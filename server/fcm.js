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

// Build the notification icon URL.
// Uses nishchay-logo.png which is confirmed present in /public.
// APP_URL is set in Render env vars: https://acadfee-app.onrender.com
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
          icon:    iconUrl,   // absolute HTTPS URL → shows academy logo in browser notifications
          badge:   iconUrl,   // small monochrome badge icon (Android Chrome)
          vibrate: [200, 100, 200],
          requireInteraction: false,
          // Click action: opens the app
          click_action: process.env.APP_URL || "https://acadfee-app.onrender.com",
        },
        fcmOptions: {
          link: process.env.APP_URL || "https://acadfee-app.onrender.com",
        },
      },
      android: {
        notification: {
          icon: "ic_launcher",  // uses native Android icon if app is installed as PWA
          color: "#2563eb",     // Arctic Blue accent
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    });
    console.log(`✅ FCM sent to token: ${token.substring(0, 20)}… | ${title}`);
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
