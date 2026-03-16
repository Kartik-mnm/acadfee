const router  = require("express").Router();
const db      = require("../db");
const { auth } = require("../middleware");
const jwt     = require("jsonwebtoken");
const { sendAttendanceNotification } = require("../fcm");

const QR_SECRET = process.env.JWT_SECRET || "secret";

// ── Generate QR token for a student
router.get("/token/:student_id", auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.name, s.branch_id, br.name AS branch_name
     FROM students s JOIN branches br ON br.id = s.branch_id
     WHERE s.id = $1`, [req.params.student_id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Student not found" });
  const token = jwt.sign(
    { student_id: rows[0].id, branch_id: rows[0].branch_id, type: "qr_attendance" },
    QR_SECRET
  );
  res.json({ token, student: rows[0] });
});

// ── Save FCM token for student or parent
// POST /api/qrscan/register-token
router.post("/register-token", auth, async (req, res) => {
  const { student_id, token, type } = req.body;
  // type = "student" or "parent"
  if (!student_id || !token || !["student", "parent"].includes(type)) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const col = type === "student" ? "fcm_token" : "parent_fcm_token";
  await db.query(`UPDATE students SET ${col}=$1 WHERE id=$2`, [token, student_id]);
  res.json({ success: true });
});

// ── Process a QR scan (entry or exit)
router.post("/scan", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "No QR token provided" });

  let payload;
  try {
    payload = jwt.verify(token, QR_SECRET);
    if (payload.type !== "qr_attendance") throw new Error("Invalid token type");
  } catch (e) {
    return res.status(400).json({ error: "Invalid or tampered QR code" });
  }

  const { student_id, branch_id } = payload;
  const today = new Date().toISOString().split("T")[0];
  const now   = new Date().toISOString();

  // Get student info including FCM tokens
  const { rows: sRows } = await db.query(
    `SELECT s.name, s.phone, s.fcm_token, s.parent_fcm_token,
            b.name AS batch_name, br.name AS branch_name
     FROM students s
     LEFT JOIN batches b ON b.id = s.batch_id
     JOIN branches br ON br.id = s.branch_id
     WHERE s.id = $1`, [student_id]
  );
  if (!sRows[0]) return res.status(404).json({ error: "Student not found" });
  const student = sRows[0];

  // Check existing scan for today
  const { rows: scanRows } = await db.query(
    `SELECT * FROM qr_scans WHERE student_id=$1 AND scan_date=$2`,
    [student_id, today]
  );

  let scanType, result;

  if (scanRows.length === 0) {
    // First scan → Entry
    const { rows } = await db.query(
      `INSERT INTO qr_scans (student_id, branch_id, scan_date, entry_time, scanned_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, branch_id, today, now, req.user.id]
    );
    scanType = "entry";
    result = rows[0];
  } else if (!scanRows[0].exit_time) {
    // Second scan → Exit
    const { rows } = await db.query(
      `UPDATE qr_scans SET exit_time=$1, scanned_by=$2
       WHERE student_id=$3 AND scan_date=$4 RETURNING *`,
      [now, req.user.id, student_id, today]
    );
    scanType = "exit";
    result = rows[0];

    // Auto-update monthly attendance
    const month = new Date().getMonth() + 1;
    const year  = new Date().getFullYear();
    await db.query(
      `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
       VALUES ($1,$2,$3,$4,1,1)
       ON CONFLICT (student_id, month, year)
       DO UPDATE SET present = attendance.present + 1`,
      [student_id, branch_id, month, year]
    );
  } else {
    return res.status(400).json({
      error: "Already scanned twice today",
      student: student.name,
      entry_time: scanRows[0].entry_time,
      exit_time:  scanRows[0].exit_time,
    });
  }

  // Send FCM push notification (non-blocking)
  sendAttendanceNotification({
    studentName:   student.name,
    scanType,
    time:          now,
    studentToken:  student.fcm_token,
    parentToken:   student.parent_fcm_token,
  }).catch(console.error);

  res.json({
    success:      true,
    scan_type:    scanType,
    student_id,
    student_name: student.name,
    batch:        student.batch_name,
    branch:       student.branch_name,
    time:         now,
    scan:         result,
  });
});

// ── Get today's scan log
router.get("/today", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const today = new Date().toISOString().split("T")[0];
  const branchCond = req.user.role === "branch_manager"
    ? `AND qs.branch_id=${req.user.branch_id}` : "";

  const { rows } = await db.query(
    `SELECT qs.*, s.name AS student_name, s.phone,
            b.name AS batch_name, br.name AS branch_name,
            u.name AS scanned_by_name
     FROM qr_scans qs
     JOIN students s ON s.id = qs.student_id
     LEFT JOIN batches b ON b.id = s.batch_id
     JOIN branches br ON br.id = qs.branch_id
     LEFT JOIN users u ON u.id = qs.scanned_by
     WHERE qs.scan_date=$1 ${branchCond}
     ORDER BY COALESCE(qs.exit_time, qs.entry_time) DESC`,
    [today]
  );
  res.json(rows);
});

module.exports = router;
