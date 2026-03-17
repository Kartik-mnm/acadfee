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

async function sendNotification(token, title, body, data = {}) {
  if (!initialized || !token) return { skipped: true };
  try {
    const result = await admin.messaging().send({
      token,
      notification: { title, body },
      data,
      webpush: {
        notification: {
          title, body,
          icon:    "/logo.png",
          badge:   "/logo.png",
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
        fcmOptions: { link: "/" },
      },
    });
    console.log(`✅ FCM sent to token: ${title}`);
    return { success: true, result };
  } catch (e) {
    console.error("FCM send error:", e.message);
    return { error: e.message };
  }
}

async function sendAttendanceNotification({ studentName, scanType, time, timeIST, studentToken, parentToken }) {
  // Use IST time in notification messages
  const displayTime = timeIST || new Date(time).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
  });

  const studentTitle = scanType === "entry" ? "✅ Entry Marked" : "🚪 Exit Marked";
  const studentBody  = scanType === "entry"
    ? `You have arrived at Nishchay Academy at ${displayTime} (IST)`
    : `You have exited Nishchay Academy at ${displayTime} (IST)`;

  const parentTitle = scanType === "entry"
    ? `✅ ${studentName} has arrived`
    : `🚪 ${studentName} has left`;
  const parentBody  = scanType === "entry"
    ? `Your child arrived at Nishchay Academy at ${displayTime} (IST)`
    : `Your child left Nishchay Academy at ${displayTime} (IST)`;

  const results = await Promise.allSettled([
    sendNotification(studentToken, studentTitle, studentBody, { scan_type: scanType }),
    sendNotification(parentToken,  parentTitle,  parentBody,  { scan_type: scanType }),
  ]);
  return results;
}

module.exports = { initFCM, sendNotification, sendAttendanceNotification };
