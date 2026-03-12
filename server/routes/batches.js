const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

router.get("/", auth, branchFilter, async (req, res) => {
  const q = req.branchId
    ? "SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id WHERE b.branch_id=$1 ORDER BY b.id"
    : "SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id ORDER BY b.id";
  const { rows } = await db.query(q, req.branchId ? [req.branchId] : []);
  res.json(rows);
});

router.post("/", auth, async (req, res) => {
  const { branch_id, name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course } = req.body;
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  const { rows } = await db.query(
    `INSERT INTO batches (branch_id, name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [bid, name, subjects, fee_monthly || 0, fee_quarterly || 0, fee_yearly || 0, fee_course || 0]
  );
  res.json(rows[0]);
});

router.put("/:id", auth, async (req, res) => {
  const { name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course } = req.body;
  const { rows } = await db.query(
    `UPDATE batches SET name=$1, subjects=$2, fee_monthly=$3, fee_quarterly=$4, fee_yearly=$5, fee_course=$6 WHERE id=$7 RETURNING *`,
    [name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course, req.params.id]
  );
  res.json(rows[0]);
});

router.delete("/:id", auth, async (req, res) => {
  await db.query("DELETE FROM batches WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
