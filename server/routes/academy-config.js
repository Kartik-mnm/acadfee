// Academy config endpoints — public + authenticated
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { auth } = require("../middleware");

// Safely get column list — roll_prefix added in a later migration so may not exist on all DBs
async function getAcademyColumns() {
  try {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'academies'
      AND column_name IN ('roll_prefix', 'phone2', 'pincode', 'state')
    `);
    return rows.map(r => r.column_name);
  } catch (e) {
    return [];
  }
}

// GET /api/academy/config?slug=xyz  (public — called on login page, must never 500)
router.get("/config", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug is required" });
  try {
    // Use only guaranteed base columns to avoid "column does not exist" crashes
    // when new columns are added via migration but DB hasn't updated yet
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, favicon_url, tagline,
             primary_color, accent_color,
             address, phone, email, website, city,
             features, plan, is_active, trial_ends_at
      FROM academies WHERE slug = $1
    `, [slug]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    if (!rows[0].is_active) return res.status(403).json({ error: "This academy account is suspended." });

    // Attempt to fetch optional newer columns separately — safe fallback if they don't exist
    let extra = { roll_prefix: "", phone2: null, state: null, pincode: null };
    try {
      const { rows: ex } = await db.query(
        `SELECT
           COALESCE(roll_prefix, '') AS roll_prefix,
           phone2,
           state,
           pincode
         FROM academies WHERE id = $1`,
        [rows[0].id]
      );
      if (ex[0]) extra = ex[0];
    } catch (e) {
      // Optional columns don't exist yet — use defaults
    }

    res.json({ ...rows[0], ...extra });
  } catch (err) {
    console.error("Academy config error:", err.message, err.stack);
    res.status(500).json({ error: "Failed to fetch academy config: " + err.message });
  }
});

// GET /api/academy/config-by-id?id=3  (public)
router.get("/config-by-id", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const { rows } = await db.query(`
      SELECT id, name, slug, logo_url, favicon_url, tagline,
             primary_color, accent_color,
             address, phone, email, website, city,
             features, plan, is_active, trial_ends_at
      FROM academies WHERE id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    if (!rows[0].is_active) return res.status(403).json({ error: "This academy account is suspended." });

    let extra = { roll_prefix: "", phone2: null, state: null, pincode: null };
    try {
      const { rows: ex } = await db.query(
        `SELECT COALESCE(roll_prefix, '') AS roll_prefix, phone2, state, pincode FROM academies WHERE id = $1`,
        [rows[0].id]
      );
      if (ex[0]) extra = ex[0];
    } catch (e) {}

    res.json({ ...rows[0], ...extra });
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

  const cleanPrefix = (roll_prefix || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4);

  try {
    // Check if roll_prefix column exists before using it
    const extraCols = await getAcademyColumns();
    const hasRollPrefix = extraCols.includes("roll_prefix");

    let queryText, queryParams;
    if (hasRollPrefix) {
      queryText = `
        UPDATE academies SET
          name=$1, tagline=$2, email=$3, phone=$4, website=$5,
          address=$6, city=$7, state=$8,
          primary_color=$9, accent_color=$10,
          logo_url=$11, favicon_url=$12, roll_prefix=$13,
          updated_at=NOW()
        WHERE id=$14
        RETURNING id, name, slug, logo_url, favicon_url, tagline,
                  primary_color, accent_color, roll_prefix, city, plan, trial_ends_at
      `;
      queryParams = [
        name.trim(), tagline || null, email || null, phone || null,
        website || null, address || null, city || null, state || null,
        primary_color || "2563EB", accent_color || "38BDF8",
        logo_url || null, favicon_url || null, cleanPrefix, aid
      ];
    } else {
      queryText = `
        UPDATE academies SET
          name=$1, tagline=$2, email=$3, phone=$4, website=$5,
          address=$6, city=$7, state=$8,
          primary_color=$9, accent_color=$10,
          logo_url=$11, favicon_url=$12,
          updated_at=NOW()
        WHERE id=$13
        RETURNING id, name, slug, logo_url, favicon_url, tagline,
                  primary_color, accent_color, city, plan, trial_ends_at
      `;
      queryParams = [
        name.trim(), tagline || null, email || null, phone || null,
        website || null, address || null, city || null, state || null,
        primary_color || "2563EB", accent_color || "38BDF8",
        logo_url || null, favicon_url || null, aid
      ];
    }

    const { rows } = await db.query(queryText, queryParams);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found." });
    res.json({ message: "Settings saved successfully!", academy: { ...rows[0], roll_prefix: cleanPrefix } });
  } catch (err) {
    console.error("Academy settings update error:", err.message);
    res.status(500).json({ error: "Failed to save settings: " + err.message });
  }
});

module.exports = router;
