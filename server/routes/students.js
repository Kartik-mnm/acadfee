const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

router.get("/", auth, branchFilter, async (req, res) => {
  const cond = req.branchId ? "WHERE s.branch_id=$1" : "";
  const params = req.branchId ? [req.branchId] : [];
  const { rows } = await db.query(
    `SELECT s.*, b.name AS batch_name, br.name AS branch_name
     FROM students s
     LEFT JOIN batches b ON b.id = s.batch_id
     LEFT JOIN branches br ON br.id = s.branch_id
     ${cond} ORDER BY s.id DESC`,
    params
  );
  res.json(rows);
});

router.get("/:id", auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, b.name AS batch_name, br.name AS branch_name
     FROM students s
     LEFT JOIN batches b ON b.id = s.batch_id
     LEFT JOIN branches br ON br.id = s.branch_id
     WHERE s.id=$1`, [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

router.post("/", auth, async (req, res) => {
  const {
    branch_id, batch_id, name, phone, parent_phone, email, address,
    dob, gender, admission_date, fee_type, admission_fee, discount, discount_reason
  } = req.body;
  const bid = req.user.role === "super_admin" ? branch_id : req.user.branch_id;
  try {
    const { rows } = await db.query(
      `INSERT INTO students
       (branch_id, batch_id, name, phone, parent_phone, email, address, dob, gender,
        admission_date, fee_type, admission_fee, discount, discount_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [bid, batch_id, name, phone, parent_phone, email, address, dob, gender,
       admission_date, fee_type, admission_fee || 0, discount || 0, discount_reason]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  const {
    batch_id, name, phone, parent_phone, email, address,
    dob, gender, fee_type, admission_fee, discount, discount_reason, status
  } = req.body;
  const { rows } = await db.query(
    `UPDATE students SET batch_id=$1, name=$2, phone=$3, parent_phone=$4, email=$5,
     address=$6, dob=$7, gender=$8, fee_type=$9, admission_fee=$10,
     discount=$11, discount_reason=$12, status=$13 WHERE id=$14 RETURNING *`,
    [batch_id, name, phone, parent_phone, email, address, dob, gender,
     fee_type, admission_fee, discount, discount_reason, status, req.params.id]
  );
  res.json(rows[0]);
});

router.delete("/:id", auth, async (req, res) => {
  await db.query("DELETE FROM students WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
