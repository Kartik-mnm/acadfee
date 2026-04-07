const router = require("express").Router();
const db     = require("../db");
const { auth } = require("../middleware");
const { sendNotification } = require("../fcm");

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
      query = `SELECT p.*, s.name AS student_name, fr.period_label
               FROM payments p
               JOIN students s ON s.id = p.student_id
               LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
               WHERE p.student_id = $1
               ORDER BY p.paid_on DESC`;
      params = [student_id];
    } else {
      query = `SELECT p.*, s.name AS student_name, fr.period_label
               FROM payments p
               JOIN students s ON s.id = p.student_id
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
      `SELECT p.*, s.name AS student_name, s.phone, s.roll_no,
              b.name AS batch_name, br.name AS branch_name,
              a.name AS academy_name, a.phone AS academy_phone,
              a.address AS academy_address, a.logo_url,
              fr.period_label
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
    const { fee_record_id, amount, payment_mode = "cash", note, paid_on } = req.body;
    if (!fee_record_id || !amount) return res.status(400).json({ error: "fee_record_id and amount required" });

    // Look up student_id from the fee record (no need to send it from frontend)
    const { rows: frRows } = await db.query(
      `SELECT fr.student_id, fr.period_label,
              s.name AS student_name, s.fcm_token, s.parent_fcm_token,
              a.name AS academy_name
       FROM fee_records fr
       JOIN students s ON s.id = fr.student_id
       LEFT JOIN academies a ON a.id = s.academy_id
       WHERE fr.id = $1`,
      [fee_record_id]
    );
    if (!frRows[0]) return res.status(404).json({ error: "Fee record not found" });
    const { student_id, student_name, fcm_token, parent_fcm_token, academy_name, period_label } = frRows[0];

    // Generate receipt number: RCP-YYYYMMDD-NNNN (per academy per day)
    const today = (paid_on || new Date().toISOString().split("T")[0]).replace(/-/g, "");
    const academyId = req.academyId;
    const { rows: cntRows } = await db.query(
      `SELECT COUNT(*) FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE DATE(p.paid_on) = $1::date AND s.academy_id = $2`,
      [paid_on || new Date().toISOString().split("T")[0], academyId]
    );
    const seq = parseInt(cntRows[0].count) + 1;
    const receipt_no = `RCP-${today}-${String(seq).padStart(4, "0")}`;

    const { rows } = await db.query(
      `INSERT INTO payments (student_id, fee_record_id, amount, payment_mode, note, paid_on, receipt_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [student_id, fee_record_id, amount, payment_mode, note || null,
       paid_on || new Date().toISOString().split("T")[0], receipt_no]
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

    // ── Send FCM payment notification to student + parent ──────────────────
    const amtStr  = `₹${Number(amount).toLocaleString("en-IN")}`;
    const academy = academy_name || "your academy";
    const period  = period_label ? ` (${period_label})` : "";
    const modeStr = payment_mode.toUpperCase();
    const dateStr = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

    const notifTitle = `💳 Payment Received — ${amtStr}`;
    const notifBody  = `${student_name}, your fee payment of ${amtStr}${period} via ${modeStr} was recorded on ${dateStr}. Receipt: ${receipt_no}`;
    const notifData  = { type: "payment", receipt_no, amount: String(amount), period_label: period_label || "" };

    const notifPromises = [];
    if (fcm_token)        notifPromises.push(sendNotification(fcm_token,        notifTitle, notifBody, notifData));
    if (parent_fcm_token) notifPromises.push(sendNotification(parent_fcm_token, `💳 Fee paid for ${student_name}`, `${amtStr} fee${period} paid via ${modeStr} at ${academy}. Receipt: ${receipt_no}`, notifData));

    if (notifPromises.length > 0) {
      Promise.allSettled(notifPromises).then(results => {
        results.forEach((r, i) => {
          if (r.status === "fulfilled") console.log(`[FCM] Payment notif ${i+1}: sent`);
          else console.warn(`[FCM] Payment notif ${i+1} failed:`, r.reason?.message);
        });
      });
    } else {
      console.log("[FCM] Payment recorded but student has no FCM token — skipping notification");
    }

    res.json({ ...payment, receipt_no });
  } catch (e) {
    console.error("Create payment error:", e.message);
    res.status(500).json({ error: "Failed to record payment" });
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
    // Reverse the fee record update
    await db.query(
      `UPDATE fee_records SET
         amount_paid = GREATEST(0, amount_paid - $1),
         status = CASE
           WHEN GREATEST(0, amount_paid - $1) <= 0       THEN 'pending'
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
