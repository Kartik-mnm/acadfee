// ── Daily Activity Report ────────────────────────────────────────────────────
const express    = require("express");
const router     = express.Router();
const ExcelJS    = require("exceljs");
const db         = require("../db");
const { auth }   = require("../middleware");
const { Resend } = require("resend");

// ── Fetch all activity for an academy on a given date ──────────────────────────
async function fetchDayData(academyId, date) {
  // FIX: use the exact date string passed in — no timezone conversion
  // The frontend always sends YYYY-MM-DD (e.g. "2026-03-20") and we match it exactly
  const d = date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [academy, payments, newStudents, attendance, expenses, feeDue] = await Promise.all([
    db.query(`SELECT name, email, phone FROM academies WHERE id=$1`, [academyId]),

    // Payments: match on the date part only, cast to IST date
    db.query(`
      SELECT p.receipt_no, p.amount, p.payment_mode, p.paid_on,
             s.name AS student_name, s.phone AS student_phone,
             br.name AS branch_name, b.name AS batch_name,
             fr.period_label
      FROM payments p
      JOIN students s  ON s.id  = p.student_id
      JOIN branches br ON br.id = p.branch_id
      LEFT JOIN batches b  ON b.id  = s.batch_id
      LEFT JOIN fee_records fr ON fr.id = p.fee_record_id
      WHERE s.academy_id = $1
        AND (p.paid_on::date = $2::date
             OR DATE(p.created_at AT TIME ZONE 'Asia/Kolkata') = $2::date)
      ORDER BY p.created_at DESC
    `, [academyId, d]),

    // New students: match created date in IST
    db.query(`
      SELECT s.name, s.phone, s.parent_phone, s.email,
             br.name AS branch_name, b.name AS batch_name,
             s.admission_date, s.created_at
      FROM students s
      JOIN branches br ON br.id = s.branch_id
      LEFT JOIN batches b ON b.id = s.batch_id
      WHERE s.academy_id = $1
        AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') = $2::date
      ORDER BY s.created_at DESC
    `, [academyId, d]),

    // Attendance
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'present') AS present_count,
        COUNT(*) FILTER (WHERE status = 'absent')  AS absent_count,
        COUNT(*) FILTER (WHERE status = 'late')    AS late_count,
        COUNT(*) AS total_count
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE s.academy_id = $1 AND a.date = $2::date
    `, [academyId, d]),

    // Expenses
    db.query(`
      SELECT e.description, e.amount, e.category,
             br.name AS branch_name, e.created_at
      FROM expenses e
      JOIN branches br ON br.id = e.branch_id
      WHERE br.academy_id = $1
        AND DATE(e.created_at AT TIME ZONE 'Asia/Kolkata') = $2::date
      ORDER BY e.created_at DESC
    `, [academyId, d]),

    // Fee records created today
    db.query(`
      SELECT fr.period_label, fr.amount_due, fr.status,
             s.name AS student_name, br.name AS branch_name
      FROM fee_records fr
      JOIN students s  ON s.id  = fr.student_id
      JOIN branches br ON br.id = fr.branch_id
      WHERE s.academy_id = $1
        AND DATE(fr.created_at AT TIME ZONE 'Asia/Kolkata') = $2::date
      ORDER BY fr.created_at DESC
    `, [academyId, d]),
  ]);

  const totalCollected = payments.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const totalExpenses  = expenses.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const att            = attendance.rows[0] || {};

  return {
    date: d,
    academy: academy.rows[0] || {},
    summary: {
      total_collected:     totalCollected,
      total_expenses:      totalExpenses,
      net_cash_flow:       totalCollected - totalExpenses,
      payments_count:      payments.rows.length,
      new_students:        newStudents.rows.length,
      present_count:       parseInt(att.present_count  || 0),
      absent_count:        parseInt(att.absent_count   || 0),
      late_count:          parseInt(att.late_count     || 0),
      total_attendance:    parseInt(att.total_count    || 0),
      fee_records_created: feeDue.rows.length,
    },
    payments:     payments.rows,
    new_students: newStudents.rows,
    expenses:     expenses.rows,
    fee_records:  feeDue.rows,
  };
}

// ── GET /api/daily-report/data ────────────────────────────────────────────────
router.get("/data", auth, async (req, res) => {
  try {
    const data = await fetchDayData(req.academyId, req.query.date);
    res.json(data);
  } catch (e) {
    console.error("Daily report data error:", e.message);
    res.status(500).json({ error: "Failed to fetch daily report" });
  }
});

// ── GET /api/daily-report/excel ───────────────────────────────────────────────
router.get("/excel", auth, async (req, res) => {
  try {
    const data = await fetchDayData(req.academyId, req.query.date);
    const wb   = new ExcelJS.Workbook();
    wb.creator = "Exponent Platform";
    wb.created = new Date();

    const ACCENT  = "FF6366F1";
    const HEADER  = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    const HFONT   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    const ALTROW  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5FF" } };
    const BORDER  = { style: "thin", color: { argb: "FFDDDDDD" } };
    const allBorders = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    const academyName = data.academy.name || "Academy";
    const dateLabel   = data.date;

    const addSheet = (name, columns, rows) => {
      const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
      ws.mergeCells(1, 1, 1, columns.length);
      const titleCell = ws.getCell("A1");
      titleCell.value = `${academyName} — ${name} — ${dateLabel}`;
      titleCell.font  = { bold: true, size: 13, color: { argb: ACCENT } };
      titleCell.alignment = { horizontal: "center" };
      ws.mergeCells(2, 1, 2, columns.length);
      ws.getCell("A2").value = `Generated by Exponent Platform on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`;
      ws.getCell("A2").font  = { size: 9, italic: true, color: { argb: "FF888888" } };
      ws.getCell("A2").alignment = { horizontal: "center" };
      const headerRow = ws.addRow(columns.map(c => c.header));
      headerRow.eachCell(cell => { cell.fill = HEADER; cell.font = HFONT; cell.alignment = { horizontal: "center" }; cell.border = allBorders; });
      rows.forEach((row, i) => {
        const r = ws.addRow(columns.map(c => row[c.key] ?? ""));
        if (i % 2 === 1) r.eachCell(cell => { cell.fill = ALTROW; });
        r.eachCell(cell => { cell.border = allBorders; });
        columns.forEach((c, ci) => {
          if (c.format === "money") r.getCell(ci + 1).numFmt = "\u20b9#,##0.00";
          if (c.format === "date")  r.getCell(ci + 1).numFmt = "DD-MM-YYYY";
        });
      });
      columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 18; });
      return ws;
    };

    // Sheet 1: Summary
    const summaryWs = wb.addWorksheet("Summary");
    summaryWs.mergeCells("A1:B1");
    summaryWs.getCell("A1").value = `${academyName} — Daily Report — ${dateLabel}`;
    summaryWs.getCell("A1").font  = { bold: true, size: 14, color: { argb: ACCENT } };
    summaryWs.getCell("A1").alignment = { horizontal: "center" };
    const s = data.summary;
    const summaryData = [
      ["Total Collected",   `\u20b9${s.total_collected.toLocaleString("en-IN")}`],
      ["Total Expenses",    `\u20b9${s.total_expenses.toLocaleString("en-IN")}`],
      ["Net Cash Flow",     `\u20b9${s.net_cash_flow.toLocaleString("en-IN")}`],
      ["Payments Count",    s.payments_count],
      ["New Students",      s.new_students],
      ["Present Today",     s.present_count],
      ["Absent Today",      s.absent_count],
      ["Late Today",        s.late_count],
      ["Fee Records Created",s.fee_records_created],
    ];
    summaryData.forEach(([label, val], i) => {
      const row = summaryWs.addRow([label, val]);
      row.getCell(1).font = { bold: true };
      if (i % 2 === 1) row.eachCell(c => { c.fill = ALTROW; });
      row.eachCell(c => { c.border = allBorders; });
    });
    summaryWs.getColumn(1).width = 28;
    summaryWs.getColumn(2).width = 20;

    addSheet("Payments", [
      { header: "Receipt No",    key: "receipt_no",     width: 22 },
      { header: "Student Name",  key: "student_name",   width: 22 },
      { header: "Phone",         key: "student_phone",  width: 14 },
      { header: "Branch",        key: "branch_name",    width: 20 },
      { header: "Batch",         key: "batch_name",     width: 18 },
      { header: "Period",        key: "period_label",   width: 16 },
      { header: "Amount (\u20b9)",    key: "amount",         width: 14, format: "money" },
      { header: "Mode",          key: "payment_mode",   width: 14 },
      { header: "Date",          key: "paid_on",        width: 14, format: "date" },
    ], data.payments);

    addSheet("New Students", [
      { header: "Name",          key: "name",           width: 22 },
      { header: "Phone",         key: "phone",          width: 14 },
      { header: "Parent Phone",  key: "parent_phone",   width: 14 },
      { header: "Email",         key: "email",          width: 24 },
      { header: "Branch",        key: "branch_name",    width: 20 },
      { header: "Batch",         key: "batch_name",     width: 18 },
      { header: "Admission Date",key: "admission_date", width: 16, format: "date" },
    ], data.new_students);

    addSheet("Expenses", [
      { header: "Description",   key: "description",   width: 28 },
      { header: "Category",      key: "category",      width: 16 },
      { header: "Branch",        key: "branch_name",   width: 20 },
      { header: "Amount (\u20b9)",    key: "amount",        width: 14, format: "money" },
    ], data.expenses);

    addSheet("Fee Records", [
      { header: "Student",       key: "student_name",  width: 22 },
      { header: "Branch",        key: "branch_name",   width: 20 },
      { header: "Period",        key: "period_label",  width: 16 },
      { header: "Amount Due (\u20b9)",key: "amount_due",    width: 16, format: "money" },
      { header: "Status",        key: "status",        width: 12 },
    ], data.fee_records);

    const filename = `daily-report-${academyName.replace(/\s+/g, "-")}-${dateLabel}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("Daily report Excel error:", e.message);
    res.status(500).json({ error: "Failed to generate Excel report" });
  }
});

// ── GET /api/daily-report/print ───────────────────────────────────────────────
router.get("/print", auth, async (req, res) => {
  try {
    const data    = await fetchDayData(req.academyId, req.query.date);
    const s       = data.summary;
    const academy = data.academy.name || "Academy";
    const date    = data.date;
    const row  = (cells) => `<tr>${cells.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`;
    const thead = (cols)  => `<thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>`;
    const fmt   = (n)     => `\u20b9${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${academy} — Daily Report — ${date}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;background:#fff;color:#111;font-size:12px;padding:20px}
  h1{font-size:20px;color:#6366f1;margin-bottom:4px}
  .sub{font-size:11px;color:#888;margin-bottom:20px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .card{border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center}
  .card .val{font-size:20px;font-weight:900;color:#6366f1}
  .card .lbl{font-size:10px;color:#888;margin-top:4px;text-transform:uppercase}
  h2{font-size:14px;font-weight:700;margin:20px 0 8px;color:#333;border-bottom:2px solid #6366f1;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}
  th{background:#6366f1;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even) td{background:#f5f5ff}
  .no-data{color:#aaa;font-style:italic;font-size:11px;margin-bottom:12px}
  .footer{margin-top:24px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}
  @media print{body{padding:0}.no-print{display:none}h2{page-break-after:avoid}}
</style></head><body>
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()" style="padding:8px 20px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700">🖸 Save as PDF / Print</button>
</div>
<h1>${academy} — Daily Activity Report</h1>
<div class="sub">Date: ${date} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</div>
<div class="summary">
  <div class="card"><div class="val">${fmt(s.total_collected)}</div><div class="lbl">Collected</div></div>
  <div class="card"><div class="val">${fmt(s.total_expenses)}</div><div class="lbl">Expenses</div></div>
  <div class="card"><div class="val">${fmt(s.net_cash_flow)}</div><div class="lbl">Net Cash</div></div>
  <div class="card"><div class="val">${s.payments_count}</div><div class="lbl">Payments</div></div>
  <div class="card"><div class="val">${s.new_students}</div><div class="lbl">New Students</div></div>
  <div class="card"><div class="val">${s.present_count}/${s.total_attendance}</div><div class="lbl">Present / Total</div></div>
</div>
<h2>💰 Payments (${data.payments.length})</h2>
${data.payments.length === 0 ? '<div class="no-data">No payments today.</div>' : `
<table>${thead(["Receipt","Student","Branch","Period","Amount","Mode"])}<tbody>
${data.payments.map(p => row([p.receipt_no, p.student_name, p.branch_name, p.period_label||"—", fmt(p.amount), p.payment_mode])).join("")}
</tbody></table>`}
<h2>🎓 New Students (${data.new_students.length})</h2>
${data.new_students.length === 0 ? '<div class="no-data">No new students today.</div>' : `
<table>${thead(["Name","Phone","Parent Phone","Branch","Batch"])}<tbody>
${data.new_students.map(s => row([s.name, s.phone, s.parent_phone||"—", s.branch_name, s.batch_name||"—"])).join("")}
</tbody></table>`}
<h2>💸 Expenses (${data.expenses.length})</h2>
${data.expenses.length === 0 ? '<div class="no-data">No expenses today.</div>' : `
<table>${thead(["Description","Category","Branch","Amount"])}<tbody>
${data.expenses.map(e => row([e.description, e.category||"—", e.branch_name, fmt(e.amount)])).join("")}
</tbody></table>`}
<h2>📝 Fee Records Created (${data.fee_records.length})</h2>
${data.fee_records.length === 0 ? '<div class="no-data">No fee records created today.</div>' : `
<table>${thead(["Student","Branch","Period","Amount Due","Status"])}<tbody>
${data.fee_records.map(f => row([f.student_name, f.branch_name, f.period_label||"—", fmt(f.amount_due), f.status])).join("")}
</tbody></table>`}
<div class="footer">Exponent Platform · Daily Report · ${academy} · ${date}</div>
</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    console.error("Daily report print error:", e.message);
    res.status(500).json({ error: "Failed to generate print report" });
  }
});

// ── POST /api/daily-report/email ───────────────────────────────────────────────
router.post("/email", auth, async (req, res) => {
  try {
    const data       = await fetchDayData(req.academyId, req.query.date);
    const s          = data.summary;
    const academy    = data.academy.name || "Academy";
    const adminEmail = data.academy.email || req.user?.email;
    if (!adminEmail) return res.status(400).json({ error: "No email address found for this academy." });
    if (!process.env.RESEND_API_KEY) return res.status(400).json({ error: "Email not configured." });
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fmt  = (n) => `\u20b9${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    const trow = (cells) => `<tr>${cells.map((c, i) => `<td style="padding:6px 10px;border-bottom:1px solid #eee;${i===0?"font-weight:600":""};">${c ?? ""}</td>`).join("")}</tr>`;
    const section = (title, count, table) => `
      <div style="margin-bottom:24px;">
        <div style="font-size:14px;font-weight:800;color:#1a1f35;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #6366f1;">${title} (${count})</div>
        ${count === 0 ? '<div style="font-size:12px;color:#aaa;font-style:italic;">No activity today.</div>' : `<table style="width:100%;border-collapse:collapse;font-size:12px;">${table}</table>`}
      </div>`;
    const paymentsTable = `
      <tr style="background:#6366f1;color:#fff;">
        <th style="padding:6px 10px;text-align:left;">Receipt</th>
        <th style="padding:6px 10px;text-align:left;">Student</th>
        <th style="padding:6px 10px;text-align:left;">Branch</th>
        <th style="padding:6px 10px;text-align:left;">Period</th>
        <th style="padding:6px 10px;text-align:right;">Amount</th>
        <th style="padding:6px 10px;text-align:left;">Mode</th>
      </tr>
      ${data.payments.map(p => trow([p.receipt_no, p.student_name, p.branch_name, p.period_label||"—", fmt(p.amount), p.payment_mode])).join("")}`;
    const studentsTable = `
      <tr style="background:#6366f1;color:#fff;">
        <th style="padding:6px 10px;text-align:left;">Name</th>
        <th style="padding:6px 10px;text-align:left;">Phone</th>
        <th style="padding:6px 10px;text-align:left;">Branch</th>
        <th style="padding:6px 10px;text-align:left;">Batch</th>
      </tr>
      ${data.new_students.map(st => trow([st.name, st.phone, st.branch_name, st.batch_name||"—"])).join("")}`;
    const expensesTable = `
      <tr style="background:#6366f1;color:#fff;">
        <th style="padding:6px 10px;text-align:left;">Description</th>
        <th style="padding:6px 10px;text-align:left;">Category</th>
        <th style="padding:6px 10px;text-align:right;">Amount</th>
      </tr>
      ${data.expenses.map(e => trow([e.description, e.category||"—", fmt(e.amount)])).join("")}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#1a1f35,#2d3561);padding:28px 32px;">
    <div style="font-size:20px;font-weight:900;color:#fff;">📊 Daily Report — ${data.date}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">${academy}</div>
  </div>
  <div style="padding:24px 32px;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
      ${[["Collected",fmt(s.total_collected)],["Expenses",fmt(s.total_expenses)],["Net Cash",fmt(s.net_cash_flow)],["Payments",s.payments_count],["New Students",s.new_students],["Present/Total",`${s.present_count}/${s.total_attendance}`]]
        .map(([l,v])=>`<div style="border:1px solid #eee;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:18px;font-weight:900;color:#6366f1;">${v}</div><div style="font-size:10px;color:#888;text-transform:uppercase;margin-top:4px;">${l}</div></div>`).join("")}
    </div>
    ${section("💰 Payments", data.payments.length, paymentsTable)}
    ${section("🎓 New Students", data.new_students.length, studentsTable)}
    ${section("💸 Expenses", data.expenses.length, expensesTable)}
    <div style="margin-top:20px;padding:12px 16px;background:#f5f5ff;border-radius:8px;font-size:12px;color:#555;">
      Log in to your dashboard to download the full Excel report.
    </div>
  </div>
  <div style="background:#1a1f35;padding:14px 32px;text-align:center;font-size:11px;color:rgba(255,255,255,0.5);">Exponent Platform · Daily Report · ${data.date}</div>
</div></body></html>`;
    await resend.emails.send({
      from:    "Exponent Reports <onboarding@resend.dev>",
      to:      adminEmail,
      subject: `Daily Report ${data.date} — ${academy}`,
      html,
    });
    res.json({ message: `Report emailed to ${adminEmail}` });
  } catch (e) {
    console.error("Daily report email error:", e.message);
    res.status(500).json({ error: "Failed to send report email" });
  }
});

module.exports = { router, fetchDayData };
