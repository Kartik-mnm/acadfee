const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Generate receipt number
function receiptNo() {
  const d = new Date();
  return `RCP-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.floor(1000+Math.random()*9000)}`;
}

// List payments
router.get("/", auth, branchFilter, async (req, res) => {
  const { student_id } = req.query;
  let cond = []; let params = []; let i = 1;
  if (req.branchId) { cond.push(`p.branch_id=$${i++}`); params.push(req.branchId); }
  if (student_id)   { cond.push(`p.student_id=$${i++}`); params.push(student_id); }
  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const { rows } = await db.query(
    `SELECT p.*, s.name AS student_name, s.phone, fr.period_label, fr.amount_due,
            br.name AS branch_name, u.name AS collected_by_name
     FROM payments p
     JOIN students s ON s.id = p.student_id
     JOIN fee_records fr ON fr.id = p.fee_record_id
     JOIN branches br ON br.id = p.branch_id
     LEFT JOIN users u ON u.id = p.collected_by
     ${where} ORDER BY p.paid_on DESC, p.id DESC`,
    params
  );
  res.json(rows);
});

// Record payment
router.post("/", auth, async (req, res) => {
  const { fee_record_id, amount, payment_mode, transaction_ref, paid_on, notes } = req.body;

  const { rows: frRows } = await db.query(
    "SELECT * FROM fee_records WHERE id=$1", [fee_record_id]
  );
  if (!frRows[0]) return res.status(404).json({ error: "Fee record not found" });
  const fr = frRows[0];

  const receipt = receiptNo();
  const { rows } = await db.query(
    `INSERT INTO payments (fee_record_id, student_id, branch_id, amount, payment_mode, transaction_ref, paid_on, collected_by, notes, receipt_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [fee_record_id, fr.student_id, fr.branch_id, amount, payment_mode, transaction_ref, paid_on || new Date(), req.user.id, notes, receipt]
  );

  // Update fee record paid amount + status
  const newPaid = parseFloat(fr.amount_paid) + parseFloat(amount);
  const newStatus = newPaid >= parseFloat(fr.amount_due) ? "paid" : "partial";
  await db.query(
    "UPDATE fee_records SET amount_paid=$1, status=$2 WHERE id=$3",
    [newPaid, newStatus, fee_record_id]
  );

  res.json({ ...rows[0], receipt_no: receipt });
});

// Get single payment (for receipt)
router.get("/:id", auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, s.name AS student_name, s.phone, s.parent_phone AS parent_name, s.email,
            fr.period_label, fr.amount_due, fr.amount_paid, fr.due_date,
            b.name AS batch_name, br.name AS branch_name, br.address AS branch_address, br.phone AS branch_phone,
            u.name AS collected_by_name
     FROM payments p
     JOIN students s ON s.id = p.student_id
     JOIN fee_records fr ON fr.id = p.fee_record_id
     LEFT JOIN batches b ON b.id = s.batch_id
     JOIN branches br ON br.id = p.branch_id
     LEFT JOIN users u ON u.id = p.collected_by
     WHERE p.id=$1`, [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

module.exports = router;
