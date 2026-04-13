const { Pool } = require("pg");

// ── Connection pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  // FIX: reduce idle timeout so the pool proactively closes stale connections
  // rather than holding onto dead ones. 4 min < DB's idle timeout.
  idleTimeoutMillis:       4 * 60 * 1000, // 4 min — proactively close idle connections
  connectionTimeoutMillis: 8000,           // 8s to get a connection
  statement_timeout:       20000,          // 20s max query time
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
  // Don't crash — the query retry wrapper handles reconnection
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
    msg.includes("too many connections") ||
    msg.includes("Client has encountered a connection error")
  );
}

// ── Query with retry ──────────────────────────────────────────────────────────
// Retries up to 3 times with exponential backoff on transient DB errors.
async function query(text, params) {
  const MAX_RETRIES = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      lastErr = err;
      if (isTransientError(err) && attempt < MAX_RETRIES) {
        const delay = attempt * 600; // 600ms, 1200ms
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
async function checkConnection() {
  const MAX_ATTEMPTS = 5;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("[DB] \u2705 Database connection verified");
      return true;
    } catch (err) {
      console.warn(`[DB] Connection check attempt ${i}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (i < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, i * 1000));
    }
  }
  console.error("[DB] \u274c Could not connect to database after", MAX_ATTEMPTS, "attempts");
  return false;
}

// ── DB heartbeat ──────────────────────────────────────────────────────────────
// Runs a lightweight SELECT every 4 minutes to keep the DB connection alive.
// Render's free PostgreSQL drops idle connections after ~5 minutes.
// This prevents the "connection terminated unexpectedly" 500 errors that users
// see when the first request after a quiet period hits a dead connection.
function startDbHeartbeat() {
  const INTERVAL_MS = 4 * 60 * 1000; // every 4 minutes
  setInterval(async () => {
    try {
      await pool.query("SELECT 1");
      // Uncomment for debugging:
      // console.log("[DB] \u2665 heartbeat ok");
    } catch (err) {
      console.warn("[DB] Heartbeat failed (will auto-recover on next query):", err.message);
    }
  }, INTERVAL_MS);
  console.log("[DB] \u2705 DB heartbeat started \u2014 pinging every 4 min to keep connections alive");
}

module.exports = { query, pool, checkConnection, startDbHeartbeat };
