import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function sendWhatsApp(phone, studentName, balance, period, dueDate, branchName) {
  const cleanPhone = phone?.replace(/\D/g, "");
  if (!cleanPhone) { alert("No phone number available for this student!"); return; }
  const indiaPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const message = `Hello! 👋

This is a reminder from *NISHCHAY ACADEMY* 🎓

Student: *${studentName}*
Period: *${period || "—"}*
Due Date: *${dueDate}*
Balance Due: *${fmt(balance)}*
Branch: *${branchName}*

Kindly pay the pending fees at the earliest to avoid inconvenience.

Thank you! 🙏
— Nishchay Academy Team`;

  const url = `https://wa.me/${indiaPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

export default function Reports() {
  const { user } = useAuth();
  const [overdue, setOverdue] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [tab, setTab] = useState("overdue");

  useEffect(() => {
    API.get("/reports/overdue").then((r) => setOverdue(r.data));
    if (user.role === "super_admin") API.get("/reports/by-branch").then((r) => setBranchStats(r.data));
  }, []);

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
        const phone = r.parent_phone || r.phone;
        const balance = r.amount_due - r.amount_paid;
        const dueDate = new Date(r.due_date).toLocaleDateString("en-IN");
        sendWhatsApp(phone, r.student_name, balance, r.period_label, dueDate, r.branch_name);
      }, i * 1500);
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reports & Analytics</div>
      </div>

      {/* Tabs */}
      <div className="gap-row" style={{ marginBottom: 20 }}>
        {[
          { id: "overdue",  label: "⚠ Overdue List" },
          { id: "defaulters", label: "📋 Defaulter List" },
          ...(user.role === "super_admin" ? [{ id: "branches", label: "🏢 Branch Summary" }] : []),
        ].map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overdue" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Overdue Fee Records ({overdue.length})</div>
            <div className="gap-row">
              <button className="btn btn-success btn-sm" onClick={sendBulkReminders} disabled={overdue.length === 0}>
                📱 Send All Reminders
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
                    <th>Batch</th><th>Period</th><th>Due Date</th>
                    <th>Balance</th><th>Contact</th><th>Remind</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r) => {
                    const balance = r.amount_due - r.amount_paid;
                    const dueDate = new Date(r.due_date).toLocaleDateString("en-IN");
                    const phone = r.parent_phone || r.phone;
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                        {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                        <td className="text-muted">{r.batch_name || "—"}</td>
                        <td>{r.period_label || "—"}</td>
                        <td style={{ color: "var(--red)" }}>{dueDate}</td>
                        <td className="mono" style={{ color: "var(--red)", fontWeight: 700 }}>{fmt(balance)}</td>
                        <td>
                          <div className="mono text-sm">{r.phone}</div>
                          {r.parent_phone && <div className="mono text-sm text-muted">{r.parent_phone}</div>}
                        </td>
                        <td>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => sendWhatsApp(phone, r.student_name, balance, r.period_label, dueDate, r.branch_name)}
                          >
                            📱 WhatsApp
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

      {tab === "defaulters" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Fee Defaulter List ({overdue.length})</div>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(
              overdue.map((r) => ({
                "Student Name": r.student_name,
                "Branch": r.branch_name,
                "Batch": r.batch_name || "—",
                "Period": r.period_label || "—",
                "Due Date": new Date(r.due_date).toLocaleDateString("en-IN"),
                "Amount Due": r.amount_due,
                "Amount Paid": r.amount_paid,
                "Balance": r.amount_due - r.amount_paid,
                "Phone": r.phone,
                "Parent Phone": r.parent_phone || "—",
              })), "defaulters.csv"
            )}>
              ⬇ Export CSV
            </button>
          </div>
          {overdue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div className="empty-text">No defaulters!</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    {user.role === "super_admin" && <th>Branch</th>}
                    <th>Batch</th>
                    <th>Period</th>
                    <th>Balance</th>
                    <th>Phone</th>
                    <th>Parent Phone</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r, i) => {
                    const balance = r.amount_due - r.amount_paid;
                    const dueDate = new Date(r.due_date).toLocaleDateString("en-IN");
                    const phone = r.parent_phone || r.phone;
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
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => sendWhatsApp(phone, r.student_name, balance, r.period_label, dueDate, r.branch_name)}
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

      {tab === "branches" && user.role === "super_admin" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Branch-wise Collection Summary</div>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(branchStats, "branch-summary.csv")}>
              ⬇ Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Branch</th><th>Active Students</th><th>Total Collected</th><th>Total Pending</th></tr>
              </thead>
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
