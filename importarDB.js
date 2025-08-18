// importarDB.js
const { exec } = require('child_process');
require('dotenv').config();

const importCommand = `mysql -h ${process.env.DB_HOST} -P ${process.env.DB_PORT} -u ${process.env.DB_USER} --password="${process.env.DB_PASSWORD}" --ssl-mode=REQUIRED ${process.env.DB_NAME} < sql/basedatos.sql`;

exec(importCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error al importar: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`⚠️ STDERR: ${stderr}`);
    return;
  }
  console.log(`✅ Importación completada: ${stdout}`);
});
