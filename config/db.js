import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: "localhost",    // luego Render te dará otro
  user: "postgres",     // usuario default
  password: "tu_password",
  database: "sigepgc",  // tu nueva BD
  port: 5432
});

export default pool;
