import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import NotificationSetup from "../components/NotificationSetup";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const grade = (p) => p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";
const gradeColor = (p) => p >= 70 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";
const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tests, setTests] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [stuRes, feeRes, payRes, attRes, testRes] = await Promise.all([
          API.get(`/students/${user.id}`),
          API.get(`/fees?student_id=${user.id}`),
          API.get(`/payments?student_id=${user.id}`),
          API.get(`/attendance?student_id=${user.id}`),
          API.get(`/tests/student/${user.id}`),
        ]);
        setStudent(stuRes.data);
        setFees(feeRes.data);
        setPayments(payRes.data);
        setAttendance(attRes.data);
        setTests(testRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ color: "var(--text2)" }}>Loading your dashboard…</div>
    </div>
  );

  const totalDue    = fees.reduce((s, f) => s + parseFloat(f.amount_due || 0), 0);
  const totalPaid   = fees.reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
  const balance     = totalDue - totalPaid;
  const pendingFees = fees.filter((f) => f.status !== "paid");
  const avgAtt      = attendance.length ? Math.round(attendance.reduce((s, a) => s + parseFloat(a.percentage || 0), 0) / attendance.length) : null;
  const avgScore    = tests.length ? Math.round(tests.reduce((s, t) => s + parseFloat(t.percentage || 0), 0) / tests.length) : null;

  const tabs = [
    { id: "overview",    label: "🏠 Overview" },
    { id: "fees",        label: "📋 Fee Records" },
    { id: "payments",    label: "💳 Payments" },
    { id: "attendance",  label: "📅 Attendance" },
    { id: "performance", label: "📊 Tests" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Notification Setup — student enables push alerts */}
      <NotificationSetup studentId={student?.id} type="student" />

      {/* Top Navbar */}
      <div style={{
        background: "var(--bg2)", borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, color: "#fff", fontSize: 16
          }}>
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>Student Portal · {user.branch_name}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            🪪 NA-{String(user.id).padStart(5,"0")}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Welcome Banner */}
        <div style={{
          background: "linear-gradient(135deg, var(--accent), #7c3aed)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Welcome, {user.name.split(" ")[0]}! 👋</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
              {student?.batch_name || "No batch"} · NISHCHAY ACADEMY · {user.branch_name}
            </div>
          </div>
          {balance > 0 && (
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Pending Balance</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{fmt(balance)}</div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Fees Due", value: fmt(totalDue), color: "var(--accent)", icon: "📋" },
            { label: "Total Paid", value: fmt(totalPaid), color: "var(--green)", icon: "✅" },
            { label: "Balance Due", value: fmt(balance), color: balance > 0 ? "var(--red)" : "var(--green)", icon: "💰" },
            { label: "Avg Attendance", value: avgAtt !== null ? `${avgAtt}%` : "—", color: avgAtt !== null ? pctColor(avgAtt) : "var(--text2)", icon: "📅" },
            { label: "Avg Test Score", value: avgScore !== null ? `${avgScore}%` : "—", color: avgScore !== null ? gradeColor(avgScore) : "var(--text2)", icon: "📊" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.id} className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

            {/* Pending Fees */}
            <div className="card">
              <div className="card-title">⚠️ Pending Fees</div>
              {pendingFees.length === 0 ? (
                <div style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✅ All fees paid! Great job!</div>
              ) : pendingFees.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.period_label}</div>
                    <div style={{ fontSize: 11, color: "var(--red)" }}>Due: {new Date(f.due_date).toLocaleDateString("en-IN")}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "var(--red)" }}>{fmt(f.amount_due - f.amount_paid)}</div>
                    <span className={`badge ${f.status === "overdue" ? "badge-red" : "badge-yellow"}`} style={{ fontSize: 10 }}>{f.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Payments */}
            <div className="card">
              <div className="card-title">💳 Recent Payments</div>
              {payments.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13 }}>No payments yet</div>
              ) : payments.slice(0, 5).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{fmt(p.amount_paid)}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>{p.period_label} · {p.mode}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>{new Date(p.payment_date).toLocaleDateString("en-IN")}</div>
                </div>
              ))}
            </div>

            {/* Recent Tests */}
            <div className="card">
              <div className="card-title">📊 Recent Test Scores</div>
              {tests.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13 }}>No tests yet</div>
              ) : tests.slice(0, 5).map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.test_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>{t.subject || "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, color: gradeColor(t.percentage) }}>{t.percentage}%</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: gradeColor(t.percentage) }}>{grade(t.percentage)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Attendance Summary */}
            <div className="card">
              <div className="card-title">📅 Recent Attendance</div>
              {attendance.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13 }}>No attendance records</div>
              ) : attendance.slice(0, 5).map((a) => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{MONTHS[a.month - 1]} {a.year}</span>
                    <span style={{ fontWeight: 700, color: pctColor(a.percentage) }}>{a.percentage}%</span>
                  </div>
                  <div style={{ background: "var(--bg3)", borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${a.percentage}%`, background: pctColor(a.percentage), height: "100%", borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{a.present} / {a.total_days} days present</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fee Records Tab */}
        {tab === "fees" && (
          <div className="card">
            <div className="card-title">📋 All Fee Records</div>
            {fees.length === 0 ? (
              <div className="empty-state"><div className="empty-text">No fee records yet</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Period</th><th>Amount Due</th><th>Paid</th><th>Balance</th><th>Due Date</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {fees.map((f) => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 600 }}>{f.period_label}</td>
                        <td className="mono">{fmt(f.amount_due)}</td>
                        <td className="mono" style={{ color: "var(--green)" }}>{fmt(f.amount_paid)}</td>
                        <td className="mono" style={{ color: f.amount_due - f.amount_paid > 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>
                          {fmt(f.amount_due - f.amount_paid)}
                        </td>
                        <td className="text-muted">{new Date(f.due_date).toLocaleDateString("en-IN")}</td>
                        <td><span className={`badge ${f.status === "paid" ? "badge-green" : f.status === "overdue" ? "badge-red" : "badge-yellow"}`}>{f.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {tab === "payments" && (
          <div className="card">
            <div className="card-title">💳 Payment History</div>
            {payments.length === 0 ? (
              <div className="empty-state"><div className="empty-text">No payments yet</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Receipt No.</th><th>Period</th><th>Amount</th><th>Mode</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="mono" style={{ color: "var(--accent)", fontWeight: 700 }}>{p.receipt_no}</td>
                        <td>{p.period_label}</td>
                        <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>{fmt(p.amount_paid)}</td>
                        <td><span className="badge badge-blue">{p.mode}</span></td>
                        <td className="text-muted">{new Date(p.payment_date).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {tab === "attendance" && (
          <div className="card">
            <div className="card-title">📅 Attendance History</div>
            {attendance.length === 0 ? (
              <div className="empty-state"><div className="empty-text">No attendance records</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Month</th><th>Year</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Percentage</th></tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{MONTHS[a.month - 1]}</td>
                        <td>{a.year}</td>
                        <td>{a.total_days}</td>
                        <td style={{ color: "var(--green)", fontWeight: 600 }}>{a.present}</td>
                        <td style={{ color: "var(--red)", fontWeight: 600 }}>{a.total_days - a.present}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${a.percentage}%`, background: pctColor(a.percentage), height: "100%", borderRadius: 4 }} />
                            </div>
                            <span style={{ color: pctColor(a.percentage), fontWeight: 700, minWidth: 40 }}>{a.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {tab === "performance" && (
          <div className="card">
            <div className="card-title">📊 Test Performance</div>
            {tests.length === 0 ? (
              <div className="empty-state"><div className="empty-text">No test records yet</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Test Name</th><th>Subject</th><th>Marks</th><th>Out of</th><th>Percentage</th><th>Grade</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {tests.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{t.test_name}</td>
                        <td className="text-muted">{t.subject || "—"}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{t.marks}</td>
                        <td className="mono text-muted">{t.total_marks}</td>
                        <td style={{ color: gradeColor(t.percentage), fontWeight: 700 }}>{t.percentage}%</td>
                        <td>
                          <span style={{ background: gradeColor(t.percentage), color: "#fff", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                            {grade(t.percentage)}
                          </span>
                        </td>
                        <td className="text-muted">{new Date(t.test_date).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
