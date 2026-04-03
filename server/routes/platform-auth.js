const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const db       = require("../db");
const { authenticatePlatformOwner } = require("../middleware");

function getPlatformSecret() {
  return process.env.JWT_SECRET || "fallback_secret";
}

// Ensure branding columns exist
db.query("ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS favicon_url TEXT").catch(() => {});
db.query("ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS logo_url TEXT").catch(() => {});

// POST /platform/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  try {
    const { rows } = await db.query(
      "SELECT * FROM platform_admins WHERE email = $1", [email.toLowerCase().trim()]
    );
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash)))
      return res.status(401).json({ error: "Invalid email or password" });
    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: "platform_owner" },
      getPlatformSecret(),
      { expiresIn: "7d" }
    );
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (e) {
    console.error("Platform login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /platform/auth/change-password
router.post("/change-password", authenticatePlatformOwner, async (req, res) => {
  const { current, newPassword } = req.body;
  if (!current || !newPassword)
    return res.status(400).json({ error: "current and newPassword are required" });
  if (newPassword.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const { rows } = await db.query(
      "SELECT * FROM platform_admins WHERE id = $1", [req.platformAdmin.id]
    );
    if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash)))
      return res.status(401).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE platform_admins SET password_hash=$1 WHERE id=$2", [hash, req.platformAdmin.id]);
    res.json({ message: "Password updated successfully" });
  } catch (e) {
    console.error("Change password error:", e.message);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// GET /platform/auth/branding  (authenticated — full details)
router.get("/branding", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT favicon_url, logo_url FROM platform_admins WHERE id=$1",
      [req.platformAdmin.id]
    );
    res.json(rows[0] || { favicon_url: null, logo_url: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /platform/auth/branding  (authenticated — save to DB)
router.put("/branding", authenticatePlatformOwner, async (req, res) => {
  const { favicon_url, logo_url } = req.body;
  try {
    await db.query(
      "UPDATE platform_admins SET favicon_url=$1, logo_url=$2 WHERE id=$3",
      [favicon_url || null, logo_url || null, req.platformAdmin.id]
    );
    res.json({ message: "Branding saved", favicon_url, logo_url });
  } catch (e) {
    console.error("Save branding error:", e.message);
    res.status(500).json({ error: "Failed to save branding" });
  }
});

// GET /platform/auth/public-branding  (NO auth — for index.html on page load)
// Returns only the favicon and logo URLs so any new browser can apply them
router.get("/public-branding", async (req, res) => {
  try {
    // Return branding for the first (and only) platform admin
    const { rows } = await db.query(
      "SELECT favicon_url, logo_url FROM platform_admins ORDER BY id LIMIT 1"
    );
    const data = rows[0] || {};
    // Only return URLs if they're real Cloudinary URLs — not nulls or empty
    res.json({
      favicon_url: data.favicon_url || null,
      logo_url:    data.logo_url    || null,
    });
  } catch (e) {
    res.status(500).json({ favicon_url: null, logo_url: null });
  }
});

module.exports = router;
