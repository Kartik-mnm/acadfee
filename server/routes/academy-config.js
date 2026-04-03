// Academy config endpoints — public + authenticated
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { auth } = require("../middleware");

// GET /api/academy/config?slug=xyz  (public)
router.get("/config", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug is required" });
  try {
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, favicon_url, tagline,
             primary_color, accent_color, roll_prefix,
             address, phone, phone2, email, website, city, state,
             features, plan, is_active, trial_ends_at
      FROM academies WHERE slug = $1
    `, [slug]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    if (!rows[0].is_active) return res.status(403).json({ error: "This academy account is suspended." });
    res.json(rows[0]);
  } catch (err) {
    console.error("Academy config error:", err.message);
    res.status(500).json({ error: "Failed to fetch academy config" });
  }
});

// GET /api/academy/config-by-id?id=3  (public)
router.get("/config-by-id", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, favicon_url, tagline,
             primary_color, accent_color, roll_prefix,
             address, phone, phone2, email, website, city, state,
             features, plan, is_active, trial_ends_at
      FROM academies WHERE id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    if (!rows[0].is_active) return res.status(403).json({ error: "This academy account is suspended." });
    res.json(rows[0]);
  } catch (err) {
    console.error("Academy config-by-id error:", err.message);
    res.status(500).json({ error: "Failed to fetch academy config" });
  }
});

// PUT /api/academy/settings  (authenticated — super_admin only)
router.put("/settings", auth, async (req, res) => {
  if (req.user.role !== "super_admin")
    return res.status(403).json({ error: "Only super admins can update academy settings." });
  const aid = req.academyId;
  if (!aid) return res.status(400).json({ error: "No academy linked to your account." });

  const {
    name, tagline, email, phone, website, address, city, state,
    primary_color, accent_color, logo_url, favicon_url, roll_prefix
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: "Academy name is required." });

  // Sanitise roll_prefix: uppercase letters/digits, max 4 chars
  const cleanPrefix = (roll_prefix || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4);

  try {
    const { rows } = await db.query(`
      UPDATE academies SET
        name          = $1,
        tagline       = $2,
        email         = $3,
        phone         = $4,
        website       = $5,
        address       = $6,
        city          = $7,
        state         = $8,
        primary_color = $9,
        accent_color  = $10,
        logo_url      = $11,
        favicon_url   = $12,
        roll_prefix   = $13,
        updated_at    = NOW()
      WHERE id = $14
      RETURNING id, name, slug, logo_url, favicon_url, tagline,
                primary_color, accent_color, roll_prefix, city, plan, trial_ends_at
    `, [
      name.trim(), tagline || null, email || null, phone || null,
      website || null, address || null, city || null, state || null,
      primary_color || "2563EB", accent_color || "38BDF8",
      logo_url || null, favicon_url || null, cleanPrefix,
      aid
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found." });
    res.json({ message: "Settings saved successfully!", academy: rows[0] });
  } catch (err) {
    console.error("Academy settings update error:", err.message);
    res.status(500).json({ error: "Failed to save settings." });
  }
});

module.exports = router;
