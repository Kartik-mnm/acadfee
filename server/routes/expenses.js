const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

const CATEGORIES = ["Rent", "Salary", "Utilities", "Stationery", "Marketing", "Maintenance", "Other"];

router.get("/categories", auth, (_, res) => res.json(CATEGORIES));

// List expenses
router.get("/", auth, branchFilter, async (req, res) => {
  const { month, year } = req.query;
  let cond = []; let params = []; let i = 1;
  if (req.branchId) { cond.push(`e.branch_id=$${i++}`); params.push(req.branchId); }
  if (month) { cond.push(`EXTRACT(MONTH FROM e.expense_date)=$${i++}`); params.push(month); }
  if (year)  { cond.push(`EXTRACT(YEAR FROM e.expense_date)=$${i++}`); params.push(year); }
  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const { rows } = await db.query(
    `SELECT e.*, br.name AS branch_name, u.name AS added_by_name
     FROM expenses e
     JOIN branches br ON br.id = e.branch_id
     LEFT JOIN users u ON u.id = e.added_by
     ${where} ORDER BY e.expense_date DESC`,
    params
  );
  res.json(rows);
});

// Add expense
router.post("/", auth, async (req, res) => {
  const { branch_id, title, amount, category, expense_date, notes } = req.body;
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  const { rows } = await db.query(
    `INSERT INTO expenses (branch_id, title, amount, category, expense_date, notes, added_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [bid, title, amount, category, expense_date, notes, req.user.id]
  );
  res.json(rows[0]);
});

// Delete expense
router.delete("/:id", auth, async (req, res) => {
  await db.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// Summary by category
router.get("/summary", auth, branchFilter, async (req, res) => {
  const { month, year } = req.query;
  let cond = []; let params = []; let i = 1;
  if (req.branchId) { cond.push(`branch_id=$${i++}`); params.push(req.branchId); }
  if (month) { cond.push(`EXTRACT(MONTH FROM expense_date)=$${i++}`); params.push(month); }
  if (year)  { cond.push(`EXTRACT(YEAR FROM expense_date)=$${i++}`); params.push(year); }
  const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const { rows } = await db.query(
    `SELECT category, COALESCE(SUM(amount),0) AS total
     FROM expenses ${where} GROUP BY category ORDER BY total DESC`,
    params
  );
  res.json(rows);
});

module.exports = router;
