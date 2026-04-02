import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Always use the same base URL that axios API uses — no hardcoding
const API_BASE = (() => {
  const base = process.env.REACT_APP_API_URL || "";
  if (base) return base.replace(/\/$/, "");
  // Derive from current hostname at runtime
  const host = window.location.hostname;
  if (host === "app.exponentgrow.in")   return "https://api.exponentgrow.in";
  if (host === "acadfee-app.onrender.com") return "https://acadfee.onrender.com";
  return "http://localhost:5000";
})();

// ── WhatsApp reminder ──────────────────────────────────────────────────────────
function sendWhatsApp(phone, studentName, balance, period, dueDate, branchName, academyName) {
  const cleanPhone = phone?.replace(/\D/g, "");
  if (!cleanPhone) { alert("No phone number available for this student!"); return; }
  const indiaPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const acad = academyName || "the Academy";
  const message =
    `Hello! 👋\n\nThis is a fee reminder from *${acad}* 🎓\n\n` +
    `Student: *${studentName}*\n` +
    `Period: *${period || "—"}*\n` +
    `Due Date: *${dueDate}*\n` +
    `Balance Due: *${fmt(balance)}*\n` +
    `Branch: *${branchName}*\n\n` +
    `Kindly pay the pending fees at the earliest to avoid inconvenience.\n\n` +
    `Thank you! 🙏\n— ${acad} Team`;
  window.open(`https://wa.me/${indiaPhone}?text=${encodeURIComponent(message)}`, "_blank");
}

export default function Reports() {
  const { user }    = useAuth();
  const { academy } = useAcademy();
  const academyName = academy?.name || "Academy";

  const [overdue,       setOverdue]       = useState([]);
  const [branchStats,   setBranchStats]   = useState([]);
  const [tab,           setTab]           = useState("daily");

  const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [reportDate,    setReportDate]    = useState(todayIST);
  const [reportData,    setReportData]    = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState("");
  const [emailSending,  setEmailSending]  = useState(false);
  const [emailMsg,      setEmailMsg]      = useState("");

  useEffect(() => {
    API.get("/reports/overdue").then((r) => setOverdue(r.data)).catch(() => {});
    if (user.role === "super_admin") API.get("/reports/by-branch").then((r) => setBranchStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "daily") return;
    setReportLoading(true);
    setReportData(null);
    setReportError("");
    API.get(`/daily-report/data?date=${reportDate}`)
      .then((r) => setReportData(r.data))
      .catch((e) => setReportError(e.response?.data?.error || "Failed to load report"))
      .finally(() => setReportLoading(false));
  }, [tab, reportDate]);

  // ── Download Excel ─────────────────────────────────────────────────────────
  const downloadExcel = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/daily-report/excel?date=${reportDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Failed to generate Excel. Try again."); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `daily-report-${reportDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert("Download failed. Please try again."); }
  };

  // ── Print view ─────────────────────────────────────────────────────────────
  const openPrintView = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/daily-report/print?date=${reportDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Failed to generate print view. Try again."); return; }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (!w) { alert("Popup blocked — please allow popups for this site."); return; }
      w.document.write(html);
      w.document.close();
    } catch { alert("Print view failed. Please try again."); }
  };

  const sendEmail = async () => {
    setEmailSending(true); setEmailMsg("");
    try {
      const r = await API.post(`/daily-report/email?date=${reportDate}`);
      setEmailMsg("✅ " + r.data.message);
    } catch (e) {
      setEmailMsg("❌ " + (e.response?.data?.error || "Failed to send email"));
    } finally {
      setEmailSending(false);
      setTimeout(() => setEmailMsg(""), 6000);
    }
  };

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map((r) => keys.map((k) => `"${r[k] ?? ""}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename; a.click();
  };

  const sendBulkReminders = () => {
    if (!window.confirm(`Send WhatsApp reminders to all ${overdue.length} overdue students?`)) return;
    overdue.forEach((r, i) => {
      setTimeout(() => {
        const phone   = r.parent_phone || r.phone;
        const balance = r.amount_due - r.amount_paid;
        const dueDate = new Date(r.due_date).toLocaleDateString("en-IN");
        sendWhatsApp(phone, r.student_name, balance, r.period_label, dueDate, r.branch_name, academyName);
      }, i * 1500);
    });
  };

  const s = reportData?.summary || {};

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reports & Analytics</div>
      </div>

      {/* Tabs */}
      <div className="gap-row" style={{ marginBottom: 20 }}>
        {[
          { id: "daily",      label: "📥 Daily Report"    },
          { id: "overdue",    label: "⚠ Overdue List"     },
          { id: "defaulters", label: "📋 Defaulter List"  },
          ...(user.role === "super_admin" ? [{ id: "branches", label: "🏢 Branch Summary" }] : []),
        ].map((t) => (
          <button key={t.id}
            className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DAILY REPORT ──────────────────────────────────────────────────────── */}
      {tab === "daily" && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Report Date
                </label>
                <input
                  type="date"
                  value={reportDate}
                  max={todayIST()}
                  onChange={e => setReportDate(e.target.value)}
                  style={{ fontSize: 14, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text1)" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm"   onClick={downloadExcel}  disabled={reportLoading}>📊 Download Excel (.xlsx)</button>
                <button className="btn btn-secondary btn-sm" onClick={openPrintView}  disabled={reportLoading}>🖨 Print / Save as PDF</button>
                <button className="btn btn-secondary btn-sm" onClick={sendEmail}      disabled={emailSending || reportLoading}>
                  {emailSending ? "Sending…" : "📧 Email Report"}
                </button>
              </div>
            </div>
            {emailMsg && (
              <div style={{ marginTop: 10, fontSize: 13, color: emailMsg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>
                {emailMsg}
              </div>
            )}
          </div>

          {reportLoading ? (
            <div className="card"><div className="loading">Loading report…</div></div>
          ) : reportError ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <div className="empty-text">Failed to load report</div>
                <div className="empty-sub" style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>{reportError}</div>
              </div>
            </div>
          ) : reportData ? (
            <>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Collected",      val: fmt(s.total_collected),  color: "var(--green)"  },
                  { label: "Expenses",        val: fmt(s.total_expenses),   color: "var(--red)"    },
                  { label: "Net Cash Flow",   val: fmt(s.net_cash_flow),    color: "var(--accent)" },
                  { label: "Payments",        val: s.payments_count,        color: "var(--accent)" },
                  { label: "New Students",    val: s.new_students,          color: "var(--green)"  },
                  { label: "QR Scans",        val: s.total_attendance || 0, color: "var(--cyan)"   },
                ].map(c => (
                  <div key={c.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.val}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Payments */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">💰 Payments ({reportData.payments.length})</div>
                {reportData.payments.length === 0
                  ? <div className="empty-state"><div className="empty-icon">💳</div><div className="empty-text">No payments on this date</div></div>
                  : <div className="table-wrap"><table>
                      <thead><tr><th>Receipt</th><th>Student</th><th>Branch</th><th>Period</th><th>Amount</th><th>Mode</th></tr></thead>
                      <tbody>
                        {reportData.payments.map((p, i) => (
                          <tr key={i}>
                            <td className="mono text-muted" style={{ fontSize: 11 }}>{p.receipt_no}</td>
                            <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                            <td className="text-muted">{p.branch_name}</td>
                            <td className="text-muted">{p.period_label || "—"}</td>
                            <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>{fmt(p.amount)}</td>
                            <td className="text-muted">{p.payment_mode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                }
              </div>

              {/* New Students */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">🎓 New Students ({reportData.new_students.length})</div>
                {reportData.new_students.length === 0
                  ? <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">No new students on this date</div></div>
                  : <div className="table-wrap"><table>
                      <thead><tr><th>Name</th><th>Phone</th><th>Branch</th><th>Batch</th></tr></thead>
                      <tbody>
                        {reportData.new_students.map((st, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{st.name}</td>
                            <td className="mono text-muted">{st.phone}</td>
                            <td className="text-muted">{st.branch_name}</td>
                            <td className="text-muted">{st.batch_name || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                }
              </div>

              {/* Expenses */}
              {reportData.expenses.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-title">💸 Expenses ({reportData.expenses.length})</div>
                  <div className="table-wrap"><table>
                    <thead><tr><th>Description</th><th>Category</th><th>Branch</th><th>Amount</th></tr></thead>
                    <tbody>
                      {reportData.expenses.map((e, i) => (
                        <tr key={i}>
                          <td>{e.description}</td>
                          <td className="text-muted">{e.category || "—"}</td>
                          <td className="text-muted">{e.branch_name}</td>
                          <td className="mono" style={{ color: "var(--red)", fontWeight: 700 }}>{fmt(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <div className="empty-text">No data for {reportDate}</div>
                <div className="empty-sub">Try a different date or check if there was any activity that day.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OVERDUE LIST ──────────────────────────────────────────────────────── */}
      {tab === "overdue" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>⚠ Overdue Fee Records ({overdue.length})</div>
            <div className="gap-row">
              <button className="btn btn-success btn-sm" onClick={sendBulkReminders} disabled={overdue.length === 0}>
                📱 Send All WhatsApp Reminders
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(overdue, "overdue-fees.csv")}>
                ⬇ Export CSV
              </button>
            </div>
          </div>
          {overdue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div className="empty-text">No overdue records!</div>
              <div className="empty-sub">All students are up to date.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    {user.role === "super_admin" && <th>Branch</th>}
                    <th>Batch</th><th>Period</th><th>Due Date</th><th>Balance</th><th>Contact</th><th>WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r) => {
                    const balance = r.amount_due - r.amount_paid;
                    const dueDate = new Date(r.due_date).toLocaleDateString("en-IN");
                    const phone   = r.parent_phone || r.phone;
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                        {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                        <td className="text-muted">{r.batch_name || "—"}</td>
                        <td>{r.period_label || "—"}</td>
                        <td style={{ color: "var(--red)", fontWeight: 600 }}>{dueDate}</td>
                        <td className="mono" style={{ color: "var(--red)", fontWeight: 700 }}>{fmt(balance)}</td>
                        <td>
                          <div className="mono text-sm">{r.phone}</div>
                          {r.parent_phone && <div className="mono text-sm text-muted">{r.parent_phone}</div>}
                        </td>
                        <td>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => sendWhatsApp(phone, r.student_name, balance, r.period_label, dueDate, r.branch_name, academyName)}
                          >
                            📱 Remind
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DEFAULTERS LIST ───────────────────────────────────────────────────── */}
      {tab === "defaulters" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Fee Defaulter List ({overdue.length})</div>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(
              overdue.map((r) => ({
                "Student Name": r.student_name, "Branch": r.branch_name,
                "Batch": r.batch_name || "—", "Period": r.period_label || "—",
                "Due Date": new Date(r.due_date).toLocaleDateString("en-IN"),
                "Amount Due": r.amount_due, "Amount Paid": r.amount_paid,
                "Balance": r.amount_due - r.amount_paid,
                "Phone": r.phone, "Parent Phone": r.parent_phone || "—",
              })), "defaulters.csv"
            )}>⬇ Export CSV</button>
          </div>
          {overdue.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><div className="empty-text">No defaulters!</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Student</th>
                    {user.role === "super_admin" && <th>Branch</th>}
                    <th>Batch</th><th>Period</th><th>Balance</th><th>Phone</th><th>Parent Phone</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r, i) => {
                    const balance = r.amount_due - r.amount_paid;
                    const dueDate = new Date(r.due_date).toLocaleDateString("en-IN");
                    const phone   = r.parent_phone || r.phone;
                    return (
                      <tr key={r.id}>
                        <td className="text-muted">{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                        {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                        <td className="text-muted">{r.batch_name || "—"}</td>
                        <td>{r.period_label || "—"}</td>
                        <td className="mono" style={{ color: "var(--red)", fontWeight: 700 }}>{fmt(balance)}</td>
                        <td className="mono text-sm">{r.phone || "—"}</td>
                        <td className="mono text-sm">{r.parent_phone || "—"}</td>
                        <td>
                          <button className="btn btn-success btn-sm"
                            onClick={() => sendWhatsApp(phone, r.student_name, balance, r.period_label, dueDate, r.branch_name, academyName)}>
                            📱 Remind
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BRANCH SUMMARY ────────────────────────────────────────────────────── */}
      {tab === "branches" && user.role === "super_admin" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Branch-wise Collection Summary</div>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(branchStats, "branch-summary.csv")}>⬇ Export CSV</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Branch</th><th>Active Students</th><th>Total Collected</th><th>Total Pending</th></tr></thead>
              <tbody>
                {branchStats.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{b.branch}</td>
                    <td>{b.students}</td>
                    <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>{fmt(b.collected)}</td>
                    <td className="mono" style={{ color: "var(--yellow)", fontWeight: 700 }}>{fmt(b.pending)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 800 }}>
                  <td>TOTAL</td>
                  <td>{branchStats.reduce((s, b) => s + parseInt(b.students), 0)}</td>
                  <td className="mono" style={{ color: "var(--green)" }}>{fmt(branchStats.reduce((s, b) => s + parseFloat(b.collected), 0))}</td>
                  <td className="mono" style={{ color: "var(--yellow)" }}>{fmt(branchStats.reduce((s, b) => s + parseFloat(b.pending), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
