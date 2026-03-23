// ── Platform Owner Auth Routes ─────────────────────────────────────────────────
// POST /platform/auth/login
// GET  /platform/auth/me

const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const db      = require("../db");

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

// POST /platform/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const { rows } = await db.query(
      "SELECT * FROM platform_admins WHERE email = $1 AND is_active = true",
      [email]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    await db.query(
      "UPDATE platform_admins SET last_login_at = NOW() WHERE id = $1",
      [rows[0].id]
    );

    const token = jwt.sign(
      { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: "platform_owner", academy_id: null },
      getJwtSecret(),
      { expiresIn: "12h" }
    );

    res.json({ token, admin: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (err) {
    console.error("Platform login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /platform/auth/me
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== "platform_owner")
      return res.status(403).json({ error: "Not a platform owner" });
    const { rows } = await db.query(
      "SELECT id, email, name, last_login_at FROM platform_admins WHERE id = $1",
      [decoded.id]
    );
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
