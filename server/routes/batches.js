const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List batches — scoped to academy
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const aid = req.academyId;
    let q, params;
    if (req.branchId) {
      q = `SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id
           WHERE b.branch_id=$1 ORDER BY b.id`;
      params = [req.branchId];
    } else if (aid) {
      q = `SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id
           WHERE br.academy_id=$1 ORDER BY b.id`;
      params = [aid];
    } else {
      q = `SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id
           WHERE br.academy_id IS NULL ORDER BY b.id`;
      params = [];
    }
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch batches" }); }
});

// Create batch
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course, start_date, end_date } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    const { rows } = await db.query(
      `INSERT INTO batches (branch_id, name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [bid, name, subjects, fee_monthly||0, fee_quarterly||0, fee_yearly||0, fee_course||0, start_date||null, end_date||null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to create batch" }); }
});

// Update batch
router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows: existing } = await db.query("SELECT branch_id FROM batches WHERE id=$1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Batch not found" });
    if (req.user.role === "branch_manager" && existing[0].branch_id !== req.user.branch_id)
      return res.status(403).json({ error: "Access denied" });
    const { name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course, start_date, end_date } = req.body;
    const { rows } = await db.query(
      `UPDATE batches SET name=$1, subjects=$2, fee_monthly=$3, fee_quarterly=$4, fee_yearly=$5,
        fee_course=$6, start_date=$7, end_date=$8 WHERE id=$9 RETURNING *`,
      [name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course, start_date||null, end_date||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to update batch" }); }
});

// Delete batch
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { rows: existing } = await db.query("SELECT branch_id FROM batches WHERE id=$1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Batch not found" });
    if (req.user.role === "branch_manager" && existing[0].branch_id !== req.user.branch_id)
      return res.status(403).json({ error: "Access denied" });
    await db.query("DELETE FROM batches WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete batch" }); }
});

module.exports = router;
