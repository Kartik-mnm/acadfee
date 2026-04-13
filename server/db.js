const { Pool } = require("pg");

// ── Connection pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis:     10 * 60 * 1000, // 10 min idle before closing
  connectionTimeoutMillis: 8000,         // 8s to get a connection
  statement_timeout:     20000,          // 20s max query time
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

// ── Transient error detection ─────────────────────────────────────────────────
function isTransientError(err) {
  if (!err) return false;
  const transientCodes = [
    "57P01", // admin_shutdown
    "08006", // connection_failure
    "08001", // unable_to_connect
    "08P01", // protocol_violation
    "53300", // too_many_connections
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
  ];
  if (transientCodes.includes(err.code)) return true;
  const msg = err.message || "";
  return (
    msg.includes("connection terminated") ||
    msg.includes("Connection terminated") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("connection timeout") ||
    msg.includes("the database system is starting up") ||
    msg.includes("too many connections")
  );
}

// ── Query with retry ──────────────────────────────────────────────────────────
// Retries up to 3 times with exponential backoff on transient DB errors.
// This handles the "dead connection" problem on Render free-tier restarts.
async function query(text, params) {
  const MAX_RETRIES = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      lastErr = err;
      if (isTransientError(err) && attempt < MAX_RETRIES) {
        const delay = attempt * 500; // 500ms, 1000ms
        console.warn(`[DB] Transient error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ── Startup health check ──────────────────────────────────────────────────────
// Called once on server start to verify DB is reachable BEFORE accepting requests.
// Prevents the first user request from hitting a cold/dead connection.
async function checkConnection() {
  const MAX_ATTEMPTS = 5;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("[DB] \u2705 Database connection verified");
      return true;
    } catch (err) {
      console.warn(`[DB] Connection check attempt ${i}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (i < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, i * 1000)); // 1s, 2s, 3s, 4s
      }
    }
  }
  console.error("[DB] \u274c Could not connect to database after", MAX_ATTEMPTS, "attempts");
  return false;
}

module.exports = { query, pool, checkConnection };
