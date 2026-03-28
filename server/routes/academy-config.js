// Academy config endpoints — public, called on every page load

const express = require("express");
const router  = express.Router();
const db      = require("../db");

// GET /api/academy/config?slug=xyz
router.get("/config", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug is required" });
  try {
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, favicon_url, tagline,
             primary_color, accent_color,
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

// GET /api/academy/config-by-id?id=3
// Used when user is logged in and we know their academy_id from JWT
router.get("/config-by-id", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, favicon_url, tagline,
             primary_color, accent_color,
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

module.exports = router;
