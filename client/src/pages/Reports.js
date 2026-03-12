import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

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

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reports & Analytics</div>
      </div>

      {/* Tabs */}
      <div className="gap-row" style={{ marginBottom: 20 }}>
        {[
          { id: "overdue", label: "⚠ Overdue List" },
          ...(user.role === "super_admin" ? [{ id: "branches", label: "🏢 Branch Summary" }] : []),
        ].map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overdue" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Overdue Fee Records ({overdue.length})</div>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(overdue, "overdue-fees.csv")}>
              ⬇ Export CSV
            </button>
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
                    <th>Amount Due</th><th>Paid</th><th>Balance</th><th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                      {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                      <td className="text-muted">{r.batch_name || "—"}</td>
                      <td>{r.period_label || "—"}</td>
                      <td style={{ color: "var(--red)" }}>{new Date(r.due_date).toLocaleDateString("en-IN")}</td>
                      <td className="mono">{fmt(r.amount_due)}</td>
                      <td className="mono" style={{ color: "var(--green)" }}>{fmt(r.amount_paid)}</td>
                      <td className="mono" style={{ color: "var(--red)", fontWeight: 700 }}>
                        {fmt(r.amount_due - r.amount_paid)}
                      </td>
                      <td>
                        <div className="mono text-sm">{r.phone}</div>
                        {r.parent_phone && <div className="mono text-sm text-muted">{r.parent_phone}</div>}
                      </td>
                    </tr>
                  ))}
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
