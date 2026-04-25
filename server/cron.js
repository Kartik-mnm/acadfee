// ── Nightly cron + Keep-alive ping ─────────────────────────────────────────────────────
const db                         = require("./db");
const { sendNotification }       = require("./fcm");
const { generateMonthForBranch } = require("./routes/attendance");
const { fetchDayData }           = require("./routes/daily-report");
const { sendWhatsAppMessage }    = require("./whatsapp");
const { Resend }                 = require("resend");

let lastFiredDate = "";

// ── Keep-alive ────────────────────────────────────────────────────────────────────────
// Pings the API and frontend every 8 minutes to prevent Render free tier from sleeping.
// Hardcoded fallback URLs ensure this works even if env vars are not set.
function startKeepAlive() {
  const HARDCODED = [
    "https://api.exponentgrow.in/health",
    "https://app.exponentgrow.in",
  ];

  const targets = [
    ...(process.env.APP_URL    ? [process.env.APP_URL]    : []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...HARDCODED,
  ];

  // Deduplicate
  const unique = [...new Set(targets)];

  const ping = async () => {
    for (const url of unique) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 8000);
        await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        console.log(`[keep-alive] \u2713 ${url}`);
      } catch (e) {
        console.warn(`[keep-alive] \u2717 ${url}: ${e.message}`);
      }
    }
  };

  // Ping immediately on startup, then every 8 minutes
  ping();
  setInterval(ping, 8 * 60 * 1000);
  console.log(`\u2705 Keep-alive started \u2014 pinging ${unique.length} URL(s) every 8 min`);
}

// ── Backfill ─────────────────────────────────────────────────────────────────────────
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

// ── Trial enforcement ────────────────────────────────────────────────────────────────────
async function enforceTrialExpiry() {
  try {
    const { rows } = await db.query(`
      UPDATE academies SET is_active=false, updated_at=NOW()
      WHERE plan='trial' AND is_active=true AND trial_ends_at < NOW() - INTERVAL '1 day'
      RETURNING id, name
    `);
    if (rows.length > 0)
      console.log(`[trial] Suspended ${rows.length} expired trial(s):`, rows.map(r => r.name).join(", "));
  } catch (e) {
    console.error("[trial] Enforcement error:", e.message);
  }
}

// ── Auto-generate attendance ──────────────────────────────────────────────────────────────
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

// ── Purge stale FCM tokens ───────────────────────────────────────────────────────────────────
async function purgeStaleTokens() {
  try {
    const { rowCount } = await db.query(`
      UPDATE students s
      SET fcm_token = NULL
      WHERE s.fcm_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM refresh_tokens rt
          WHERE (rt.payload->>'id')::int = s.id
            AND rt.payload->>'role' = 'student'
            AND rt.expires_at > NOW()
        )
    `);
    if (rowCount > 0)
      console.log(`[Cron] Purged stale fcm_token from ${rowCount} logged-out student(s)`);
  } catch (e) {
    console.error("[Cron] Purge stale tokens error:", e.message);
  }
}

// ── Absent notifications ─────────────────────────────────────────────────────────────────────
async function sendAbsentNotifications(todayIST) {
  try {
    const { rows: absentStudents } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.fcm_token, s.parent_fcm_token, s.phone, s.parent_phone,
              br.name AS branch_name, a.name AS academy_name, COALESCE(s.academy_id, br.academy_id) AS academy_id
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       LEFT JOIN academies a ON a.id = COALESCE(s.academy_id, br.academy_id)
       WHERE s.status = 'active'
         AND (s.parent_fcm_token IS NOT NULL OR s.fcm_token IS NOT NULL OR s.phone IS NOT NULL OR s.parent_phone IS NOT NULL)
         AND s.id NOT IN (
           SELECT student_id FROM qr_scans
           WHERE scan_date = $1
         )`,
      [todayIST]
    );

    const { rows: holidays } = await db.query(
      `SELECT branch_id FROM working_days WHERE date=$1 AND is_working=false`,
      [todayIST]
    );
    const holidayBranchIds = new Set(holidays.map(h => h.branch_id));
    const notifyList = absentStudents.filter(s => !holidayBranchIds.has(s.branch_id));

    console.log(`[Cron] ${notifyList.length} absent student(s) to notify on ${todayIST}`);

    for (const student of notifyList) {
      const academyName = student.academy_name || "your academy";
      const dateLabel   = new Date(todayIST).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", timeZone: "Asia/Kolkata"
      });
      if (student.fcm_token) {
        await sendNotification(student.fcm_token,
          `\u26a0\ufe0f You were absent today`,
          `You did not attend ${academyName} on ${dateLabel}.`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
      }
      if (student.parent_fcm_token) {
        await sendNotification(student.parent_fcm_token,
          `\u26a0\ufe0f ${student.name} was absent today`,
          `${student.name} did not attend ${academyName} on ${dateLabel}.`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
      }
      const phone = student.parent_phone || student.phone;
      if (phone && student.academy_id) {
        const text = `\u26a0\ufe0f *ABSENT ALERT*\n\nHi, ${student.name} did not attend ${academyName} on ${dateLabel}. Please contact the administration if you have questions.\n\n- ${academyName}`;
        await sendWhatsAppMessage(student.academy_id, phone, text);
      }
    }
  } catch (e) {
    console.error("[Cron] Absent notification error:", e.message);
  }
}

// ── Email daily reports ──────────────────────────────────────────────────────────────────────
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
    <div style="font-size:18px;font-weight:900;color:#fff;">\ud83d\udcca Daily Report \u2014 ${todayIST}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">${acad.name}</div>
  </div>
  <div style="padding:24px 28px;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
      ${[["Collected",fmt(s.total_collected)],["Expenses",fmt(s.total_expenses)],["Net Cash",fmt(s.net_cash_flow)],["Payments",s.payments_count],["New Students",s.new_students],["Present/Total",`${s.present_count}/${s.total_attendance}`]]
        .map(([l,v])=>`<div style="border:1px solid #eee;border-radius:8px;padding:10px;text-align:center;"><div style="font-size:16px;font-weight:900;color:#6366f1;">${v}</div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-top:3px;">${l}</div></div>`).join("")}
    </div>
    <div style="margin-top:16px;padding:10px 14px;background:#f5f5ff;border-radius:8px;font-size:11px;color:#555;">Log in at your academy dashboard to download the full Excel report.</div>
  </div>
  <div style="background:#1a1f35;padding:12px 28px;text-align:center;font-size:10px;color:rgba(255,255,255,0.4);">Exponent Platform \u00b7 exponentgrow.in \u00b7 ${todayIST}</div>
</div></body></html>`;
        await resend.emails.send({
          from:    "Exponent Reports <noreply@exponentgrow.in>",
          to:      acad.email,
          subject: `\ud83d\udcca Daily Report ${todayIST} \u2014 ${acad.name}`,
          html,
        });
        console.log(`[daily-report] Sent to ${acad.email} (${acad.name})`);
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        console.error(`[daily-report] Failed for ${acad.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error("[daily-report] Nightly email error:", e.message);
  }
}

// ── Nightly database backup ───────────────────────────────────────────────────
async function runNightlyBackup(dateStr) {
  if (!process.env.RESEND_API_KEY) { console.warn("[backup] Skipped — RESEND_API_KEY not set"); return; }
  const backupEmail = process.env.BACKUP_EMAIL || "kartik@exponent.app";
  console.log(`[backup] Starting nightly backup for ${dateStr}...`);
  try {
    const tables = ["academies","branches","users","batches","students","fee_records","payments","expenses","admission_enquiries","platform_admins","platform_revenue"];
    const backup = { exported_at: new Date().toISOString(), date: dateStr, tables: {} };
    const summary = [];
    for (const table of tables) {
      try {
        const { rows } = await db.query(`SELECT * FROM ${table} ORDER BY id`);
        backup.tables[table] = rows;
        summary.push(`${table}: ${rows.length} rows`);
      } catch (e) {
        backup.tables[table] = [];
        summary.push(`${table}: skipped (${e.message})`);
      }
    }
    const jsonBuffer = Buffer.from(JSON.stringify(backup, null, 2), "utf-8");
    const totalRows  = Object.values(backup.tables).reduce((acc, t) => acc + t.length, 0);
    const sizeKB     = (jsonBuffer.length / 1024).toFixed(1);
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Exponent Backup <noreply@exponentgrow.in>",
      to:   backupEmail,
      subject: `\ud83d\uddc4\ufe0f DB Backup ${dateStr} \u2014 ${totalRows} rows`,
      html: `<p>Backup attached: <strong>${totalRows} rows</strong>, <strong>${sizeKB} KB</strong></p><ul>${summary.map(s=>`<li>${s}</li>`).join("")}</ul>`,
      attachments: [{ filename: `backup-${dateStr}.json`, content: jsonBuffer.toString("base64") }],
    });
    console.log(`[backup] \u2705 Emailed to ${backupEmail} \u2014 ${totalRows} rows, ${sizeKB} KB`);
  } catch (e) {
    console.error("[backup] Failed:", e.message);
  }
}

let lastBackupDate = "";

// ── Main nightly job ───────────────────────────────────────────────────────────────────────────
async function runNightlyJob() {
  const now      = new Date();
  const istMs    = now.getTime() + (5.5 * 60 * 60 * 1000);
  const istDate  = new Date(istMs);
  const todayIST = istDate.toISOString().split("T")[0];
  if (lastFiredDate === todayIST) return;
  lastFiredDate = todayIST;
  const [y, m] = todayIST.split("-").map(Number);
  console.log(`\n[Cron] \u23f0 Nightly job starting for ${todayIST}`);
  const runTask = async (name, fn) => {
    try { console.log(`[Cron] [${name}] Starting...`); await fn(); console.log(`[Cron] [${name}] Done.`); }
    catch (err) { console.error(`[Cron] [${name}] ERROR:`, err.message); }
  };
  await runTask("PurgeStaleTokens",    () => purgeStaleTokens());
  await runTask("AbsentNotifications", () => sendAbsentNotifications(todayIST));
  await runTask("AttendanceGen",       () => autoGenerateAttendance(m, y));
  await runTask("TrialEnforcement",    () => enforceTrialExpiry());
  await runTask("BackfillIDs",         () => backfillStudentAcademyIds());
  await runTask("DailyReports",        () => emailDailyReports(todayIST));
  console.log(`[Cron] \u2705 Nightly job complete for ${todayIST}`);
}

// ── Start schedulers ──────────────────────────────────────────────────────────
function startAbsentCron() {
  console.log("\u2705 Nightly cron started \u2014 fires at 10:00 PM IST");
  console.log("\u2705 Backup cron started  \u2014 fires at 02:00 AM IST");
  setInterval(() => {
    const now      = new Date();
    const istDate  = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const istHour  = istDate.getUTCHours();
    const istMin   = istDate.getUTCMinutes();
    const todayIST = istDate.toISOString().split("T")[0];
    if (istHour === 22 && istMin === 0) runNightlyJob();
    if (istHour === 2  && istMin === 0 && lastBackupDate !== todayIST) {
      lastBackupDate = todayIST;
      runNightlyBackup(todayIST);
    }
  }, 60 * 1000);
}

module.exports = { startAbsentCron, runNightlyJob, runNightlyBackup, startKeepAlive, backfillStudentAcademyIds, sendAbsentNotifications };
