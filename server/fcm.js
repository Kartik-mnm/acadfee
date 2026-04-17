const admin = require("firebase-admin");
const db    = require("./db");

let initialized = false;

function initFCM() {
  if (initialized) return;
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.log("[FCM] Firebase env vars not set \u2014 FCM disabled");
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
  const url = process.env.APP_URL || process.env.FRONTEND_URL || "https://app.exponentgrow.in";
  return url.replace(/\/$/, "");
}

/**
 * Core send function.
 * - tag: unique per notification so each one shows separately (not replaced)
 * - requireInteraction: true so notification stays until user taps it
 * - Auto-purges stale/invalid FCM tokens from DB
 */
async function sendNotification(token, title, body, data = {}) {
  if (!initialized || !token) {
    if (!initialized) console.log("[FCM] Not initialized \u2014 skipping notification");
    return { skipped: true };
  }
  // Unique tag per notification = each one shows as a separate notification
  // Use timestamp + type so they don't replace each other
  const tag = `exponent-${data.type || "alert"}-${Date.now()}`;
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
          icon:    `${getAppUrl()}/logo192.png`,
          badge:   `${getAppUrl()}/logo192.png`,
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true,  // stays visible until user taps it
          tag,                       // unique per notification
          renotify: true,
          timestamp: Date.now(),
        },
        fcmOptions: {
          link: getAppUrl(),
        },
      },
      android: {
        priority: "high",
        notification: {
          sound:    "default",
          priority: "high",
          channelId: "exponent_alerts",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    });
    console.log(`[FCM] \u2705 Sent: "${title}" to ${token.substring(0, 20)}...`);
    return { success: true, result };
  } catch (e) {
    const isStale =
      e.code === "messaging/invalid-registration-token" ||
      e.code === "messaging/registration-token-not-registered" ||
      e.message?.includes("not-registered") ||
      e.message?.includes("invalid-registration-token");

    if (isStale) {
      console.warn(`[FCM] Stale token \u2014 purging from DB: ${token.substring(0, 20)}...`);
      try {
        await db.query(`UPDATE students SET fcm_token = NULL WHERE fcm_token = $1`, [token]);
        await db.query(`UPDATE students SET parent_fcm_token = NULL WHERE parent_fcm_token = $1`, [token]);
      } catch (dbErr) {
        console.error("[FCM] Failed to purge stale token:", dbErr.message);
      }
    } else {
      console.error("[FCM] Send error:", e.code, e.message);
    }
    return { error: e.message };
  }
}

/**
 * Attendance notification \u2014 sent on QR entry/exit scan.
 * Shows to student's device and parent's device separately.
 */
async function sendAttendanceNotification({
  studentName, scanType, time, timeIST,
  studentToken, parentToken,
  academyName,
}) {
  const academy     = academyName || "your academy";
  const displayTime = timeIST || new Date(time).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const isEntry = scanType === "entry";

  const studentTitle = isEntry ? `\u2705 Entry Marked` : `\ud83d\udeb6 Exit Marked`;
  const studentBody  = isEntry
    ? `Hi ${studentName}! You arrived at ${academy} at ${displayTime}.`
    : `Goodbye ${studentName}! You left ${academy} at ${displayTime}.`;

  const parentTitle  = isEntry ? `\u2705 ${studentName} has arrived` : `\ud83d\udeb6 ${studentName} has left`;
  const parentBody   = isEntry
    ? `${studentName} arrived at ${academy} at ${displayTime}.`
    : `${studentName} left ${academy} at ${displayTime}.`;

  const promises = [];
  if (studentToken)
    promises.push(sendNotification(studentToken, studentTitle, studentBody, {
      type: "attendance", scan_type: scanType, student_name: studentName,
    }));
  if (parentToken)
    promises.push(sendNotification(parentToken, parentTitle, parentBody, {
      type: "attendance", scan_type: scanType, student_name: studentName,
    }));

  if (promises.length === 0) {
    console.log(`[FCM] No tokens for ${studentName} \u2014 attendance notification skipped`);
    return [{ skipped: true }];
  }
  const results = await Promise.allSettled(promises);
  return results;
}

/**
 * Payment notification \u2014 sent when a fee payment is recorded.
 * Shows receipt number, amount, and period to student.
 */
async function sendPaymentNotification({
  studentName, studentToken, parentToken,
  amount, receiptNo, periodLabel, academyName,
}) {
  const academy = academyName || "your academy";
  const amtStr  = `\u20b9${parseFloat(amount).toLocaleString("en-IN")}`;
  const period  = periodLabel ? ` for ${periodLabel}` : "";

  const title = `\ud83d\udcb3 Payment Received \u2014 ${receiptNo}`;
  const body  = `${amtStr} paid${period} at ${academy}. Thank you!`;

  const parentTitle = `\ud83d\udcb3 Fee Payment \u2014 ${studentName}`;
  const parentBody  = `${amtStr} received${period} for ${studentName} at ${academy}. Receipt: ${receiptNo}`;

  const promises = [];
  if (studentToken)
    promises.push(sendNotification(studentToken, title, body, {
      type: "payment", receipt_no: receiptNo, amount: String(amount),
    }));
  if (parentToken)
    promises.push(sendNotification(parentToken, parentTitle, parentBody, {
      type: "payment", receipt_no: receiptNo, amount: String(amount), student_name: studentName,
    }));

  if (promises.length === 0) {
    console.log(`[FCM] No tokens for ${studentName} \u2014 payment notification skipped`);
    return [{ skipped: true }];
  }
  const results = await Promise.allSettled(promises);
  return results;
}

module.exports = { initFCM, sendNotification, sendAttendanceNotification, sendPaymentNotification };
