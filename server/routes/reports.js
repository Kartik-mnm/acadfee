const router = require("express").Router();
const db = require("../db");
const { auth, branchFilter } = require("../middleware");

// Dashboard summary
router.get("/dashboard", auth, branchFilter, async (req, res) => {
  const bid = req.branchId;
  const cond = bid ? "AND branch_id=$1" : "";
  const p = bid ? [bid] : [];

  const [students, collected, due, overdue, recentPayments] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM students WHERE status='active' ${cond}`, p),
    db.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE 1=1 ${cond.replace("branch_id","branch_id")}`, p),
    db.query(`SELECT COALESCE(SUM(amount_due - amount_paid),0) AS total FROM fee_records WHERE status IN ('pending','partial','overdue') ${cond}`, p),
    db.query(`SELECT COUNT(*) FROM fee_records WHERE status='overdue' ${cond}`, p),
    db.query(
      `SELECT p.receipt_no, p.amount, p.paid_on, p.payment_mode, s.name AS student_name, br.name AS branch_name
       FROM payments p JOIN students s ON s.id=p.student_id JOIN branches br ON br.id=p.branch_id
       WHERE 1=1 ${cond} ORDER BY p.paid_on DESC LIMIT 8`, p
    ),
  ]);

  res.json({
    active_students: parseInt(students.rows[0].count),
    total_collected: parseFloat(collected.rows[0].total),
    total_due:       parseFloat(due.rows[0].total),
    overdue_count:   parseInt(overdue.rows[0].count),
    recent_payments: recentPayments.rows,
  });
});

// Collection report by branch
router.get("/by-branch", auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT br.name AS branch,
            COUNT(DISTINCT s.id) AS students,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.branch_id=br.id), 0) AS collected,
            COALESCE((SELECT SUM(fr.amount_due - fr.amount_paid) FROM fee_records fr WHERE fr.branch_id=br.id AND fr.status != 'paid'), 0) AS pending
     FROM branches br
     LEFT JOIN students s ON s.branch_id=br.id AND s.status='active'
     GROUP BY br.id, br.name ORDER BY br.id`
  );
  res.json(rows);
});

// Monthly collection trend
router.get("/monthly-trend", auth, branchFilter, async (req, res) => {
  const cond = req.branchId ? "AND p.branch_id=$1" : "";
  const { rows } = await db.query(
    `SELECT TO_CHAR(p.paid_on,'Mon YYYY') AS month,
            DATE_TRUNC('month', p.paid_on) AS month_sort,
            COALESCE(SUM(p.amount),0) AS collected
     FROM payments p WHERE 1=1 ${cond}
     GROUP BY month, month_sort ORDER BY month_sort DESC LIMIT 12`,
    req.branchId ? [req.branchId] : []
  );
  res.json(rows.reverse());
});

// Overdue list
router.get("/overdue", auth, branchFilter, async (req, res) => {
  const cond = req.branchId ? "AND fr.branch_id=$1" : "";
  const { rows } = await db.query(
    `SELECT fr.*, s.name AS student_name, s.phone, s.parent_phone,
            b.name AS batch_name, br.name AS branch_name
     FROM fee_records fr
     JOIN students s ON s.id=fr.student_id
     LEFT JOIN batches b ON b.id=s.batch_id
     JOIN branches br ON br.id=fr.branch_id
     WHERE fr.status='overdue' ${cond} ORDER BY fr.due_date ASC`,
    req.branchId ? [req.branchId] : []
  );
  res.json(rows);
});

module.exports = router;
