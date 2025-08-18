const bcrypt = require('bcrypt');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');

// ✅ Registrar nuevo usuario (admin puede enviar el rol y departamento)
const register = async (req, res) => {
  const { nombre, email, password, role_id, departamento } = req.body;

  try {
    // Validación mínima
    if (!departamento || !['ventas', 'contabilidad', 'produccion'].includes(departamento)) {
      return res.status(400).json({ message: 'Departamento inválido o no proporcionado' });
    }

    const [existe] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (existe.length > 0) {
      return res.status(400).json({ message: 'Usuario ya registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const rolAsignado = [1, 2].includes(role_id) ? role_id : 2;

    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, role_id, departamento) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, hash, rolAsignado, departamento]
    );

    const [user] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);

    const token = generateToken(user[0]);
    res.json({ user: user[0], token });

  } catch (err) {
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
};

// ✅ Iniciar sesión
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, users[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Contraseña incorrecta' });

    const token = generateToken(users[0]);
    res.json({ user: users[0], token });

  } catch (err) {
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
  }
};

// ✅ Obtener datos del usuario actual
const me = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, nombre, email, role_id, departamento FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario', error: err.message });
  }
};

module.exports = { register, login, me };
