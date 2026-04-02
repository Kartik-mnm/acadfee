// ── Nightly cron + Keep-alive ping ──────────────────────────────────────────────────
const db                     = require("./db");
const { sendNotification }   = require("./fcm");
const { generateMonthForBranch } = require("./routes/attendance");
const { fetchDayData }       = require("./routes/daily-report");
const { Resend }             = require("resend");

let lastFiredDate = "";

// ── Keep-alive ───────────────────────────────────────────────────────────────────
function startKeepAlive() {
  const targets = [
    "https://acadfee.onrender.com/health",
    "https://acadfee-app.onrender.com/health",
    "https://api.exponentgrow.in/health",
    "https://app.exponentgrow.in",
  ].filter(Boolean);

  const ping = async () => {
    for (const url of targets) {
      try {
        await fetch(url, { signal: AbortSignal.timeout(8000) });
        console.log(`[keep-alive] \u2713 pinged ${url}`);
      } catch (e) {
        console.warn(`[keep-alive] \u2717 ${url}: ${e.message}`);
      }
    }
  };
  ping();
  setInterval(ping, 10 * 60 * 1000);
  console.log("\u2705 Keep-alive started — pinging every 10 min");
}

// ── Backfill ───────────────────────────────────────────────────────────────────
async function backfillStudentAcademyIds() {
  try {
    const { rowCount } = await db.query(`
      UPDATE students s SET academy_id = b.academy_id
      FROM branches b
      WHERE s.branch_id = b.id AND s.academy_id IS NULL AND b.academy_id IS NOT NULL
    `);
    if (rowCount > 0) console.log(`[backfill] Fixed academy_id for ${rowCount} student(s)`);
  } catch (e) {
    console.error("[backfill] Error:", e.message);
  }
}

// ── Trial enforcement ───────────────────────────────────────────────────────────────
async function enforceTrialExpiry() {
  try {
    const { rows } = await db.query(`
      UPDATE academies SET is_active=false, updated_at=NOW()
      WHERE plan='trial' AND is_active=true AND trial_ends_at < NOW() - INTERVAL '1 day'
      RETURNING id, name
    `);
    if (rows.length > 0) console.log(`[trial] Suspended ${rows.length} expired trial(s):`, rows.map(r => r.name).join(", "));
  } catch (e) {
    console.error("[trial] Enforcement error:", e.message);
  }
}

// ── Auto-generate attendance ─────────────────────────────────────────────────────
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

// ── Absent notifications ─────────────────────────────────────────────────────────────
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
      if (student.parent_fcm_token)
        await sendNotification(student.parent_fcm_token, `\u26a0\ufe0f Absent Today \u2014 ${student.name}`, `${student.name} was not present at ${academyName} today (${todayIST}).`, { type: "absent_alert", student_id: String(student.id), date: todayIST });
      if (student.fcm_token)
        await sendNotification(student.fcm_token, `\u26a0\ufe0f You were absent today`, `You did not attend ${academyName} today (${todayIST}).`, { type: "absent_alert", date: todayIST });
    }
  } catch (e) {
    console.error("[Cron] Absent notification error:", e.message);
  }
}

// ── Email daily reports to all active academies ──────────────────────────────────
async function emailDailyReports(todayIST) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { rows: academies } = await db.query(`
      SELECT id, name, email FROM academies
      WHERE is_active = true AND plan != 'lead' AND email IS NOT NULL AND email != ''
    `);
    const resend = new Resend(process.env.RESEND_API_KEY);
    for (const acad of academies) {
      try {
        const data = await fetchDayData(acad.id, todayIST);
        const s    = data.summary;
        const hasActivity = s.payments_count > 0 || s.new_students > 0 || s.total_attendance > 0 || s.total_expenses > 0;
        if (!hasActivity) continue;
        const fmt = (n) => `\u20b9${parseFloat(n||0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#1a1f35,#2d3561);padding:24px 28px;">
    <div style="font-size:18px;font-weight:900;color:#fff;">📊 Daily Report — ${todayIST}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">${acad.name}</div>
  </div>
  <div style="padding:24px 28px;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
      ${[["Collected",fmt(s.total_collected)],["Expenses",fmt(s.total_expenses)],["Net Cash",fmt(s.net_cash_flow)],["Payments",s.payments_count],["New Students",s.new_students],["Present/Total",`${s.present_count}/${s.total_attendance}`]]
        .map(([l,v])=>`<div style="border:1px solid #eee;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:16px;font-weight:900;color:#6366f1;">${v}</div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-top:3px;">${l}</div></div>`).join("")}
    </div>
    ${data.payments.length > 0 ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:#333;margin-bottom:6px;border-bottom:2px solid #6366f1;padding-bottom:4px;">💰 Payments (${data.payments.length})</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#6366f1;color:#fff;"><th style="padding:5px 8px;text-align:left;">Student</th><th style="padding:5px 8px;text-align:left;">Branch</th><th style="padding:5px 8px;text-align:right;">Amount</th><th style="padding:5px 8px;text-align:left;">Mode</th></tr>${data.payments.map((p,i)=>`<tr style="${i%2===1?"background:#f5f5ff":""}"><td style="padding:5px 8px;border-bottom:1px solid #eee;">${p.student_name}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;">${p.branch_name}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#6366f1;">${fmt(p.amount)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;">${p.payment_mode}</td></tr>`).join("")}</table></div>` : ""}
    ${data.new_students.length > 0 ? `<div style="font-size:12px;margin-bottom:12px;"><span style="font-weight:700;">🎓 New students:</span> ${data.new_students.map(st=>st.name).join(", ")}</div>` : ""}
    <div style="margin-top:16px;padding:10px 14px;background:#f5f5ff;border-radius:8px;font-size:11px;color:#555;">Log in at <a href="https://app.exponentgrow.in" style="color:#6366f1;">app.exponentgrow.in</a> to download the full Excel report.</div>
  </div>
  <div style="background:#1a1f35;padding:12px 28px;text-align:center;font-size:10px;color:rgba(255,255,255,0.4);">Exponent Platform · exponentgrow.in · ${todayIST}</div>
</div></body></html>`;
        await resend.emails.send({
          from:    "Exponent Reports <noreply@exponentgrow.in>",
          to:      acad.email,
          subject: `\uD83D\uDCCA Daily Report ${todayIST} — ${acad.name}`,
          html,
        });
        console.log(`[daily-report] Sent to ${acad.email} (${acad.name})`);
      } catch (e) {
        console.error(`[daily-report] Failed for ${acad.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error("[daily-report] Nightly email error:", e.message);
  }
}

// ── Main nightly job ──────────────────────────────────────────────────────────────────
async function runNightlyJob() {
  const nowIST   = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayIST = nowIST.split(",")[0].trim();
  if (lastFiredDate === todayIST) return;
  lastFiredDate = todayIST;
  const [y, m] = todayIST.split("-").map(Number);
  console.log(`\n[Cron] \u23f0 Nightly job starting for ${todayIST}`);
  await autoGenerateAttendance(m, y);
  await sendAbsentNotifications(todayIST);
  await enforceTrialExpiry();
  await backfillStudentAcademyIds();
  await emailDailyReports(todayIST);
  console.log(`[Cron] \u2705 Nightly job complete for ${todayIST}`);
}

// ── Start scheduler ───────────────────────────────────────────────────────────────────
function startAbsentCron() {
  console.log("\u2705 Nightly cron started — fires at 10:00 PM IST");
  setInterval(() => {
    // BUG FIX: toLocaleString with hour12:false can return "24:00" instead of "00:00"
    // on some Node/V8 versions, and may include invisible Unicode chars or spaces.
    // Use explicit UTC offset arithmetic instead — IST = UTC+5:30.
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const istHour   = istDate.getUTCHours();
    const istMinute = istDate.getUTCMinutes();
    if (istHour === 22 && istMinute === 0) runNightlyJob();
  }, 60 * 1000);
}

module.exports = { startAbsentCron, runNightlyJob, startKeepAlive, backfillStudentAcademyIds };
