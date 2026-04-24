// FCM debug routes — helps diagnose notification issues
const router = require("express").Router();
const { auth } = require("../middleware");
const { sendNotification } = require("../fcm");
const db = require("../db");

// GET /api/fcm-debug/status  — PUBLIC, no auth needed
// Open this URL directly in any browser to check FCM setup
router.get("/status", async (req, res) => {
  const vars = {
    FIREBASE_PROJECT_ID:   !!process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY:  !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
  };
  const allSet = Object.values(vars).every(Boolean);

  let tokenCount = 0;
  let sampleStudents = [];
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM students WHERE fcm_token IS NOT NULL AND fcm_token != ''`
    );
    tokenCount = rows[0].cnt;

    // Show first 5 students with tokens (name only, for verification)
    const { rows: samples } = await db.query(
      `SELECT name FROM students WHERE fcm_token IS NOT NULL AND fcm_token != '' LIMIT 5`
    );
    sampleStudents = samples.map(s => s.name);
  } catch (e) {
    console.error("[fcm-debug] DB error:", e.message);
  }

  res.json({
    ok: allSet && tokenCount > 0,
    firebase_admin_initialized: allSet,
    env_vars_set: vars,
    students_with_fcm_token: tokenCount,
    sample_students_with_token: sampleStudents,
    diagnosis: !allSet
      ? "PROBLEM: Firebase Admin env vars missing in Render. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL."
      : tokenCount === 0
      ? "WARNING: Firebase Admin is configured but NO student has an FCM token. Students need to open the portal and click 'Enable Notifications'."
      : `All good! Firebase configured + ${tokenCount} student(s) have tokens. Notifications should work.`,
  });
});

// POST /api/fcm-debug/test  — send a test push to a specific student (requires auth)
// Body: { student_id }
router.post("/test", auth, async (req, res) => {
  if (!["super_admin", "branch_manager"].includes(req.user.role))
    return res.status(403).json({ error: "Admin only" });

  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: "student_id required" });

  try {
    const { rows } = await db.query(
      "SELECT id, name, fcm_token, parent_fcm_token FROM students WHERE id = $1",
      [student_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found" });
    const student = rows[0];

    if (!student.fcm_token && !student.parent_fcm_token) {
      return res.json({
        sent: false,
        student: student.name,
        diagnosis: "Student has no FCM token. They need to open the student portal and click 'Enable Notifications'.",
      });
    }

    const results = [];
    if (student.fcm_token) {
      const r = await sendNotification(
        student.fcm_token,
        "\uD83D\uDD14 Test Notification",
        `Hello ${student.name}! Attendance notifications are working correctly.`,
        { type: "test" }
      );
      results.push({ token_type: "student", result: r });
    }
    if (student.parent_fcm_token) {
      const r = await sendNotification(
        student.parent_fcm_token,
        "\uD83D\uDD14 Test Notification (Parent)",
        `Parent notification test for ${student.name} — working correctly.`,
        { type: "test" }
      );
      results.push({ token_type: "parent", result: r });
    }

    res.json({ sent: true, student: student.name, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fcm-debug/trigger-absent — manually trigger the absent notification job (super_admin only)
router.post("/trigger-absent", auth, async (req, res) => {
  if (req.user.role !== "super_admin")
    return res.status(403).json({ error: "Access denied: super_admin only" });

  const { sendAbsentNotifications } = require("../cron");
  
  // Use today's date in IST
  const now      = new Date();
  const istMs    = now.getTime() + (5.5 * 60 * 60 * 1000);
  const istDate  = new Date(istMs);
  const todayIST = istDate.toISOString().split("T")[0];

  try {
    console.log(`[fcm-debug] Manual trigger for absent notifications: ${todayIST}`);
    // We don't await this to avoid timeout, but we trigger it
    sendAbsentNotifications(todayIST);
    res.json({ success: true, message: `Absent notification job triggered for ${todayIST}. Check server logs for results.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
