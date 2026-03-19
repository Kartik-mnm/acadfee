const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

// Export both pool (for transactions) and query shorthand
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
