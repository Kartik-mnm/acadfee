const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  // #9 — DB connection pool tuning
  max: 10,                      // max simultaneous connections
  idleTimeoutMillis: 30000,     // close idle connections after 30s
  connectionTimeoutMillis: 2000, // fail fast if can't connect in 2s
  statement_timeout: 10000,     // kill queries running > 10s
});

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

module.exports = pool;
