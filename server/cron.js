// ── Nightly cron + Keep-alive ping ─────────────────────────────────────────────────────
const db                         = require("./db");
const { sendNotification }       = require("./fcm");
const { generateMonthForBranch } = require("./routes/attendance");
const { fetchDayData }           = require("./routes/daily-report");
const { Resend }                 = require("resend");

let lastFiredDate = "";

// ── Keep-alive ────────────────────────────────────────────────────────────────────────
function startKeepAlive() {
  const targets = [
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
  console.log("\u2705 Keep-alive started \u2014 pinging every 10 min");
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
// Students who have logged out (no active refresh token) should not receive FCM notifications.
// This runs before absent notifications so we don't push to phantom devices.
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
    // A student is considered ABSENT if they have NO completed scan today.
    // A completed scan = a qr_scans row with exit_time IS NOT NULL.
    // Students who only scanned entry (no exit) are still absent — they didn't
    // complete their attendance, so their attendance count was NOT incremented.
    // BUG FIX: previous version dropped the exit_time IS NOT NULL check, meaning
    // students who only tapped entry would be excluded from absent notifications
    // but also have NO attendance credit — the worst of both worlds.
    const { rows: absentStudents } = await db.query(
      `SELECT s.id, s.name, s.branch_id, s.fcm_token, s.parent_fcm_token,
              br.name AS branch_name, a.name AS academy_name
       FROM students s
       JOIN branches br ON br.id = s.branch_id
       LEFT JOIN academies a ON a.id = COALESCE(s.academy_id, br.academy_id)
       WHERE s.status = 'active'
         AND (s.parent_fcm_token IS NOT NULL OR s.fcm_token IS NOT NULL)
         AND s.id NOT IN (
           SELECT student_id FROM qr_scans
           WHERE scan_date = $1
             AND exit_time IS NOT NULL
         )`,
      [todayIST]
    );

    // Filter out students whose branch is a holiday today
    const notifyList = [];
    for (const s of absentStudents) {
      const { rows: wd } = await db.query(
        `SELECT is_working FROM working_days WHERE branch_id=$1 AND date=$2`,
        [s.branch_id, todayIST]
      );
      const isHoliday = wd.length > 0 && !wd[0].is_working;
      if (!isHoliday) notifyList.push(s);
    }

    console.log(`[Cron] ${notifyList.length} absent student(s) to notify on ${todayIST}`);

    for (const student of notifyList) {
      const academyName = student.academy_name || "your academy";
      const dateLabel   = new Date(todayIST).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", timeZone: "Asia/Kolkata"
      });

      if (student.fcm_token) {
        await sendNotification(
          student.fcm_token,
          `\u26a0\ufe0f You were absent today`,
          `You did not attend ${academyName} on ${dateLabel}. Please contact your admin if this is a mistake.`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
      }
      if (student.parent_fcm_token) {
        await sendNotification(
          student.parent_fcm_token,
          `\u26a0\ufe0f ${student.name} was absent today`,
          `${student.name} did not attend ${academyName} on ${dateLabel}.`,
          { type: "absent_alert", student_id: String(student.id), date: todayIST }
        );
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
    ${data.payments.length > 0 ? `<div style="margin-bottom:16px;"><div style="font-size:12px;font-weight:700;color:#333;margin-bottom:6px;border-bottom:2px solid #6366f1;padding-bottom:4px;">\ud83d\udcb0 Payments (${data.payments.length})</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#6366f1;color:#fff;"><th style="padding:5px 8px;text-align:left;">Student</th><th style="padding:5px 8px;text-align:left;">Branch</th><th style="padding:5px 8px;text-align:right;">Amount</th><th style="padding:5px 8px;text-align:left;">Mode</th></tr>${data.payments.map((p,i)=>`<tr style="${i%2===1?"background:#f5f5ff":""}"><td style="padding:5px 8px;border-bottom:1px solid #eee;">${p.student_name}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;">${p.branch_name}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#6366f1;">${fmt(p.amount)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;">${p.payment_mode}</td></tr>`).join("")}</table></div>` : ""}
    ${data.new_students.length > 0 ? `<div style="font-size:12px;margin-bottom:12px;"><span style="font-weight:700;">\ud83c\udf93 New students:</span> ${data.new_students.map(st=>st.name).join(", ")}</div>` : ""}
    <div style="margin-top:16px;padding:10px 14px;background:#f5f5ff;border-radius:8px;font-size:11px;color:#555;">Log in at <a href="https://app.exponentgrow.in" style="color:#6366f1;">app.exponentgrow.in</a> to download the full Excel report.</div>
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
      } catch (e) {
        console.error(`[daily-report] Failed for ${acad.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error("[daily-report] Nightly email error:", e.message);
  }
}

// ── Nightly database backup ───────────────────────────────────────────────────
// Exports all critical tables as a JSON file and emails it to BACKUP_EMAIL.
// Runs at 2:00 AM IST — safely after the 10 PM nightly job completes.
// Requires RESEND_API_KEY and BACKUP_EMAIL environment variables.
async function runNightlyBackup(dateStr) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[backup] Skipped — RESEND_API_KEY not set");
    return;
  }
  const backupEmail = process.env.BACKUP_EMAIL || "kartik@exponent.app";
  console.log(`[backup] Starting nightly backup for ${dateStr}...`);

  try {
    // Tables to back up — in dependency order
    const tables = [
      "academies",
      "branches",
      "users",
      "batches",
      "students",
      "fee_records",
      "payments",
      "expenses",
      "admission_enquiries",
      "platform_admins",
      "platform_revenue",
    ];

    const backup = { exported_at: new Date().toISOString(), date: dateStr, tables: {} };
    const summary = [];

    for (const table of tables) {
      try {
        const { rows } = await db.query(`SELECT * FROM ${table} ORDER BY id`);
        backup.tables[table] = rows;
        summary.push(`${table}: ${rows.length} rows`);
      } catch (e) {
        // Table might not exist yet — skip silently
        backup.tables[table] = [];
        summary.push(`${table}: skipped (${e.message})`);
      }
    }

    const jsonStr    = JSON.stringify(backup, null, 2);
    const jsonBuffer = Buffer.from(jsonStr, "utf-8");
    const totalRows  = Object.values(backup.tables).reduce((acc, t) => acc + t.length, 0);
    const sizeKB     = (jsonBuffer.length / 1024).toFixed(1);

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Exponent Backup <noreply@exponentgrow.in>",
      to:   backupEmail,
      subject: `🗄️ DB Backup ${dateStr} — ${totalRows} rows, ${sizeKB} KB`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#1a1f35,#2d3561);padding:20px 24px;border-radius:10px 10px 0 0;">
            <div style="font-size:18px;font-weight:900;color:#fff;">🗄️ Nightly Database Backup</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">${dateStr} — Exponent Platform</div>
          </div>
          <div style="padding:20px 24px;border:1px solid #eee;border-top:none;border-radius:0 0 10px 10px;">
            <p style="margin:0 0 12px;color:#333;">
              Your automated backup is attached as <strong>backup-${dateStr}.json</strong>.
              To restore, contact your developer with this file.
            </p>
            <div style="background:#f5f5ff;border-radius:8px;padding:12px 16px;font-size:12px;color:#444;margin-bottom:16px;">
              <strong>Summary:</strong><br/>
              ${summary.map(s => `• ${s}`).join("<br/>")}
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 16px;font-size:12px;color:#166534;">
              ✅ Total: <strong>${totalRows} rows</strong> exported &nbsp;|&nbsp; File size: <strong>${sizeKB} KB</strong>
            </div>
          </div>
        </div>`,
      attachments: [{
        filename: `backup-${dateStr}.json`,
        content:  jsonBuffer.toString("base64"),
      }],
    });

    console.log(`[backup] ✅ Backup emailed to ${backupEmail} — ${totalRows} rows, ${sizeKB} KB`);
  } catch (e) {
    console.error("[backup] Failed:", e.message);
  }
}

let lastBackupDate = "";

// ── Main nightly job ───────────────────────────────────────────────────────────────────────────
async function runNightlyJob() {
  // Calculate IST date using UTC+5:30 arithmetic — reliable across all Node/V8 versions
  const now      = new Date();
  const istMs    = now.getTime() + (5.5 * 60 * 60 * 1000);
  const istDate  = new Date(istMs);
  const todayIST = istDate.toISOString().split("T")[0]; // YYYY-MM-DD in IST

  if (lastFiredDate === todayIST) {
    console.log(`[Cron] Already ran for ${todayIST}, skipping.`);
    return;
  }
  lastFiredDate = todayIST;

  const [y, m] = todayIST.split("-").map(Number);
  console.log(`\n[Cron] ⏰ Nightly job starting for ${todayIST}`);

  await purgeStaleTokens();               // 1. Clear FCM tokens for logged-out students
  await sendAbsentNotifications(todayIST); // 2. Push absent alerts
  await autoGenerateAttendance(m, y);     // 3. Generate/update monthly attendance records
  await enforceTrialExpiry();             // 4. Suspend expired trials
  await backfillStudentAcademyIds();      // 5. Fix any missing academy_id values
  await emailDailyReports(todayIST);      // 6. Email daily summaries to academy owners

  console.log(`[Cron] ✅ Nightly job complete for ${todayIST}`);
}

// ── Start schedulers ──────────────────────────────────────────────────────────
function startAbsentCron() {
  console.log("✅ Nightly cron started — fires at 10:00 PM IST");
  console.log("✅ Backup cron started  — fires at 02:00 AM IST");
  setInterval(() => {
    const now     = new Date();
    const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const istHour = istDate.getUTCHours();
    const istMin  = istDate.getUTCMinutes();
    const todayIST = istDate.toISOString().split("T")[0];

    // Nightly job — 10:00 PM IST
    if (istHour === 22 && istMin === 0) runNightlyJob();

    // Backup — 2:00 AM IST (runs once per day)
    if (istHour === 2 && istMin === 0 && lastBackupDate !== todayIST) {
      lastBackupDate = todayIST;
      runNightlyBackup(todayIST);
    }
  }, 60 * 1000);
}

module.exports = { startAbsentCron, runNightlyJob, runNightlyBackup, startKeepAlive, backfillStudentAcademyIds };
