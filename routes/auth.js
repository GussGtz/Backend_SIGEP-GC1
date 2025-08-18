// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');
const { verifyToken } = require('../middlewares/authMiddleware'); // para /me

const router = express.Router();

// ✅ Registrar nuevo usuario
const register = async (req, res) => {
  const { nombre, email, password, role_id, departamento } = req.body;

  try {
    if (!departamento || !['ventas', 'contabilidad', 'produccion'].includes(departamento)) {
      return res.status(400).json({ message: 'Departamento inválido o no proporcionado' });
    }

    // Verificar si existe el usuario
    const existe = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ message: 'Usuario ya registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const rolAsignado = [1, 2].includes(role_id) ? role_id : 2;

    // Insertar usuario y devolver el nuevo registro
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, role_id, departamento) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, email, hash, rolAsignado, departamento]
    );

    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error('💥 Error en register:', err);
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
};

// ✅ Iniciar sesión
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }

    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const users = result.rows;

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const valid = await bcrypt.compare(password, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = generateToken(users[0]);
    res.json({ user: users[0], token });
  } catch (err) {
    console.error('💥 Error en login:', err);
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
};

// ✅ Obtener datos del usuario actual
const me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, role_id, departamento FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    const users = result.rows;

    if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(users[0]);
  } catch (err) {
    console.error('💥 Error en me:', err);
    res.status(500).json({ message: 'Error al obtener usuario', error: err.message });
  }
};

/* 👇 Rutas */
router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, me);

module.exports = router;
