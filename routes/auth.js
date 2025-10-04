// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = process.env.COOKIE_NAME || 'token';

// POST /api/auth/register
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

    // Opcional: setear cookie también al registrar
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({ user }); // ya no es necesario devolver "token"
  } catch (err) {
    console.error('💥 Error en register:', err);
    return res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
});

// POST /api/auth/login
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

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({ user: { id: user.id, nombre: user.nombre, email: user.email, role_id: user.role_id, departamento: user.departamento } });
  } catch (err) {
    console.error('💥 Error en login:', err);
    return res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
});

// GET /api/auth/me
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

// POST /api/auth/logout  (opcional)
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'none',
    path: '/',
  });
  return res.json({ success: true });
});


// Importamos módulos necesarios para este flujo
const crypto = require('crypto');              // Para generar tokens únicos y seguros
const sendEmail = require('../utils/sendEmail'); // Nuestra función reutilizable que usa Resend

// 🔹 Endpoint: POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  // Validación básica del campo email
  if (!email) {
    return res.status(400).json({ message: 'Correo electrónico requerido' });
  }

  try {
    // 1️⃣ Verificamos si el usuario existe en la base de datos
    const userQuery = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);

    if (userQuery.rowCount === 0) {
      return res.status(404).json({ message: 'No existe un usuario con ese correo' });
    }

    // 2️⃣ Generamos un token aleatorio y fecha de expiración
    const token = crypto.randomBytes(32).toString('hex');  // Token único y difícil de adivinar
    const expires = new Date(Date.now() + 15 * 60 * 1000); // Expira en 15 minutos

    // 3️⃣ Guardamos el token y expiración en la base de datos
    await pool.query(
      'UPDATE usuarios SET reset_token = $1, reset_expires = $2 WHERE email = $3',
      [token, expires, email]
    );

    // 4️⃣ Construimos el enlace de recuperación (enlace hacia el frontend)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    // 5️⃣ Estructuramos el contenido del correo
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Restablecer contraseña - SIGEP GC</h2>
        <p>Has solicitado restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <a href="${resetUrl}"
          style="display:inline-block; background:#0d6efd; color:#fff;
          padding:10px 20px; text-decoration:none; border-radius:6px;">
          Restablecer contraseña
        </a>
        <p style="margin-top:10px;">Este enlace expirará en <strong>15 minutos</strong>.</p>
        <p style="font-size:0.9rem; color:#777;">Si no solicitaste este cambio, ignora este mensaje.</p>
      </div>
    `;

    // 6️⃣ Enviamos el correo
    await sendEmail(email, 'Recupera tu acceso a SIGEP GC', html);

    // 7️⃣ Respondemos al cliente
    return res.json({ message: 'Correo de recuperación enviado correctamente.' });
  } catch (err) {
    console.error('💥 Error en forgot-password:', err);
    return res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});
// 🔹 Endpoint: POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  // Validaciones básicas
  if (!token || !password) {
    return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
  }

  try {
    // 1️⃣ Buscamos al usuario con ese token válido y no expirado
    const result = await pool.query(
      `SELECT id, email, reset_expires
       FROM usuarios
       WHERE reset_token = $1 AND reset_expires > NOW()`,
      [token]
    );

    // Si no hay resultados, token inválido o expirado
    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const user = result.rows[0];

    // 2️⃣ Encriptamos la nueva contraseña
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 10);

    // 3️⃣ Actualizamos la contraseña y limpiamos los campos de token
    await pool.query(
      `UPDATE usuarios
       SET password_hash = $1, reset_token = NULL, reset_expires = NULL
       WHERE id = $2`,
      [hashed, user.id]
    );

    // 4️⃣ Respuesta al cliente
    return res.json({ message: 'Contraseña restablecida correctamente.' });
  } catch (err) {
    console.error('💥 Error en reset-password:', err);
    return res.status(500).json({ message: 'Error al restablecer la contraseña', error: err.message });
  }
});

module.exports = router;