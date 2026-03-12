const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { auth, superAdmin } = require("../middleware");

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query(
      `SELECT u.*, b.name AS branch_name FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.email = $1`, [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role, branch_id: user.branch_id, name: user.name, branch_name: user.branch_name },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "12h" }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, branch_id: user.branch_id, branch_name: user.branch_name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create user (super admin only)
router.post("/users", auth, superAdmin, async (req, res) => {
  const { name, email, password, role, branch_id } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role, branch_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, branch_id`,
      [name, email, hash, role, branch_id || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List users (super admin only)
router.get("/users", auth, superAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.branch_id, b.name AS branch_name
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id`
  );
  res.json(rows);
});

module.exports = router;
