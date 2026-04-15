const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Ensure tests and test_results tables exist with all needed columns
async function ensureTestsTables() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY,
      branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
      batch_id  INT REFERENCES batches(id)  ON DELETE SET NULL,
      name      TEXT NOT NULL,
      subject   TEXT,
      total_marks NUMERIC NOT NULL DEFAULT 100,
      test_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS test_results (
      id SERIAL PRIMARY KEY,
      test_id    INT NOT NULL REFERENCES tests(id)    ON DELETE CASCADE,
      student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      marks      NUMERIC,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(test_id, student_id)
    )`);
    // Add any missing columns to existing tables
    for (const col of ["subject TEXT", "batch_id INT", "branch_id INT"]) {
      await db.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
    }
  } catch (e) {
    console.error("[tests] table ensure error:", e.message);
  }
}
ensureTestsTables();

// Normalize date to YYYY-MM-DD — handles both YYYY-MM-DD and DD-MM-YYYY
function normalizeDate(raw) {
  if (!raw) return new Date().toISOString().split("T")[0];
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD-MM-YYYY → YYYY-MM-DD
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("-");
    return `${y}-${m}-${d}`;
  }
  // DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m}-${d}`;
  }
  // fallback — let Postgres try to parse it
  return raw;
}

// GET /api/tests — list tests scoped to academy
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    let cond, params;
    if (req.branchId) {
      cond = "WHERE t.branch_id=$1"; params = [req.branchId];
    } else if (aid) {
      cond = "WHERE br.academy_id=$1"; params = [aid];
    } else {
      cond = ""; params = [];
    }
    const { rows } = await db.query(
      `SELECT t.*, b.name AS batch_name, br.name AS branch_name,
              COUNT(tr.id) AS result_count
       FROM tests t
       LEFT JOIN batches  b  ON b.id  = t.batch_id
       JOIN  branches br ON br.id = t.branch_id
       LEFT JOIN test_results tr ON tr.test_id = t.id
       ${cond}
       GROUP BY t.id, b.name, br.name
       ORDER BY t.test_date DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("List tests error:", e.message);
    res.status(500).json({ error: "Failed to fetch tests: " + e.message });
  }
});

// POST /api/tests — create test
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, batch_id, name, subject, total_marks, test_date } = req.body;
    if (!name || !total_marks)
      return res.status(400).json({ error: "name and total_marks are required" });

    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    if (!bid) return res.status(400).json({ error: "branch_id is required" });

    const aid = req.academyId;
    if (aid) {
      const { rows: brRows } = await db.query(
        `SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]
      );
      if (!brRows[0]) return res.status(403).json({ error: "Branch does not belong to your academy" });
    }

    // Normalize date — handles DD-MM-YYYY from Indian locale browsers
    const safeDate = normalizeDate(test_date);

    const { rows } = await db.query(
      `INSERT INTO tests (branch_id, batch_id, name, subject, total_marks, test_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [bid, batch_id || null, name, subject || null, total_marks, safeDate]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create test error:", e.message);
    res.status(500).json({ error: "Failed to create test: " + e.message });
  }
});

// DELETE /api/tests/:id
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { rows: existing } = await db.query(
      `SELECT t.*, br.academy_id FROM tests t
       JOIN branches br ON br.id=t.branch_id WHERE t.id=$1`,
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: "Test not found" });
    if (aid && existing[0].academy_id && existing[0].academy_id !== aid)
      return res.status(403).json({ error: "Access denied" });
    await db.query("DELETE FROM tests WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Delete test error:", e.message);
    res.status(500).json({ error: "Failed to delete test: " + e.message });
  }
});

// GET /api/tests/:id/results
router.get("/:id/results", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { rows: testRows } = await db.query(
      `SELECT t.*, br.academy_id FROM tests t
       JOIN branches br ON br.id=t.branch_id WHERE t.id=$1`,
      [req.params.id]
    );
    if (!testRows[0]) return res.status(404).json({ error: "Test not found" });
    if (aid && testRows[0].academy_id && testRows[0].academy_id !== aid)
      return res.status(403).json({ error: "Access denied" });

    const { rows } = await db.query(
      `SELECT tr.*, s.name AS student_name, s.phone, s.photo_url, s.roll_no,
              ROUND((tr.marks / t.total_marks::numeric) * 100, 1) AS percentage
       FROM test_results tr
       JOIN students s ON s.id = tr.student_id
       JOIN tests    t ON t.id = tr.test_id
       WHERE tr.test_id=$1
       ORDER BY tr.marks DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (e) {
    console.error("Get results error:", e.message);
    res.status(500).json({ error: "Failed to fetch results: " + e.message });
  }
});

// POST /api/tests/:id/results — bulk save marks
router.post("/:id/results", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0)
    return res.status(400).json({ error: "results array is required" });
  try {
    const aid = req.academyId;
    const { rows: testRows } = await db.query(
      `SELECT t.*, br.academy_id FROM tests t
       JOIN branches br ON br.id=t.branch_id WHERE t.id=$1`,
      [req.params.id]
    );
    if (!testRows[0]) return res.status(404).json({ error: "Test not found" });
    if (aid && testRows[0].academy_id && testRows[0].academy_id !== aid)
      return res.status(403).json({ error: "Access denied" });
  } catch (e) {
    return res.status(500).json({ error: "Failed to verify test" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    let saved = 0;
    for (const r of results) {
      if (r.marks === "" || r.marks === null || r.marks === undefined) continue;
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
    res.status(500).json({ error: "Failed to save results: " + e.message });
  } finally { client.release(); }
});

// GET /api/tests/student/:studentId — student performance
router.get("/student/:studentId", auth, async (req, res) => {
  if (req.user.role === "student" && req.user.id !== parseInt(req.params.studentId))
    return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    if (req.user.role !== "student" && aid) {
      const { rows: sRows } = await db.query(
        `SELECT id FROM students WHERE id=$1 AND academy_id=$2`,
        [req.params.studentId, aid]
      );
      if (!sRows[0]) return res.status(403).json({ error: "Student does not belong to your academy" });
    }
    const { rows } = await db.query(
      `SELECT t.name AS test_name, t.subject, t.total_marks, t.test_date,
              tr.marks, ROUND((tr.marks / t.total_marks::numeric) * 100, 1) AS percentage
       FROM test_results tr
       JOIN tests t ON t.id = tr.test_id
       WHERE tr.student_id=$1
       ORDER BY t.test_date DESC`,
      [req.params.studentId]
    );
    res.json(rows);
  } catch (e) {
    console.error("Student performance error:", e.message);
    res.status(500).json({ error: "Failed to fetch performance" });
  }
});

module.exports = router;
