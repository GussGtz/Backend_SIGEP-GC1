// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');
const { verifyToken } = require('../middlewares/authMiddleware');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// ================== CONFIG ==================
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = process.env.COOKIE_NAME || 'token';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://frontend-sigep-gc.onrender.com';

// ================== REGISTRO ==================
router.post('/register', async (req, res) => {
  const { nombre, email, password, role_id, departamento } = req.body;

  try {
    if (!departamento || !['ventas', 'contabilidad', 'produccion'].includes(departamento)) {
      return res.status(400).json({ message: 'Departamento inválido o no proporcionado' });
    }

    const existe = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
    if (existe.rowCount > 0) {
      return res.status(400).json({ message: 'Usuario ya registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const rolAsignado = [1, 2].includes(+role_id) ? +role_id : 2;

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, role_id, departamento)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, role_id, departamento`,
      [nombre, email, hash, rolAsignado, departamento]
    );

    const user = result.rows[0];
    const token = generateToken({
      id: user.id,
      role_id: user.role_id,
      departamento: user.departamento,
      email: user.email
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({ user });
  } catch (err) {
    console.error('💥 Error en register:', err);
    return res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
});

// ================== LOGIN ==================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }

    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = generateToken({
      id: user.id,
      role_id: user.role_id,
      departamento: user.departamento,
      email: user.email
    });

    // ✅ Cookie JWT segura y persistente
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role_id: user.role_id,
        departamento: user.departamento
      }
    });
  } catch (err) {
    console.error('💥 Error en login:', err);
    return res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
});

// ================== PERFIL / SESIÓN ==================
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, role_id, departamento FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('💥 Error en me:', err);
    return res.status(500).json({ message: 'Error al obtener usuario', error: err.message });
  }
});

// ================== LOGOUT ==================
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'none',
    path: '/',
  });
  return res.json({ success: true });
});

// ================== RECUPERAR CONTRASEÑA ==================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Correo electrónico requerido' });

  try {
    const userQuery = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (userQuery.rowCount === 0) {
      return res.status(404).json({ message: 'No existe un usuario con ese correo' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE usuarios SET reset_token = $1, reset_expires = $2 WHERE email = $3',
      [token, expires, email]
    );

    const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Restablecer contraseña - SIGEP GC</h2>
        <p>Has solicitado restablecer tu contraseña.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Restablecer contraseña</a>
        <p style="margin-top:10px;">El enlace expirará en <strong>15 minutos</strong>.</p>
      </div>
    `;

    await sendEmail(email, 'Recupera tu acceso a SIGEP GC', html);

    return res.json({ message: 'Correo de recuperación enviado correctamente.' });
  } catch (err) {
    console.error('💥 Error en forgot-password:', err);
    return res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// ================== RESTABLECER CONTRASEÑA ==================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      `SELECT id FROM usuarios WHERE reset_token = $1 AND reset_expires > NOW()`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const user = result.rows[0];
    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE usuarios
       SET password_hash = $1, reset_token = NULL, reset_expires = NULL
       WHERE id = $2`,
      [hashed, user.id]
    );

    return res.json({ message: 'Contraseña restablecida correctamente.' });
  } catch (err) {
    console.error('💥 Error en reset-password:', err);
    return res.status(500).json({ message: 'Error al restablecer la contraseña', error: err.message });
  }
});

module.exports = router;
