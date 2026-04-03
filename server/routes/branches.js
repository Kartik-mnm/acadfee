const router = require("express").Router();
const db     = require("../db");
const { auth, superAdmin } = require("../middleware");

// GET /api/branches
router.get("/", auth, async (req, res) => {
  try {
    const academyId = req.academyId;
    let rows;
    if (req.user.role === "branch_manager") {
      ({ rows } = await db.query(
        `SELECT b.*, COUNT(DISTINCT s.id)::int AS student_count
         FROM branches b LEFT JOIN students s ON s.branch_id = b.id
         WHERE b.id = $1 GROUP BY b.id`, [req.user.branch_id]
      ));
    } else if (academyId) {
      ({ rows } = await db.query(
        `SELECT b.*, COUNT(DISTINCT s.id)::int AS student_count
         FROM branches b LEFT JOIN students s ON s.branch_id = b.id
         WHERE b.academy_id = $1 GROUP BY b.id ORDER BY b.id`, [academyId]
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT b.*, COUNT(DISTINCT s.id)::int AS student_count
         FROM branches b LEFT JOIN students s ON s.branch_id = b.id
         GROUP BY b.id ORDER BY b.id`
      ));
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/branches
router.post("/", auth, superAdmin, async (req, res) => {
  const { name, address, phone, email, roll_prefix } = req.body;
  if (!name) return res.status(400).json({ error: "Branch name is required" });

  const academyId = req.academyId;
  try {
    if (academyId) {
      const { rows: acadRows } = await db.query(
        `SELECT max_branches FROM academies WHERE id = $1`, [academyId]
      );
      const maxBranches = acadRows[0]?.max_branches ?? 999;
      const { rows: countRows } = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM branches WHERE academy_id = $1`, [academyId]
      );
      if (countRows[0].cnt >= maxBranches) {
        return res.status(403).json({
          error: `Your plan allows a maximum of ${maxBranches} branch${maxBranches === 1 ? "" : "es"}. Please contact support to upgrade.`
        });
      }
    }

    // Sanitise roll_prefix: uppercase, letters only, max 4 chars
    const cleanPrefix = (roll_prefix || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 4);

    const { rows } = await db.query(
      `INSERT INTO branches (name, address, phone, email, academy_id, roll_prefix)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, address || null, phone || null, email || null, academyId || null, cleanPrefix]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("Create branch error:", e.message);
    res.status(500).json({ error: "Failed to create branch" });
  }
});

// PUT /api/branches/:id
router.put("/:id", auth, superAdmin, async (req, res) => {
  const { name, address, phone, email, roll_prefix } = req.body;
  if (!name) return res.status(400).json({ error: "Branch name is required" });
  try {
    const academyId = req.academyId;
    const cleanPrefix = (roll_prefix || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 4);

    const whereExtra = academyId ? "AND academy_id = $7" : "";
    const params = [name, address || null, phone || null, email || null, cleanPrefix, req.params.id];
    if (academyId) params.push(academyId);
    const { rows, rowCount } = await db.query(
      `UPDATE branches SET name=$1, address=$2, phone=$3, email=$4, roll_prefix=$5 WHERE id=$6 ${whereExtra} RETURNING *`,
      params
    );
    if (rowCount === 0) return res.status(404).json({ error: "Branch not found or access denied" });
    res.json(rows[0]);
  } catch (e) {
    console.error("Update branch error:", e.message);
    res.status(500).json({ error: "Failed to update branch" });
  }
});

// DELETE /api/branches/:id
router.delete("/:id", auth, superAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const whereExtra = academyId ? "AND academy_id = $2" : "";
    const params = [req.params.id];
    if (academyId) params.push(academyId);
    const { rowCount } = await db.query(
      `DELETE FROM branches WHERE id=$1 ${whereExtra}`, params
    );
    if (rowCount === 0) return res.status(404).json({ error: "Branch not found or access denied" });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete branch" });
  }
});

module.exports = router;
