const express = require('express');
const router = express.Router();

// === Controladores ===
const {
  crearPedido,
  obtenerPedidos,
  actualizarEstatus,
  eliminarPedido,
  eliminarPedidosCompletados
} = require('../controllers/pedidoController');

const {
  obtenerComentario,
  actualizarComentario,
  eliminarComentario,
  obtenerComentariosPorPedido
} = require('../controllers/comentariosController');

// === Middleware de autenticación y permisos ===
const {
  verifyToken,
  isAdmin
} = require('../middlewares/authMiddleware');

// ==== 📦 PEDIDOS ====

router.get('/', verifyToken, obtenerPedidos);
router.post('/', verifyToken, isAdmin, crearPedido);
router.put('/estatus/:id', verifyToken, actualizarEstatus);
router.delete('/completados', verifyToken, isAdmin, eliminarPedidosCompletados);
router.delete('/:id', verifyToken, isAdmin, eliminarPedido);

// ==== 💬 COMENTARIOS ====

// Obtener comentario individual por área (para editar/eliminar)
router.get('/comentario/:pedidoId/:area', verifyToken, obtenerComentario);
router.put('/comentario/:pedidoId/:area', verifyToken, actualizarComentario);
router.delete('/comentario/:pedidoId/:area', verifyToken, eliminarComentario);

// ✅ Obtener TODOS los comentarios visibles del pedido (para todos los usuarios)
router.get('/comentarios/:pedidoId', verifyToken, obtenerComentariosPorPedido); // plural (recomendado)
router.get('/comentario/:pedidoId', verifyToken, obtenerComentariosPorPedido);  // singular (para frontend actual)

module.exports = router;
