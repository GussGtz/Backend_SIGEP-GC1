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

module.exports = router;
