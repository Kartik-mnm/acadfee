const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// ── List payments ───────────────────────────────────────────────────────────────
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { student_id, from, to } = req.query;
    const aid = req.academyId;

    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT p.*, s.name AS student_name, s.phone,
                fr.period_label, b.name AS batch_name, br.name AS branch_name
         FROM payments p
         JOIN students s  ON s.id  = p.student_id
         LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
         LEFT JOIN batches b      ON b.id  = s.batch_id
         JOIN branches br         ON br.id = p.branch_id
         WHERE p.student_id = $1 ORDER BY p.paid_on DESC, p.id DESC`,
        [req.user.id]
      );
      return res.json(rows);
    }

    let conditions = []; let params = []; let idx = 1;
    if (aid)          { conditions.push(`s.academy_id=$${idx++}`);  params.push(aid); }
    if (req.branchId) { conditions.push(`p.branch_id=$${idx++}`);   params.push(req.branchId); }
    if (student_id)   { conditions.push(`p.student_id=$${idx++}`);  params.push(student_id); }
    if (from)         { conditions.push(`p.paid_on>=$${idx++}`);    params.push(from); }
    if (to)           { conditions.push(`p.paid_on<=$${idx++}`);    params.push(to); }
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

// ── Get single payment (for receipt) ─────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*,
              s.name AS student_name, s.phone, s.parent_name,
              fr.period_label, fr.amount_due, fr.amount_paid, fr.due_date,
              b.name AS batch_name, br.name AS branch_name
       FROM payments p
       JOIN students s  ON s.id  = p.student_id
       LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
       LEFT JOIN batches b      ON b.id  = s.batch_id
       JOIN branches br         ON br.id = p.branch_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Payment not found" });
    if (req.user.role === "student" && rows[0].student_id !== req.user.id)
      return res.status(403).json({ error: "Access denied" });
    if (req.academyId && req.user.role !== "student") {
      const { rows: check } = await db.query(`SELECT academy_id FROM students WHERE id=$1`, [rows[0].student_id]);
      if (check[0]?.academy_id && check[0].academy_id !== req.academyId)
        return res.status(403).json({ error: "Access denied" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error("Get payment error:", e.message);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ── Record payment — sends push notification to student + parent ────────────────────
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  
  const client = await db.pool.connect();
  try {
    const { fee_record_id, amount, payment_mode, transaction_ref, paid_on, notes } = req.body;
    if (!fee_record_id || amount === undefined || amount === null || !payment_mode)
      return res.status(400).json({ error: "fee_record_id, amount and payment_mode are required" });

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount. Amount must be greater than zero." });
    }

    // Fetch fee record + student info (including FCM tokens) + academy name
    const { rows: frRows } = await client.query(
      `SELECT fr.*, s.branch_id, s.academy_id AS student_academy_id,
              s.fcm_token, s.parent_fcm_token, s.name AS student_name,
              a.name AS academy_name
       FROM fee_records fr
       JOIN students s ON s.id = fr.student_id
       LEFT JOIN academies a ON a.id = COALESCE(s.academy_id, (SELECT academy_id FROM branches WHERE id = s.branch_id))
       WHERE fr.id = $1`, [fee_record_id]
    );
    if (!frRows[0]) return res.status(404).json({ error: "Fee record not found" });
    const fr = frRows[0];

    const aid = req.academyId;
    if (aid && fr.student_academy_id && fr.student_academy_id !== aid)
      return res.status(403).json({ error: "Fee record does not belong to your academy" });

    const due = parseFloat(fr.amount_due);
    const paidSoFar = parseFloat(fr.amount_paid);
    // Allow a small epsilon for floating point issues
    if (paymentAmount > (due - paidSoFar) + 0.01) {
      return res.status(400).json({ error: `Payment amount (${paymentAmount}) exceeds the outstanding balance (${due - paidSoFar}).` });
    }

    const student_id = fr.student_id;
    const branch_id  = fr.branch_id;

    await client.query("BEGIN");

    // Acquire an advisory lock scoped to academy to prevent receipt number race conditions
    // Using a hash of the prefix as the lock ID
    const today  = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).replace(/-/g, "");
    const prefix = `RCP-${today}-`;
    const lockId = 1000 + (aid || 0);
    await client.query("SELECT pg_advisory_xact_lock($1)", [lockId]);

    // Receipt number: RCP-YYYYMMDD-NNNN per academy per day
    const { rows: lastRows } = await client.query(
      `SELECT receipt_no FROM payments
       WHERE receipt_no LIKE $1
       ${aid ? "AND branch_id IN (SELECT id FROM branches WHERE academy_id=$2)" : ""}
       ORDER BY id DESC LIMIT 1`,
      aid ? [`${prefix}%`, aid] : [`${prefix}%`]
    );
    let seq = 1;
    if (lastRows[0]?.receipt_no) {
      const parts = lastRows[0].receipt_no.split("-");
      const last  = parseInt(parts[parts.length - 1]);
      if (!isNaN(last)) seq = last + 1;
    }
    const receipt_no = `${prefix}${String(seq).padStart(4, "0")}`;

    const { rows } = await client.query(
      `INSERT INTO payments
         (fee_record_id, student_id, branch_id, amount, payment_mode,
          transaction_ref, paid_on, collected_by, notes, receipt_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [fee_record_id, student_id, branch_id, paymentAmount, payment_mode,
       transaction_ref || null, paid_on || new Date(), req.user.id, notes || null, receipt_no]
    );

    const totalPaid = paidSoFar + paymentAmount;
    const status    = totalPaid >= due - 0.01 ? "paid" : "partial";
    await client.query(
      "UPDATE fee_records SET amount_paid=$1, status=$2 WHERE id=$3",
      [totalPaid, status, fee_record_id]
    );

    await client.query("COMMIT");

    // Send push notification to student and parent
    if (fr.fcm_token || fr.parent_fcm_token) {
      const { sendPaymentNotification } = require("../fcm");
      sendPaymentNotification({
        studentName:  fr.student_name,
        studentToken: fr.fcm_token,
        parentToken:  fr.parent_fcm_token,
        amount:       paymentAmount,
        receiptNo:    receipt_no,
        periodLabel:  fr.period_label,
        academyName:  fr.academy_name,
      }).catch(console.error);
    }

    res.json(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Create payment error:", e.message);
    res.status(500).json({ error: "Failed to record payment" });
  } finally {
    client.release();
  }
});

// ── Delete payment ───────────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { rows } = await db.query(
      `SELECT p.*, s.academy_id AS student_academy_id
       FROM payments p JOIN students s ON s.id = p.student_id
       WHERE p.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Payment not found" });
    if (aid && rows[0].student_academy_id && rows[0].student_academy_id !== aid)
      return res.status(403).json({ error: "Access denied: payment belongs to a different academy" });
    const p = rows[0];
    await db.query("DELETE FROM payments WHERE id=$1", [req.params.id]);
    const { rows: frRows } = await db.query("SELECT * FROM fee_records WHERE id=$1", [p.fee_record_id]);
    if (frRows[0]) {
      const newPaid = Math.max(0, parseFloat(frRows[0].amount_paid) - parseFloat(p.amount));
      const status  = newPaid <= 0 ? "pending" : newPaid >= frRows[0].amount_due ? "paid" : "partial";
      await db.query("UPDATE fee_records SET amount_paid=$1, status=$2 WHERE id=$3", [newPaid, status, p.fee_record_id]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error("Delete payment error:", e.message);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

module.exports = router;
