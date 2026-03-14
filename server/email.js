const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

function numberToWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + numberToWords(n%100) : "");
  if (n < 100000) return numberToWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + numberToWords(n%1000) : "");
  return numberToWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + numberToWords(n%100000) : "");
}

async function sendReceiptEmail(payment) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set, skipping email");
    return { skipped: true };
  }

  const studentEmail = payment.email;
  if (!studentEmail) {
    console.log("No student email, skipping");
    return { skipped: true };
  }

  const balance = (payment.amount_due || 0) - (payment.amount_paid || 0);
  const amountWords = numberToWords(Math.round(payment.amount || 0)) + " Rupees Only";
  const paidDate = new Date(payment.paid_on).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const dueDate = payment.due_date ? new Date(payment.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fee Receipt - Nishchay Academy</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1f35,#2d3561);padding:28px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:900;color:#f0d060;letter-spacing:.05em;">NISHCHAY ACADEMY</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">${payment.branch_name || ""}</div>
      <div style="background:rgba(255,255,255,0.15);border-radius:6px;padding:6px 20px;display:inline-block;margin-top:12px;">
        <div style="font-size:14px;font-weight:800;color:#fff;letter-spacing:.08em;">FEE RECEIPT</div>
      </div>
    </div>

    <!-- Receipt Info -->
    <div style="padding:24px 32px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #eee;">
        <div>
          <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;">Receipt No.</div>
          <div style="font-size:15px;font-weight:800;color:#2d3561;font-family:monospace;">${payment.receipt_no}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;">Date</div>
          <div style="font-size:14px;font-weight:700;">${paidDate}</div>
        </div>
      </div>

      <!-- Student Details -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${[
          ["Student Name", payment.student_name],
          ["Batch / Course", payment.batch_name || "—"],
          ["Branch", payment.branch_name || "—"],
          ["Period", payment.period_label || "—"],
          ["Due Date", dueDate],
          ["Payment Mode", (payment.payment_mode || "").toUpperCase()],
          payment.transaction_ref ? ["Txn / Ref No.", payment.transaction_ref] : null,
        ].filter(Boolean).map(([l, v]) => `
          <tr>
            <td style="padding:6px 0;font-size:12px;color:#888;font-weight:600;width:130px;">${l}</td>
            <td style="padding:6px 0;font-size:13px;font-weight:700;color:#333;">${v}</td>
          </tr>
        `).join("")}
      </table>

      <!-- Fee Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-radius:8px;overflow:hidden;border:1px solid #e8e8e8;">
        <thead>
          <tr style="background:#f5f7ff;">
            <th style="padding:10px 14px;font-size:12px;font-weight:700;text-align:left;color:#555;">Fee Details</th>
            <th style="padding:10px 14px;font-size:12px;font-weight:700;text-align:right;color:#555;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 14px;font-size:13px;border-top:1px solid #eee;">${payment.period_label || "Tuition Fee"}</td>
            <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;border-top:1px solid #eee;">₹${Number(payment.amount_due || 0).toLocaleString("en-IN")}</td>
          </tr>
        </tbody>
      </table>

      <!-- Summary -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr style="background:#f9f9f9;">
          <td style="padding:8px 14px;font-size:13px;font-weight:700;border:1px solid #eee;">Total Fee</td>
          <td style="padding:8px 14px;font-size:13px;font-weight:700;text-align:right;border:1px solid #eee;">₹${Number(payment.amount_due || 0).toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-size:13px;font-weight:700;border:1px solid #eee;color:#059669;">Paid Fee</td>
          <td style="padding:8px 14px;font-size:13px;font-weight:700;text-align:right;border:1px solid #eee;color:#059669;">₹${Number(payment.amount || 0).toLocaleString("en-IN")}</td>
        </tr>
        <tr style="background:${balance > 0 ? "#fff8f8" : "#f0fff8"};">
          <td style="padding:8px 14px;font-size:13px;font-weight:800;border:1px solid #eee;color:${balance > 0 ? "#dc2626" : "#059669"};">Balance Fee</td>
          <td style="padding:8px 14px;font-size:13px;font-weight:800;text-align:right;border:1px solid #eee;color:${balance > 0 ? "#dc2626" : "#059669"};">₹${Number(balance).toLocaleString("en-IN")}</td>
        </tr>
      </table>

      <!-- Amount in Words -->
      <div style="background:#f5f7ff;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#555;">
        <strong>Rupees:</strong> ${amountWords}
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding-top:16px;border-top:1px solid #eee;">
        <div style="font-size:12px;color:#888;">This is a computer-generated receipt. No signature required.</div>
        <div style="font-size:12px;color:#888;margin-top:4px;">Thank you for your payment! 🙏</div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div style="background:#1a1f35;padding:16px 32px;text-align:center;">
      <div style="font-size:12px;color:rgba(255,255,255,0.5);">NISHCHAY ACADEMY · Contact: 8956419453</div>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await resend.emails.send({
      from: "Nishchay Academy <receipts@resend.dev>",
      to: studentEmail,
      subject: `Fee Receipt ${payment.receipt_no} - ${payment.period_label || "Payment Confirmation"}`,
      html,
    });
    console.log("Email sent:", result);
    return { success: true, id: result.id };
  } catch (err) {
    console.error("Email error:", err);
    return { error: err.message };
  }
}


async function sendFeeSummaryEmail({ student, fees, payments, attendance, tests }) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  if (!student.email) return { skipped: true, reason: "No email" };

  const totalDue  = fees.reduce((s, f) => s + parseFloat(f.amount_due || 0), 0);
  const totalPaid = fees.reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
  const balance   = totalDue - totalPaid;
  const pendingFees = fees.filter((f) => f.status !== "paid");
  const avgAtt = attendance.length ? Math.round(attendance.reduce((s, a) => s + parseFloat(a.percentage || 0), 0) / attendance.length) : null;
  const avgScore = tests.length ? Math.round(tests.reduce((s, t) => s + parseFloat(t.percentage || 0), 0) / tests.length) : null;
  const grade = (p) => p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
<div style="background:linear-gradient(135deg,#1a1f35,#2d3561);padding:28px 32px;text-align:center;">
  <div style="font-size:22px;font-weight:900;color:#f0d060;">NISHCHAY ACADEMY</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">${student.branch_name || ""}</div>
  <div style="background:rgba(255,255,255,0.15);border-radius:6px;padding:6px 20px;display:inline-block;margin-top:12px;">
    <div style="font-size:14px;font-weight:800;color:#fff;">FEE SUMMARY REPORT</div>
  </div>
</div>
<div style="padding:28px 32px;">
  <div style="background:#f5f7ff;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
    <div style="font-size:18px;font-weight:900;color:#1a1f35;margin-bottom:8px;">👤 ${student.name}</div>
    <div style="font-size:13px;color:#555;">Batch: <strong>${student.batch_name||"—"}</strong> &nbsp;|&nbsp; Branch: <strong>${student.branch_name||"—"}</strong> &nbsp;|&nbsp; ID: <strong>NA-${String(student.id).padStart(5,"0")}</strong></div>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:24px;">
    <div style="flex:1;background:#f0f7ff;border-radius:8px;padding:14px;text-align:center;border-top:3px solid #4f8ef7;">
      <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;">Total Due</div>
      <div style="font-size:20px;font-weight:900;color:#4f8ef7;">₹${totalDue.toLocaleString("en-IN")}</div>
    </div>
    <div style="flex:1;background:#f0fff8;border-radius:8px;padding:14px;text-align:center;border-top:3px solid #22d3a5;">
      <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;">Total Paid</div>
      <div style="font-size:20px;font-weight:900;color:#22d3a5;">₹${totalPaid.toLocaleString("en-IN")}</div>
    </div>
    <div style="flex:1;background:${balance>0?"#fff5f5":"#f0fff8"};border-radius:8px;padding:14px;text-align:center;border-top:3px solid ${balance>0?"#f75f5f":"#22d3a5"};">
      <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;">Balance</div>
      <div style="font-size:20px;font-weight:900;color:${balance>0?"#f75f5f":"#22d3a5"};">₹${balance.toLocaleString("en-IN")}</div>
    </div>
  </div>

  ${pendingFees.length > 0 ? `
  <div style="margin-bottom:20px;">
    <div style="font-size:14px;font-weight:800;margin-bottom:10px;border-bottom:2px solid #eee;padding-bottom:6px;">⚠️ Pending Fees</div>
    ${pendingFees.map(f => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
      <span style="font-weight:600;">${f.period_label}</span>
      <span style="color:#f75f5f;font-weight:700;">₹${(f.amount_due-f.amount_paid).toLocaleString("en-IN")} due by ${new Date(f.due_date).toLocaleDateString("en-IN")}</span>
    </div>`).join("")}
  </div>` : `<div style="background:#f0fff8;border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;font-weight:700;color:#22d3a5;">✅ All fees paid!</div>`}

  ${payments.length > 0 ? `
  <div style="margin-bottom:20px;">
    <div style="font-size:14px;font-weight:800;margin-bottom:10px;border-bottom:2px solid #eee;padding-bottom:6px;">💳 Recent Payments</div>
    ${payments.slice(0,5).map(p => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
      <span style="font-family:monospace;color:#4f8ef7;">${p.receipt_no}</span>
      <span>${p.period_label}</span>
      <span style="color:#22d3a5;font-weight:700;">₹${Number(p.amount_paid||p.amount).toLocaleString("en-IN")}</span>
      <span style="color:#888;">${new Date(p.payment_date||p.paid_on).toLocaleDateString("en-IN")}</span>
    </div>`).join("")}
  </div>` : ""}

  <div style="display:flex;gap:16px;margin-bottom:20px;">
    <div style="flex:1;background:#f5f7ff;border-radius:8px;padding:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:6px;">📅 Avg Attendance</div>
      ${avgAtt!==null ? `<div style="font-size:26px;font-weight:900;color:${avgAtt>=75?"#22d3a5":avgAtt>=50?"#f7c84f":"#f75f5f"};">${avgAtt}%</div>` : `<div style="color:#888;font-size:13px;">No records</div>`}
    </div>
    <div style="flex:1;background:#f5f7ff;border-radius:8px;padding:14px;">
      <div style="font-size:13px;font-weight:800;margin-bottom:6px;">📊 Avg Test Score</div>
      ${avgScore!==null ? `<div style="font-size:26px;font-weight:900;color:${avgScore>=70?"#22d3a5":avgScore>=50?"#f7c84f":"#f75f5f"};">${avgScore}% (${grade(avgScore)})</div>` : `<div style="color:#888;font-size:13px;">No tests</div>`}
    </div>
  </div>

  <div style="text-align:center;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">
    This is an automated email from Nishchay Academy · Contact: 8956419453
  </div>
</div>
<div style="background:#1a1f35;padding:14px 32px;text-align:center;">
  <div style="font-size:12px;color:rgba(255,255,255,0.5);">NISHCHAY ACADEMY</div>
</div>
</div>
</body></html>`;

  try {
    const result = await resend.emails.send({
      from: "Nishchay Academy <receipts@resend.dev>",
      to: student.email,
      subject: `Fee Summary — ${student.name} | Nishchay Academy`,
      html,
    });
    return { success: true, id: result.id };
  } catch (err) {
    console.error("Email error:", err);
    return { error: err.message };
  }
}

module.exports = { sendReceiptEmail, sendFeeSummaryEmail };
