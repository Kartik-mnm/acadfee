const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Dashboard summary
router.get("/dashboard", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const bid = req.branchId;
    const aid = req.academyId;

    // Build conditions — always scope by academy, optionally also by branch
    const buildCond = (tableAlias, extra = "") => {
      const parts = [];
      const params = [];
      let idx = 1;
      if (aid) { parts.push(`${tableAlias}.academy_id=$${idx++}`); params.push(aid); }
      if (bid) { parts.push(`${tableAlias}.branch_id=$${idx++}`); params.push(bid); }
      if (extra) parts.push(extra);
      return { where: parts.length ? "WHERE " + parts.join(" AND ") : "", params, nextIdx: idx };
    };

    const sc = buildCond("s", "s.status='active'");
    const pc = buildCond("p");
    const fc = buildCond("fr", "fr.status IN ('pending','partial','overdue')");
    const oc = buildCond("fr", "fr.status='overdue'");

    // BUG FIX: was using string interpolation for aid/bid in recentPayments query
    // — replaced with parameterized placeholders to prevent SQL injection
    const recentParams = [];
    const recentParts = [];
    let ri = 1;
    if (aid) { recentParts.push(`s.academy_id=$${ri++}`); recentParams.push(aid); }
    if (bid) { recentParts.push(`p.branch_id=$${ri++}`);  recentParams.push(bid); }
    const recentWhere = recentParts.length ? "AND " + recentParts.join(" AND ") : "";

    const [students, collected, due, overdue, recentPayments, branchPerf] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM students s ${sc.where}`, sc.params),
      db.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments p ${pc.where}`, pc.params),
      db.query(`SELECT COALESCE(SUM(amount_due - amount_paid),0) AS total FROM fee_records fr ${fc.where}`, fc.params),
      db.query(`SELECT COUNT(*) FROM fee_records fr ${oc.where}`, oc.params),
      db.query(
        `SELECT p.receipt_no, p.amount, p.paid_on, p.payment_mode,
                s.name AS student_name, br.name AS branch_name
         FROM payments p
         JOIN students s ON s.id=p.student_id
         JOIN branches br ON br.id=p.branch_id
         WHERE 1=1 ${recentWhere}
         ORDER BY p.paid_on DESC LIMIT 8`,
        recentParams
      ),
      // Branch performance — only branches of this academy
      db.query(
        `SELECT br.name AS branch,
                COUNT(DISTINCT s.id) AS students,
                COALESCE(SUM(p.amount), 0) AS collected,
                COALESCE((
                  SELECT SUM(fr2.amount_due - fr2.amount_paid)
                  FROM fee_records fr2
                  WHERE fr2.branch_id = br.id AND fr2.status != 'paid'
                ), 0) AS pending
         FROM branches br
         LEFT JOIN students s ON s.branch_id = br.id AND s.status = 'active'
         LEFT JOIN payments p ON p.branch_id = br.id
         WHERE br.academy_id = $1
         GROUP BY br.id, br.name
         ORDER BY br.id`,
        [aid || 0]
      ),
    ]);

    res.json({
      active_students:  parseInt(students.rows[0].count),
      total_collected:  parseFloat(collected.rows[0].total),
      total_due:        parseFloat(due.rows[0].total),
      overdue_count:    parseInt(overdue.rows[0].count),
      recent_payments:  recentPayments.rows,
      branch_performance: branchPerf.rows,
    });
  } catch (e) {
    console.error("Dashboard report error:", e.message);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// Collection by branch — scoped to academy
router.get("/by-branch", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const { rows } = await db.query(
      `SELECT br.name AS branch,
              COUNT(DISTINCT s.id) AS students,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.branch_id=br.id), 0) AS collected,
              COALESCE((SELECT SUM(fr.amount_due - fr.amount_paid)
                        FROM fee_records fr
                        WHERE fr.branch_id=br.id AND fr.status != 'paid'), 0) AS pending
       FROM branches br
       LEFT JOIN students s ON s.branch_id=br.id AND s.status='active'
       WHERE br.academy_id = $1
       GROUP BY br.id, br.name ORDER BY br.id`,
      [aid || 0]
    );
    res.json(rows);
  } catch (e) {
    console.error("By-branch report error:", e.message);
    res.status(500).json({ error: "Failed to load branch report" });
  }
});

// Monthly collection trend — scoped to academy
router.get("/monthly-trend", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const bid = req.branchId;
    const params = [];
    const parts = [];
    let idx = 1;
    if (aid) { parts.push(`s.academy_id=$${idx++}`); params.push(aid); }
    if (bid) { parts.push(`p.branch_id=$${idx++}`); params.push(bid); }
    const joinWhere = parts.length ? "AND " + parts.join(" AND ") : "";
    const { rows } = await db.query(
      `SELECT TO_CHAR(p.paid_on,'Mon YYYY') AS month,
              DATE_TRUNC('month', p.paid_on) AS month_sort,
              COALESCE(SUM(p.amount),0) AS collected
       FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE 1=1 ${joinWhere}
       GROUP BY month, month_sort ORDER BY month_sort DESC LIMIT 12`,
      params
    );
    res.json(rows.reverse());
  } catch (e) {
    console.error("Monthly trend error:", e.message);
    res.status(500).json({ error: "Failed to load monthly trend" });
  }
});

// Overdue list — scoped to academy
router.get("/overdue", auth, branchFilter, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId;
    const bid = req.branchId;
    const params = [];
    const parts = [];
    let idx = 1;
    if (aid) { parts.push(`s.academy_id=$${idx++}`); params.push(aid); }
    if (bid) { parts.push(`fr.branch_id=$${idx++}`); params.push(bid); }
    parts.push("fr.status='overdue'");
    const { rows } = await db.query(
      `SELECT fr.*, s.name AS student_name, s.phone, s.parent_phone,
              b.name AS batch_name, br.name AS branch_name
       FROM fee_records fr
       JOIN students s ON s.id=fr.student_id
       LEFT JOIN batches b ON b.id=s.batch_id
       JOIN branches br ON br.id=fr.branch_id
       WHERE ${parts.join(" AND ")}
       ORDER BY fr.due_date ASC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("Overdue report error:", e.message);
    res.status(500).json({ error: "Failed to load overdue list" });
  }
});

module.exports = router;
