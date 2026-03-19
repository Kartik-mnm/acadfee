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
          // Use absolute Render URL so browser notifications show the logo
          icon:    process.env.APP_URL ? `${process.env.APP_URL}/logo.png` : "/logo.png",
          badge:   process.env.APP_URL ? `${process.env.APP_URL}/logo.png` : "/logo.png",
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
        fcmOptions: { link: "/" },
      },
    });
    console.log(`✅ FCM sent: ${title}`);
    return { success: true, result };
  } catch (e) {
    console.error("FCM send error:", e.message);
    return { error: e.message };
  }
}

// Fix #1 — student notification now includes their name too
async function sendAttendanceNotification({ studentName, scanType, time, timeIST, studentToken, parentToken }) {
  const displayTime = timeIST || new Date(time).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
  });

  const studentTitle = scanType === "entry"
    ? `✅ ${studentName} — Entry Marked`
    : `🚪 ${studentName} — Exit Marked`;
  const studentBody  = scanType === "entry"
    ? `${studentName} arrived at Nishchay Academy at ${displayTime} (IST)`
    : `${studentName} exited Nishchay Academy at ${displayTime} (IST)`;

  const parentTitle = scanType === "entry"
    ? `✅ ${studentName} has arrived`
    : `🚪 ${studentName} has left`;
  const parentBody  = scanType === "entry"
    ? `Your child ${studentName} arrived at Nishchay Academy at ${displayTime} (IST)`
    : `Your child ${studentName} left Nishchay Academy at ${displayTime} (IST)`;

  const results = await Promise.allSettled([
    sendNotification(studentToken, studentTitle, studentBody, { scan_type: scanType, student_name: studentName }),
    sendNotification(parentToken,  parentTitle,  parentBody,  { scan_type: scanType, student_name: studentName }),
  ]);
  return results;
}

module.exports = { initFCM, sendNotification, sendAttendanceNotification };
