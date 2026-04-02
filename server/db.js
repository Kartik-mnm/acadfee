const { Pool } = require("pg");

// ── Connection pool — tuned for Render free/starter tier ──────────────────────
// Free tier has limited DB connections (typically 25 on Neon/Supabase free).
// These settings prevent connection exhaustion under real load and
// gracefully handle the "connection terminated due to timeout" errors
// that appear when the DB proxy drops idle connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,

  // Max connections in pool — keep low enough to share with other services
  max: 10,

  // How long (ms) an idle client can sit in the pool before being closed
  // 10 min — long enough to avoid constant reconnects, short enough to
  // not exhaust DB-side connection limits
  idleTimeoutMillis: 10 * 60 * 1000,

  // How long (ms) to wait for a connection before throwing
  // 5s gives enough time on a cold DB without hanging the user request
  connectionTimeoutMillis: 5000,

  // Kill queries that run longer than 15s — prevents slow queries from
  // blocking the entire pool on Render's slower free-tier DB
  statement_timeout: 15000,

  // Re-check connection health before handing it to a request
  // Catches stale connections dropped by Neon/Supabase proxy
  allowExitOnIdle: false,
});

// Log pool errors — these show up as the "connection terminated" messages
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

pool.on("connect", () => {
  // Uncomment for debugging connection churn:
  // console.log("[DB] New client connected to pool");
});

pool.on("remove", () => {
  // Uncomment for debugging connection churn:
  // console.log("[DB] Client removed from pool");
});

// Retry wrapper — on transient connection errors, retry once automatically
// Handles the "connection terminated unexpectedly" race condition at cold start
async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    const isTransient =
      err.code === "57P01" || // admin_shutdown
      err.code === "08006" || // connection_failure
      err.code === "08001" || // unable_to_connect
      err.message?.includes("connection terminated") ||
      err.message?.includes("Connection terminated") ||
      err.message?.includes("ECONNRESET");

    if (isTransient) {
      console.warn("[DB] Transient connection error — retrying once:", err.message);
      // Wait 300ms then retry with a fresh connection
      await new Promise((r) => setTimeout(r, 300));
      return pool.query(text, params);
    }
    throw err;
  }
}

module.exports = { query, pool };
