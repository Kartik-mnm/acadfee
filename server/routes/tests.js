const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List tests — students cannot access this list page
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const cond = req.branchId ? "WHERE t.branch_id=$1" : "";
  const { rows } = await db.query(
    `SELECT t.*, b.name AS batch_name, br.name AS branch_name,
            COUNT(tr.id) AS result_count
     FROM tests t
     LEFT JOIN batches b ON b.id = t.batch_id
     JOIN branches br ON br.id = t.branch_id
     LEFT JOIN test_results tr ON tr.test_id = t.id
     ${cond} GROUP BY t.id, b.name, br.name ORDER BY t.test_date DESC`,
    req.branchId ? [req.branchId] : []
  );
  res.json(rows);
});

// Create test — students cannot
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { branch_id, batch_id, name, subject, total_marks, test_date } = req.body;
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  const { rows } = await db.query(
    `INSERT INTO tests (branch_id, batch_id, name, subject, total_marks, test_date)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [bid, batch_id, name, subject, total_marks, test_date]
  );
  res.json(rows[0]);
});

// Delete test — students cannot
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  await db.query("DELETE FROM tests WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// Get results for a test — students cannot access raw test results
router.get("/:id/results", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { rows } = await db.query(
    `SELECT tr.*, s.name AS student_name, s.phone,
            ROUND((tr.marks / t.total_marks::numeric) * 100, 1) AS percentage
     FROM test_results tr
     JOIN students s ON s.id = tr.student_id
     JOIN tests t ON t.id = tr.test_id
     WHERE tr.test_id=$1 ORDER BY tr.marks DESC`,
    [req.params.id]
  );
  res.json(rows);
});

// Save results for a test (bulk) — students cannot
router.post("/:id/results", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { results } = req.body;
  let saved = 0;
  for (const r of results) {
    await db.query(
      `INSERT INTO test_results (test_id, student_id, marks)
       VALUES ($1,$2,$3)
       ON CONFLICT (test_id, student_id) DO UPDATE SET marks=$3`,
      [req.params.id, r.student_id, r.marks]
    );
    saved++;
  }
  res.json({ saved });
});

// #5 — Student performance summary: students can only see their own
router.get("/student/:studentId", auth, async (req, res) => {
  // Students can only access their own test results
  if (req.user.role === "student" && req.user.id !== parseInt(req.params.studentId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { rows } = await db.query(
    `SELECT t.name AS test_name, t.subject, t.total_marks, t.test_date,
            tr.marks, ROUND((tr.marks / t.total_marks::numeric) * 100, 1) AS percentage
     FROM test_results tr
     JOIN tests t ON t.id = tr.test_id
     WHERE tr.student_id=$1 ORDER BY t.test_date DESC`,
    [req.params.studentId]
  );
  res.json(rows);
});

module.exports = router;
