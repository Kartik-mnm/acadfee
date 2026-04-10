const router = require("express").Router();
const db     = require("../db");
const { auth } = require("../middleware");
const { sendNotification } = require("../fcm");

// Ensure payments table has a notes column (some older DBs may only have note)
db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {});

// GET /api/payments  — student sees own, admin sees academy's
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT p.*, fr.period_label
         FROM payments p
         LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
         WHERE p.student_id = $1
         ORDER BY p.paid_on DESC`,
        [req.user.id]
      );
      return res.json(rows);
    }
    const aid = req.academyId;
    const { student_id } = req.query;
    let query, params;
    if (student_id) {
      query = `SELECT p.*, s.name AS student_name, s.phone, s.roll_no,
               b.name AS batch_name, br.name AS branch_name, fr.period_label
               FROM payments p
               JOIN students s ON s.id = p.student_id
               LEFT JOIN batches  b  ON b.id  = s.batch_id
               LEFT JOIN branches br ON br.id = s.branch_id
               LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
               WHERE p.student_id = $1
               ORDER BY p.paid_on DESC`;
      params = [student_id];
    } else {
      query = `SELECT p.*, s.name AS student_name, s.phone, s.roll_no,
               b.name AS batch_name, br.name AS branch_name, fr.period_label
               FROM payments p
               JOIN students s ON s.id = p.student_id
               LEFT JOIN batches  b  ON b.id  = s.batch_id
               LEFT JOIN branches br ON br.id = s.branch_id
               LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
               WHERE s.academy_id = $1
               ORDER BY p.paid_on DESC LIMIT 200`;
      params = [aid];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error("List payments error:", e.message);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// GET /api/payments/:id  — fetch a single payment for receipt reprint
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, s.name AS student_name, s.phone, s.roll_no, s.parent_name,
              b.name AS batch_name, br.name AS branch_name,
              a.name AS academy_name, a.phone AS academy_phone,
              a.phone2 AS academy_phone2,
              a.address AS academy_address, a.logo_url,
              fr.period_label, fr.amount_due, fr.amount_paid, fr.due_date
       FROM payments p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN batches  b  ON b.id  = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       LEFT JOIN academies a ON a.id  = s.academy_id
       LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Payment not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("Get payment error:", e.message);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// POST /api/payments  — record a payment + send FCM notification to student
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { fee_record_id, amount, payment_mode = "cash", transaction_ref, note, notes, paid_on } = req.body;
    if (!fee_record_id || !amount) return res.status(400).json({ error: "fee_record_id and amount required" });
    if (parseFloat(amount) <= 0) return res.status(400).json({ error: "Amount must be greater than 0" });

    // Normalize paid_on — always YYYY-MM-DD
    const paymentDate = paid_on && /^\d{4}-\d{2}-\d{2}$/.test(paid_on)
      ? paid_on
      : new Date().toISOString().split("T")[0];

    // The final notes value — accept either field name from frontend
    const finalNotes = notes || note || null;

    // Look up student_id + FCM tokens from the fee record
    const { rows: frRows } = await db.query(
      `SELECT fr.student_id, fr.period_label, fr.amount_due, fr.amount_paid,
              s.name AS student_name, s.fcm_token, s.parent_fcm_token, s.academy_id, s.branch_id,
              a.name AS academy_name
       FROM fee_records fr
       JOIN students s ON s.id = fr.student_id
       LEFT JOIN academies a ON a.id = s.academy_id
       WHERE fr.id = $1`,
      [fee_record_id]
    );
    if (!frRows[0]) return res.status(404).json({ error: "Fee record not found" });

    const {
      student_id, student_name, fcm_token, parent_fcm_token,
      academy_name, period_label, academy_id: studentAcademyId, branch_id,
    } = frRows[0];

    // Use academy_id from the student record as fallback (handles branch managers)
    const academyId = req.academyId || studentAcademyId;

    // Generate receipt number: RCP-YYYYMMDD-NNNN (per academy per day)
    const today = paymentDate.replace(/-/g, "");
    let seq = 1;
    if (academyId) {
      const { rows: cntRows } = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM payments p
         JOIN students s ON s.id = p.student_id
         WHERE DATE(p.paid_on) = $1::date AND s.academy_id = $2`,
        [paymentDate, academyId]
      );
      seq = (cntRows[0]?.cnt || 0) + 1;
    }
    const receipt_no = `RCP-${today}-${String(seq).padStart(4, "0")}`;

    // INSERT — include merchant_id (academy_id in DB), branch_id, and collected_by
    const { rows } = await db.query(
      `INSERT INTO payments
         (student_id, fee_record_id, amount, payment_mode, transaction_ref, notes, paid_on, receipt_no, merchant_id, branch_id, collected_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [student_id, fee_record_id, amount, payment_mode,
       transaction_ref || null, finalNotes,
       paymentDate, receipt_no, academyId, branch_id, req.user.id]
    );
    const payment = rows[0];

    // Update fee record status
    await db.query(
      `UPDATE fee_records SET
         amount_paid = LEAST(amount_due, amount_paid + $1),
         status = CASE
           WHEN amount_paid + $1 >= amount_due THEN 'paid'
           WHEN amount_paid + $1 > 0           THEN 'partial'
           ELSE status
         END
       WHERE id = $2`,
      [amount, fee_record_id]
    );

    // Send FCM payment notification (non-blocking — never fails the request)
    const amtStr  = `\u20b9${Number(amount).toLocaleString("en-IN")}`;
    const academy = academy_name || "your academy";
    const period  = period_label ? ` (${period_label})` : "";
    const modeStr = payment_mode.toUpperCase();
    const dateStr = new Date(paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    const notifTitle = `\ud83d\udcb3 Payment Received \u2014 ${amtStr}`;
    const notifBody  = `${student_name}, your fee payment of ${amtStr}${period} via ${modeStr} was recorded on ${dateStr}. Receipt: ${receipt_no}`;
    const notifData  = { type: "payment", receipt_no, amount: String(amount), period_label: period_label || "" };

    const notifPromises = [];
    if (fcm_token)        notifPromises.push(sendNotification(fcm_token,        notifTitle, notifBody, notifData));
    if (parent_fcm_token) notifPromises.push(sendNotification(parent_fcm_token, `\ud83d\udcb3 Fee paid for ${student_name}`, `${amtStr} fee${period} paid via ${modeStr} at ${academy}. Receipt: ${receipt_no}`, notifData));
    if (notifPromises.length > 0) Promise.allSettled(notifPromises).catch(() => {});

    res.json({ ...payment, receipt_no });
  } catch (e) {
    console.error("Create payment error:", e.message, e.stack);
    res.status(500).json({ error: "Failed to record payment: " + e.message });
  }
});

// DELETE /api/payments/:id
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows } = await db.query("SELECT * FROM payments WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Payment not found" });
    const p = rows[0];
    await db.query("DELETE FROM payments WHERE id=$1", [req.params.id]);
    await db.query(
      `UPDATE fee_records SET
         amount_paid = GREATEST(0, amount_paid - $1),
         status = CASE
           WHEN GREATEST(0, amount_paid - $1) <= 0        THEN 'pending'
           WHEN GREATEST(0, amount_paid - $1) < amount_due THEN 'partial'
           ELSE 'paid'
         END
       WHERE id = $2`,
      [p.amount, p.fee_record_id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("Delete payment error:", e.message);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

module.exports = router;
