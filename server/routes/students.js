const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter, studentSelf } = require("../middleware");

// #5 — Students list: students can only see their own record
// #13 — Pagination: 20 records per page via ?page=1
// #14 — Backend search: ?search=name/phone searched in DB
router.get("/", auth, branchFilter, studentSelf, async (req, res) => {
  if (req.user.role === "student") {
    const { rows } = await db.query(
      `SELECT s.*, b.name AS batch_name, br.name AS branch_name
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       LEFT JOIN branches br ON br.id = s.branch_id
       WHERE s.id = $1`, [req.user.id]
    );
    return res.json(rows);
  }

  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  let conditions = [];
  let params     = [];
  let idx        = 1;

  if (req.branchId)        { conditions.push(`s.branch_id = $${idx++}`); params.push(req.branchId); }
  if (req.query.batch_id)  { conditions.push(`s.batch_id = $${idx++}`);  params.push(req.query.batch_id); }
  if (req.query.status)    { conditions.push(`s.status = $${idx++}`);    params.push(req.query.status); }
  if (search) {
    conditions.push(`(s.name ILIKE $${idx} OR s.phone ILIKE $${idx} OR s.parent_phone ILIKE $${idx} OR s.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const { rows: countRows } = await db.query(`SELECT COUNT(*) FROM students s ${where}`, [...params]);
  const total      = parseInt(countRows[0].count);
  const totalPages = Math.ceil(total / limit);

  params.push(limit);
  params.push(offset);

  const { rows } = await db.query(
    `SELECT s.*, b.name AS batch_name, br.name AS branch_name
     FROM students s
     LEFT JOIN batches b ON b.id = s.batch_id
     LEFT JOIN branches br ON br.id = s.branch_id
     ${where}
     ORDER BY s.id DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  res.json({ data: rows, page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 });
});

router.get("/:id", auth, studentSelf, async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, b.name AS batch_name, br.name AS branch_name
     FROM students s
     LEFT JOIN batches b ON b.id = s.batch_id
     LEFT JOIN branches br ON br.id = s.branch_id
     WHERE s.id=$1`, [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender, admission_date, fee_type, admission_fee, discount, discount_reason, due_day, photo_url } = req.body;
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  const dueDaySafe = Math.min(Math.max(parseInt(due_day) || 10, 1), 28);
  try {
    const { rows } = await db.query(
      `INSERT INTO students (branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender, admission_date, fee_type, admission_fee, discount, discount_reason, due_day, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [bid, batch_id, name, phone, parent_phone, email, address, dob, gender, admission_date, fee_type, admission_fee || 0, discount || 0, discount_reason, dueDaySafe, photo_url || null]
    );
    if (email) { const { addContactToResend } = require("../email"); addContactToResend(name, email).catch(console.error); }
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { batch_id, name, phone, parent_phone, email, address, dob, gender, fee_type, admission_fee, discount, discount_reason, status, due_day, photo_url } = req.body;
  const dueDaySafe = Math.min(Math.max(parseInt(due_day) || 10, 1), 28);
  const { rows } = await db.query(
    `UPDATE students SET batch_id=$1, name=$2, phone=$3, parent_phone=$4, email=$5, address=$6, dob=$7, gender=$8, fee_type=$9, admission_fee=$10, discount=$11, discount_reason=$12, status=$13, due_day=$14, photo_url=$15 WHERE id=$16 RETURNING *`,
    [batch_id, name, phone, parent_phone, email, address, dob, gender, fee_type, admission_fee, discount, discount_reason, status, dueDaySafe, photo_url || null, req.params.id]
  );
  if (email) { const { addContactToResend } = require("../email"); addContactToResend(name, email).catch(console.error); }
  res.json(rows[0]);
});

router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  await db.query("DELETE FROM students WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

router.post("/:id/send-email", auth, async (req, res) => {
  if (req.user.role === "student" && req.user.id !== parseInt(req.params.id)) return res.status(403).json({ error: "Access denied" });
  const { sendFeeSummaryEmail } = require("../email");
  try {
    const [stuRes, feeRes, payRes, attRes, testRes] = await Promise.all([
      db.query(`SELECT s.*, b.name AS batch_name, br.name AS branch_name FROM students s LEFT JOIN batches b ON b.id = s.batch_id LEFT JOIN branches br ON br.id = s.branch_id WHERE s.id=$1`, [req.params.id]),
      db.query("SELECT * FROM fee_records WHERE student_id=$1 ORDER BY due_date DESC", [req.params.id]),
      db.query(`SELECT p.*, fr.period_label FROM payments p JOIN fee_records fr ON fr.id = p.fee_record_id WHERE p.student_id=$1 ORDER BY p.paid_on DESC`, [req.params.id]),
      db.query("SELECT * FROM attendance WHERE student_id=$1 ORDER BY year DESC, month DESC", [req.params.id]),
      db.query(`SELECT tr.*, t.name AS test_name, t.subject, t.total_marks, t.test_date, ROUND((tr.marks / t.total_marks::numeric) * 100, 1) AS percentage FROM test_results tr JOIN tests t ON t.id = tr.test_id WHERE tr.student_id=$1 ORDER BY t.test_date DESC`, [req.params.id]),
    ]);
    if (!stuRes.rows[0]) return res.status(404).json({ error: "Student not found" });
    if (!stuRes.rows[0].email) return res.status(400).json({ error: "Student has no email address!" });
    const result = await sendFeeSummaryEmail({ student: stuRes.rows[0], fees: feeRes.rows, payments: payRes.rows, attendance: attRes.rows, tests: testRes.rows });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
