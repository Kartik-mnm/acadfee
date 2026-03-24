const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const db = require("../db");
const { auth, superAdmin, getJwtSecret } = require("../middleware");

async function initTables() {
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
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_device_limit INT DEFAULT 2`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id)`);
    console.log("✅ auth tables ready");
  } catch (e) {
    console.error("Failed to init auth tables:", e.message);
  }
}
initTables();

setInterval(async () => {
  try {
    const { rowCount } = await db.query("DELETE FROM refresh_tokens WHERE expires_at < NOW()");
    if (rowCount > 0) console.log(`[Auth] Cleaned up ${rowCount} expired refresh token(s)`);
  } catch (e) {
    console.error("[Auth] Cleanup error:", e.message);
  }
}, 60 * 60 * 1000);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
});

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  try {
    const { rows } = await db.query(
      `SELECT u.*, b.name AS branch_name FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id WHERE u.email = $1`, [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid email or password" });

    const payload = {
      id: user.id, role: user.role,
      branch_id: user.branch_id, name: user.name,
      branch_name: user.branch_name,
      academy_id: user.academy_id || 1
    };
    const { accessToken, refreshToken } = await issueTokenPair(payload);
    res.json({
      token: accessToken, refreshToken,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, branch_id: user.branch_id,
        branch_name: user.branch_name,
        academy_id: user.academy_id || 1
      }
    });
  } catch (e) {
    console.error("Login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Student Login ─────────────────────────────────────────────────────────────
router.post("/student-login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  try {
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       WHERE s.email = $1 AND s.login_enabled = true`, [email]
    );
    const student = rows[0];
    if (!student) return res.status(401).json({ error: "Invalid email or student portal not enabled" });
    if (!student.login_password) return res.status(401).json({ error: "Student portal not set up" });
    if (!(await bcrypt.compare(password, student.login_password)))
      return res.status(401).json({ error: "Invalid email or password" });

    const deviceLimit = student.login_device_limit ?? 2;
    const { rows: activeTokens } = await db.query(
      `SELECT COUNT(*) AS cnt FROM refresh_tokens
       WHERE (payload->>'id')::int = $1 AND payload->>'role' = 'student' AND expires_at > NOW()`,
      [student.id]
    );
    const activeCount = parseInt(activeTokens[0].cnt);
    if (activeCount >= deviceLimit) {
      return res.status(403).json({
        error: `Maximum ${deviceLimit} device(s) already logged in.`,
        code: "DEVICE_LIMIT_REACHED",
        active_devices: activeCount,
        limit: deviceLimit,
      });
    }

    const payload = {
      id: student.id, role: "student",
      branch_id: student.branch_id, name: student.name,
      academy_id: student.academy_id || 1
    };
    const { accessToken, refreshToken } = await issueTokenPair(payload);
    res.json({
      token: accessToken, refreshToken,
      user: {
        id: student.id, name: student.name, email: student.email, role: "student",
        branch_id: student.branch_id, branch_name: student.branch_name,
        batch_name: student.batch_name, academy_id: student.academy_id || 1
      },
    });
  } catch (e) {
    console.error("Student login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Session management ────────────────────────────────────────────────────────
router.get("/student-sessions/:studentId", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows } = await db.query(
      `SELECT id, created_at, expires_at,
              EXTRACT(EPOCH FROM (expires_at - NOW())) AS seconds_left
       FROM refresh_tokens
       WHERE (payload->>'id')::int = $1 AND payload->>'role' = 'student' AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.params.studentId]
    );
    const { rows: student } = await db.query(
      `SELECT login_device_limit FROM students WHERE id=$1`, [req.params.studentId]
    );
    res.json({ sessions: rows, device_limit: student[0]?.login_device_limit ?? 2 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/student-sessions/:tokenId", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    await db.query("DELETE FROM refresh_tokens WHERE id=$1", [req.params.tokenId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/student-sessions-all/:studentId", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rowCount } = await db.query(
      `DELETE FROM refresh_tokens WHERE (payload->>'id')::int = $1 AND payload->>'role' = 'student'`,
      [req.params.studentId]
    );
    res.json({ success: true, revoked: rowCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/student-device-limit/:studentId", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { limit } = req.body;
  if (!limit || limit < 1 || limit > 10) return res.status(400).json({ error: "limit must be 1–10" });
  try {
    await db.query("UPDATE students SET login_device_limit=$1 WHERE id=$2", [limit, req.params.studentId]);
    res.json({ success: true, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  try {
    const { rows } = await db.query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`, [refreshToken]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid or expired refresh token" });
    await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(rows[0].payload);
    res.json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (e) {
    console.error("Refresh error:", e.message);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]).catch(() => {});
  res.json({ success: true });
});

router.post("/student-logout", auth, async (req, res) => {
  try {
    const { student_id, token, type, refreshToken } = req.body;
    if (!student_id || !token) return res.status(400).json({ error: "student_id and token required" });
    if (req.user.role === "student" && req.user.id !== parseInt(student_id))
      return res.status(403).json({ error: "Access denied" });
    const col = type === "parent" ? "parent_fcm_token" : "fcm_token";
    await db.query(`UPDATE students SET ${col} = NULL WHERE id = $1 AND ${col} = $2`, [student_id, token]);
    if (refreshToken) await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── User management ───────────────────────────────────────────────────────────
router.post("/users", auth, superAdmin, async (req, res) => {
  const { name, email, password, role, branch_id } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: "name, email, password and role are required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role, branch_id, academy_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, branch_id, academy_id`,
      [name, email, hash, role, branch_id || null, req.user.academy_id || 1]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create user error:", e.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.get("/users", auth, superAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, b.name AS branch_name
       FROM users u LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.academy_id = $1
       ORDER BY u.id`,
      [req.user.academy_id || 1]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FIXED: DELETE scoped to caller's academy_id — cannot touch other academies
router.delete("/users/:id", auth, superAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: "Cannot delete your own account!" });
  try {
    // Only delete if the user belongs to the same academy as the caller
    const { rowCount } = await db.query(
      "DELETE FROM users WHERE id=$1 AND academy_id=$2",
      [targetId, req.user.academy_id || 1]
    );
    if (rowCount === 0) return res.status(404).json({ error: "User not found in your academy" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/users/:id/password", auth, superAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "password is required" });
    const hash = await bcrypt.hash(password, 10);
    // Also scoped to caller's academy
    const { rowCount } = await db.query(
      "UPDATE users SET password=$1 WHERE id=$2 AND academy_id=$3",
      [hash, req.params.id, req.user.academy_id || 1]
    );
    if (rowCount === 0) return res.status(404).json({ error: "User not found in your academy" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
