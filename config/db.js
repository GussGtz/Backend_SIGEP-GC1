// config/db.js
const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://sigep_gc_user:RihmF80BMzubBhhfrpocQgr9hpEUV7RH@dpg-d2ho2cndiees738f6c30-a.oregon-postgres.render.com/sigep_gc?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[PG POOL ERROR]', err);
});

module.exports = pool;
