const router = require("express").Router();
const db = require("../db");
const { auth } = require("../middleware");

router.get("/", auth, async (_, res) => {
  const { rows } = await db.query("SELECT * FROM branches ORDER BY id");
  res.json(rows);
});

router.post("/", auth, async (req, res) => {
  const { name, address, phone } = req.body;
  const { rows } = await db.query(
    "INSERT INTO branches (name, address, phone) VALUES ($1,$2,$3) RETURNING *",
    [name, address, phone]
  );
  res.json(rows[0]);
});

module.exports = router;
