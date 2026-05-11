const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Ensure expenses table has all needed columns
// BUG FIX: old migration referenced e.description before confirming it exists,
// causing the entire migration to crash and leaving the table broken.
// Now we ONLY add columns that are missing — no reads of old columns.
async function ensureExpenseColumns() {
  try {
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title TEXT`);
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT`);
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS academy_id INT`);
    // Backfill academy_id from branch
    await db.query(`
      UPDATE expenses e
      SET academy_id = br.academy_id
      FROM branches br
      WHERE br.id = e.branch_id AND e.academy_id IS NULL
    `);
  } catch (e) {
    console.error("[expenses] column migration error:", e.message);
  }
}
ensureExpenseColumns();

const EXPENSE_CATEGORIES = ["Rent", "Salary", "Utilities", "Stationery", "Marketing", "Maintenance", "Other"];

// GET /api/expenses/categories
router.get("/categories", auth, (req, res) => {
  res.json(EXPENSE_CATEGORIES);
});

// GET /api/expenses/summary
router.get("/summary", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { month, year } = req.query;
    const aid = req.academyId;
    const bid = req.branchId;
    let conditions = [
      `EXTRACT(MONTH FROM e.expense_date) = $1`,
      `EXTRACT(YEAR  FROM e.expense_date) = $2`,
    ];
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
  } catch (e) {
    console.error("Expense summary error:", e.message);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// GET /api/expenses
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { month, year } = req.query;
    const aid = req.academyId;
    const bid = req.branchId;
    let conditions = []; let params = []; let idx = 1;
    if (aid)   { conditions.push(`br.academy_id=$${idx++}`); params.push(aid); }
    if (bid)   { conditions.push(`e.branch_id=$${idx++}`);   params.push(bid); }
    if (month) { conditions.push(`EXTRACT(MONTH FROM e.expense_date) = $${idx++}`); params.push(month); }
    if (year)  { conditions.push(`EXTRACT(YEAR  FROM e.expense_date) = $${idx++}`); params.push(year); }
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    
    if (req.query.page) {
      const { rows: countRows } = await db.query(
        `SELECT COUNT(*) FROM expenses e JOIN branches br ON br.id=e.branch_id ${where}`,
        params
      );
      const total = parseInt(countRows[0].count);
      const totalPages = Math.ceil(total / limit);

      const { rows } = await db.query(
        `SELECT e.*, br.name AS branch_name
         FROM expenses e JOIN branches br ON br.id=e.branch_id
         ${where} ORDER BY e.expense_date DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      );
      return res.json({ data: rows, page, limit, total, totalPages });
    }

    const { rows } = await db.query(
      `SELECT e.*, br.name AS branch_name
       FROM expenses e JOIN branches br ON br.id=e.branch_id
       ${where} ORDER BY e.expense_date DESC LIMIT $${idx}`,
      [...params, limit]
    );
    res.json(rows);
  } catch (e) {
    console.error("Expenses fetch error:", e.message);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// POST /api/expenses
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, category, title, amount, expense_date, notes } = req.body;

    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ error: "Amount is required and must be > 0" });

    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    if (!bid) return res.status(400).json({ error: "Branch is required" });

    // Validate branch belongs to this academy
    const aid = req.academyId;
    if (aid) {
      const { rows: brRows } = await db.query(
        `SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]
      );
      if (!brRows[0])
        return res.status(403).json({ error: "Branch does not belong to your academy" });
    }

    const finalTitle = title || null;
    const finalCat   = category || "Other";
    const finalNotes = notes || null;
    const finalDate  = expense_date || new Date().toISOString().split("T")[0];

    // BUG FIX: was inserting into description and paid_to columns which don't exist.
    // Now only inserts into columns that actually exist in the schema.
    const { rows } = await db.query(
      `INSERT INTO expenses (branch_id, academy_id, category, title, amount, expense_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [bid, aid || null, finalCat, finalTitle, amount, finalDate, finalNotes]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create expense error:", e.message);
    res.status(500).json({ error: "Failed to create expense: " + e.message });
  }
});

// PUT /api/expenses/:id
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
      return res.status(403).json({ error: "Access denied" });

    const { category, title, amount, expense_date, notes } = req.body;
    const finalTitle = title || null;
    const finalNotes = notes || null;
    // BUG FIX: was updating description and paid_to columns which don't exist.
    const { rows } = await db.query(
      `UPDATE expenses
       SET category=$1, title=$2, amount=$3, expense_date=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [category || "Other", finalTitle, amount, expense_date, finalNotes, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Update expense error:", e.message);
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// DELETE /api/expenses/:id
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
      return res.status(403).json({ error: "Access denied" });
    await db.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Delete expense error:", e.message);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

module.exports = router;
