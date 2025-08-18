const pool = require('../config/db');

// === GET - Obtener comentario por pedido y área (individual) ===
const obtenerComentario = async (req, res) => {
  const { pedidoId, area } = req.params;

  try {
    const [result] = await pool.query(
      'SELECT comentarios FROM pedido_estatus WHERE pedido_id = ? AND area = ?',
      [pedidoId, area]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'No se encontró comentario' });
    }

    res.json(result[0]); // { comentarios: "..." }
  } catch (err) {
    console.error('[ERROR obtenerComentario]', err);
    res.status(500).json({ message: 'Error al obtener comentario', error: err.message });
  }
};

// === GET - Obtener TODOS los comentarios por pedido (visibles por todos) ===
const obtenerComentariosPorPedido = async (req, res) => {
  const { pedidoId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT area, comentarios 
       FROM pedido_estatus 
       WHERE pedido_id = ? 
         AND comentarios IS NOT NULL 
         AND comentarios != ''`,
      [pedidoId]
    );

    res.json(rows); // Ej: [ { area: 'ventas', comentarios: 'Lorem ipsum' }, ... ]
  } catch (err) {
    console.error('[ERROR obtenerComentariosPorPedido]', err);
    res.status(500).json({ message: 'Error al obtener comentarios', error: err.message });
  }
};

// === PUT - Actualizar comentario ===
const actualizarComentario = async (req, res) => {
  const { pedidoId, area } = req.params;
  const { comentario } = req.body;

  if (!comentario && comentario !== '') {
    return res.status(400).json({ message: 'Comentario requerido' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE pedido_estatus SET comentarios = ? WHERE pedido_id = ? AND area = ?',
      [comentario.trim(), pedidoId, area]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se encontró estatus para actualizar comentario' });
    }

    res.json({ message: 'Comentario actualizado correctamente' });
  } catch (err) {
    console.error('[ERROR actualizarComentario]', err);
    res.status(500).json({ message: 'Error al actualizar comentario', error: err.message });
  }
};

// === DELETE - Eliminar comentario ===
const eliminarComentario = async (req, res) => {
  const { pedidoId, area } = req.params;

  try {
    const [result] = await pool.query(
      'UPDATE pedido_estatus SET comentarios = NULL WHERE pedido_id = ? AND area = ?',
      [pedidoId, area]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se encontró estatus para eliminar comentario' });
    }

    res.json({ message: 'Comentario eliminado correctamente' });
  } catch (err) {
    console.error('[ERROR eliminarComentario]', err);
    res.status(500).json({ message: 'Error al eliminar comentario', error: err.message });
  }
};

module.exports = {
  obtenerComentario,
  obtenerComentariosPorPedido,
  actualizarComentario,
  eliminarComentario
};
