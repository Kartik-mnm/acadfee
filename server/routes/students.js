const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter, studentSelf } = require("../middleware");

const BRANCH_PREFIX = {
  "favinagar": "RN", "ravinagar": "RN",
  "dattawadi": "DW", "dattwadi":  "DW",
  "dabha":     "DB", "dhabha":    "DB",
};

function getRollPrefix(branchName) {
  if (!branchName) return "NA";
  const lower = branchName.toLowerCase();
  for (const [key, prefix] of Object.entries(BRANCH_PREFIX)) {
    if (lower.includes(key)) return prefix;
  }
  return branchName.replace(/[^a-zA-Z]/g, "").substring(0, 2).toUpperCase() || "NA";
}

router.post("/backfill-roll-numbers", auth, async (req, res) => {
  if (req.user.role !== "super_admin") return res.status(403).json({ error: "Super admin only" });
  try {
    const aid = req.academyId;
    const aidCond = aid ? "AND s.academy_id = " + parseInt(aid) : "AND s.academy_id IS NULL";
    const { rows: students } = await db.query(
      `SELECT s.id, s.branch_id, br.name AS branch_name
       FROM students s JOIN branches br ON br.id = s.branch_id
       WHERE s.roll_no IS NULL ${aidCond} ORDER BY s.branch_id, s.id ASC`
    );
    const { rows: existing } = await db.query(
      `SELECT branch_id, MAX(CAST(REGEXP_REPLACE(roll_no, '[^0-9]', '', 'g') AS INTEGER)) AS max_serial
       FROM students WHERE roll_no IS NOT NULL GROUP BY branch_id`
    );
    const maxSerial = {};
    existing.forEach((r) => { maxSerial[r.branch_id] = r.max_serial || 0; });
    let updated = 0;
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      for (const s of students) {
        const prefix = getRollPrefix(s.branch_name);
        const serial = (maxSerial[s.branch_id] || 0) + 1;
        maxSerial[s.branch_id] = serial;
        const rollNo = `${prefix}${String(serial).padStart(4, "0")}`;
        await client.query(`UPDATE students SET roll_no=$1 WHERE id=$2 AND roll_no IS NULL`, [rollNo, s.id]);
        updated++;
      }
      await client.query("COMMIT");
      res.json({ updated, message: `Roll numbers assigned to ${updated} students` });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  } catch (e) {
    console.error("Backfill roll numbers error:", e.message);
    res.status(500).json({ error: "Failed to backfill roll numbers: " + e.message });
  }
});

router.get("/", auth, branchFilter, studentSelf, async (req, res) => {
  try {
    const aid = req.academyId;
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT s.*, b.name AS batch_name, br.name AS branch_name
         FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
         WHERE s.id=$1`, [req.user.id]
      );
      return res.json(rows);
    }
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    let conditions = []; let params = []; let idx = 1;
    if (aid) { conditions.push(`s.academy_id=$${idx++}`); params.push(aid); }
    if (req.branchId)       { conditions.push(`s.branch_id=$${idx++}`); params.push(req.branchId); }
    if (req.query.batch_id) { conditions.push(`s.batch_id=$${idx++}`);  params.push(req.query.batch_id); }
    if (req.query.status)   { conditions.push(`s.status=$${idx++}`);    params.push(req.query.status); }
    if (search) {
      conditions.push(`(s.name ILIKE $${idx} OR s.phone ILIKE $${idx} OR s.parent_phone ILIKE $${idx} OR s.email ILIKE $${idx} OR s.roll_no ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows: countRows } = await db.query(`SELECT COUNT(*) FROM students s ${where}`, [...params]);
    const total = parseInt(countRows[0].count);
    const totalPages = Math.ceil(total / limit);

    // BUG FIX: was using idx++ inside template literal which evaluates both sides before
    // pushing to params — causing mismatched $N indices when search param is present.
    // Now push limit/offset first, then reference their known positions.
    const limitIdx  = idx;
    const offsetIdx = idx + 1;
    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
       ${where} ORDER BY s.id DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    res.json({ data: rows, page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 });
  } catch (e) {
    console.error("List students error:", e.message);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

router.get("/:id", auth, studentSelf, async (req, res) => {
  try {
    const aid = req.academyId;
    const conditions = ["s.id=$1"];
    const params = [req.params.id];
    if (req.user.role !== "student" && aid) {
      conditions.push(`s.academy_id=$2`);
      params.push(aid);
    }
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id
       WHERE ${conditions.join(" AND ")}`, params
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to fetch student" }); }
});

router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender,
            admission_date, fee_type, admission_fee, discount, discount_reason, due_day, photo_url } = req.body;
    if (!name || !batch_id) return res.status(400).json({ error: "name and batch_id are required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    const aid = req.academyId;
    const dueDaySafe = Math.min(Math.max(parseInt(due_day) || 10, 1), 28);
    const { rows: brRows } = await db.query("SELECT name FROM branches WHERE id=$1", [bid]);
    const prefix = getRollPrefix(brRows[0]?.name || "");
    const { rows: maxRows } = await db.query(
      `SELECT MAX(CAST(REGEXP_REPLACE(roll_no, '[^0-9]', '', 'g') AS INTEGER)) AS max_serial
       FROM students WHERE branch_id=$1 AND roll_no IS NOT NULL`, [bid]
    );
    const serial = (maxRows[0]?.max_serial || 0) + 1;
    const rollNo = `${prefix}${String(serial).padStart(4, "0")}`;
    const { rows } = await db.query(
      `INSERT INTO students (branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender,
        admission_date, fee_type, admission_fee, discount, discount_reason, due_day, photo_url, roll_no, academy_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [bid, batch_id, name, phone, parent_phone, email, address, dob, gender, admission_date,
       fee_type, admission_fee || 0, discount || 0, discount_reason, dueDaySafe, photo_url || null, rollNo, aid]
    );
    if (email) { const { addContactToResend } = require("../email"); addContactToResend(name, email).catch(console.error); }
    res.json(rows[0]);
  } catch (e) {
    console.error("Create student error:", e.message);
    res.status(500).json({ error: "Failed to create student" });
  }
});

router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { batch_id, name, phone, parent_phone, email, address, dob, gender,
            fee_type, admission_fee, discount, discount_reason, status, due_day, photo_url } = req.body;
    const dueDaySafe = Math.min(Math.max(parseInt(due_day) || 10, 1), 28);
    const whereClause = aid ? "WHERE id=$16 AND academy_id=$17" : "WHERE id=$16";
    const params = [
      batch_id, name, phone, parent_phone, email, address, dob, gender, fee_type,
      admission_fee, discount, discount_reason, status, dueDaySafe, photo_url || null,
      req.params.id,
    ];
    if (aid) params.push(aid);
    const { rows } = await db.query(
      `UPDATE students SET batch_id=$1, name=$2, phone=$3, parent_phone=$4, email=$5, address=$6,
        dob=$7, gender=$8, fee_type=$9, admission_fee=$10, discount=$11, discount_reason=$12,
        status=$13, due_day=$14, photo_url=$15 ${whereClause} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found in your academy" });
    if (email) { const { addContactToResend } = require("../email"); addContactToResend(name, email).catch(console.error); }
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to update student" }); }
});

router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const whereClause = aid ? "WHERE id=$1 AND academy_id=$2" : "WHERE id=$1";
    const params = aid ? [req.params.id, aid] : [req.params.id];
    const { rowCount } = await db.query(`DELETE FROM students ${whereClause}`, params);
    if (rowCount === 0) return res.status(404).json({ error: "Student not found in your academy" });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete student" }); }
});

// Send fee summary email — passes academy info for dynamic branding
router.post("/:id/send-email", auth, async (req, res) => {
  if (req.user.role === "student" && req.user.id !== parseInt(req.params.id))
    return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    if (req.user.role !== "student" && aid) {
      const { rows: check } = await db.query(
        `SELECT id FROM students WHERE id=$1 AND academy_id=$2`, [req.params.id, aid]
      );
      if (!check[0]) return res.status(403).json({ error: "Student does not belong to your academy" });
    }
    const { sendFeeSummaryEmail } = require("../email");
    const [stuRes, feeRes, payRes, attRes, testRes, acadRes] = await Promise.all([
      db.query(`SELECT s.*, b.name AS batch_name, br.name AS branch_name FROM students s LEFT JOIN batches b ON b.id=s.batch_id LEFT JOIN branches br ON br.id=s.branch_id WHERE s.id=$1`, [req.params.id]),
      db.query("SELECT * FROM fee_records WHERE student_id=$1 ORDER BY due_date DESC", [req.params.id]),
      db.query(`SELECT p.*, fr.period_label FROM payments p JOIN fee_records fr ON fr.id=p.fee_record_id WHERE p.student_id=$1 ORDER BY p.paid_on DESC`, [req.params.id]),
      db.query("SELECT * FROM attendance WHERE student_id=$1 ORDER BY year DESC, month DESC", [req.params.id]),
      db.query(`SELECT tr.*, t.name AS test_name, t.subject, t.total_marks, t.test_date, ROUND((tr.marks/t.total_marks::numeric)*100,1) AS percentage FROM test_results tr JOIN tests t ON t.id=tr.test_id WHERE tr.student_id=$1 ORDER BY t.test_date DESC`, [req.params.id]),
      aid ? db.query(`SELECT name, phone, primary_color, accent_color FROM academies WHERE id=$1`, [aid]) : Promise.resolve({ rows: [{}] }),
    ]);
    if (!stuRes.rows[0]) return res.status(404).json({ error: "Student not found" });
    if (!stuRes.rows[0].email) return res.status(400).json({ error: "Student has no email address" });
    const result = await sendFeeSummaryEmail({
      student:    stuRes.rows[0],
      fees:       feeRes.rows,
      payments:   payRes.rows,
      attendance: attRes.rows,
      tests:      testRes.rows,
      academy:    acadRes.rows[0] || {},
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: "Failed to send email" }); }
});

module.exports = router;
