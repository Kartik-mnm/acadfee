const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List tests
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
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
  } catch (e) {
    console.error("List tests error:", e.message);
    res.status(500).json({ error: "Failed to fetch tests" });
  }
});

// Create test
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, batch_id, name, subject, total_marks, test_date } = req.body;
    if (!name || !subject || !total_marks || !test_date)
      return res.status(400).json({ error: "name, subject, total_marks and test_date are required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    const { rows } = await db.query(
      `INSERT INTO tests (branch_id, batch_id, name, subject, total_marks, test_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [bid, batch_id, name, subject, total_marks, test_date]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create test error:", e.message);
    res.status(500).json({ error: "Failed to create test" });
  }
});

// Delete test
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    await db.query("DELETE FROM tests WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Delete test error:", e.message);
    res.status(500).json({ error: "Failed to delete test" });
  }
});

// Get results for a test
router.get("/:id/results", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
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
  } catch (e) {
    console.error("Get results error:", e.message);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// Save bulk results — wrapped in transaction so it's all-or-nothing
router.post("/:id/results", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0)
    return res.status(400).json({ error: "results array is required" });

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    let saved = 0;
    for (const r of results) {
      await client.query(
        `INSERT INTO test_results (test_id, student_id, marks)
         VALUES ($1,$2,$3)
         ON CONFLICT (test_id, student_id) DO UPDATE SET marks=$3`,
        [req.params.id, r.student_id, r.marks]
      );
      saved++;
    }
    await client.query("COMMIT");
    res.json({ saved });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Bulk results save error:", e.message);
    res.status(500).json({ error: "Failed to save results — all changes rolled back" });
  } finally {
    client.release();
  }
});

// Student performance summary — students can only see their own
router.get("/student/:studentId", auth, async (req, res) => {
  if (req.user.role === "student" && req.user.id !== parseInt(req.params.studentId))
    return res.status(403).json({ error: "Access denied" });
  try {
    const { rows } = await db.query(
      `SELECT t.name AS test_name, t.subject, t.total_marks, t.test_date,
              tr.marks, ROUND((tr.marks / t.total_marks::numeric) * 100, 1) AS percentage
       FROM test_results tr
       JOIN tests t ON t.id = tr.test_id
       WHERE tr.student_id=$1 ORDER BY t.test_date DESC`,
      [req.params.studentId]
    );
    res.json(rows);
  } catch (e) {
    console.error("Student performance error:", e.message);
    res.status(500).json({ error: "Failed to fetch performance" });
  }
});

module.exports = router;
