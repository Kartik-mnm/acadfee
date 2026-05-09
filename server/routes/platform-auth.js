// ── Platform Auth Routes ───────────────────────────────────────────────────────────────────
const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const db       = require("../db");
const { authenticatePlatformOwner } = require("../middleware");

function getPlatformSecret() {
  return process.env.JWT_SECRET || "fallback_secret";
}

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

    // Check if viewer access is allowed
    if (admin.role === "viewer") {
      const { rows: settings } = await db.query("SELECT value FROM platform_settings WHERE key = 'allow_viewer_access'");
      const allowed = settings[0] ? settings[0].value : true;
      if (!allowed) {
        return res.status(403).json({ error: "Access Denied: Co-founder access is currently disabled by the Platform Owner." });
      }
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: admin.role || "platform_owner" },
      getPlatformSecret(),
      { expiresIn: "7d" }
    );
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role || "platform_owner" } });
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

// ── Platform branding (favicon + logo stored in DB) ──────────────────────────────────────────
db.query(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS favicon_url TEXT`).catch(() => {});
db.query(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS logo_url TEXT`).catch(() => {});

// GET /platform/auth/branding  — authenticated
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

// PUT /platform/auth/branding  — authenticated
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

// GET /platform/auth/public-branding  — PUBLIC (no auth)
// Called by AcademyContext when no academy slug is stored.
// Returns the platform owner's favicon/logo for generic branding.
// Must never 500 — client silently ignores errors.
router.get("/public-branding", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT favicon_url, logo_url FROM platform_admins ORDER BY id ASC LIMIT 1"
    );
    // Also fetch viewer access status for the login screen
    const { rows: settings } = await db.query("SELECT value FROM platform_settings WHERE key = 'allow_viewer_access'");
    const viewerAllowed = settings[0] ? settings[0].value : true;

    res.json({ 
      favicon_url: rows[0]?.favicon_url || null, 
      logo_url: rows[0]?.logo_url || null,
      viewer_allowed: viewerAllowed
    });
  } catch (e) {
    // Silently return empty — client falls back to defaults
    res.json({ favicon_url: null, logo_url: null, viewer_allowed: true });
  }
});

// ── Platform Settings (Allow/Disallow Co-Founder) ──────────────────────────────────────────

// GET /platform/auth/settings — authenticated (Super Admin Only)
router.get("/settings", authenticatePlatformOwner, async (req, res) => {
  if (req.platformAdmin.role !== "platform_owner") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows } = await db.query("SELECT * FROM platform_settings");
    const config = {};
    rows.forEach(r => config[r.key] = r.value);
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT /platform/auth/settings — authenticated (Super Admin Only)
router.put("/settings", authenticatePlatformOwner, async (req, res) => {
  if (req.platformAdmin.role !== "platform_owner") return res.status(403).json({ error: "Access denied" });
  const { allow_viewer_access } = req.body;
  try {
    if (allow_viewer_access !== undefined) {
      await db.query(
        "INSERT INTO platform_settings (key, value) VALUES ('allow_viewer_access', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(allow_viewer_access)]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

module.exports = router;
