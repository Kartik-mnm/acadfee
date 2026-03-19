const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

const CATEGORIES = ["Rent", "Salary", "Utilities", "Stationery", "Marketing", "Maintenance", "Other"];

router.get("/categories", auth, (_, res) => res.json(CATEGORIES));

// List expenses
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const { month, year } = req.query;
    let cond = []; let params = []; let i = 1;
    if (req.branchId) { cond.push(`e.branch_id=$${i++}`); params.push(req.branchId); }
    if (month) { cond.push(`EXTRACT(MONTH FROM e.expense_date)=$${i++}`); params.push(month); }
    if (year)  { cond.push(`EXTRACT(YEAR FROM e.expense_date)=$${i++}`);  params.push(year); }
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
  } catch (e) {
    console.error("List expenses error:", e.message);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// Add expense
router.post("/", auth, async (req, res) => {
  try {
    const { branch_id, title, amount, category, expense_date, notes } = req.body;
    if (!title || !amount || !expense_date) return res.status(400).json({ error: "title, amount and expense_date are required" });
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(", ")}` });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    const { rows } = await db.query(
      `INSERT INTO expenses (branch_id, title, amount, category, expense_date, notes, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [bid, title, amount, category, expense_date, notes, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Add expense error:", e.message);
    res.status(500).json({ error: "Failed to add expense" });
  }
});

// Delete expense — only the branch that owns it can delete (#new: ownership check)
router.delete("/:id", auth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT branch_id, added_by FROM expenses WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Expense not found" });
    // super_admin can delete any; branch_manager can only delete own branch's expenses
    if (req.user.role !== "super_admin" && rows[0].branch_id !== req.user.branch_id)
      return res.status(403).json({ error: "Access denied: you can only delete expenses from your own branch" });
    await db.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Delete expense error:", e.message);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// Summary by category
router.get("/summary", auth, branchFilter, async (req, res) => {
  try {
    const { month, year } = req.query;
    let cond = []; let params = []; let i = 1;
    if (req.branchId) { cond.push(`branch_id=$${i++}`); params.push(req.branchId); }
    if (month) { cond.push(`EXTRACT(MONTH FROM expense_date)=$${i++}`); params.push(month); }
    if (year)  { cond.push(`EXTRACT(YEAR FROM expense_date)=$${i++}`);  params.push(year); }
    const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT category, COALESCE(SUM(amount),0) AS total
       FROM expenses ${where} GROUP BY category ORDER BY total DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("Expense summary error:", e.message);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

module.exports = router;
