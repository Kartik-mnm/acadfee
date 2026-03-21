const router  = require("express").Router();
const db      = require("../db");
const { auth, getJwtSecret } = require("../middleware");
const jwt     = require("jsonwebtoken");
const { sendAttendanceNotification } = require("../fcm");

const toIST = (date) => new Date(date).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
});

// Generate QR token for a student
router.get("/token/:student_id", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.status, br.name AS branch_name
       FROM students s JOIN branches br ON br.id = s.branch_id
       WHERE s.id = $1`, [req.params.student_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found" });
    // Fix 3: inactive students should not get a scannable QR token
    if (rows[0].status !== "active") {
      return res.status(403).json({ error: "Student is inactive. QR code is disabled." });
    }
    const token = jwt.sign(
      { student_id: rows[0].id, branch_id: rows[0].branch_id, type: "qr_attendance" },
      getJwtSecret()
    );
    res.json({ token, student: rows[0] });
  } catch (e) {
    console.error("QR token error:", e.message);
    res.status(500).json({ error: "Failed to generate QR token" });
  }
});

// Register FCM push token for student or parent
router.post("/register-token", auth, async (req, res) => {
  try {
    const { student_id, token, type } = req.body;
    if (!student_id || !token || !["student", "parent"].includes(type))
      return res.status(400).json({ error: "Invalid request" });
    if (req.user.role === "student" && req.user.id !== parseInt(student_id))
      return res.status(403).json({ error: "Cannot register token for another student" });
    const col = type === "student" ? "fcm_token" : "parent_fcm_token";
    await db.query(`UPDATE students SET ${col}=$1 WHERE id=$2`, [token, student_id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Register token error:", e.message);
    res.status(500).json({ error: "Failed to register token" });
  }
});

// Process a QR scan (entry or exit)
router.post("/scan", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role))
    return res.status(403).json({ error: "Access denied" });
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "No QR token provided" });

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
      if (payload.type !== "qr_attendance") throw new Error("Invalid token type");
    } catch (e) {
      return res.status(400).json({ error: "Invalid or tampered QR code" });
    }

    const { student_id, branch_id } = payload;
    const nowIST  = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
    const today   = nowIST.split(",")[0].trim();
    const now     = new Date().toISOString();
    const [istYear, istMonth] = today.split("-").map(Number);

    // Check if today is a working day
    const { rows: wdRows } = await db.query(
      "SELECT is_working, note FROM working_days WHERE branch_id = $1 AND date = $2",
      [branch_id, today]
    );
    const isWorkingDay = wdRows.length === 0 ? true : wdRows[0].is_working;
    const holidayNote  = wdRows.length > 0 && !wdRows[0].is_working ? (wdRows[0].note || "Holiday") : null;

    // Fix 3: also check status at scan time (QR codes are long-lived JWTs,
    // so even if someone saved their QR before being deactivated, we
    // verify the student is still active before recording the scan.
    const { rows: sRows } = await db.query(
      `SELECT s.name, s.phone, s.status, s.fcm_token, s.parent_fcm_token,
              b.name AS batch_name, br.name AS branch_name
       FROM students s LEFT JOIN batches b ON b.id = s.batch_id
       JOIN branches br ON br.id = s.branch_id
       WHERE s.id = $1`, [student_id]
    );
    if (!sRows[0]) return res.status(404).json({ error: "Student not found" });
    const student = sRows[0];

    // Block inactive students at scan time too
    if (student.status !== "active") {
      return res.status(403).json({
        error: "Student is inactive. Scan not allowed.",
        student: student.name,
      });
    }

    const { rows: scanRows } = await db.query(
      "SELECT * FROM qr_scans WHERE student_id=$1 AND scan_date=$2", [student_id, today]
    );

    let scanType, result;
    if (scanRows.length === 0) {
      // ── First scan of the day → entry ──
      const { rows } = await db.query(
        `INSERT INTO qr_scans (student_id, branch_id, scan_date, entry_time, scanned_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [student_id, branch_id, today, now, req.user.id]
      );
      scanType = "entry"; result = rows[0];

    } else if (!scanRows[0].exit_time) {
      // ── Second scan → exit ──
      const { rows } = await db.query(
        `UPDATE qr_scans SET exit_time=$1, scanned_by=$2
         WHERE student_id=$3 AND scan_date=$4 RETURNING *`,
        [now, req.user.id, student_id, today]
      );
      scanType = "exit"; result = rows[0];

      if (isWorkingDay) {
        await db.query(
          `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
           VALUES ($1, $2, $3, $4, 0, 1)
           ON CONFLICT (student_id, month, year)
           DO UPDATE SET present = LEAST(attendance.present + 1, GREATEST(attendance.total_days, attendance.present + 1))`,
          [student_id, branch_id, istMonth, istYear]
        );
      }

    } else {
      return res.status(400).json({
        error: "Already scanned twice today",
        student: student.name,
        entry_time: toIST(scanRows[0].entry_time),
        exit_time:  toIST(scanRows[0].exit_time),
      });
    }

    sendAttendanceNotification({
      studentName:  student.name, scanType,
      time: now, timeIST: toIST(now),
      studentToken: student.fcm_token,
      parentToken:  student.parent_fcm_token,
    }).catch(console.error);

    res.json({
      success: true, scan_type: scanType, student_id,
      student_name: student.name, batch: student.batch_name, branch: student.branch_name,
      time: now, time_ist: toIST(now), scan: result,
      is_working_day: isWorkingDay, holiday_note: holidayNote,
    });
  } catch (e) {
    console.error("QR scan error:", e.message);
    res.status(500).json({ error: "Scan failed" });
  }
});

// Today's scans
router.get("/today", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role))
    return res.status(403).json({ error: "Access denied" });
  try {
    const todayIST = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).split(",")[0].trim();
    let query, params;
    if (req.user.role === "branch_manager") {
      query = `SELECT qs.*, s.name AS student_name, s.phone, b.name AS batch_name, br.name AS branch_name, u.name AS scanned_by_name
               FROM qr_scans qs JOIN students s ON s.id = qs.student_id
               LEFT JOIN batches b ON b.id = s.batch_id JOIN branches br ON br.id = qs.branch_id
               LEFT JOIN users u ON u.id = qs.scanned_by
               WHERE qs.scan_date=$1 AND qs.branch_id=$2
               ORDER BY COALESCE(qs.exit_time, qs.entry_time) DESC`;
      params = [todayIST, req.user.branch_id];
    } else {
      query = `SELECT qs.*, s.name AS student_name, s.phone, b.name AS batch_name, br.name AS branch_name, u.name AS scanned_by_name
               FROM qr_scans qs JOIN students s ON s.id = qs.student_id
               LEFT JOIN batches b ON b.id = s.batch_id JOIN branches br ON br.id = qs.branch_id
               LEFT JOIN users u ON u.id = qs.scanned_by
               WHERE qs.scan_date=$1
               ORDER BY COALESCE(qs.exit_time, qs.entry_time) DESC`;
      params = [todayIST];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error("Today scans error:", e.message);
    res.status(500).json({ error: "Failed to fetch today's scans" });
  }
});

module.exports = router;
