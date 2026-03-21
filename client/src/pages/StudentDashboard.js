import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import NotificationSetup from "../components/NotificationSetup";
import QRCode from "qrcode";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const grade = (p) => p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";
const gradeColor = (p) => p >= 70 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";
const pctColor  = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [student,    setStudent]    = useState(null);
  const [fees,       setFees]       = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tests,      setTests]      = useState([]);
  const [tab,        setTab]        = useState("overview");
  const [loading,    setLoading]    = useState(true);
  const [qrDataUrl,  setQrDataUrl]  = useState("");
  // null = loading, "active" = scannable, "expired" = batch ended, "inactive" = manually deactivated
  const [qrStatus,   setQrStatus]   = useState(null);

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

  // Generate QR code — always render a QR image.
  // If the student is inactive, still show a QR but mark it as disabled with the reason.
  useEffect(() => {
    if (!user?.id) return;
    API.get(`/qrscan/token/${user.id}`)
      .then(async (r) => {
        const url = await QRCode.toDataURL(r.data.token, {
          width: 180, margin: 1,
          errorCorrectionLevel: "L",
          color: { dark: "#0a1628", light: "#ffffff" },
        });
        setQrDataUrl(url);
        setQrStatus("active");
      })
      .catch(async (err) => {
        const reason = err.response?.data?.reason || "inactive";
        // Generate a dummy/placeholder QR (encodes the error message) so the card still looks good
        const dummyText = reason === "expired" ? "SESSION EXPIRED" : "STUDENT INACTIVE";
        try {
          const url = await QRCode.toDataURL(dummyText, {
            width: 180, margin: 1,
            errorCorrectionLevel: "L",
            color: { dark: "#94a3b8", light: "#f1f5f9" },  // greyed-out palette
          });
          setQrDataUrl(url);
        } catch { /* ignore */ }
        setQrStatus(reason === "expired" ? "expired" : "inactive");
      });
  }, [user?.id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="loading">Loading your dashboard…</div>
    </div>
  );

  const totalDue    = fees.reduce((s, f) => s + parseFloat(f.amount_due  || 0), 0);
  const totalPaid   = fees.reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
  const balance     = totalDue - totalPaid;
  const pendingFees = fees.filter((f) => f.status !== "paid");
  const avgAtt      = attendance.length ? Math.round(attendance.reduce((s, a) => s + parseFloat(a.percentage || 0), 0) / attendance.length) : null;
  const avgScore    = tests.length      ? Math.round(tests.reduce((s, t)      => s + parseFloat(t.percentage || 0), 0) / tests.length)      : null;

  const rollDisplay = student?.roll_no || `NA-${String(user.id).padStart(5, "0")}`;

  const tabs = [
    { id: "overview",    label: "🏠 Overview" },
    { id: "idcard",      label: "🪪 ID Card" },
    { id: "fees",        label: "📋 Fees" },
    { id: "payments",    label: "💳 Payments" },
    { id: "attendance",  label: "📅 Attendance" },
    { id: "performance", label: "📊 Tests" },
  ];

  // QR overlay content based on status
  const QrStatusOverlay = () => {
    if (qrStatus === "active" || qrStatus === null) return null;
    const isExpired = qrStatus === "expired";
    return (
      <div style={{
        position: "absolute", inset: 0,
        background: isExpired ? "rgba(239,68,68,0.85)" : "rgba(100,116,139,0.88)",
        borderRadius: 12,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6, padding: 12,
        backdropFilter: "blur(2px)",
      }}>
        <div style={{ fontSize: 28 }}>{isExpired ? "⏰" : "🚫"}</div>
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, textAlign: "center", lineHeight: 1.3 }}>
          {isExpired ? "Session Expired" : "You're Inactive"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, textAlign: "center", lineHeight: 1.4 }}>
          {isExpired
            ? "Your batch has ended. Contact the academy."
            : "Your account is inactive. Contact admin."}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <NotificationSetup studentId={student?.id} type="student" />

      {/* Navbar */}
      <div style={{
        background: "var(--glass)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, var(--blue-600), var(--cyan-400))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, color: "#fff", fontSize: 16,
            boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
          }}>
            {student?.photo_url
              ? <img src={student.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
              : user.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Student · {user.branch_name}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "var(--cyan-300)",
            fontFamily: "JetBrains Mono, monospace", letterSpacing: 0.5,
          }}>
            {rollDisplay}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Welcome banner */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a8a, #2563eb, #0ea5e9)",
          borderRadius: 16, padding: "22px 26px", marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 12,
          border: "1px solid rgba(56,189,248,0.2)",
          boxShadow: "0 4px 24px rgba(37,99,235,0.2)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Welcome, {user.name.split(" ")[0]}! 👋</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              {student?.batch_name || "No batch"} · Nishchay Academy · {user.branch_name}
            </div>
          </div>
          {balance > 0 && (
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 16px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Pending Balance</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{fmt(balance)}</div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Fees",      value: fmt(totalDue),   color: "var(--blue-400)",   icon: "📋" },
            { label: "Total Paid",      value: fmt(totalPaid),  color: "var(--green)",       icon: "✅" },
            { label: "Balance Due",     value: fmt(balance),    color: balance > 0 ? "var(--red)" : "var(--green)", icon: "💰" },
            { label: "Avg Attendance",  value: avgAtt  !== null ? `${avgAtt}%`   : "—", color: avgAtt  !== null ? pctColor(avgAtt)   : "var(--text3)", icon: "📅" },
            { label: "Avg Test Score",  value: avgScore !== null ? `${avgScore}%` : "—", color: avgScore !== null ? gradeColor(avgScore) : "var(--text3)", icon: "📊" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "var(--glass)", backdropFilter: "blur(16px)",
              border: "1px solid var(--border)", borderRadius: 12, padding: "16px",
              transition: "transform 0.2s",
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.id} className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ID Card Tab ── */}
        {tab === "idcard" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {/* Roll number + info card */}
            <div className="card">
              <div className="card-title">Student Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                    {student?.photo_url
                      ? <img src={student.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : "👤"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{student?.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{student?.batch_name || "No batch"}</div>
                  </div>
                </div>
                {[
                  ["Roll Number",  rollDisplay],
                  ["Branch",       user.branch_name],
                  ["Phone",        student?.phone || "—"],
                  ["Admission",    student?.admission_date ? new Date(student.admission_date).toLocaleDateString("en-IN") : "—"],
                  ["Email",        student?.email || "—"],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border2)", fontSize: 13 }}>
                    <span style={{ color: "var(--text3)" }}>{l}</span>
                    <span style={{ fontWeight: 600, color: l === "Roll Number" ? "var(--cyan-300)" : "var(--text)", fontFamily: l === "Roll Number" ? "JetBrains Mono, monospace" : "inherit" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* QR Code card — always visible, overlaid with error if inactive */}
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div className="card-title" style={{ alignSelf: "flex-start" }}>Attendance QR Code</div>

              {/* QR wrapper — always show QR image, overlay if disabled */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{
                  background: "white", padding: 14, borderRadius: 12,
                  border: `1px solid ${qrStatus === "active" ? "var(--border)" : "rgba(248,113,113,0.3)"}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  opacity: qrStatus !== "active" && qrStatus !== null ? 0.5 : 1,
                  transition: "opacity 0.3s",
                }}>
                  {qrDataUrl
                    ? <img src={qrDataUrl} alt="QR" style={{ width: 160, height: 160, display: "block" }} />
                    : <div style={{ width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 12 }}>Loading…</div>
                  }
                </div>
                {/* Status overlay (sits on top of QR) */}
                <QrStatusOverlay />
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{student?.name}</div>
                {qrStatus === "active" && (
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Show this QR at entry/exit to mark attendance</div>
                )}
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--cyan-300)", marginTop: 4 }}>{rollDisplay}</div>
              </div>
            </div>
          </div>
        )}

        {/* Overview */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div className="card">
              <div className="card-title">⚠️ Pending Fees</div>
              {pendingFees.length === 0 ? (
                <div style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✅ All fees paid!</div>
              ) : pendingFees.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)", fontSize: 13 }}>
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
            <div className="card">
              <div className="card-title">💳 Recent Payments</div>
              {payments.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>No payments yet</div>
              : payments.slice(0, 5).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{fmt(p.amount)}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{p.period_label}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{new Date(p.paid_on).toLocaleDateString("en-IN")}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">📊 Recent Tests</div>
              {tests.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>No tests yet</div>
              : tests.slice(0, 5).map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border2)", fontSize: 13 }}>
                  <div><div style={{ fontWeight: 600 }}>{t.test_name}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{t.subject || "—"}</div></div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, color: gradeColor(t.percentage) }}>{t.percentage}%</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: gradeColor(t.percentage) }}>{grade(t.percentage)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">📅 Attendance</div>
              {attendance.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>No records</div>
              : attendance.slice(0, 5).map((a) => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{MONTHS[a.month - 1]} {a.year}</span>
                    <span style={{ fontWeight: 700, color: pctColor(a.percentage) }}>{a.percentage}%</span>
                  </div>
                  <div style={{ background: "var(--bg3)", borderRadius: 4, height: 5 }}>
                    <div style={{ width: `${a.percentage}%`, background: pctColor(a.percentage), height: "100%", borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{a.present} / {a.total_days} days present</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "fees" && (
          <div className="card">
            <div className="card-title">📋 All Fee Records</div>
            {fees.length === 0 ? <div className="empty-state"><div className="empty-text">No fee records yet</div></div>
            : (
              <div className="table-wrap"><table>
                <thead><tr><th>Period</th><th>Amount Due</th><th>Paid</th><th>Balance</th><th>Due Date</th><th>Status</th></tr></thead>
                <tbody>{fees.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.period_label}</td>
                    <td className="mono">{fmt(f.amount_due)}</td>
                    <td className="mono" style={{ color: "var(--green)" }}>{fmt(f.amount_paid)}</td>
                    <td className="mono" style={{ color: f.amount_due - f.amount_paid > 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>{fmt(f.amount_due - f.amount_paid)}</td>
                    <td className="text-muted">{new Date(f.due_date).toLocaleDateString("en-IN")}</td>
                    <td><span className={`badge ${f.status === "paid" ? "badge-green" : f.status === "overdue" ? "badge-red" : "badge-yellow"}`}>{f.status}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="card">
            <div className="card-title">💳 Payment History</div>
            {payments.length === 0 ? <div className="empty-state"><div className="empty-text">No payments yet</div></div>
            : (
              <div className="table-wrap"><table>
                <thead><tr><th>Receipt</th><th>Period</th><th>Amount</th><th>Mode</th><th>Date</th></tr></thead>
                <tbody>{payments.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ color: "var(--accent)" }}>{p.receipt_no}</td>
                    <td>{p.period_label}</td>
                    <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>{fmt(p.amount)}</td>
                    <td><span className="badge badge-blue">{p.payment_mode}</span></td>
                    <td className="text-muted">{new Date(p.paid_on).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {tab === "attendance" && (
          <div className="card">
            <div className="card-title">📅 Attendance History</div>
            {attendance.length === 0 ? <div className="empty-state"><div className="empty-text">No attendance records</div></div>
            : (
              <div className="table-wrap"><table>
                <thead><tr><th>Month</th><th>Year</th><th>Working Days</th><th>Present</th><th>Absent</th><th>%</th></tr></thead>
                <tbody>{attendance.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{MONTHS[a.month - 1]}</td>
                    <td>{a.year}</td>
                    <td>{a.total_days}</td>
                    <td style={{ color: "var(--green)", fontWeight: 600 }}>{a.present}</td>
                    <td style={{ color: "var(--red)", fontWeight: 600 }}>{a.total_days - a.present}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, background: "var(--bg3)", borderRadius: 4, height: 5 }}>
                          <div style={{ width: `${a.percentage}%`, background: pctColor(a.percentage), height: "100%", borderRadius: 4 }} />
                        </div>
                        <span style={{ color: pctColor(a.percentage), fontWeight: 700, minWidth: 40 }}>{a.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {tab === "performance" && (
          <div className="card">
            <div className="card-title">📊 Test Performance</div>
            {tests.length === 0 ? <div className="empty-state"><div className="empty-text">No test records yet</div></div>
            : (
              <div className="table-wrap"><table>
                <thead><tr><th>Test</th><th>Subject</th><th>Marks</th><th>Out of</th><th>%</th><th>Grade</th><th>Date</th></tr></thead>
                <tbody>{tests.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{t.test_name}</td>
                    <td className="text-muted">{t.subject || "—"}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{t.marks}</td>
                    <td className="mono text-muted">{t.total_marks}</td>
                    <td style={{ color: gradeColor(t.percentage), fontWeight: 700 }}>{t.percentage}%</td>
                    <td><span style={{ background: gradeColor(t.percentage), color: "#fff", padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>{grade(t.percentage)}</span></td>
                    <td className="text-muted">{new Date(t.test_date).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
