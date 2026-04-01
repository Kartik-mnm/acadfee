const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Fixed list of categories — no separate endpoint needed
const EXPENSE_CATEGORIES = ["Rent", "Salary", "Utilities", "Stationery", "Marketing", "Maintenance", "Other"];

// GET /api/expenses/categories — FIX: was 404, now returns static list
router.get("/categories", auth, (req, res) => {
  res.json(EXPENSE_CATEGORIES);
});

// GET /api/expenses/summary — FIX: was 404, now returns category totals for the month
router.get("/summary", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { month, year } = req.query;
    const aid = req.academyId;
    const bid = req.branchId;
    let conditions = [`EXTRACT(MONTH FROM e.expense_date) = $1`, `EXTRACT(YEAR FROM e.expense_date) = $2`];
    let params = [month || new Date().getMonth() + 1, year || new Date().getFullYear()];
    let idx = 3;
    if (aid) { conditions.push(`br.academy_id=$${idx++}`); params.push(aid); }
    if (bid) { conditions.push(`e.branch_id=$${idx++}`);   params.push(bid); }
    const { rows } = await db.query(
      `SELECT e.category, SUM(e.amount)::numeric AS total
       FROM expenses e JOIN branches br ON br.id=e.branch_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY e.category ORDER BY total DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch summary" }); }
});

// GET /api/expenses — scoped to academy
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { month, year } = req.query;
    const aid = req.academyId;
    const bid = req.branchId;
    let conditions = []; let params = []; let idx = 1;
    if (aid) { conditions.push(`br.academy_id=$${idx++}`); params.push(aid); }
    if (bid) { conditions.push(`e.branch_id=$${idx++}`);   params.push(bid); }
    if (month) { conditions.push(`EXTRACT(MONTH FROM e.expense_date) = $${idx++}`); params.push(month); }
    if (year)  { conditions.push(`EXTRACT(YEAR  FROM e.expense_date) = $${idx++}`); params.push(year); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT e.*, br.name AS branch_name FROM expenses e JOIN branches br ON br.id=e.branch_id
       ${where} ORDER BY e.expense_date DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch expenses" }); }
});

// POST /api/expenses — verify branch belongs to this academy
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, category, description, title, amount, expense_date, paid_to, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Amount is required and must be > 0" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    if (!bid) return res.status(400).json({ error: "Branch is required" });

    const aid = req.academyId;
    if (aid) {
      const { rows: brRows } = await db.query(`SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]);
      if (!brRows[0]) return res.status(403).json({ error: "Branch does not belong to your academy" });
    }

    // Support both 'title' (new frontend) and 'description' (old) as the description field
    const finalDesc = title || description || null;
    const finalCat  = category || "Other";
    const finalNotes = notes || paid_to || null;

    const { rows } = await db.query(
      `INSERT INTO expenses (branch_id, category, description, amount, expense_date, paid_to)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [bid, finalCat, finalDesc, amount, expense_date || new Date(), finalNotes]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to create expense: " + e.message }); }
});

// PUT /api/expenses/:id — verify ownership
router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { rows: existing } = await db.query(
      `SELECT e.*, br.academy_id FROM expenses e JOIN branches br ON br.id=e.branch_id WHERE e.id=$1`,
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: "Expense not found" });
    if (aid && existing[0].academy_id && existing[0].academy_id !== aid)
      return res.status(403).json({ error: "Access denied: expense belongs to a different academy" });
    const { category, description, title, amount, expense_date, paid_to, notes } = req.body;
    const { rows } = await db.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, expense_date=$4, paid_to=$5 WHERE id=$6 RETURNING *`,
      [category||"Other", title||description||null, amount, expense_date, notes||paid_to||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to update expense" }); }
});

// DELETE /api/expenses/:id — verify ownership
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { rows: existing } = await db.query(
      `SELECT e.*, br.academy_id FROM expenses e JOIN branches br ON br.id=e.branch_id WHERE e.id=$1`,
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: "Expense not found" });
    if (aid && existing[0].academy_id && existing[0].academy_id !== aid)
      return res.status(403).json({ error: "Access denied: expense belongs to a different academy" });
    await db.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete expense" }); }
});

module.exports = router;
