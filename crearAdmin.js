const bcrypt = require('bcrypt');
const pool = require('./config/db'); // asegúrate que la ruta sea correcta

(async () => {
  try {
    const nombre = 'Samuel Gutierrez';
    const email = 'contabilidad@glasscaribe.com';
    const password = 'Santiago16';
     const departamento = "contabilidad";
    const hash = await bcrypt.hash(password, 10);
   
    // Verificar si ya existe
    const [existente] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (existente.length > 0) {
      console.log('❌ Ya existe un usuario con ese correo.');
      return;
    }

    // Insertar nuevo admin
    await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, role_id, activo) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, hash, 1, 1]
    );

    console.log('✅ Usuario administrador creado exitosamente.');
    console.log(`Correo: ${email}`);
    console.log(`Contraseña: ${password}`);
  } catch (error) {
    console.error('❌ Error al crear el usuario admin:', error.message);
  } finally {
    pool.end();
  }
})();
