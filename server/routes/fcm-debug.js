// GET /api/fcm-debug  — confirms FCM is working end-to-end
// Protected: only works if you know the admin JWT
const router = require("express").Router();
const { auth } = require("../middleware");
const { sendNotification } = require("../fcm");
const db = require("../db");

// GET /api/fcm-debug/status  — check if Firebase Admin is initialized
router.get("/status", auth, async (req, res) => {
  const firebaseVars = {
    FIREBASE_PROJECT_ID:    !!process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY:   !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL:  !!process.env.FIREBASE_CLIENT_EMAIL,
  };
  const allSet = Object.values(firebaseVars).every(Boolean);

  // Check how many students have FCM tokens
  let tokenCount = 0;
  try {
    const { rows } = await db.query(
      "SELECT COUNT(*) FROM students WHERE fcm_token IS NOT NULL AND fcm_token != ''"
    );
    tokenCount = parseInt(rows[0].count);
  } catch {}

  res.json({
    firebase_initialized: allSet,
    env_vars: firebaseVars,
    students_with_fcm_token: tokenCount,
    message: allSet
      ? "Firebase Admin is configured. Notifications will be sent if students have tokens."
      : "Firebase Admin is NOT fully configured. Set all FIREBASE_* env vars in Render.",
  });
});

// POST /api/fcm-debug/test  — send a test notification to a specific student
// Body: { student_id }
router.post("/test", auth, async (req, res) => {
  if (req.user.role !== "super_admin")
    return res.status(403).json({ error: "Super admin only" });

  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: "student_id required" });

  try {
    const { rows } = await db.query(
      "SELECT id, name, fcm_token FROM students WHERE id = $1", [student_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found" });
    const student = rows[0];

    if (!student.fcm_token) {
      return res.json({
        sent: false,
        reason: "Student has no FCM token. They need to open the student portal and click 'Enable Notifications'.",
        student: student.name,
      });
    }

    const result = await sendNotification(
      student.fcm_token,
      "🔔 Test Notification",
      `Hello ${student.name}! If you see this, FCM notifications are working correctly.`,
      { type: "test" }
    );

    res.json({ sent: !result.skipped && !result.error, result, student: student.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
