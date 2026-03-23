// ── Platform API Routes ────────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const bcrypt  = require("bcryptjs");
const { authenticatePlatformOwner } = require("../middleware");

// GET /platform/academies
router.get("/academies", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        a.id, a.name, a.slug, a.logo_url, a.city, a.plan,
        a.is_active, a.max_students, a.max_branches, a.primary_color, a.created_at,
        COUNT(DISTINCT s.id) AS student_count,
        COUNT(DISTINCT b.id) AS branch_count
      FROM academies a
      LEFT JOIN students s ON s.academy_id = a.id
      LEFT JOIN branches b ON b.academy_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch academies" });
  }
});

// GET /platform/academies/:id
router.get("/academies/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM academies WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch academy" });
  }
});

// POST /platform/academies
router.post("/academies", authenticatePlatformOwner, async (req, res) => {
  const {
    name, slug, tagline, city, state, pincode,
    phone, phone2, email, website, address,
    primary_color = "2563EB", accent_color = "38BDF8",
    plan = "basic", max_students = 200, max_branches = 3, features
  } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

  const defaultFeatures = {
    attendance: true, tests: true, expenses: true, admissions: true,
    notifications: true, id_cards: true, qr_scanner: true, reports: true
  };
  try {
    const { rows } = await db.query(`
      INSERT INTO academies (
        name, slug, tagline, city, state, pincode,
        phone, phone2, email, website, address,
        primary_color, accent_color, plan, max_students, max_branches, features
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      name, slug.toLowerCase().replace(/\s+/g, "-"),
      tagline, city, state, pincode, phone, phone2, email, website, address,
      primary_color, accent_color, plan, max_students, max_branches,
      JSON.stringify(features || defaultFeatures)
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Slug already exists. Choose a different one." });
    console.error(err);
    res.status(500).json({ error: "Failed to create academy" });
  }
});

// PUT /platform/academies/:id
router.put("/academies/:id", authenticatePlatformOwner, async (req, res) => {
  const {
    name, tagline, city, state, pincode, phone, phone2, email, website, address,
    primary_color, accent_color, logo_url, plan, max_students, max_branches, features, is_active
  } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE academies SET
        name          = COALESCE($1,  name),
        tagline       = COALESCE($2,  tagline),
        city          = COALESCE($3,  city),
        state         = COALESCE($4,  state),
        pincode       = COALESCE($5,  pincode),
        phone         = COALESCE($6,  phone),
        phone2        = COALESCE($7,  phone2),
        email         = COALESCE($8,  email),
        website       = COALESCE($9,  website),
        address       = COALESCE($10, address),
        primary_color = COALESCE($11, primary_color),
        accent_color  = COALESCE($12, accent_color),
        logo_url      = COALESCE($13, logo_url),
        plan          = COALESCE($14, plan),
        max_students  = COALESCE($15, max_students),
        max_branches  = COALESCE($16, max_branches),
        features      = COALESCE($17::jsonb, features),
        is_active     = COALESCE($18, is_active),
        updated_at    = NOW()
      WHERE id = $19 RETURNING *
    `, [
      name, tagline, city, state, pincode, phone, phone2, email, website, address,
      primary_color, accent_color, logo_url, plan, max_students, max_branches,
      features ? JSON.stringify(features) : null,
      is_active, req.params.id
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Academy not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update academy" });
  }
});

// DELETE /platform/academies/:id (soft deactivate)
router.delete("/academies/:id", authenticatePlatformOwner, async (req, res) => {
  try {
    await db.query(
      "UPDATE academies SET is_active=false, updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    res.json({ message: "Academy deactivated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate academy" });
  }
});

// ── NEW: POST /platform/academies/:id/admin ────────────────────────────────────
// Creates the first super_admin user for an academy
// Body: { name, email, password }
router.post("/academies/:id/admin", authenticatePlatformOwner, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email and password are required" });

  try {
    // Verify academy exists
    const { rows: acadRows } = await db.query(
      "SELECT id, name FROM academies WHERE id=$1", [req.params.id]
    );
    if (!acadRows[0]) return res.status(404).json({ error: "Academy not found" });

    // Check if email already exists in users
    const { rows: existing } = await db.query(
      "SELECT id FROM users WHERE email=$1", [email]
    );
    if (existing[0]) return res.status(409).json({ error: "A user with this email already exists" });

    // Hash password and create user with super_admin role + academy_id
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role, academy_id)
       VALUES ($1,$2,$3,'super_admin',$4)
       RETURNING id, name, email, role, academy_id`,
      [name, email, hash, req.params.id]
    );

    res.status(201).json({
      message: `Admin created for ${acadRows[0].name}`,
      admin: rows[0]
    });
  } catch (err) {
    console.error("Create academy admin error:", err.message);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

// GET /platform/academies/:id/admins — list all admins for an academy
router.get("/academies/:id/admins", authenticatePlatformOwner, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, role, created_at
       FROM users WHERE academy_id=$1 AND role='super_admin'
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

// GET /platform/academies/:id/stats
router.get("/academies/:id/stats", authenticatePlatformOwner, async (req, res) => {
  try {
    const aid = req.params.id;
    const [students, branches, fees] = await Promise.all([
      db.query("SELECT COUNT(*) FROM students WHERE academy_id=$1", [aid]),
      db.query("SELECT COUNT(*) FROM branches WHERE academy_id=$1", [aid]),
      db.query(`SELECT COALESCE(SUM(amount_paid),0) AS total FROM payments WHERE academy_id=$1 AND created_at >= date_trunc('month', NOW())`, [aid]),
    ]);
    res.json({
      student_count:   parseInt(students.rows[0].count),
      branch_count:    parseInt(branches.rows[0].count),
      fees_this_month: parseFloat(fees.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /platform/stats
router.get("/stats", authenticatePlatformOwner, async (req, res) => {
  try {
    const [academies, students, fees] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active, COUNT(*) FILTER (WHERE is_active=false) AS inactive FROM academies`),
      db.query("SELECT COUNT(*) FROM students"),
      db.query(`SELECT COALESCE(SUM(amount_paid),0) AS total FROM payments WHERE created_at >= date_trunc('month', NOW())`),
    ]);
    res.json({
      academies:       academies.rows[0],
      total_students:  parseInt(students.rows[0].count),
      fees_this_month: parseFloat(fees.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch platform stats" });
  }
});

module.exports = router;
