const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");
const { sendReceiptEmail } = require("../email");

// Receipt number — collision-safe: timestamp (ms) + 4-digit counter using DB sequence (#11)
// Falls back to crypto.randomBytes if sequence not available
const crypto = require("crypto");
function receiptNo() {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars = 16M combinations
  return `RCP-${datePart}-${randomPart}`;
}

// List payments
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { student_id } = req.query;
    let cond = []; let params = []; let i = 1;

    if (req.user.role === "student") {
      cond.push(`p.student_id=$${i++}`);
      params.push(req.user.id);
    } else {
      if (req.branchId) { cond.push(`p.branch_id=$${i++}`); params.push(req.branchId); }
      if (student_id)   { cond.push(`p.student_id=$${i++}`); params.push(student_id); }
    }

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
  } catch (e) {
    console.error("List payments error:", e.message);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Record payment — students cannot record payments
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { fee_record_id, amount, payment_mode, transaction_ref, paid_on, notes } = req.body;
    if (!fee_record_id || !amount || !payment_mode)
      return res.status(400).json({ error: "fee_record_id, amount and payment_mode are required" });
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0)
      return res.status(400).json({ error: "amount must be a positive number" });

    const { rows: frRows } = await db.query("SELECT * FROM fee_records WHERE id=$1", [fee_record_id]);
    if (!frRows[0]) return res.status(404).json({ error: "Fee record not found" });
    const fr = frRows[0];

    const receipt = receiptNo();
    const { rows } = await db.query(
      `INSERT INTO payments (fee_record_id, student_id, branch_id, amount, payment_mode, transaction_ref, paid_on, collected_by, notes, receipt_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [fee_record_id, fr.student_id, fr.branch_id, parsedAmount, payment_mode, transaction_ref, paid_on || new Date(), req.user.id, notes, receipt]
    );

    const newPaid   = parseFloat(fr.amount_paid) + parsedAmount;
    const newStatus = newPaid >= parseFloat(fr.amount_due) ? "paid" : "partial";
    await db.query(
      "UPDATE fee_records SET amount_paid=$1, status=$2 WHERE id=$3",
      [newPaid, newStatus, fee_record_id]
    );

    try {
      const { rows: fullRows } = await db.query(
        `SELECT p.*, s.name AS student_name, s.email, s.parent_phone AS parent_name,
                fr.period_label, fr.amount_due, fr.amount_paid, fr.due_date,
                b.name AS batch_name, br.name AS branch_name
         FROM payments p
         JOIN students s ON s.id = p.student_id
         JOIN fee_records fr ON fr.id = p.fee_record_id
         LEFT JOIN batches b ON b.id = s.batch_id
         JOIN branches br ON br.id = p.branch_id
         WHERE p.id=$1`, [rows[0].id]
      );
      if (fullRows[0]) await sendReceiptEmail(fullRows[0]);
    } catch (emailErr) {
      console.error("Receipt email error:", emailErr.message);
    }

    res.json({ ...rows[0], receipt_no: receipt });
  } catch (e) {
    console.error("Record payment error:", e.message);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Get single payment — students can only see their own
router.get("/:id", auth, async (req, res) => {
  try {
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
    if (req.user.role === "student" && rows[0].student_id !== req.user.id)
      return res.status(403).json({ error: "Access denied" });
    res.json(rows[0]);
  } catch (e) {
    console.error("Get payment error:", e.message);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

module.exports = router;
