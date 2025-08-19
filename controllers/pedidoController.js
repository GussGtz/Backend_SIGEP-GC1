// controllers/pedidoController.js
const pool = require('../config/db');

// POST /api/pedidos  (admin)
const crearPedido = async (req, res) => {
  const { numero_pedido, fecha_entrega } = req.body;
  const userId = req.user.id;

  try {
    const existe = await pool.query('SELECT 1 FROM pedidos WHERE numero_pedido = $1', [numero_pedido]);
    if (existe.rowCount > 0) {
      return res.status(400).json({ message: 'Ese número de pedido ya existe' });
    }

    await pool.query('BEGIN');

    const nuevo = await pool.query(
      `INSERT INTO pedidos (numero_pedido, fecha_entrega, creado_por)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [numero_pedido, fecha_entrega, userId]
    );

    const pedidoId = nuevo.rows[0].id;
    const areas = ['contabilidad', 'ventas', 'produccion'];

    await Promise.all(
      areas.map(area =>
        pool.query('INSERT INTO pedido_estatus (pedido_id, area) VALUES ($1, $2)', [pedidoId, area])
      )
    );

    await pool.query('COMMIT');

    return res.status(201).json({ message: 'Pedido creado correctamente', pedidoId });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[ERROR crearPedido]', err);
    return res.status(500).json({ message: 'Error al crear el pedido', error: err.message });
  }
};

// GET /api/pedidos?completado=true|false
const obtenerPedidos = async (req, res) => {
  const filtroCompletado = req.query.completado;

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.numero_pedido,
        TO_CHAR(p.fecha_entrega, 'YYYY-MM-DD')  AS fecha_entrega,
        TO_CHAR(p.fecha_creacion, 'YYYY-MM-DD HH24:MI') AS fecha_creacion,
        e.area,
        e.estatus,
        e.comentarios
      FROM pedidos p
      LEFT JOIN pedido_estatus e ON p.id = e.pedido_id
      ORDER BY p.fecha_creacion DESC
    `);

    const pedidosMap = new Map();

    for (const row of result.rows) {
      if (!pedidosMap.has(row.id)) {
        pedidosMap.set(row.id, {
          id: row.id,
          numero_pedido: row.numero_pedido,
          fecha_entrega: row.fecha_entrega,
          fecha_creacion: row.fecha_creacion,
          estatus: { ventas: null, contabilidad: null, produccion: null },
          completados: 0,
          total_estatus: 0,
        });
      }

      const pedido = pedidosMap.get(row.id);

      if (row.area) {
        pedido.total_estatus += 1;
        if (row.estatus === 'completado') pedido.completados += 1;
        pedido.estatus[row.area] = {
          estado: row.estatus || 'Sin estatus',
          comentarios: row.comentarios || '',
        };
      }
    }

    let pedidos = Array.from(pedidosMap.values()).map(p => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      fecha_entrega: p.fecha_entrega,
      fecha_creacion: p.fecha_creacion,
      estatus: p.estatus,
      completado: p.total_estatus > 0 && p.completados === p.total_estatus,
    }));

    if (filtroCompletado === 'true') {
      pedidos = pedidos.filter(p => p.completado);
    } else if (filtroCompletado === 'false') {
      pedidos = pedidos.filter(p => !p.completado);
    }

    // No enviar "completado"
    pedidos = pedidos.map(({ completado, ...rest }) => rest);

    return res.json(pedidos);
  } catch (err) {
    console.error('[ERROR obtenerPedidos]', err);
    return res.status(500).json({ message: 'Error al obtener los pedidos', error: err.message });
  }
};

// PUT /api/pedidos/estatus/:id
const actualizarEstatus = async (req, res) => {
  const pedidoId = req.params.id;
  const { area, estatus, comentarios } = req.body;

  if (!pedidoId || !area || !estatus) {
    return res.status(400).json({ message: 'Faltan campos requeridos' });
  }

  const areaValida = ['ventas', 'contabilidad', 'produccion'].includes((area || '').toLowerCase());
  const estatusValido = ['pendiente', 'en proceso', 'completado'].includes((estatus || '').toLowerCase());
  if (!areaValida) return res.status(400).json({ message: 'Área no permitida' });
  if (!estatusValido) return res.status(400).json({ message: 'Estatus no válido' });

  try {
    const result = await pool.query(
      `UPDATE pedido_estatus
       SET estatus = $1, comentarios = $2
       WHERE pedido_id = $3 AND area = $4`,
      [estatus.toLowerCase(), comentarios || '', pedidoId, area.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No se encontró estatus para ese pedido y área' });
    }

    return res.json({ message: `✅ Estatus actualizado para ${area} correctamente.` });
  } catch (err) {
    console.error('[ERROR actualizarEstatus]', err);
    return res.status(500).json({ message: 'Error del servidor al actualizar', error: err.message });
  }
};

// DELETE /api/pedidos/:id  (admin)
const eliminarPedido = async (req, res) => {
  const pedidoId = req.params.id;

  try {
    await pool.query('BEGIN');

    await pool.query('DELETE FROM pedido_estatus WHERE pedido_id = $1', [pedidoId]);
    const del = await pool.query('DELETE FROM pedidos WHERE id = $1', [pedidoId]);

    if (del.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    await pool.query('COMMIT');
    return res.json({ message: '✅ Pedido eliminado correctamente' });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[ERROR eliminarPedido]', err);
    return res.status(500).json({ message: 'Error al eliminar el pedido', error: err.message });
  }
};

// DELETE /api/pedidos/completados  (admin)
const eliminarPedidosCompletados = async (req, res) => {
  try {
    const comp = await pool.query(`
      SELECT p.id
      FROM pedidos p
      JOIN pedido_estatus e ON p.id = e.pedido_id
      GROUP BY p.id
      HAVING COUNT(*) = SUM( (e.estatus = 'completado')::int )
    `);

    if (comp.rowCount === 0) {
      return res.status(200).json({ message: 'No hay pedidos completados para eliminar.' });
    }

    const ids = comp.rows.map(r => r.id);

    await pool.query('BEGIN');
    await pool.query('DELETE FROM pedido_estatus WHERE pedido_id = ANY($1::int[])', [ids]);
    await pool.query('DELETE FROM pedidos WHERE id = ANY($1::int[])', [ids]);
    await pool.query('COMMIT');

    return res.json({ message: `✅ ${ids.length} pedidos completados eliminados correctamente.` });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[ERROR eliminarPedidosCompletados]', err);
    return res.status(500).json({ message: 'Error al eliminar pedidos completados', error: err.message });
  }
};

module.exports = {
  crearPedido,
  obtenerPedidos,
  actualizarEstatus,
  eliminarPedido,
  eliminarPedidosCompletados,
};
