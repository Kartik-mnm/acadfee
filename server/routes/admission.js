const router = require("express").Router();
const db     = require("../db");
const { auth } = require("../middleware");

// ── Public: Submit admission enquiry (no login required)
// POST /api/admission/enquiry
router.post("/enquiry", async (req, res) => {
  const { name, phone, parent_phone, email, batch_id, address, branch_id } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
  try {
    const { rows } = await db.query(
      `INSERT INTO admission_enquiries
       (name, phone, parent_phone, email, batch_id, address, branch_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [name, phone, parent_phone || null, email || null,
       batch_id || null, address || null, branch_id || null]
    );
    res.json({ success: true, enquiry_id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: Get branches + batches for admission form
router.get("/form-data", async (req, res) => {
  const [branches, batches] = await Promise.all([
    db.query("SELECT id, name FROM branches ORDER BY name"),
    db.query("SELECT id, name, branch_id, fee_monthly FROM batches ORDER BY name"),
  ]);
  res.json({ branches: branches.rows, batches: batches.rows });
});

// ── Admin: Get all enquiries
router.get("/enquiries", auth, async (req, res) => {
  const branchCond = req.user.role === "branch_manager"
    ? `WHERE ae.branch_id=${req.user.branch_id}` : "";
  const { rows } = await db.query(
    `SELECT ae.*, b.name AS batch_name, br.name AS branch_name
     FROM admission_enquiries ae
     LEFT JOIN batches b ON b.id = ae.batch_id
     LEFT JOIN branches br ON br.id = ae.branch_id
     ${branchCond} ORDER BY ae.created_at DESC`
  );
  res.json(rows);
});

// ── Admin: Approve enquiry → create student
router.post("/enquiries/:id/approve", auth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM admission_enquiries WHERE id=$1", [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Enquiry not found" });
  const e = rows[0];

  try {
    // Create student from enquiry
    const { rows: stuRows } = await db.query(
      `INSERT INTO students
       (branch_id, batch_id, name, phone, parent_phone, email, address, admission_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,'active') RETURNING *`,
      [e.branch_id, e.batch_id, e.name, e.phone, e.parent_phone, e.email, e.address]
    );
    // Mark enquiry as approved
    await db.query(
      "UPDATE admission_enquiries SET status='approved', student_id=$1 WHERE id=$2",
      [stuRows[0].id, req.params.id]
    );
    res.json({ success: true, student: stuRows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Reject enquiry
router.patch("/enquiries/:id/reject", auth, async (req, res) => {
  await db.query(
    "UPDATE admission_enquiries SET status='rejected' WHERE id=$1", [req.params.id]
  );
  res.json({ success: true });
});

module.exports = router;
