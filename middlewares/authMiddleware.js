// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const COOKIE_NAME = process.env.COOKIE_NAME || 'token';

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearer = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    const cookieToken = req.cookies?.[COOKIE_NAME] || null;
    const token = cookieToken || bearer;

    if (!token) return res.status(401).json({ message: 'Token requerido' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Normaliza forma de usuario
    // Esperamos { id, role_id, departamento, ... } o { sub: id, ... }
    const id = decoded.id ?? decoded.sub;
    req.user = { ...decoded, id };
    if (!req.user.id) {
      return res.status(401).json({ message: 'Token inválido (sin id)' });
    }
    next();
  } catch (e) {
    return res.status(403).json({ message: 'Token inválido' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || +req.user.role_id !== 1) {
    return res.status(403).json({ message: 'Solo administradores pueden realizar esta acción' });
  }
  next();
};

module.exports = { verifyToken, isAdmin };
