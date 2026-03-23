// GET /api/academy/config?slug=nishchay
// Public endpoint — called by frontend on every page load
// Returns academy branding + features for the given slug

const express = require("express");
const router  = express.Router();
const db      = require("../db");

router.get("/config", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug is required" });
  try {
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, tagline,
             primary_color, accent_color,
             address, phone, phone2, email, website, city, state,
             features, plan, is_active
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

module.exports = router;
