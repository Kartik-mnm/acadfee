const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Get attendance list
router.get("/", auth, branchFilter, async (req, res) => {
  const { month, year, student_id } = req.query;
  let cond = []; let params = []; let i = 1;

  // #5 — Students can only see their own attendance
  if (req.user.role === "student") {
    cond.push(`a.student_id=$${i++}`);
    params.push(req.user.id);
  } else {
    if (student_id)      { cond.push(`a.student_id=$${i++}`); params.push(student_id); }
    else if (req.branchId) { cond.push(`a.branch_id=$${i++}`); params.push(req.branchId); }
  }

  if (month) { cond.push(`a.month=$${i++}`); params.push(month); }
  if (year)  { cond.push(`a.year=$${i++}`);  params.push(year); }

  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const { rows } = await db.query(
    `SELECT a.*, s.name AS student_name, s.phone, b.name AS batch_name, br.name AS branch_name,
            LEAST(ROUND((a.present::numeric / NULLIF(a.total_days,0)) * 100, 1), 100) AS percentage
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     LEFT JOIN batches b ON b.id = s.batch_id
     JOIN branches br ON br.id = a.branch_id
     ${where} ORDER BY a.year DESC, a.month DESC, s.name`,
    params
  );
  res.json(rows);
});

// Save / update attendance — students cannot manually edit
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  let { student_id, month, year, total_days, present } = req.body;
  total_days = parseInt(total_days) || 0;
  present    = Math.min(parseInt(present) || 0, total_days);

  const { rows: sRows } = await db.query("SELECT branch_id FROM students WHERE id=$1", [student_id]);
  if (!sRows[0]) return res.status(404).json({ error: "Student not found" });
  const { rows } = await db.query(
    `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (student_id, month, year)
     DO UPDATE SET total_days=$5, present=LEAST($6, $5)
     RETURNING *`,
    [student_id, sRows[0].branch_id, month, year, total_days, present]
  );
  res.json(rows[0]);
});

// Bulk save attendance — students cannot
router.post("/bulk", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { records } = req.body;
  let saved = 0;
  for (const r of records) {
    const total_days = parseInt(r.total_days) || 0;
    const present    = Math.min(parseInt(r.present) || 0, total_days);
    const { rows: sRows } = await db.query("SELECT branch_id FROM students WHERE id=$1", [r.student_id]);
    if (!sRows[0]) continue;
    await db.query(
      `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_id, month, year)
       DO UPDATE SET total_days=$5, present=LEAST($6, $5)`,
      [r.student_id, sRows[0].branch_id, r.month, r.year, total_days, present]
    );
    saved++;
  }
  res.json({ saved });
});

module.exports = router;
