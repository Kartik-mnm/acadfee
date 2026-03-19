const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const db = require("../db");
const { auth, superAdmin, getJwtSecret } = require("../middleware");

// ── Create refresh_tokens table on startup if it doesn't exist ────────────────
async function initRefreshTokensTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        token      TEXT NOT NULL UNIQUE,
        payload    JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`);
    console.log("✅ refresh_tokens table ready");
  } catch (e) {
    console.error("Failed to init refresh_tokens table:", e.message);
  }
}
initRefreshTokensTable();

// ── Cleanup expired tokens once per hour ─────────────────────────────────────
setInterval(async () => {
  try {
    const { rowCount } = await db.query("DELETE FROM refresh_tokens WHERE expires_at < NOW()");
    if (rowCount > 0) console.log(`[Auth] Cleaned up ${rowCount} expired refresh token(s)`);
  } catch (e) {
    console.error("[Auth] Cleanup error:", e.message);
  }
}, 60 * 60 * 1000);

// ── Rate limiting on login endpoints ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
});

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Issue a new token pair and persist the refresh token to DB ───────────────
async function issueTokenPair(payload) {
  const accessToken  = jwt.sign(payload, getJwtSecret(), { expiresIn: "12h" });
  const refreshToken = crypto.randomBytes(40).toString("hex");
  const expiresAt    = new Date(Date.now() + REFRESH_TTL_MS);

  await db.query(
    `INSERT INTO refresh_tokens (token, payload, expires_at) VALUES ($1, $2, $3)`,
    [refreshToken, JSON.stringify(payload), expiresAt]
  );

  return { accessToken, refreshToken };
}

// ── Admin Login ───────────────────────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const { rows } = await db.query(
      `SELECT u.*, b.name AS branch_name FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.email = $1`,
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid email or password" });

    const payload = {
      id: user.id, role: user.role,
      branch_id: user.branch_id, name: user.name,
      branch_name: user.branch_name,
    };
    const { accessToken, refreshToken } = await issueTokenPair(payload);
    res.json({
      token: accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, branch_id: user.branch_id, branch_name: user.branch_name },
    });
  } catch (e) {
    console.error("Login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Student Login ─────────────────────────────────────────────────────────────
router.post("/student-login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       WHERE s.email = $1 AND s.login_enabled = true`,
      [email]
    );
    const student = rows[0];
    if (!student) return res.status(401).json({ error: "Invalid email or student portal not enabled" });
    if (!student.login_password) return res.status(401).json({ error: "Student portal not set up" });
    if (!(await bcrypt.compare(password, student.login_password)))
      return res.status(401).json({ error: "Invalid email or password" });

    const payload = { id: student.id, role: "student", branch_id: student.branch_id, name: student.name };
    const { accessToken, refreshToken } = await issueTokenPair(payload);
    res.json({
      token: accessToken, refreshToken,
      user: { id: student.id, name: student.name, email: student.email, role: "student", branch_id: student.branch_id, branch_name: student.branch_name, batch_name: student.batch_name },
    });
  } catch (e) {
    console.error("Student login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Refresh access token — survives server restarts/deploys ──────────────────
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  try {
    const { rows } = await db.query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
      [refreshToken]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid or expired refresh token — please log in again" });

    // Rotate: delete old token, issue new pair
    await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(rows[0].payload);
    res.json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (e) {
    console.error("Refresh error:", e.message);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// ── Logout — delete refresh token from DB ────────────────────────────────────
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]).catch(() => {});
  }
  res.json({ success: true });
});

// ── Student logout — clear FCM token + refresh token ─────────────────────────
router.post("/student-logout", auth, async (req, res) => {
  try {
    const { student_id, token, type, refreshToken } = req.body;
    if (!student_id || !token)
      return res.status(400).json({ error: "student_id and token required" });
    if (req.user.role === "student" && req.user.id !== parseInt(student_id))
      return res.status(403).json({ error: "Access denied" });
    const col = type === "parent" ? "parent_fcm_token" : "fcm_token";
    await db.query(`UPDATE students SET ${col} = NULL WHERE id = $1 AND ${col} = $2`, [student_id, token]);
    if (refreshToken) {
      await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]).catch(() => {});
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Create user — super admin only ───────────────────────────────────────────
router.post("/users", auth, superAdmin, async (req, res) => {
  const { name, email, password, role, branch_id } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "name, email, password and role are required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role, branch_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, branch_id`,
      [name, email, hash, role, branch_id || null]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create user error:", e.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ── List users — super admin only ────────────────────────────────────────────
router.get("/users", auth, superAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, b.name AS branch_name
       FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Delete user ───────────────────────────────────────────────────────────────
router.delete("/users/:id", auth, superAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ error: "Cannot delete your own account!" });
  try {
    await db.query("DELETE FROM users WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Reset user password ───────────────────────────────────────────────────────
router.patch("/users/:id/password", auth, superAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "password is required" });
    const hash = await bcrypt.hash(password, 10);
    await db.query("UPDATE users SET password=$1 WHERE id=$2", [hash, req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Set student portal password ───────────────────────────────────────────────
router.post("/set-student-password", auth, async (req, res) => {
  const { student_id, password, enabled } = req.body;
  if (!student_id || !password) return res.status(400).json({ error: "student_id and password are required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(`UPDATE students SET login_password=$1, login_enabled=$2 WHERE id=$3`, [hash, enabled !== false, student_id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Set student password error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
