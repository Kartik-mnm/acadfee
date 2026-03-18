// #37 — Auto absent notification to parent at 10 PM IST
const db                   = require("./db");
const { sendNotification } = require("./fcm");

let lastFiredDate = "";

async function sendAbsentNotifications() {
  const nowIST   = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayIST = nowIST.split(",")[0].trim();

  if (lastFiredDate === todayIST) return;
  lastFiredDate = todayIST;

  console.log(`[Cron] Running absent notification check for ${todayIST}`);

  try {
    const { rows: absentStudents } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.parent_fcm_token, s.fcm_token, br.name AS branch_name
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       WHERE s.status = 'active'
         AND (s.parent_fcm_token IS NOT NULL OR s.fcm_token IS NOT NULL)
         AND s.id NOT IN (
           SELECT student_id FROM qr_scans WHERE scan_date = $1
         )`,
      [todayIST]
    );

    console.log(`[Cron] ${absentStudents.length} absent students for ${todayIST}`);

    for (const student of absentStudents) {
      if (student.parent_fcm_token) {
        await sendNotification(
          student.parent_fcm_token,
          `\u26a0\ufe0f Absent Today \u2014 ${student.name}`,
          `${student.name} has not been scanned in at Nishchay Academy today (${todayIST}). Please check in with your child.`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
      }
      if (student.fcm_token) {
        await sendNotification(
          student.fcm_token,
          `\u26a0\ufe0f You were marked absent today`,
          `You have not scanned in at Nishchay Academy today. Please contact your branch if this is incorrect.`,
          { type: "absent_alert", date: todayIST }
        );
      }
    }

    console.log(`[Cron] Absent notifications sent`);
  } catch (e) {
    console.error("[Cron] Absent notification error:", e.message);
  }
}

function startAbsentCron() {
  console.log("\u2705 Absent notification cron started (fires at 10:00 PM IST daily)");
  setInterval(() => {
    const nowIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    if (nowIST === "22:00") sendAbsentNotifications();
  }, 60 * 1000);
}

module.exports = { startAbsentCron, sendAbsentNotifications };
