const router = require("express").Router();
const db = require("../db");
const { auth } = require("../middleware");

// GET /api/branches — only return branches belonging to the logged-in user's academy
router.get("/", auth, async (req, res) => {
  try {
    const aid = req.academyId;
    let rows;
    if (aid) {
      // Multi-tenant: filter by academy_id
      ({ rows } = await db.query(
        "SELECT * FROM branches WHERE academy_id = $1 ORDER BY id",
        [aid]
      ));
    } else {
      // Legacy single-tenant fallback (academy_id IS NULL = old data)
      ({ rows } = await db.query(
        "SELECT * FROM branches WHERE academy_id IS NULL ORDER BY id"
      ));
    }
    res.json(rows);
  } catch (e) {
    console.error("List branches error:", e.message);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
});

// POST /api/branches — link new branch to the academy
router.post("/", auth, async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const aid = req.academyId;
    const { rows } = await db.query(
      "INSERT INTO branches (name, address, phone, academy_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [name, address, phone, aid]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("Create branch error:", e.message);
    res.status(500).json({ error: "Failed to create branch" });
  }
});

// PUT /api/branches/:id
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    const aid = req.academyId;
    const check = aid
      ? await db.query("SELECT id FROM branches WHERE id=$1 AND academy_id=$2", [req.params.id, aid])
      : await db.query("SELECT id FROM branches WHERE id=$1", [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: "Branch not found" });
    const { rows } = await db.query(
      "UPDATE branches SET name=$1, address=$2, phone=$3 WHERE id=$4 RETURNING *",
      [name, address, phone, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Failed to update branch" });
  }
});

// DELETE /api/branches/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const aid = req.academyId;
    const check = aid
      ? await db.query("SELECT id FROM branches WHERE id=$1 AND academy_id=$2", [req.params.id, aid])
      : await db.query("SELECT id FROM branches WHERE id=$1", [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: "Branch not found" });
    await db.query("DELETE FROM branches WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete branch" });
  }
});

module.exports = router;
