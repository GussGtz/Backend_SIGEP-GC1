// config/db.js
const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://sigep_gc_6fuz_user:dV73lIdFLrQD53xHsypH2nkOh0ZW6TIy@dpg-d3db9u8dl3ps73dlnt9g-a.oregon-postgres.render.com/sigep_gc_6fuz';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[PG POOL ERROR]', err);
});

module.exports = pool;
