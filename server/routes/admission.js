const router   = require("express").Router();
const db       = require("../db");
const { auth } = require("../middleware");
const rateLimit = require("express-rate-limit");

// Rate limit the public enquiry endpoint — max 5 submissions per IP per 15 min
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many enquiries submitted. Please try again after 15 minutes." },
});

// Public: Submit admission enquiry (no login required)
router.post("/enquiry", enquiryLimiter, async (req, res) => {
  const { name, phone, parent_phone, email, batch_id, address, branch_id, extra } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
  try {
    const { rows } = await db.query(
      `INSERT INTO admission_enquiries
       (name, phone, parent_phone, email, batch_id, address, branch_id, extra, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [name, phone, parent_phone || null, email || null,
       batch_id || null, address || null, branch_id || null, extra || null]
    );
    res.json({ success: true, enquiry_id: rows[0].id });
  } catch (e) {
    console.error("Admission enquiry error:", e.message);
    res.status(500).json({ error: "Failed to submit enquiry" });
  }
});

// Public: Get branches + batches for admission form
router.get("/form-data", async (req, res) => {
  try {
    const [branches, batches] = await Promise.all([
      db.query("SELECT id, name FROM branches ORDER BY name"),
      db.query("SELECT id, name, branch_id, fee_monthly FROM batches ORDER BY name"),
    ]);
    res.json({ branches: branches.rows, batches: batches.rows });
  } catch (e) {
    console.error("Form data error:", e.message);
    res.status(500).json({ error: "Failed to load form data" });
  }
});

// Admin: Get all enquiries — parameterized branch filter (no SQL injection)
router.get("/enquiries", auth, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === "branch_manager") {
      query = `SELECT ae.*, b.name AS batch_name, br.name AS branch_name
               FROM admission_enquiries ae
               LEFT JOIN batches b ON b.id = ae.batch_id
               LEFT JOIN branches br ON br.id = ae.branch_id
               WHERE ae.branch_id = $1
               ORDER BY ae.created_at DESC`;
      params = [req.user.branch_id];
    } else {
      query = `SELECT ae.*, b.name AS batch_name, br.name AS branch_name
               FROM admission_enquiries ae
               LEFT JOIN batches b ON b.id = ae.batch_id
               LEFT JOIN branches br ON br.id = ae.branch_id
               ORDER BY ae.created_at DESC`;
      params = [];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error("List enquiries error:", e.message);
    res.status(500).json({ error: "Failed to fetch enquiries" });
  }
});

// Admin: Approve enquiry → create student
router.post("/enquiries/:id/approve", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM admission_enquiries WHERE id=$1", [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Enquiry not found" });
    const e = rows[0];
    const { rows: stuRows } = await db.query(
      `INSERT INTO students
       (branch_id, batch_id, name, phone, parent_phone, email, address, admission_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,'active') RETURNING *`,
      [e.branch_id, e.batch_id, e.name, e.phone, e.parent_phone, e.email, e.address]
    );
    await db.query(
      "UPDATE admission_enquiries SET status='approved', student_id=$1 WHERE id=$2",
      [stuRows[0].id, req.params.id]
    );
    res.json({ success: true, student: stuRows[0] });
  } catch (e) {
    console.error("Approve enquiry error:", e.message);
    res.status(500).json({ error: "Failed to approve enquiry" });
  }
});

// Admin: Reject enquiry
router.patch("/enquiries/:id/reject", auth, async (req, res) => {
  try {
    await db.query(
      "UPDATE admission_enquiries SET status='rejected' WHERE id=$1", [req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("Reject enquiry error:", e.message);
    res.status(500).json({ error: "Failed to reject enquiry" });
  }
});

module.exports = router;
