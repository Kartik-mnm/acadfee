const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Get attendance list
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { month, year, student_id } = req.query;
    let cond = []; let params = []; let i = 1;

    if (req.user.role === "student") {
      cond.push(`a.student_id=$${i++}`);
      params.push(req.user.id);
    } else {
      if (student_id)        { cond.push(`a.student_id=$${i++}`); params.push(student_id); }
      else if (req.branchId) { cond.push(`a.branch_id=$${i++}`);  params.push(req.branchId); }
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
  } catch (e) {
    console.error("Get attendance error:", e.message);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Save / update attendance
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    let { student_id, month, year, total_days, present } = req.body;
    if (!student_id || !month || !year) return res.status(400).json({ error: "student_id, month and year are required" });
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
  } catch (e) {
    console.error("Save attendance error:", e.message);
    res.status(500).json({ error: "Failed to save attendance" });
  }
});

// Bulk save attendance — wrapped in a transaction so it's all-or-nothing (#9)
router.post("/bulk", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0)
    return res.status(400).json({ error: "records array is required" });

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    let saved = 0;
    for (const r of records) {
      const total_days = parseInt(r.total_days) || 0;
      const present    = Math.min(parseInt(r.present) || 0, total_days);
      const { rows: sRows } = await client.query("SELECT branch_id FROM students WHERE id=$1", [r.student_id]);
      if (!sRows[0]) continue;
      await client.query(
        `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (student_id, month, year)
         DO UPDATE SET total_days=$5, present=LEAST($6, $5)`,
        [r.student_id, sRows[0].branch_id, r.month, r.year, total_days, present]
      );
      saved++;
    }
    await client.query("COMMIT");
    res.json({ saved });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Bulk attendance error:", e.message);
    res.status(500).json({ error: "Bulk save failed — all changes rolled back" });
  } finally {
    client.release();
  }
});

module.exports = router;
