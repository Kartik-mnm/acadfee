const admin = require("firebase-admin");

let initialized = false;

function initFCM() {
  if (initialized) return;
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.log("Firebase env vars not set — FCM disabled");
    return;
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    initialized = true;
    console.log("✅ Firebase Admin initialized");
  } catch (e) {
    console.error("Firebase init error:", e.message);
  }
}

// Absolute URL to the academy logo hosted on the frontend
// APP_URL is set in Render env: https://acadfee-app.onrender.com
function getIconUrl() {
  const base = (process.env.APP_URL || "https://acadfee-app.onrender.com").replace(/\/$/, "");
  return `${base}/nishchay-logo.png`;
}

async function sendNotification(token, title, body, data = {}) {
  if (!initialized || !token) return { skipped: true };
  const iconUrl = getIconUrl();
  try {
    const result = await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      webpush: {
        notification: {
          title,
          body,
          // icon  → large image on the RIGHT of the Android notification (working correctly)
          // badge → omitted intentionally:
          //          Android requires a white-on-transparent monochrome PNG for the left slot.
          //          Passing a full-colour logo causes Android to show Chrome's blue square
          //          as a fallback, which looks worse than no badge at all.
          icon:    iconUrl,
          vibrate: [200, 100, 200],
          requireInteraction: false,
          tag:      "nishchay-attendance",
          renotify: true,
        },
        fcmOptions: {
          link: process.env.APP_URL || "https://acadfee-app.onrender.com",
        },
      },
    });
    console.log(`✅ FCM sent: ${title}`);
    return { success: true, result };
  } catch (e) {
    console.error("FCM send error:", e.message);
    return { error: e.message };
  }
}

async function sendAttendanceNotification({ studentName, scanType, time, timeIST, studentToken, parentToken }) {
  const displayTime = timeIST || new Date(time).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
  });

  const studentTitle = scanType === "entry"
    ? `✅ Entry Marked — ${studentName}`
    : `🚶 Exit Marked — ${studentName}`;
  const studentBody = scanType === "entry"
    ? `Welcome! You arrived at Nishchay Academy at ${displayTime} IST`
    : `Goodbye! You left Nishchay Academy at ${displayTime} IST`;

  const parentTitle = scanType === "entry"
    ? `✅ ${studentName} has arrived`
    : `🚶 ${studentName} has left`;
  const parentBody = scanType === "entry"
    ? `Your child ${studentName} arrived at Nishchay Academy at ${displayTime} IST`
    : `Your child ${studentName} left Nishchay Academy at ${displayTime} IST`;

  const results = await Promise.allSettled([
    sendNotification(studentToken, studentTitle, studentBody, { scan_type: scanType, student_name: studentName }),
    sendNotification(parentToken,  parentTitle,  parentBody,  { scan_type: scanType, student_name: studentName }),
  ]);
  return results;
}

module.exports = { initFCM, sendNotification, sendAttendanceNotification };
