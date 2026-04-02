const admin = require("firebase-admin");
const db    = require("./db");

let initialized = false;

function initFCM() {
  if (initialized) return;
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.log("[FCM] Firebase env vars not set — FCM disabled");
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
    console.log("\u2705 Firebase Admin initialized");
  } catch (e) {
    console.error("Firebase init error:", e.message);
  }
}

function getAppUrl() {
  return (process.env.APP_URL || "https://app.exponentgrow.in").replace(/\/$/, "");
}

/**
 * Core send function.
 * If FCM rejects the token as invalid/unregistered, we automatically
 * clear it from the DB so it is never retried.
 */
async function sendNotification(token, title, body, data = {}) {
  if (!initialized || !token) return { skipped: true };
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
          // Use a generic Exponent icon hosted at the app URL
          icon:    `${getAppUrl()}/logo192.png`,
          vibrate: [200, 100, 200],
          requireInteraction: false,
          tag:      "exponent-attendance",
          renotify: true,
        },
        fcmOptions: {
          link: getAppUrl(),
        },
      },
    });
    console.log(`[FCM] \u2705 Sent: "${title}"`);
    return { success: true, result };
  } catch (e) {
    // Automatically purge stale / unregistered FCM tokens from DB
    const isStale = e.code === "messaging/invalid-registration-token"
                 || e.code === "messaging/registration-token-not-registered"
                 || e.message?.includes("not-registered")
                 || e.message?.includes("invalid-registration-token");
    if (isStale) {
      console.warn(`[FCM] Stale token detected — purging from DB: ${token.substring(0, 20)}...`);
      try {
        // Clear from both student columns (fcm_token and parent_fcm_token)
        await db.query(
          `UPDATE students SET fcm_token = NULL WHERE fcm_token = $1`, [token]
        );
        await db.query(
          `UPDATE students SET parent_fcm_token = NULL WHERE parent_fcm_token = $1`, [token]
        );
      } catch (dbErr) {
        console.error("[FCM] Failed to purge token from DB:", dbErr.message);
      }
    } else {
      console.error("[FCM] Send error:", e.message);
    }
    return { error: e.message };
  }
}

/**
 * Send entry/exit attendance notification to student and parent.
 * academyName is passed from the QR scan route so each academy
 * shows its own name instead of a hardcoded one.
 */
async function sendAttendanceNotification({
  studentName, scanType, time, timeIST,
  studentToken, parentToken,
  academyName   // <-- new param: academy's actual name
}) {
  const academy  = academyName || "your academy";
  const displayTime = timeIST || new Date(time).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
  });

  const isEntry = scanType === "entry";

  const studentTitle = isEntry
    ? `\u2705 Entry Marked \u2014 ${studentName}`
    : `\ud83d\udeb6 Exit Marked \u2014 ${studentName}`;
  const studentBody = isEntry
    ? `Welcome! You arrived at ${academy} at ${displayTime}`
    : `Goodbye! You left ${academy} at ${displayTime}`;

  const parentTitle = isEntry
    ? `\u2705 ${studentName} has arrived`
    : `\ud83d\udeb6 ${studentName} has left`;
  const parentBody = isEntry
    ? `${studentName} arrived at ${academy} at ${displayTime}`
    : `${studentName} left ${academy} at ${displayTime}`;

  const promises = [];
  if (studentToken)
    promises.push(sendNotification(studentToken, studentTitle, studentBody,
      { type: "attendance", scan_type: scanType, student_name: studentName }));
  if (parentToken)
    promises.push(sendNotification(parentToken, parentTitle, parentBody,
      { type: "attendance", scan_type: scanType, student_name: studentName }));

  if (promises.length === 0) return [{ skipped: true }];
  const results = await Promise.allSettled(promises);
  return results;
}

module.exports = { initFCM, sendNotification, sendAttendanceNotification };
