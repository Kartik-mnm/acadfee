const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List expenses — scoped to academy
router.get("/", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const bid = req.branchId;
    let conditions = []; let params = []; let idx = 1;
    if (aid) { conditions.push(`br.academy_id=$${idx++}`); params.push(aid); }
    if (bid) { conditions.push(`e.branch_id=$${idx++}`);   params.push(bid); }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT e.*, br.name AS branch_name FROM expenses e JOIN branches br ON br.id=e.branch_id
       ${where} ORDER BY e.expense_date DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Failed to fetch expenses" }); }
});

// Create expense
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, category, description, amount, expense_date, paid_to } = req.body;
    if (!amount || !category) return res.status(400).json({ error: "amount and category are required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;

    // Verify branch belongs to this academy
    const aid = req.academyId;
    if (aid) {
      const { rows: brRows } = await db.query(`SELECT id FROM branches WHERE id=$1 AND academy_id=$2`, [bid, aid]);
      if (!brRows[0]) return res.status(403).json({ error: "Branch does not belong to your academy" });
    }

    const { rows } = await db.query(
      `INSERT INTO expenses (branch_id, category, description, amount, expense_date, paid_to)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [bid, category, description, amount, expense_date || new Date(), paid_to]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to create expense" }); }
});

// Update expense — FIX: verify ownership via branch → academy before updating
router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    // Check ownership
    const { rows: existing } = await db.query(
      `SELECT e.*, br.academy_id FROM expenses e JOIN branches br ON br.id=e.branch_id WHERE e.id=$1`,
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: "Expense not found" });
    if (aid && existing[0].academy_id && existing[0].academy_id !== aid)
      return res.status(403).json({ error: "Access denied: expense belongs to a different academy" });

    const { category, description, amount, expense_date, paid_to } = req.body;
    const { rows } = await db.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, expense_date=$4, paid_to=$5 WHERE id=$6 RETURNING *`,
      [category, description, amount, expense_date, paid_to, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: "Failed to update expense" }); }
});

// Delete expense — FIX: verify ownership via branch → academy before deleting
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
