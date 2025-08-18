const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (user) => {
  return jwt.sign({
    id: user.id,
    role_id: user.role_id, // 👈 este nombre sí es usado en el frontend
    nombre: user.nombre,
    departamento: user.departamento
  }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

module.exports = generateToken;
