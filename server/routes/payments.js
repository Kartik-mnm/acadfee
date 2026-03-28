const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List payments — scoped to academy
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { student_id, from, to } = req.query;
    const aid = req.academyId;
    let conditions = []; let params = []; let idx = 1;
    if (aid)          { conditions.push(`s.academy_id=$${idx++}`);  params.push(aid); }
    if (req.branchId) { conditions.push(`p.branch_id=$${idx++}`);   params.push(req.branchId); }
    if (student_id)   { conditions.push(`p.student_id=$${idx++}`);  params.push(student_id); }
    if (from)         { conditions.push(`p.paid_on>=$${idx++}`);     params.push(from); }
    if (to)           { conditions.push(`p.paid_on<=$${idx++}`);     params.push(to); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT p.*, s.name AS student_name, s.phone, fr.period_label,
              b.name AS batch_name, br.name AS branch_name
       FROM payments p
       JOIN students s ON s.id=p.student_id
       LEFT JOIN fee_records fr ON fr.id=p.fee_record_id
       LEFT JOIN batches b ON b.id=s.batch_id
       JOIN branches br ON br.id=p.branch_id
       ${where} ORDER BY p.paid_on DESC, p.id DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("List payments error:", e.message);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Record payment
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { fee_record_id, student_id, amount, payment_mode, transaction_ref, paid_on, notes } = req.body;
    if (!fee_record_id || !student_id || !amount || !payment_mode)
      return res.status(400).json({ error: "fee_record_id, student_id, amount and payment_mode are required" });
    const { rows: sRows } = await db.query("SELECT branch_id FROM students WHERE id=$1", [student_id]);
    if (!sRows[0]) return res.status(404).json({ error: "Student not found" });
    const branch_id = sRows[0].branch_id;

    // Generate receipt number
    const { rows: lastReceipt } = await db.query(
      `SELECT receipt_no FROM payments ORDER BY id DESC LIMIT 1`
    );
    let receiptNum = 1001;
    if (lastReceipt[0]?.receipt_no) {
      const num = parseInt(lastReceipt[0].receipt_no.replace(/[^0-9]/g, ""));
      if (!isNaN(num)) receiptNum = num + 1;
    }
    const receipt_no = `RCP${String(receiptNum).padStart(5, "0")}`;

    const { rows } = await db.query(
      `INSERT INTO payments (fee_record_id, student_id, branch_id, amount, payment_mode,
        transaction_ref, paid_on, collected_by, notes, receipt_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [fee_record_id, student_id, branch_id, amount, payment_mode,
       transaction_ref, paid_on || new Date(), req.user.id, notes, receipt_no]
    );

    // Update fee record status
    const { rows: frRows } = await db.query("SELECT * FROM fee_records WHERE id=$1", [fee_record_id]);
    if (frRows[0]) {
      const totalPaid = parseFloat(frRows[0].amount_paid) + parseFloat(amount);
      const status = totalPaid >= frRows[0].amount_due ? "paid" : "partial";
      await db.query(
        "UPDATE fee_records SET amount_paid=$1, status=$2 WHERE id=$3",
        [totalPaid, status, fee_record_id]
      );
    }
    res.json(rows[0]);
  } catch (e) {
    console.error("Create payment error:", e.message);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Delete payment
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows } = await db.query("SELECT * FROM payments WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Payment not found" });
    const p = rows[0];
    await db.query("DELETE FROM payments WHERE id=$1", [req.params.id]);
    // Reverse the fee record update
    const { rows: frRows } = await db.query("SELECT * FROM fee_records WHERE id=$1", [p.fee_record_id]);
    if (frRows[0]) {
      const newPaid = Math.max(0, parseFloat(frRows[0].amount_paid) - parseFloat(p.amount));
      const status = newPaid <= 0 ? "pending" : newPaid >= frRows[0].amount_due ? "paid" : "partial";
      await db.query("UPDATE fee_records SET amount_paid=$1, status=$2 WHERE id=$3", [newPaid, status, p.fee_record_id]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error("Delete payment error:", e.message);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

module.exports = router;
