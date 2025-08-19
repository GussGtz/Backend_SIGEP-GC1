// controllers/comentariosController.js
const pool = require('../config/db');

const AREAS = ['ventas', 'contabilidad', 'produccion'];

// GET /api/pedidos/comentario/:pedidoId/:area  (individual)
const obtenerComentario = async (req, res) => {
  const { pedidoId, area } = req.params;
  const id = parseInt(pedidoId, 10);
  const areaKey = (area || '').toLowerCase();

  if (!id || !AREAS.includes(areaKey)) {
    return res.status(400).json({ message: 'Parámetros inválidos (pedidoId/area)' });
  }

  try {
    const result = await pool.query(
      'SELECT comentarios FROM pedido_estatus WHERE pedido_id = $1 AND area = $2',
      [id, areaKey]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró comentario' });
    }

    return res.json(result.rows[0]); // { comentarios: "..." }
  } catch (err) {
    console.error('[ERROR obtenerComentario]', err);
    return res.status(500).json({ message: 'Error al obtener comentario', error: err.message });
  }
};

// GET /api/pedidos/comentario/:pedidoId  (todos del pedido)
const obtenerComentariosPorPedido = async (req, res) => {
  const { pedidoId } = req.params;
  const id = parseInt(pedidoId, 10);

  if (!id) return res.status(400).json({ message: 'pedidoId inválido' });

  try {
    const result = await pool.query(
      `SELECT area, comentarios
       FROM pedido_estatus
       WHERE pedido_id = $1
         AND comentarios IS NOT NULL
         AND comentarios <> ''`,
      [id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[ERROR obtenerComentariosPorPedido]', err);
    return res.status(500).json({ message: 'Error al obtener comentarios', error: err.message });
  }
};

// PUT /api/pedidos/comentario/:pedidoId/:area
const actualizarComentario = async (req, res) => {
  const { pedidoId, area } = req.params;
  const { comentario } = req.body;

  const id = parseInt(pedidoId, 10);
  const areaKey = (area || '').toLowerCase();

  if (!id || !AREAS.includes(areaKey)) {
    return res.status(400).json({ message: 'Parámetros inválidos (pedidoId/area)' });
  }
  if (comentario === undefined || comentario === null) {
    return res.status(400).json({ message: 'Comentario requerido' });
  }

  try {
    const result = await pool.query(
      'UPDATE pedido_estatus SET comentarios = $1 WHERE pedido_id = $2 AND area = $3',
      [String(comentario).trim(), id, areaKey]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró estatus para actualizar comentario' });
    }

    return res.json({ message: 'Comentario actualizado correctamente' });
  } catch (err) {
    console.error('[ERROR actualizarComentario]', err);
    return res.status(500).json({ message: 'Error al actualizar comentario', error: err.message });
  }
};

// DELETE /api/pedidos/comentario/:pedidoId/:area
const eliminarComentario = async (req, res) => {
  const { pedidoId, area } = req.params;
  const id = parseInt(pedidoId, 10);
  const areaKey = (area || '').toLowerCase();

  if (!id || !AREAS.includes(areaKey)) {
    return res.status(400).json({ message: 'Parámetros inválidos (pedidoId/area)' });
  }

  try {
    const result = await pool.query(
      'UPDATE pedido_estatus SET comentarios = NULL WHERE pedido_id = $1 AND area = $2',
      [id, areaKey]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró estatus para eliminar comentario' });
    }

    return res.json({ message: 'Comentario eliminado correctamente' });
  } catch (err) {
    console.error('[ERROR eliminarComentario]', err);
    return res.status(500).json({ message: 'Error al eliminar comentario', error: err.message });
  }
};

module.exports = {
  obtenerComentario,
  obtenerComentariosPorPedido,
  actualizarComentario,
  eliminarComentario,
};
