// Nishchay Academy — nightly cron at 10:00 PM IST
// Does two things:
//   1. Auto-marks attendance for ALL branches for today's month (so admin never has to)
//   2. Notifies absent students & parents via FCM

const db                   = require("./db");
const { sendNotification } = require("./fcm");
const { generateMonthForBranch } = require("./routes/attendance");

let lastFiredDate = "";

// ── Step 1: Auto-generate attendance for all branches ──────────────────────
async function autoGenerateAttendance(month, year) {
  try {
    const { rows: branches } = await db.query(`SELECT id, name FROM branches`);
    console.log(`[Cron] Auto-generating attendance for ${branches.length} branch(es) — ${month}/${year}`);
    for (const branch of branches) {
      try {
        const result = await generateMonthForBranch(branch.id, month, year);
        console.log(`[Cron] ${branch.name}: ${result.created} created, ${result.updated} updated, ${result.total_working_days} working days`);
      } catch (e) {
        console.error(`[Cron] Error generating attendance for branch ${branch.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error("[Cron] Auto-generate attendance error:", e.message);
  }
}

// ── Step 2: Notify absent students & parents ──────────────────────────────
async function sendAbsentNotifications(todayIST) {
  try {
    // Find all active students who have not completed a scan today (no exit_time)
    const { rows: absentStudents } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.parent_fcm_token, s.fcm_token, br.name AS branch_name
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       WHERE s.status = 'active'
         AND (s.parent_fcm_token IS NOT NULL OR s.fcm_token IS NOT NULL)
         AND s.id NOT IN (
           SELECT student_id FROM qr_scans
           WHERE scan_date = $1 AND exit_time IS NOT NULL
         )`,
      [todayIST]
    );

    // Also check: is today actually a working day for this student's branch?
    // We don't want to send "absent" notifications on holidays.
    const notifyList = [];
    for (const s of absentStudents) {
      const { rows: wd } = await db.query(
        `SELECT is_working FROM working_days WHERE branch_id=$1 AND date=$2`,
        [s.branch_id, todayIST]
      );
      const isWorkingDay = wd.length === 0 ? true : wd[0].is_working;
      if (isWorkingDay) notifyList.push(s);
    }

    console.log(`[Cron] ${notifyList.length} absent student(s) on working day ${todayIST}`);

    for (const student of notifyList) {
      if (student.parent_fcm_token) {
        await sendNotification(
          student.parent_fcm_token,
          `\u26a0\ufe0f Absent Today — ${student.name}`,
          `${student.name} was not present at Nishchay Academy today (${todayIST}). Please check in with your child.`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
      }
      if (student.fcm_token) {
        await sendNotification(
          student.fcm_token,
          `\u26a0\ufe0f You were absent today`,
          `You did not attend Nishchay Academy today (${todayIST}). Contact your branch if this is incorrect.`,
          { type: "absent_alert", date: todayIST }
        );
      }
    }
    console.log("[Cron] Absent notifications sent");
  } catch (e) {
    console.error("[Cron] Absent notification error:", e.message);
  }
}

// ── Main nightly job ────────────────────────────────────────────────────────────
async function runNightlyJob() {
  const nowIST   = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayIST = nowIST.split(",")[0].trim();  // "2026-03-20"

  if (lastFiredDate === todayIST) return; // already ran today
  lastFiredDate = todayIST;

  const [y, m] = todayIST.split("-").map(Number);
  console.log(`\n[Cron] ⏰ Nightly job starting for ${todayIST}`);

  // Step 1: Auto-generate / sync attendance from QR scans for this month
  await autoGenerateAttendance(m, y);

  // Step 2: Notify absent students & parents
  await sendAbsentNotifications(todayIST);

  console.log(`[Cron] ✅ Nightly job complete for ${todayIST}`);
}

// ── Start the scheduler ────────────────────────────────────────────────────────────
function startAbsentCron() {
  console.log("✅ Nightly cron started — fires at 10:00 PM IST (auto-attendance + absent alerts)");
  setInterval(() => {
    const nowIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    // Fire at exactly 22:00 IST
    if (nowIST === "22:00") runNightlyJob();
  }, 60 * 1000); // check every minute
}

module.exports = { startAbsentCron, runNightlyJob };
