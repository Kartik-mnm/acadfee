const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// List batches
router.get("/", auth, branchFilter, async (req, res) => {
  try {
    const q = req.branchId
      ? "SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id WHERE b.branch_id=$1 ORDER BY b.id"
      : "SELECT b.*, br.name AS branch_name FROM batches b JOIN branches br ON br.id=b.branch_id ORDER BY b.id";
    const { rows } = await db.query(q, req.branchId ? [req.branchId] : []);
    res.json(rows);
  } catch (e) {
    console.error("List batches error:", e.message);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});

// Create batch
router.post("/", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const { branch_id, name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
    const { rows } = await db.query(
      `INSERT INTO batches (branch_id, name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [bid, name, subjects, fee_monthly || 0, fee_quarterly || 0, fee_yearly || 0, fee_course || 0]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create batch error:", e.message);
    res.status(500).json({ error: "Failed to create batch" });
  }
});

// Update batch — branch managers can only update their own branch's batches
router.put("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    // Verify ownership before updating
    const { rows: existing } = await db.query("SELECT branch_id FROM batches WHERE id=$1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Batch not found" });
    if (req.user.role === "branch_manager" && existing[0].branch_id !== req.user.branch_id)
      return res.status(403).json({ error: "Access denied: you can only edit your own branch's batches" });

    const { name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course } = req.body;
    const { rows } = await db.query(
      `UPDATE batches SET name=$1, subjects=$2, fee_monthly=$3, fee_quarterly=$4, fee_yearly=$5, fee_course=$6 WHERE id=$7 RETURNING *`,
      [name, subjects, fee_monthly, fee_quarterly, fee_yearly, fee_course, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Update batch error:", e.message);
    res.status(500).json({ error: "Failed to update batch" });
  }
});

// Delete batch — branch managers can only delete their own branch's batches
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    // Verify ownership before deleting
    const { rows: existing } = await db.query("SELECT branch_id FROM batches WHERE id=$1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Batch not found" });
    if (req.user.role === "branch_manager" && existing[0].branch_id !== req.user.branch_id)
      return res.status(403).json({ error: "Access denied: you can only delete your own branch's batches" });

    await db.query("DELETE FROM batches WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Delete batch error:", e.message);
    res.status(500).json({ error: "Failed to delete batch" });
  }
});

module.exports = router;
