const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List fee records — scoped to academy
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { student_id, status } = req.query;
    const aid = req.academyId;
    let conditions = []; let params = []; let idx = 1;
    if (req.user.role === "student") {
      conditions.push(`fr.student_id=$${idx++}`);
      params.push(req.user.id);
    } else {
      if (aid)        { conditions.push(`s.academy_id=$${idx++}`);  params.push(aid); }
      if (req.branchId) { conditions.push(`fr.branch_id=$${idx++}`); params.push(req.branchId); }
      if (student_id) { conditions.push(`fr.student_id=$${idx++}`); params.push(student_id); }
      if (status)     { conditions.push(`fr.status=$${idx++}`);     params.push(status); }
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT fr.*, s.name AS student_name, s.phone, b.name AS batch_name, br.name AS branch_name
       FROM fee_records fr
       JOIN students s ON s.id=fr.student_id
       LEFT JOIN batches b ON b.id=s.batch_id
       JOIN branches br ON br.id=fr.branch_id
       ${where} ORDER BY fr.due_date DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("List fees error:", e.message);
    res.status(500).json({ error: "Failed to fetch fee records" });
  }
});

// Create fee record
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { student_id, amount_due, due_date, period_label } = req.body;
    if (!student_id || !amount_due || !due_date || !period_label)
      return res.status(400).json({ error: "student_id, amount_due, due_date and period_label are required" });
    const aid = req.academyId;
    // Verify student belongs to this academy
    const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
    const sParams = aid ? [student_id, aid] : [student_id];
    const { rows: sRows } = await db.query(`SELECT branch_id FROM students ${whereClause}`, sParams);
    if (!sRows[0]) return res.status(404).json({ error: "Student not found in your academy" });
    const { rows } = await db.query(
      `INSERT INTO fee_records (student_id, branch_id, amount_due, due_date, period_label) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, sRows[0].branch_id, amount_due, due_date, period_label]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create fee record error:", e.message);
    res.status(500).json({ error: "Failed to create fee record" });
  }
});

// Bulk generate monthly fee records
router.post("/generate", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { branch_id, month, year } = req.body;
  if (!month || !year) return res.status(400).json({ error: "month and year are required" });
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  const aid = req.academyId;
  const label = new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    
    // Support filtering by branch_id if provided, else all branches for the academy
    let queryParams = [];
    let whereClauses = ["s.status='active'"];
    if (aid) {
      queryParams.push(aid);
      whereClauses.push(`s.academy_id=$${queryParams.length}`);
    }
    if (bid) {
      queryParams.push(bid);
      whereClauses.push(`s.branch_id=$${queryParams.length}`);
    }
    const whereStr = "WHERE " + whereClauses.join(" AND ");

    const { rows: students } = await client.query(
      `SELECT s.*, bt.fee_monthly, bt.fee_quarterly, bt.fee_yearly, bt.fee_course
       FROM students s LEFT JOIN batches bt ON bt.id=s.batch_id
       ${whereStr}`,
      queryParams
    );

    console.log(`[Generate] Fetched ${students.length} active students for generation. (Aid: ${aid}, Bid: ${bid})`);

    let created = 0;
    for (const s of students) {
      let fType = (s.fee_type || "monthly").toLowerCase();
      let rawAmt = 0;

      // Priority 1: Use student-specific admission_fee if it is set (custom override)
      if (s.admission_fee && parseFloat(s.admission_fee) > 0) {
        rawAmt = s.admission_fee;
      } 
      // Priority 2: Fall back to batch-defined fees based on fee_type
      else {
        if (fType === "monthly")        rawAmt = s.fee_monthly;
        else if (fType === "quarterly") rawAmt = s.fee_quarterly;
        else if (fType === "yearly")    rawAmt = s.fee_yearly;
        else rawAmt = s.fee_course;
      }

      let amt = parseFloat(rawAmt || 0);
      let disc = parseFloat(s.discount || 0);
      amt = amt - (amt * (disc / 100));
      
      let dueDay  = s.due_day || 10;
      const maxDays = new Date(year, month, 0).getDate();
      if (dueDay > maxDays) dueDay = maxDays;
      
      const dueDate = `${year}-${String(month).padStart(2,"0")}-${String(dueDay).padStart(2,"0")}`;
      
      const { rows: exist } = await client.query(
        "SELECT id FROM fee_records WHERE student_id=$1 AND period_label=$2", [s.id, label]
      );
      
      if (exist.length > 0) {
        console.log(`[Generate] Skipping student ${s.id} (${s.name}): Record already exists for ${label}`);
        continue;
      }
      if (amt <= 0) {
        console.log(`[Generate] Skipping student ${s.id} (${s.name}): Calculated amount is 0 (Type: ${fType}, RawAmt: ${rawAmt})`);
        continue;
      }

      await client.query(
        "INSERT INTO fee_records (student_id, branch_id, amount_due, due_date, period_label) VALUES ($1,$2,$3,$4,$5)",
        [s.id, s.branch_id, amt, dueDate, label]
      );
      created++;
    }
    console.log(`[Generate] Successfully created ${created} new fee records.`);
    await client.query("COMMIT");
    res.json({ created, label });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Generate fees error:", e.message);
    res.status(500).json({ error: "Fee generation failed" });
  } finally { client.release(); }
});

// Bulk Nudge Defaulters via WhatsApp
router.post("/nudge", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { record_ids } = req.body;
  if (!Array.isArray(record_ids) || record_ids.length === 0) return res.status(400).json({ error: "No records selected" });
  
  const aid = req.academyId;
  const { sendWhatsAppMessage } = require("../whatsapp");

  try {
    // Bulk fetch records ensuring they belong to this academy and are overdue or pending partial
    const { rows } = await db.query(
      `SELECT fr.id, fr.amount_due, fr.amount_paid, fr.period_label, 
              s.name AS student_name, s.phone, s.parent_phone, a.name AS academy_name
       FROM fee_records fr
       JOIN students s ON s.id = fr.student_id
       LEFT JOIN academies a ON a.id = s.academy_id
       WHERE fr.id = ANY($1) 
         AND (s.academy_id = $2 OR $2 IS NULL)
         AND fr.status IN ('pending', 'partial', 'overdue')`,
      [record_ids, aid || null]
    );

    let sentCount = 0;
    // We send sequentially to avoid spamming the connection and triggering WhatsApp anti-spam too quickly
    for (const record of rows) {
      const balance = record.amount_due - record.amount_paid;
      const phone = record.parent_phone || record.phone;
      if (balance > 0 && phone) {
        const amtStr = `\u20b9${Number(balance).toLocaleString("en-IN")}`;
        const pLabel = record.period_label || "this period";
        const acadName = record.academy_name || "Academy";
        
        const msg = `⚠️ *FEE REMINDER*\n\nDear Parent/Student,\n\nThis is a gentle reminder that a fee balance of *${amtStr}* for ${record.student_name} (${pLabel}) is currently pending.\n\nPlease clear your dues at the earliest.\n\nThank you,\n${acadName}`;
        
        const success = await sendWhatsAppMessage(aid, phone, msg);
        if (success) sentCount++;
      }
    }

    res.json({ success: true, nudged: sentCount, total: rows.length });
  } catch (e) {
    console.error("Nudge defaulters error:", e.message);
    res.status(500).json({ error: "Failed to send WhatsApp reminders" });
  }
});

// Mark overdue — scoped to academy only
router.patch("/mark-overdue", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const today = new Date().toISOString().split("T")[0];
    const aid = req.academyId;
    // BUG FIX: was marking ALL academies' records as overdue — now scoped to this academy only
    let query, params;
    if (aid) {
      query = `UPDATE fee_records fr SET status='overdue'
               FROM students s
               WHERE fr.student_id = s.id
                 AND s.academy_id = $1
                 AND fr.status = 'pending'
                 AND fr.due_date < $2`;
      params = [aid, today];
    } else if (req.user.branch_id) {
      query = `UPDATE fee_records SET status='overdue' WHERE branch_id=$1 AND status='pending' AND due_date < $2`;
      params = [req.user.branch_id, today];
    } else {
      query = `UPDATE fee_records SET status='overdue' WHERE status='pending' AND due_date < $1`;
      params = [today];
    }
    const { rowCount } = await db.query(query, params);
    res.json({ updated: rowCount });
  } catch (e) { res.status(500).json({ error: "Failed to mark overdue records" }); }
});

module.exports = router;
