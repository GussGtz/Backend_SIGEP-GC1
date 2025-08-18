const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://sigep_gc_user:RihmF80BMzubBhhfrpocQgr9hpEUV7RH@dpg-d2ho2cndiees738f6c30-a.oregon-postgres.render.com/sigep_gc",
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
