const router   = require("express").Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db       = require("../db");
const { auth, superAdmin, getJwtSecret } = require("../middleware");

// #4 — Rate limiting on login: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // only count failed attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
});

// Admin Login
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  try {
    const { rows } = await db.query(
      `SELECT u.*, b.name AS branch_name FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.email = $1`, [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id, role: user.role, branch_id: user.branch_id, name: user.name, branch_name: user.branch_name },
      getJwtSecret(),
      { expiresIn: "12h" }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, branch_id: user.branch_id, branch_name: user.branch_name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Student Login
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

    const valid = await bcrypt.compare(password, student.login_password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: student.id, role: "student", branch_id: student.branch_id, name: student.name },
      getJwtSecret(),
      { expiresIn: "12h" }
    );
    res.json({
      token,
      user: {
        id: student.id, name: student.name, email: student.email,
        role: "student", branch_id: student.branch_id,
        branch_name: student.branch_name, batch_name: student.batch_name
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// #36 — Student logout: clear FCM token for this specific device so it no longer receives notifications
router.post("/student-logout", auth, async (req, res) => {
  try {
    const { student_id, token, type } = req.body;
    if (!student_id || !token) return res.status(400).json({ error: "student_id and token required" });

    // Security: students can only clear their own token
    if (req.user.role === "student" && req.user.id !== parseInt(student_id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const col = type === "parent" ? "parent_fcm_token" : "fcm_token";

    // Only clear the token if it matches the stored one (this device's token)
    await db.query(
      `UPDATE students SET ${col} = NULL WHERE id = $1 AND ${col} = $2`,
      [student_id, token]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create user (super admin only)
router.post("/users", auth, superAdmin, async (req, res) => {
  const { name, email, password, role, branch_id } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, password_hint, role, branch_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, branch_id`,
      [name, email, hash, password, role, branch_id || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List users
router.get("/users", auth, superAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.password_hint, b.name AS branch_name
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id`
  );
  res.json(rows);
});

// Delete user
router.delete("/users/:id", auth, superAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ error: "Cannot delete your own account!" });
  await db.query("DELETE FROM users WHERE id=$1", [id]);
  res.json({ success: true });
});

// Reset user password
router.patch("/users/:id/password", auth, superAdmin, async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await db.query("UPDATE users SET password=$1, password_hint=$2 WHERE id=$3", [hash, password, req.params.id]);
  res.json({ success: true });
});

// Set student portal password (admin only)
router.post("/set-student-password", auth, async (req, res) => {
  const { student_id, password, enabled } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE students SET login_password=$1, login_enabled=$2 WHERE id=$3`,
      [hash, enabled !== false, student_id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
