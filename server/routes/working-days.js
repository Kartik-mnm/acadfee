const router = require("express").Router();
const db     = require("../db");
const { auth, branchFilter } = require("../middleware");

// GET /api/working-days?month=3&year=2026&branch_id=1
router.get("/", auth, branchFilter, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: "month and year required" });
  const branchCond = req.branchId ? "AND wd.branch_id = $3" : "";
  const params = req.branchId ? [year, month, req.branchId] : [year, month];
  const { rows } = await db.query(
    `SELECT wd.*, u.name AS marked_by_name
     FROM working_days wd
     LEFT JOIN users u ON u.id = wd.marked_by
     WHERE EXTRACT(YEAR FROM wd.date) = $1
       AND EXTRACT(MONTH FROM wd.date) = $2
       ${branchCond}
     ORDER BY wd.date`,
    params
  );
  res.json(rows);
});

// POST /api/working-days — mark a date as working or holiday
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { date, is_working, note, branch_id } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  if (!bid) return res.status(400).json({ error: "branch_id required" });
  try {
    const { rows } = await db.query(
      `INSERT INTO working_days (branch_id, date, is_working, note, marked_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (branch_id, date)
       DO UPDATE SET is_working = $3, note = $4, marked_by = $5
       RETURNING *`,
      [bid, date, is_working !== false, note || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/working-days/:date — remove marking (reverts to default working day)
router.delete("/:date", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const bid = req.user.role === "super_admin" ? req.query.branch_id : req.user.branch_id;
  await db.query("DELETE FROM working_days WHERE date = $1 AND branch_id = $2", [req.params.date, bid]);
  res.json({ success: true });
});

// GET /api/working-days/check/:date — check if a date is working
router.get("/check/:date", auth, async (req, res) => {
  const bid = req.user.role === "super_admin" ? req.query.branch_id : req.user.branch_id;
  const { rows } = await db.query("SELECT * FROM working_days WHERE date = $1 AND branch_id = $2", [req.params.date, bid]);
  const isWorking = rows.length === 0 ? true : rows[0].is_working;
  res.json({ date: req.params.date, is_working: isWorking, record: rows[0] || null });
});

module.exports = router;
