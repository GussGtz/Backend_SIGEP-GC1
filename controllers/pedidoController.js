const pool = require('../config/db');

// POST /api/pedidos - Solo para admins
const crearPedido = async (req, res) => {
  const { numero_pedido, fecha_entrega } = req.body;
  const userId = req.user.id;

  try {
    const [existe] = await pool.query('SELECT 1 FROM pedidos WHERE numero_pedido = ?', [numero_pedido]);
    if (existe.length > 0) return res.status(400).json({ message: 'Ese número de pedido ya existe' });

    const [pedido] = await pool.query(
      'INSERT INTO pedidos (numero_pedido, fecha_entrega, creado_por) VALUES (?, ?, ?)',
      [numero_pedido, fecha_entrega, userId]
    );

    const pedidoId = pedido.insertId;
    const areas = ['contabilidad', 'ventas', 'produccion'];

    // Insertar todos los estados en paralelo para optimizar
    await Promise.all(
      areas.map(area => pool.query('INSERT INTO pedido_estatus (pedido_id, area) VALUES (?, ?)', [pedidoId, area]))
    );

    res.status(201).json({ message: 'Pedido creado correctamente', pedidoId });
  } catch (err) {
    console.error('[ERROR crearPedido]', err);
    res.status(500).json({ message: 'Error al crear el pedido', error: err.message });
  }
};

// GET /api/pedidos?completado=true|false
const obtenerPedidos = async (req, res) => {
  const filtroCompletado = req.query.completado;

  try {
    const [pedidosRaw] = await pool.query(`
      SELECT 
        p.id, 
        p.numero_pedido, 
        DATE_FORMAT(p.fecha_entrega, '%Y-%m-%d') AS fecha_entrega,
        DATE_FORMAT(p.fecha_creacion, '%Y-%m-%d %H:%i') AS fecha_creacion,
        e.area,
        e.estatus,
        e.comentarios
      FROM pedidos p
      LEFT JOIN pedido_estatus e ON p.id = e.pedido_id
      ORDER BY p.fecha_creacion DESC
    `);

    const pedidosMap = new Map();

    for (const row of pedidosRaw) {
      if (!pedidosMap.has(row.id)) {
        pedidosMap.set(row.id, {
          id: row.id,
          numero_pedido: row.numero_pedido,
          fecha_entrega: row.fecha_entrega,
          fecha_creacion: row.fecha_creacion,
          estatus: {
            ventas: null,
            contabilidad: null,
            produccion: null
          },
          completados: 0,
          total_estatus: 0
        });
      }

      const pedido = pedidosMap.get(row.id);

      if (row.area) {
        pedido.total_estatus += 1;
        if (row.estatus === 'completado') pedido.completados += 1;
        pedido.estatus[row.area] = {
          estado: row.estatus || 'Sin estatus',
          comentarios: row.comentarios || ''
        };
      }
    }

    let pedidos = Array.from(pedidosMap.values()).map(p => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      fecha_entrega: p.fecha_entrega,
      fecha_creacion: p.fecha_creacion,
      estatus: p.estatus,
      completado: p.total_estatus > 0 && p.completados === p.total_estatus
    }));

    if (filtroCompletado === 'true') {
      pedidos = pedidos.filter(p => p.completado);
    } else if (filtroCompletado === 'false') {
      pedidos = pedidos.filter(p => !p.completado);
    }

    // Se elimina la propiedad 'completado' para no enviarla
    pedidos = pedidos.map(({ completado, ...rest }) => rest);

    res.json(pedidos);
  } catch (err) {
    console.error('[ERROR obtenerPedidos]', err);
    res.status(500).json({ message: 'Error al obtener los pedidos', error: err.message });
  }
};

// PUT /api/pedidos/estatus/:id - Solo colaboradores
const actualizarEstatus = async (req, res) => {
  const pedidoId = req.params.id;
  const { area, estatus, comentarios } = req.body;

  if (!pedidoId || !area || !estatus) {
    return res.status(400).json({ message: 'Faltan campos requeridos' });
  }

  const areaValida = ['ventas', 'contabilidad', 'produccion'].includes(area.toLowerCase());
  const estatusValido = ['pendiente', 'en proceso', 'completado'].includes(estatus.toLowerCase());

  if (!areaValida) return res.status(400).json({ message: 'Área no permitida' });
  if (!estatusValido) return res.status(400).json({ message: 'Estatus no válido' });

  try {
    const [result] = await pool.query(
      'UPDATE pedido_estatus SET estatus = ?, comentarios = ? WHERE pedido_id = ? AND area = ?',
      [estatus.toLowerCase(), comentarios || '', pedidoId, area.toLowerCase()]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se encontró estatus para ese pedido y área' });
    }

    res.json({ message: `✅ Estatus actualizado para ${area} correctamente.` });
  } catch (err) {
    console.error('[ERROR actualizarEstatus]', err);
    res.status(500).json({ message: 'Error del servidor al actualizar', error: err.message });
  }
};

// DELETE /api/pedidos/:id - Solo para admins
const eliminarPedido = async (req, res) => {
  const pedidoId = req.params.id;

  try {
    // Primero elimina estados relacionados
    await pool.query('DELETE FROM pedido_estatus WHERE pedido_id = ?', [pedidoId]);
    // Luego elimina el pedido
    const [result] = await pool.query('DELETE FROM pedidos WHERE id = ?', [pedidoId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    res.json({ message: '✅ Pedido eliminado correctamente' });
  } catch (err) {
    console.error('[ERROR eliminarPedido]', err);
    res.status(500).json({ message: 'Error al eliminar el pedido', error: err.message });
  }
};

// DELETE /api/pedidos/completados - Solo para admins
const eliminarPedidosCompletados = async (req, res) => {
  try {
    // Busca pedidos cuyo estatus de todas las áreas está "completado"
    const [completados] = await pool.query(`
      SELECT p.id
      FROM pedidos p
      JOIN pedido_estatus e ON p.id = e.pedido_id
      GROUP BY p.id
      HAVING COUNT(*) = SUM(e.estatus = 'completado')
    `);

    if (completados.length === 0) {
      return res.status(200).json({ message: 'No hay pedidos completados para eliminar.' });
    }

    const ids = completados.map(p => p.id);

    // Usar transacción para evitar inconsistencias
    await pool.query('START TRANSACTION');

    await pool.query('DELETE FROM pedido_estatus WHERE pedido_id IN (?)', [ids]);
    await pool.query('DELETE FROM pedidos WHERE id IN (?)', [ids]);

    await pool.query('COMMIT');

    res.json({ message: `✅ ${ids.length} pedidos completados eliminados correctamente.` });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[ERROR eliminarPedidosCompletados]', err);
    res.status(500).json({ message: 'Error al eliminar pedidos completados', error: err.message });
  }
};

module.exports = {
  crearPedido,
  obtenerPedidos,
  actualizarEstatus,
  eliminarPedido,
  eliminarPedidosCompletados
};
