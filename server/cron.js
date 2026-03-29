// ── Nightly cron + Keep-alive ping ────────────────────────────────────────────
// 1. Keep-alive: pings both Render services every 10 min so they never cold-start
// 2. Nightly job at 10:00 PM IST: auto-attendance + absent alerts
// 3. Trial enforcement: suspends academies whose trial expired > 1 day ago
// 4. Backfill: any students with null academy_id get fixed automatically

const db                   = require("./db");
const { sendNotification } = require("./fcm");
const { generateMonthForBranch } = require("./routes/attendance");

let lastFiredDate = "";

// ── Keep-alive ─────────────────────────────────────────────────────────────────
// Pings both services every 10 minutes so Render free tier never spins down
function startKeepAlive() {
  const targets = [
    "https://acadfee.onrender.com/health",
    "https://acadfee-app.onrender.com/health",
  ].filter(Boolean);

  const ping = async () => {
    for (const url of targets) {
      try {
        await fetch(url, { signal: AbortSignal.timeout(8000) });
        console.log(`[keep-alive] ✓ pinged ${url}`);
      } catch (e) {
        console.warn(`[keep-alive] ✗ ${url}: ${e.message}`);
      }
    }
  };

  // Ping once at startup, then every 10 minutes
  ping();
  setInterval(ping, 10 * 60 * 1000);
  console.log("✅ Keep-alive started — pinging every 10 min");
}

// ── Backfill: fix any students with null academy_id ────────────────────────────
async function backfillStudentAcademyIds() {
  try {
    // Students whose branch has an academy_id but the student doesn't
    const { rowCount } = await db.query(`
      UPDATE students s
      SET academy_id = b.academy_id
      FROM branches b
      WHERE s.branch_id = b.id
        AND s.academy_id IS NULL
        AND b.academy_id IS NOT NULL
    `);
    if (rowCount > 0)
      console.log(`[backfill] Fixed academy_id for ${rowCount} student(s)`);
  } catch (e) {
    console.error("[backfill] Error:", e.message);
  }
}

// ── Trial enforcement ──────────────────────────────────────────────────────────
// Suspends academies whose trial ended more than 1 day ago and are still active
async function enforceTrialExpiry() {
  try {
    const { rows } = await db.query(`
      UPDATE academies
      SET is_active = false, updated_at = NOW()
      WHERE plan = 'trial'
        AND is_active = true
        AND trial_ends_at < NOW() - INTERVAL '1 day'
      RETURNING id, name
    `);
    if (rows.length > 0)
      console.log(`[trial] Suspended ${rows.length} expired trial(s):`, rows.map(r => r.name).join(", "));
  } catch (e) {
    console.error("[trial] Enforcement error:", e.message);
  }
}

// ── Auto-generate attendance ────────────────────────────────────────────────────
async function autoGenerateAttendance(month, year) {
  try {
    const { rows: branches } = await db.query(`SELECT id, name FROM branches`);
    for (const branch of branches) {
      try {
        const result = await generateMonthForBranch(branch.id, month, year);
        console.log(`[Cron] ${branch.name}: ${result.created} created, ${result.updated} updated`);
      } catch (e) {
        console.error(`[Cron] Error for branch ${branch.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error("[Cron] Auto-generate attendance error:", e.message);
  }
}

// ── Absent notifications ────────────────────────────────────────────────────────
async function sendAbsentNotifications(todayIST) {
  try {
    const { rows: absentStudents } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.parent_fcm_token, s.fcm_token,
              br.name AS branch_name, a.name AS academy_name
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       LEFT JOIN academies a ON a.id = s.academy_id
       WHERE s.status = 'active'
         AND (s.parent_fcm_token IS NOT NULL OR s.fcm_token IS NOT NULL)
         AND s.id NOT IN (
           SELECT student_id FROM qr_scans
           WHERE scan_date = $1 AND exit_time IS NOT NULL
         )`,
      [todayIST]
    );

    const notifyList = [];
    for (const s of absentStudents) {
      const { rows: wd } = await db.query(
        `SELECT is_working FROM working_days WHERE branch_id=$1 AND date=$2`,
        [s.branch_id, todayIST]
      );
      if (wd.length === 0 || wd[0].is_working) notifyList.push(s);
    }

    console.log(`[Cron] ${notifyList.length} absent student(s) on ${todayIST}`);

    for (const student of notifyList) {
      const academyName = student.academy_name || "your academy";
      if (student.parent_fcm_token) {
        await sendNotification(
          student.parent_fcm_token,
          `⚠️ Absent Today — ${student.name}`,
          `${student.name} was not present at ${academyName} today (${todayIST}).`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
      }
      if (student.fcm_token) {
        await sendNotification(
          student.fcm_token,
          `⚠️ You were absent today`,
          `You did not attend ${academyName} today (${todayIST}). Contact your branch if incorrect.`,
          { type: "absent_alert", date: todayIST }
        );
      }
    }
  } catch (e) {
    console.error("[Cron] Absent notification error:", e.message);
  }
}

// ── Main nightly job ────────────────────────────────────────────────────────────
async function runNightlyJob() {
  const nowIST   = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayIST = nowIST.split(",")[0].trim();

  if (lastFiredDate === todayIST) return;
  lastFiredDate = todayIST;

  const [y, m] = todayIST.split("-").map(Number);
  console.log(`\n[Cron] ⏰ Nightly job starting for ${todayIST}`);

  await autoGenerateAttendance(m, y);
  await sendAbsentNotifications(todayIST);
  await enforceTrialExpiry();
  await backfillStudentAcademyIds();

  console.log(`[Cron] ✅ Nightly job complete for ${todayIST}`);
}

// ── Start scheduler ─────────────────────────────────────────────────────────────
function startAbsentCron() {
  console.log("✅ Nightly cron started — fires at 10:00 PM IST");
  setInterval(() => {
    const nowIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    if (nowIST === "22:00") runNightlyJob();
  }, 60 * 1000);
}

module.exports = { startAbsentCron, runNightlyJob, startKeepAlive, backfillStudentAcademyIds };
