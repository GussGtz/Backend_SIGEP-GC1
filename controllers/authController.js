// Importamos librerías y módulos necesarios
// const bcrypt = require('bcrypt'); // Librería para encriptar contraseñas
// const pool = require('../config/db'); // Conexión a la base de datos (MySQL o PostgreSQL)
// const generateToken = require('../utils/generateToken'); // Función para generar token JWT

// ✅ Registrar nuevo usuario (admin puede enviar el rol y departamento)
// const register = async (req, res) => {
//   // Extraemos los datos enviados en el body de la petición
//   const { nombre, email, password, role_id, departamento } = req.body;

//   try {
//     // 🔹 Validación del campo departamento
//     // Se valida que el departamento exista y esté dentro de los permitidos
//     if (!departamento || !['ventas', 'contabilidad', 'produccion'].includes(departamento)) {
//       return res.status(400).json({ message: 'Departamento inválido o no proporcionado' });
//     }

//     // 🔹 Comprobación si ya existe un usuario con el mismo correo
//     // Se consulta la base de datos buscando coincidencia de email
//     const [existe] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
//     if (existe.length > 0) {
//       return res.status(400).json({ message: 'Usuario ya registrado' });
//     }

//     // 🔹 Encriptación de la contraseña usando bcrypt
//     // El número 10 es el "saltRounds" que define el costo de la encriptación
//     const hash = await bcrypt.hash(password, 10);

//     // 🔹 Validación y asignación de rol
//     // Si el role_id recibido es válido (1 o 2) se asigna, de lo contrario se asigna el rol 2 (ej: usuario básico)
//     // const rolAsignado = [1, 2].includes(role_id) ? role_id : 2;

//     // 🔹 Inserción del nuevo usuario en la base de datos
//     // Guardamos nombre, correo, contraseña encriptada, rol y departamento
//     const [result] = await pool.query(
//       'INSERT INTO usuarios (nombre, email, password_hash, role_id, departamento) VALUES (?, ?, ?, ?, ?)',
//       [nombre, email, hash, rolAsignado, departamento]
//     );

//     // 🔹 Recuperación del usuario recién insertado usando el id generado automáticamente
//     const [user] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);

//     // 🔹 Generación de un token JWT para autenticación inmediata
//     const token = generateToken(user[0]);

//     // 🔹 Envío de respuesta al cliente con los datos del usuario y el token
//     res.json({ user: user[0], token });

//   } catch (err) {
//     // 🔹 En caso de error en el servidor o base de datos, devolvemos un error 500
//     res.status(500).json({ message: 'Error en el servidor', error: err.message });
//   }
// };

// ✅ Iniciar sesión
// const login = async (req, res) => {
//   // Extraemos email y password del body de la petición
//   const { email, password } = req.body;

//   try {
//     // 🔹 Buscar el usuario en la base de datos usando el correo
//     const [users] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);

//     // Si no existe un usuario con ese email, devolvemos error 404
//     if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

//     // 🔹 Validación de la contraseña
//     // Se compara la contraseña enviada con la contraseña encriptada almacenada en la BD
//     const valid = await bcrypt.compare(password, users[0].password_hash);

//     // Si la contraseña no coincide, devolvemos error 401 (no autorizado)
//     if (!valid) return res.status(401).json({ message: 'Contraseña incorrecta' });

//     // 🔹 Generación de token JWT si la contraseña es correcta
//     const token = generateToken(users[0]);

//     // 🔹 Respuesta con los datos del usuario autenticado y su token
//     res.json({ user: users[0], token });

//   } catch (err) {
//     // 🔹 Si ocurre un error, respondemos con estado 500
//     res.status(500).json({ message: 'Error en el servidor', error: err.message });
//   }
// };

// ✅ Obtener datos del usuario actual
// const me = async (req, res) => {
//   try {
//     // 🔹 Consultar en la base de datos los datos del usuario actual
//     // El id se obtiene del token decodificado (req.user.id)
//     const [users] = await pool.query(
//       'SELECT id, nombre, email, role_id, departamento FROM usuarios WHERE id = ?',
//       [req.user.id]
//     );

//     // Si no se encuentra el usuario, devolvemos error 404
//     if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

//     // 🔹 Responder con los datos básicos del usuario
//     res.json(users[0]);

//   } catch (err) {
//     // 🔹 En caso de error, respondemos con mensaje y detalle del error
//     res.status(500).json({ message: 'Error al obtener usuario', error: err.message });
//   }
// };

// 🔹 Exportamos las funciones para poder utilizarlas en las rutas
// module.exports = { register, login, me };
