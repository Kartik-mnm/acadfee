const router  = require("express").Router();
const db      = require("../db");
const { auth, getJwtSecret } = require("../middleware");
const jwt     = require("jsonwebtoken");
const { sendAttendanceNotification } = require("../fcm");

const toIST = (date) => new Date(date).toLocaleTimeString("en-IN", {
  timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
});

// ── Generate QR token ─────────────────────────────────────────────────────────────
router.get("/token/:student_id", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.academy_id, LOWER(s.status) AS status, s.batch_id,
              br.name AS branch_name,
              b.end_date AS batch_end_date
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       LEFT JOIN batches b ON b.id = s.batch_id
       WHERE s.id = $1`,
      [req.params.student_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found" });
    const student = rows[0];

    const aid = req.academyId;
    if (aid && student.academy_id && student.academy_id !== aid) {
      return res.status(403).json({ error: "Access denied: student belongs to different academy" });
    }

    if (student.status !== "active") {
      const batchEnded = student.batch_end_date && new Date(student.batch_end_date) < new Date();
      return res.status(403).json({
        error: batchEnded ? "Session expired. Your batch has ended." : "You are inactive. Contact admin.",
        reason: batchEnded ? "expired" : "inactive",
      });
    }

    let academyId = student.academy_id;
    if (!academyId) {
      const { rows: brRows } = await db.query(
        `SELECT academy_id FROM branches WHERE id = $1`, [student.branch_id]
      );
      academyId = brRows[0]?.academy_id || null;
    }

    const token = jwt.sign(
      {
        student_id: student.id,
        branch_id:  student.branch_id,
        academy_id: academyId,
        type: "qr_attendance"
      },
      getJwtSecret()
    );
    res.json({ token, student: { ...student, academy_id: academyId } });
  } catch (e) {
    console.error("QR token error:", e.message);
    res.status(500).json({ error: "Failed to generate QR token" });
  }
});

// ── Generate QR tokens in bulk ──────────────────────────────────────────────────
router.post("/tokens/bulk", auth, async (req, res) => {
  try {
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) return res.status(400).json({ error: "No students provided" });

    const aid = req.academyId;
    // ensure the students belong to the academy correctly
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.branch_id, COALESCE(s.academy_id, br.academy_id) AS academy_id,
              LOWER(s.status) AS status, b.end_date AS batch_end_date
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       LEFT JOIN batches b ON b.id = s.batch_id
       WHERE s.id = ANY($1)`,
      [student_ids]
    );

    const tokens = {};
    for (const student of rows) {
      if (aid && student.academy_id !== aid) continue;
      
      const isInactive = student.status !== "active";
      const batchEnded = student.batch_end_date && new Date(student.batch_end_date) < new Date();
      if (isInactive || batchEnded) continue; // Skip tokens for inactive

      const token = jwt.sign(
        {
          student_id: student.id,
          branch_id:  student.branch_id,
          academy_id: student.academy_id,
          type: "qr_attendance"
        },
        getJwtSecret()
      );
      tokens[student.id] = token;
    }

    res.json(tokens);
  } catch (e) {
    console.error("Bulk QR token error:", e.message);
    res.status(500).json({ error: "Failed to generate bulk tokens" });
  }
});

// ── Register FCM token ────────────────────────────────────────────────────────────
router.post("/register-token", auth, async (req, res) => {
  try {
    const { student_id, token, type } = req.body;
    if (!student_id || !token || !["student", "parent"].includes(type))
      return res.status(400).json({ error: "Invalid request" });
    if (req.user.role === "student" && req.user.id !== parseInt(student_id))
      return res.status(403).json({ error: "Cannot register token for another student" });
    
    // Verify academy ownership for branch managers / admins
    const aid = req.academyId;
    if (aid) {
      const { rows } = await db.query(
        "SELECT id FROM students WHERE id=$1 AND academy_id=$2", [student_id, aid]
      );
      if (!rows[0]) return res.status(403).json({ error: "Access denied: student belongs to different academy" });
    }

    const col = type === "student" ? "fcm_token" : "parent_fcm_token";
    await db.query(`UPDATE students SET ${col}=$1 WHERE id=$2`, [token, student_id]);
    console.log(`[FCM] Registered ${type} token for student ${student_id}`);
    res.json({ success: true });
  } catch (e) {
    console.error("Register token error:", e.message);
    res.status(500).json({ error: "Failed to register token" });
  }
});

// ── Process QR scan ─────────────────────────────────────────────────────────────
router.post("/scan", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role))
    return res.status(403).json({ error: "Access denied" });

  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "No QR token provided" });

    // Verify JWT
    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
      if (payload.type !== "qr_attendance") throw new Error("Invalid token type");
    } catch (e) {
      return res.status(400).json({ error: "Invalid or tampered QR code" });
    }

    const { student_id, branch_id } = payload;
    const tokenAcademyId = payload.academy_id || null;

    // Resolve scanner's academy_id
    let scannerAcademyId = req.academyId || null;
    if (!scannerAcademyId && req.user.branch_id) {
      const { rows: brRows } = await db.query(
        `SELECT academy_id FROM branches WHERE id = $1`, [req.user.branch_id]
      );
      scannerAcademyId = brRows[0]?.academy_id || null;
    }

    // Resolve student's academy_id
    let studentAcademyId = tokenAcademyId;
    if (!studentAcademyId) {
      const { rows: stRows } = await db.query(
        `SELECT COALESCE(s.academy_id, br.academy_id) AS academy_id
         FROM students s JOIN branches br ON br.id = s.branch_id
         WHERE s.id = $1`, [student_id]
      );
      studentAcademyId = stRows[0]?.academy_id || null;
    }

    // HARD BLOCK: cross-academy scan
    if (scannerAcademyId && studentAcademyId && scannerAcademyId !== studentAcademyId) {
      console.warn(`[QR] BLOCKED cross-academy: scanner=${scannerAcademyId} student=${studentAcademyId}`);
      return res.status(403).json({
        error: "\u26d4 This student belongs to a different academy. You cannot scan their QR.",
        reason: "wrong_academy",
      });
    }
    if (scannerAcademyId && !studentAcademyId) {
      const { rows: crossCheck } = await db.query(
        `SELECT s.id FROM students s JOIN branches br ON br.id = s.branch_id
         WHERE s.id = $1 AND (s.academy_id = $2 OR br.academy_id = $2)`,
        [student_id, scannerAcademyId]
      );
      if (!crossCheck[0]) {
        return res.status(403).json({
          error: "\u26d4 This student does not belong to your academy.",
          reason: "wrong_academy",
        });
      }
    }

    // Fetch student + academy name in one query
    const { rows: sRows } = await db.query(
      `SELECT s.name, s.phone, LOWER(s.status) AS status,
              s.fcm_token, s.parent_fcm_token,
              b.name AS batch_name, b.end_date AS batch_end_date,
              br.name AS branch_name,
              a.name AS academy_name
       FROM students s
       LEFT JOIN batches b ON b.id = s.batch_id
       JOIN branches br ON br.id = s.branch_id
       LEFT JOIN academies a ON a.id = COALESCE(s.academy_id, br.academy_id)
       WHERE s.id = $1`,
      [student_id]
    );
    if (!sRows[0]) return res.status(404).json({ error: "Student not found" });
    const student = sRows[0];

    if (student.status !== "active") {
      const batchEnded = student.batch_end_date && new Date(student.batch_end_date) < new Date();
      return res.status(403).json({
        error: batchEnded ? "Session expired. Batch has ended." : "Student is inactive.",
        student: student.name,
        reason: batchEnded ? "expired" : "inactive",
      });
    }

    // Working day check
    const nowIST  = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
    const today   = nowIST.split(",")[0].trim();
    const now     = new Date().toISOString();
    const [istYear, istMonth] = today.split("-").map(Number);

    const { rows: wdRows } = await db.query(
      "SELECT is_working, note FROM working_days WHERE branch_id = $1 AND date = $2",
      [branch_id, today]
    );
    const isWorkingDay = wdRows.length === 0 ? true : wdRows[0].is_working;
    const holidayNote  = wdRows.length > 0 && !wdRows[0].is_working ? (wdRows[0].note || "Holiday") : null;

    // Record scan
    const { rows: scanRows } = await db.query(
      "SELECT * FROM qr_scans WHERE student_id=$1 AND scan_date=$2",
      [student_id, today]
    );

    let scanType, result;
    if (scanRows.length === 0) {
      // First scan of the day = Entry
      const { rows } = await db.query(
        `INSERT INTO qr_scans (student_id, branch_id, scan_date, entry_time, scanned_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [student_id, branch_id, today, now, req.user.id]
      );
      scanType = "entry"; result = rows[0];
    } else if (!scanRows[0].exit_time) {
      // Second scan = Exit
      const { rows } = await db.query(
        `UPDATE qr_scans SET exit_time=$1, scanned_by=$2
         WHERE student_id=$3 AND scan_date=$4 RETURNING *`,
        [now, req.user.id, student_id, today]
      );
      scanType = "exit"; result = rows[0];
      // Only increment attendance on working days
      if (isWorkingDay) {
        await db.query(
          `INSERT INTO attendance (student_id, branch_id, month, year, total_days, present)
           VALUES ($1,$2,$3,$4,0,1)
           ON CONFLICT (student_id, month, year)
           DO UPDATE SET present = LEAST(
             attendance.present + 1,
             GREATEST(attendance.total_days, attendance.present + 1)
           )`,
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

    // FIX: pass academy_name so notifications say the correct academy name
    sendAttendanceNotification({
      studentName:  student.name,
      scanType,
      time:         now,
      timeIST:      toIST(now),
      studentToken: student.fcm_token,
      parentToken:  student.parent_fcm_token,
      academyName:  student.academy_name,  // <-- now dynamic
    }).catch(console.error);

    res.json({
      success: true, scan_type: scanType, student_id,
      student_name: student.name, batch: student.batch_name, branch: student.branch_name,
      time: now, time_ist: toIST(now), scan: result,
      is_working_day: isWorkingDay, holiday_note: holidayNote,
    });
  } catch (e) {
    console.error("QR scan error:", e.message);
    res.status(500).json({ error: "Scan failed: " + e.message });
  }
});

// ── Today's scans ──────────────────────────────────────────────────────────────────────
router.get("/today", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role))
    return res.status(403).json({ error: "Access denied" });
  try {
    const todayIST  = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).split(",")[0].trim();
    const academyId = req.academyId;
    let query, params;
    if (req.user.role === "branch_manager") {
      query = `SELECT qs.*, s.name AS student_name, s.phone,
                      b.name AS batch_name, br.name AS branch_name, u.name AS scanned_by_name
               FROM qr_scans qs
               JOIN students s ON s.id = qs.student_id
               LEFT JOIN batches b ON b.id = s.batch_id
               JOIN branches br ON br.id = qs.branch_id
               LEFT JOIN users u ON u.id = qs.scanned_by
               WHERE qs.scan_date=$1 AND qs.branch_id=$2
               ORDER BY COALESCE(qs.exit_time, qs.entry_time) DESC`;
      params = [todayIST, req.user.branch_id];
    } else if (academyId) {
      query = `SELECT qs.*, s.name AS student_name, s.phone,
                      b.name AS batch_name, br.name AS branch_name, u.name AS scanned_by_name
               FROM qr_scans qs
               JOIN students s ON s.id = qs.student_id
               LEFT JOIN batches b ON b.id = s.batch_id
               JOIN branches br ON br.id = qs.branch_id
               LEFT JOIN users u ON u.id = qs.scanned_by
               WHERE qs.scan_date=$1 AND (s.academy_id=$2 OR br.academy_id=$2)
               ORDER BY COALESCE(qs.exit_time, qs.entry_time) DESC`;
      params = [todayIST, academyId];
    } else {
      query = `SELECT qs.*, s.name AS student_name, s.phone,
                      b.name AS batch_name, br.name AS branch_name, u.name AS scanned_by_name
               FROM qr_scans qs
               JOIN students s ON s.id = qs.student_id
               LEFT JOIN batches b ON b.id = s.batch_id
               JOIN branches br ON br.id = qs.branch_id
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
