const router = require("express").Router();
const db     = require("../db");
const { auth, branchFilter } = require("../middleware");

// GET /api/working-days — scoped to academy's branches only
router.get("/", auth, branchFilter, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: "month and year required" });
  const aid = req.academyId;
  let conds = [
    `EXTRACT(YEAR  FROM wd.date) = $1`,
    `EXTRACT(MONTH FROM wd.date) = $2`,
  ];
  let params = [year, month];
  let idx = 3;
  if (req.branchId) {
    conds.push(`wd.branch_id = $${idx++}`); params.push(req.branchId);
  } else if (aid) {
    // Only return working-day records for branches that belong to this academy
    conds.push(`wd.branch_id IN (SELECT id FROM branches WHERE academy_id = $${idx++})`); params.push(aid);
  }
  const { rows } = await db.query(
    `SELECT wd.*, u.name AS marked_by_name FROM working_days wd
     LEFT JOIN users u ON u.id = wd.marked_by
     WHERE ${conds.join(" AND ")} ORDER BY wd.date`,
    params
  );
  res.json(rows);
});

// POST /api/working-days — FIX: verify branch belongs to this academy
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const { date, is_working, note, branch_id } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  if (!bid) return res.status(400).json({ error: "branch_id required" });

  // Verify branch belongs to this academy
  const aid = req.academyId;
  if (aid) {
    const { rows: brRows } = await db.query(`SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]);
    if (!brRows[0]) return res.status(403).json({ error: "Branch does not belong to your academy" });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO working_days (branch_id, date, is_working, note, marked_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (branch_id, date)
       DO UPDATE SET is_working=$3, note=$4, marked_by=$5
       RETURNING *`,
      [bid, date, is_working !== false, note || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/working-days/:date — FIX: verify branch belongs to this academy
router.delete("/:date", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  const bid = req.user.role === "super_admin" ? req.query.branch_id : req.user.branch_id;
  const aid = req.academyId;
  if (aid) {
    const { rows: brRows } = await db.query(`SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]);
    if (!brRows[0]) return res.status(403).json({ error: "Branch does not belong to your academy" });
  }
  await db.query("DELETE FROM working_days WHERE date=$1 AND branch_id=$2", [req.params.date, bid]);
  res.json({ success: true });
});

// GET /api/working-days/check/:date
router.get("/check/:date", auth, async (req, res) => {
  const bid = req.user.role === "super_admin" ? req.query.branch_id : req.user.branch_id;
  const aid = req.academyId;

  if (!bid) return res.status(400).json({ error: "branch_id required" });

  if (aid) {
    const { rows: brRows } = await db.query(`SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]);
    if (!brRows[0]) return res.status(403).json({ error: "Access denied: branch from different academy" });
  }

  const { rows } = await db.query("SELECT * FROM working_days WHERE date=$1 AND branch_id=$2", [req.params.date, bid]);
  const isWorking = rows.length === 0 ? true : rows[0].is_working;
  res.json({ date: req.params.date, is_working: isWorking, record: rows[0] || null });
});

module.exports = router;
