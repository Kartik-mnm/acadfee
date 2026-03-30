// ── Platform API Routes ─────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const bcrypt  = require("bcryptjs");
const { authenticatePlatformOwner } = require("../middleware");

const DEFAULT_FEATURES = {
  attendance: true, tests: true, expenses: true, admissions: true,
  notifications: true, id_cards: true, qr_scanner: true, reports: true
};

async function audit(adminName, action, target, details = {}) {
  db.query(
    `INSERT INTO platform_audit_log (admin_name, action, target, details) VALUES ($1,$2,$3,$4)`,
    [adminName, action, target, JSON.stringify(details)]
  ).catch(() => {});
}

// ── Revenue log table (auto-create) ────────────────────────────────────────────
db.query(`
  CREATE TABLE IF NOT EXISTS platform_revenue (
    id          SERIAL PRIMARY KEY,
    academy_id  INT REFERENCES academies(id) ON DELETE SET NULL,
    academy_name VARCHAR(200),
    amount      NUMERIC(10,2) NOT NULL,
    plan        VARCHAR(30),
    note        TEXT,
    paid_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// GET /platform/academies  (exclude pure leads from main list)
router.get("/academies", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.id, a.name, a.slug, a.logo_url, a.favicon_url, a.tagline,
             a.city, a.state, a.plan, a.is_active,
             a.max_students, a.max_branches, a.primary_color, a.accent_color,
             a.phone, a.phone2, a.email, a.website, a.address,
             a.features, a.trial_ends_at, a.created_at, a.updated_at,
             COUNT(DISTINCT s.id)::int AS student_count,
             COUNT(DISTINCT b.id)::int AS branch_count
      FROM academies a
      LEFT JOIN students s ON s.academy_id = a.id
      LEFT JOIN branches b ON b.academy_id = a.id
      WHERE a.plan != 'lead'
      GROUP BY a.id ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch academies" });
  }
});

// GET /platform/leads  (only lead entries)
router.get("/leads", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name, phone, email, created_at, is_active, plan, slug
      FROM academies
      WHERE plan = 'lead'
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// PATCH /platform/leads/:id/convert  — promote a lead to a real trial academy
router.patch("/leads/:id/convert", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows: lead } = await db.query("SELECT * FROM academies WHERE id=$1 AND plan='lead'", [req.params.id]);
    if (!lead[0]) return res.status(404).json({ error: "Lead not found" });
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      `UPDATE academies SET plan='trial', is_active=true, trial_ends_at=$1, updated_at=NOW() WHERE id=$2`,
      [trialEndsAt, req.params.id]
    );
    audit(req.platformAdmin?.name, "CONVERT_LEAD", lead[0].name, { id: req.params.id });
    res.json({ message: `Lead converted to trial. Expires ${new Date(trialEndsAt).toLocaleDateString("en-IN")}.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to convert lead" });
  }
});

// DELETE /platform/leads/:id  — discard a lead
router.delete("/leads/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT name FROM academies WHERE id=$1 AND plan='lead'", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Lead not found" });
    await db.query("DELETE FROM academies WHERE id=$1", [req.params.id]);
    audit(req.platformAdmin?.name, "DISCARD_LEAD", rows[0].name);
    res.json({ message: "Lead discarded." });
  } catch (err) {
    res.status(500).json({ error: "Failed to discard lead" });
  }
});

// GET /platform/academies/:id
router.get("/academies/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, COUNT(DISTINCT s.id)::int AS student_count, COUNT(DISTINCT b.id)::int AS branch_count
       FROM academies a LEFT JOIN students s ON s.academy_id=a.id LEFT JOIN branches b ON b.academy_id=a.id
       WHERE a.id=$1 GROUP BY a.id`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to fetch academy" }); }
});

// POST /platform/academies
router.post("/academies", authenticatePlatformOwner, async (req, res) => {
  const { name, slug, tagline, city, state, pincode, phone, phone2, email, website,
          address, logo_url, favicon_url, primary_color="2563EB", accent_color="38BDF8",
          plan="basic", max_students=200, max_branches=3, features } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });
  try {
    const { rows } = await db.query(`
      INSERT INTO academies (name,slug,tagline,city,state,pincode,phone,phone2,email,website,address,
        logo_url,favicon_url,primary_color,accent_color,plan,max_students,max_branches,features)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *
    `, [name, slug.toLowerCase().replace(/\s+/g,"-"), tagline, city, state, pincode,
        phone, phone2, email, website, address, logo_url||null, favicon_url||null,
        primary_color, accent_color, plan, max_students, max_branches,
        JSON.stringify(features || DEFAULT_FEATURES)]);
    audit(req.platformAdmin?.name, "CREATE_ACADEMY", name, { slug });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Slug already exists." });
    console.error(err);
    res.status(500).json({ error: "Failed to create academy" });
  }
});

// PUT /platform/academies/:id
router.put("/academies/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows: cur } = await db.query("SELECT * FROM academies WHERE id=$1", [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: "Academy not found" });
    const c = cur[0]; const b = req.body;
    const mergedFeatures = { ...DEFAULT_FEATURES };
    if (c.features) Object.keys(c.features).forEach(k => { mergedFeatures[k] = c.features[k] !== false; });
    if (b.features) Object.keys(b.features).forEach(k => { mergedFeatures[k] = Boolean(b.features[k]); });
    const { rows } = await db.query(`
      UPDATE academies SET
        name=$1,tagline=$2,city=$3,state=$4,pincode=$5,phone=$6,phone2=$7,email=$8,website=$9,
        address=$10,primary_color=$11,accent_color=$12,logo_url=$13,favicon_url=$14,plan=$15,
        max_students=$16,max_branches=$17,features=$18::jsonb,is_active=$19,trial_ends_at=$20,updated_at=NOW()
      WHERE id=$21 RETURNING *
    `, [
      b.name??c.name, b.tagline??c.tagline, b.city??c.city, b.state??c.state, b.pincode??c.pincode,
      b.phone??c.phone, b.phone2??c.phone2, b.email??c.email, b.website??c.website, b.address??c.address,
      b.primary_color??c.primary_color, b.accent_color??c.accent_color,
      b.logo_url!==undefined?(b.logo_url||null):c.logo_url,
      b.favicon_url!==undefined?(b.favicon_url||null):c.favicon_url,
      b.plan??c.plan, b.max_students??c.max_students, b.max_branches??c.max_branches,
      JSON.stringify(mergedFeatures),
      b.is_active!==undefined?Boolean(b.is_active):c.is_active,
      b.trial_ends_at!==undefined?(b.trial_ends_at||null):c.trial_ends_at,
      req.params.id
    ]);
    audit(req.platformAdmin?.name, "UPDATE_ACADEMY", cur[0].name, { changed: Object.keys(b) });
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT academy error:", err.message);
    res.status(500).json({ error: "Failed to update academy" });
  }
});

// PATCH /platform/academies/:id/extend  — quick extend trial by N days
router.patch("/academies/:id/extend", authenticatePlatformOwner, async (req, res) => {
  const days = parseInt(req.body.days) || 30;
  try {
    const { rows: cur } = await db.query("SELECT name, trial_ends_at FROM academies WHERE id=$1", [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: "Academy not found" });
    // Extend from today if expired, or from current end date if still valid
    const base = cur[0].trial_ends_at && new Date(cur[0].trial_ends_at) > new Date()
      ? new Date(cur[0].trial_ends_at)
      : new Date();
    const newDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await db.query(
      `UPDATE academies SET trial_ends_at=$1, is_active=true, plan=CASE WHEN plan='lead' THEN 'trial' ELSE plan END, updated_at=NOW() WHERE id=$2`,
      [newDate.toISOString(), req.params.id]
    );
    audit(req.platformAdmin?.name, "EXTEND_TRIAL", cur[0].name, { days, new_expiry: newDate.toISOString().split("T")[0] });
    res.json({ message: `Extended by ${days} days. New expiry: ${newDate.toLocaleDateString("en-IN")}.`, new_expiry: newDate.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to extend trial" });
  }
});

// DELETE /platform/academies/:id/hard
router.delete("/academies/:id/hard", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT name FROM academies WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    await db.query("DELETE FROM academies WHERE id=$1", [req.params.id]);
    audit(req.platformAdmin?.name, "DELETE_ACADEMY_PERMANENT", rows[0].name, { id: req.params.id });
    res.json({ message: `Academy "${rows[0].name}" permanently deleted.` });
  } catch (err) {
    console.error("Hard delete error:", err.message);
    res.status(500).json({ error: "Failed to delete academy: " + err.message });
  }
});

// DELETE /platform/academies/:id — soft suspend
router.delete("/academies/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT name FROM academies WHERE id=$1", [req.params.id]);
    await db.query("UPDATE academies SET is_active=false, updated_at=NOW() WHERE id=$1", [req.params.id]);
    audit(req.platformAdmin?.name, "SUSPEND_ACADEMY", rows[0]?.name);
    res.json({ message: "Academy suspended successfully" });
  } catch (err) { res.status(500).json({ error: "Failed to suspend academy" }); }
});

// POST /platform/academies/:id/admin
router.post("/academies/:id/admin", authenticatePlatformOwner, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email and password are required" });
  try {
    const { rows: acadRows } = await db.query("SELECT id,name FROM academies WHERE id=$1", [req.params.id]);
    if (!acadRows[0]) return res.status(404).json({ error: "Academy not found" });
    const { rows: existing } = await db.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing[0]) return res.status(409).json({ error: "A user with this email already exists" });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name,email,password,role,academy_id) VALUES ($1,$2,$3,'super_admin',$4) RETURNING id,name,email,role,academy_id`,
      [name, email, hash, req.params.id]
    );
    audit(req.platformAdmin?.name, "CREATE_ADMIN", acadRows[0].name, { email });
    res.status(201).json({ message: `Admin created for ${acadRows[0].name}`, admin: rows[0] });
  } catch (err) {
    console.error("Create academy admin error:", err.message);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

// GET /platform/academies/:id/admins
router.get("/academies/:id/admins", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id,name,email,role,created_at FROM users WHERE academy_id=$1 AND role='super_admin' ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch admins" }); }
});

// GET /platform/academies/:id/stats
router.get("/academies/:id/stats", authenticatePlatformOwner, async (req, res) => {
  try {
    const aid = req.params.id;
    const [students, branches, fees] = await Promise.all([
      db.query("SELECT COUNT(*) FROM students WHERE academy_id=$1", [aid]),
      db.query("SELECT COUNT(*) FROM branches WHERE academy_id=$1", [aid]),
      db.query(`SELECT COALESCE(SUM(p.amount),0) AS total FROM payments p JOIN students s ON s.id=p.student_id WHERE s.academy_id=$1 AND p.created_at>=date_trunc('month',NOW())`, [aid]),
    ]);
    res.json({
      student_count:   parseInt(students.rows[0].count),
      branch_count:    parseInt(branches.rows[0].count),
      fees_this_month: parseFloat(fees.rows[0].total),
    });
  } catch (err) { res.status(500).json({ error: "Failed to fetch stats" }); }
});

// GET /platform/stats
router.get("/stats", authenticatePlatformOwner, async (req, res) => {
  try {
    const [acad, students, revenue] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active=true AND plan!='lead')::int AS active, COUNT(*) FILTER (WHERE is_active=false)::int AS inactive, COUNT(*) FILTER (WHERE plan='lead')::int AS leads FROM academies`),
      db.query("SELECT COUNT(*)::int FROM students"),
      db.query(`SELECT COALESCE(SUM(amount),0) AS total_all_time, COALESCE(SUM(amount) FILTER (WHERE paid_on >= date_trunc('month', CURRENT_DATE)),0) AS this_month FROM platform_revenue`),
    ]);
    res.json({
      academies:        acad.rows[0],
      total_students:   students.rows[0].count,
      revenue_all_time: parseFloat(revenue.rows[0].total_all_time),
      revenue_this_month: parseFloat(revenue.rows[0].this_month),
    });
  } catch (err) { res.status(500).json({ error: "Failed to fetch platform stats" }); }
});

// ── Revenue log endpoints ──────────────────────────────────────────────────────

// GET /platform/revenue
router.get("/revenue", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, a.name AS current_academy_name
      FROM platform_revenue r
      LEFT JOIN academies a ON a.id = r.academy_id
      ORDER BY r.paid_on DESC, r.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch revenue" }); }
});

// POST /platform/revenue  — manually log a payment received
router.post("/revenue", authenticatePlatformOwner, async (req, res) => {
  const { academy_id, academy_name, amount, plan, note, paid_on } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount is required and must be > 0" });
  try {
    // Look up academy name if id provided
    let name = academy_name || "—";
    if (academy_id && !academy_name) {
      const { rows } = await db.query("SELECT name FROM academies WHERE id=$1", [academy_id]);
      if (rows[0]) name = rows[0].name;
    }
    const { rows } = await db.query(`
      INSERT INTO platform_revenue (academy_id, academy_name, amount, plan, note, paid_on)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [academy_id || null, name, amount, plan || null, note || null, paid_on || new Date().toISOString().split("T")[0]]);
    audit(req.platformAdmin?.name, "LOG_REVENUE", name, { amount, plan });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Log revenue error:", err.message);
    res.status(500).json({ error: "Failed to log revenue" });
  }
});

// DELETE /platform/revenue/:id
router.delete("/revenue/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    await db.query("DELETE FROM platform_revenue WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete revenue entry" }); }
});

// GET /platform/audit-log
router.get("/audit-log", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, admin_name, action, target, details, created_at
       FROM platform_audit_log ORDER BY created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch audit log" }); }
});

module.exports = router;
