// Academy config endpoints — public + authenticated
// CRITICAL: /api/academy/config is called on every page load (login page).
// It must NEVER return 500. All DB errors must be caught and return 200 with fallback.
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { auth } = require("../middleware");

// Safe column fetch — only used in PUT /settings
async function columnExists(table, column) {
  try {
    const { rows } = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
      [table, column]
    );
    return rows.length > 0;
  } catch { return false; }
}

// Build a safe SELECT for academies that works regardless of which optional
// columns exist in this particular DB instance.
// Strategy: select only the hard-coded base columns that existed at launch,
// then try to add optional ones via a second query with its own try/catch.
const BASE_COLS = `
  id, name, slug, logo_url, favicon_url, tagline,
  primary_color, accent_color,
  address, phone, email, website, city,
  features, plan, is_active, trial_ends_at,
  max_students, max_branches, created_at, updated_at
`;

async function fetchOptionalCols(id) {
  // Each optional column in its own try/catch so one missing column
  // can never crash the whole request.
  const result = {};
  const optionals = [
    { key: "roll_prefix", fallback: "" },
    { key: "phone2",      fallback: null },
    { key: "state",       fallback: null },
    { key: "pincode",     fallback: null },
  ];
  for (const { key, fallback } of optionals) {
    try {
      const { rows } = await db.query(
        `SELECT ${key} FROM academies WHERE id = $1`, [id]
      );
      result[key] = rows[0]?.[key] ?? fallback;
    } catch {
      result[key] = fallback;
    }
  }
  return result;
}

// GET /api/academy/config?slug=xyz  (public — MUST NEVER 500)
router.get("/config", async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug is required" });
  try {
    const { rows } = await db.query(
      `SELECT ${BASE_COLS} FROM academies WHERE slug = $1`, [slug]
    );
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    if (!rows[0].is_active) return res.status(403).json({ error: "This academy account is suspended." });
    const extra = await fetchOptionalCols(rows[0].id);
    return res.json({ ...rows[0], ...extra });
  } catch (err) {
    console.error("[academy-config] /config error:", err.message);
    // Return 503 (not 500) with a clear message — client will fall back to cached data
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again." });
  }
});

// GET /api/academy/config-by-id?id=3  (public — MUST NEVER 500)
router.get("/config-by-id", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const { rows } = await db.query(
      `SELECT ${BASE_COLS} FROM academies WHERE id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    if (!rows[0].is_active) return res.status(403).json({ error: "This academy account is suspended." });
    const extra = await fetchOptionalCols(rows[0].id);
    return res.json({ ...rows[0], ...extra });
  } catch (err) {
    console.error("[academy-config] /config-by-id error:", err.message);
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again." });
  }
});

// GET /api/academy/public-config?slug=xyz  (alias — for backwards compat)
router.get("/public-config", async (req, res) => {
  req.url = "/config";
  router.handle(req, res);
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
    .toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 4);

  // Build the UPDATE dynamically so missing optional columns never cause 500
  const setClauses = [
    "name=$1", "tagline=$2", "email=$3", "phone=$4", "website=$5",
    "address=$6", "city=$7", "state=$8",
    "primary_color=$9", "accent_color=$10",
    "logo_url=$11", "favicon_url=$12",
    "updated_at=NOW()",
  ];
  const params = [
    name.trim(), tagline || null, email || null, phone || null,
    website || null, address || null, city || null, state || null,
    primary_color || "2563EB", accent_color || "38BDF8",
    logo_url || null, favicon_url || null,
  ];

  // Only include roll_prefix if the column exists
  const hasRollPrefix = await columnExists("academies", "roll_prefix");
  if (hasRollPrefix) {
    params.push(cleanPrefix);
    setClauses.push(`roll_prefix=$${params.length}`);
  }

  params.push(aid); // WHERE id = $N
  const whereIdx = params.length;

  try {
    const { rows } = await db.query(
      `UPDATE academies SET ${setClauses.join(", ")} WHERE id=$${whereIdx} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Academy not found." });
    res.json({ message: "Settings saved successfully!", academy: { ...rows[0], roll_prefix: cleanPrefix } });
  } catch (err) {
    console.error("[academy-config] settings update error:", err.message);
    res.status(500).json({ error: "Failed to save settings: " + err.message });
  }
});

module.exports = router;
