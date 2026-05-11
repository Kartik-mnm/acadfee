import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const grade = (p) => p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";
const gradeColor = (p) => p >= 70 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";
const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

function StudentAvatar({ student, size = 72 }) {
  const [imgError, setImgError] = useState(false);
  const showPhoto = student?.photo_url && !imgError;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: showPhoto ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), #7c3aed)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 900, color: "#fff", flexShrink: 0,
      overflow: "hidden", border: "3px solid var(--border)",
    }}>
      {showPhoto
        ? <img src={student.photo_url} alt={student.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)} />
        : student?.name?.[0]?.toUpperCase() || "?"
      }
    </div>
  );
}

export default function StudentProfile({ studentId, onBack }) {
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tests, setTests] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [stuRes, feeRes, payRes, attRes, testRes] = await Promise.all([
        API.get(`/students/${studentId}`),
        API.get(`/fees?student_id=${studentId}`),
        API.get(`/payments?student_id=${studentId}`),
        API.get(`/attendance?student_id=${studentId}`),
        API.get(`/tests/student/${studentId}`),
      ]);
      setStudent(stuRes.data);
      setFees(feeRes.data);
      setPayments(payRes.data);
      setAttendance(attRes.data);
      setTests(testRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, [studentId]);

  const handleDeleteFee = async (feeId) => {
    if (!window.confirm("Are you sure you want to delete this fee record? This cannot be undone. (Note: You must delete associated payments first)")) return;
    try {
      await API.delete(`/fees/${feeId}`);
      alert("✅ Fee record deleted successfully!");
      load(); // Refresh data
    } catch (e) {
      alert("⚠ Failed: " + (e.response?.data?.error || e.message));
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to void/delete this payment? This will update the fee record balance.")) return;
    try {
      await API.delete(`/payments/${paymentId}`);
      alert("✅ Payment deleted and balance updated!");
      load();
    } catch (e) {
      alert("⚠ Failed: " + (e.response?.data?.error || e.message));
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ color: "var(--text2)", fontSize: 14 }}>Loading student profile…</div>
    </div>
  );

  if (!student) return <div>Student not found</div>;

  const totalDue  = student?.fee_type?.toLowerCase() === "course" 
    ? parseFloat(student.admission_fee || 0)
    : fees.reduce((s, f) => s + parseFloat(f.amount_due || 0), 0);
  const totalPaid = fees.reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
  const balance   = totalDue - totalPaid;
  const avgAttendance = attendance.length
    ? Math.round(attendance.reduce((s, a) => s + parseFloat(a.percentage || 0), 0) / attendance.length)
    : null;
  const avgScore = tests.length
    ? Math.round(tests.reduce((s, t) => s + parseFloat(t.percentage || 0), 0) / tests.length)
    : null;

  // Roll number — same format as ID Card: use roll_no if set, else NA-XXXXX
  const rollDisplay = student.roll_no || `NA-${String(student.id).padStart(5, "0")}`;

  const tabs = [
    { id: "overview",    label: "Overview" },
    { id: "fees",        label: `Fee Records (${fees.length})` },
    { id: "payments",    label: `Payments (${payments.length})` },
    { id: "attendance",  label: `Attendance (${attendance.length})` },
    { id: "performance", label: `Tests (${tests.length})` },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={onBack}>← Back to Students</button>
        <button className="btn btn-success" onClick={async () => {
          if (!student.email) { alert("No email address for this student!"); return; }
          if (!window.confirm(`Send fee summary email to ${student.name}?`)) return;
          try {
            await API.post(`/students/${student.id}/send-email`);
            alert(`✅ Email sent to ${student.email}!`);
          } catch (e) { alert("⚠ Failed: " + (e.response?.data?.error || e.message)); }
        }}>📧 Send Fee Summary Email</button>
      </div>

      {/* Profile Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <StudentAvatar student={student} size={80} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{student.name}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="badge badge-blue">{student.batch_name || "No Batch"}</span>
              <span className="badge badge-gray">{student.branch_name}</span>
              <span className={`badge ${student.status === "active" ? "badge-green" : "badge-red"}`}>{student.status}</span>
              <span className="badge badge-yellow">{student.fee_type}</span>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "var(--text2)" }}>
              {student.phone && <span>📞 {student.phone}</span>}
              {student.parent_phone && <span>👨‍👩‍👦 {student.parent_phone}</span>}
              {student.email && <span>✉ {student.email}</span>}
              {student.admission_date && <span>📅 Joined {new Date(student.admission_date).toLocaleDateString("en-IN")}</span>}
              {/* Fix: show roll_no — same as ID card */}
              <span>🪪 ID: {rollDisplay}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {/* Fix 1: "Total Fees Due" → "Total Fees" */}
        <div className="stat-card blue"><div className="stat-label">Total Fees</div><div className="stat-value blue">{fmt(totalDue)}</div></div>
        <div className="stat-card green"><div className="stat-label">Total Paid</div><div className="stat-value green">{fmt(totalPaid)}</div></div>
        <div className="stat-card red"><div className="stat-label">Balance Pending</div><div className="stat-value red">{fmt(balance)}</div></div>
        <div className="stat-card yellow"><div className="stat-label">Avg Attendance</div><div className="stat-value yellow">{avgAttendance !== null ? `${avgAttendance}%` : "—"}</div></div>
        <div className="stat-card blue"><div className="stat-label">Avg Test Score</div><div className="stat-value blue">{avgScore !== null ? `${avgScore}%` : "—"}</div></div>
      </div>

      <div className="gap-row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">👤 Student Details</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              {[
                ["Full Name",     student.name],
                ["Roll No.",      rollDisplay],
                ["Phone",         student.phone||"—"],
                ["Parent Phone",  student.parent_phone||"—"],
                ["Email",         student.email||"—"],
                ["Branch",        student.branch_name],
                ["Batch",         student.batch_name||"—"],
                ["Fee Type",      student.fee_type],
                ["Due Day",       `${student.due_day||10}th of every month`],
                ["Discount",      student.discount>0?`${student.discount}% — ${student.discount_reason||""}`:`None`],
                ["Admission Fee", student.admission_fee>0?fmt(student.admission_fee):"—"],
                ["Admission Date",student.admission_date?new Date(student.admission_date).toLocaleDateString("en-IN"):"—"],
                ["Address",       student.address||"—"],
                ["Status",        student.status],
              ].map(([label,val])=>(
                <tr key={label} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"8px 0",color:"var(--text2)",fontSize:12,fontWeight:600,width:130}}>{label}</td>
                  <td style={{padding:"8px 0",fontSize:13,fontWeight:500}}>{val}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card"><div className="card-title">💳 Recent Payments</div>
              {payments.length===0?<div className="text-muted" style={{fontSize:13}}>No payments yet</div>:payments.slice(0,4).map((p)=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <div><div style={{fontWeight:600}}>{fmt(p.amount)}</div><div className="text-muted text-sm">{p.period_label} · {p.payment_mode}</div></div>
                  <div className="text-muted text-sm">{new Date(p.paid_on).toLocaleDateString("en-IN")}</div>
                </div>
              ))}
            </div>
            <div className="card"><div className="card-title">📊 Recent Test Scores</div>
              {tests.length===0?<div className="text-muted" style={{fontSize:13}}>No tests yet</div>:tests.slice(0,4).map((t,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <div><div style={{fontWeight:600}}>{t.test_name}</div><div className="text-muted text-sm">{t.subject||"—"} · {new Date(t.test_date).toLocaleDateString("en-IN")}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:gradeColor(t.percentage)}}>{t.percentage}%</div><div style={{fontSize:11,color:gradeColor(t.percentage)}}>{grade(t.percentage)}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="fees" && (
        <div className="card">
          <div className="card-title">📋 Fee Records</div>
          {fees.length===0 ? (
            <div className="empty-state"><div className="empty-text">No fee records</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Amount Due</th>
                    <th>Amount Paid</th>
                    <th>Balance</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => (
                    <tr key={f.id}>
                      <td style={{fontWeight:600}}>{f.period_label}</td>
                      <td className="mono">{fmt(f.amount_due)}</td>
                      <td className="mono" style={{color:"var(--green)"}}>{fmt(f.amount_paid)}</td>
                      <td className="mono" style={{color:f.amount_due-f.amount_paid>0?"var(--red)":"var(--green)",fontWeight:700}}>{fmt(f.amount_due-f.amount_paid)}</td>
                      <td className="text-muted">{new Date(f.due_date).toLocaleDateString("en-IN")}</td>
                      <td>
                        <span className={`badge ${f.status==="paid"?"badge-green":f.status==="overdue"?"badge-red":"badge-yellow"}`}>
                          {f.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-red btn-sm"
                          style={{ padding: "4px 8px", fontSize: 11, background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)" }}
                          onClick={() => handleDeleteFee(f.id)}
                          disabled={parseFloat(f.amount_paid) > 0}
                          title={parseFloat(f.amount_paid) > 0 ? "Cannot delete record with payments" : "Delete record"}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab==="payments" && (
        <div className="card">
          <div className="card-title">💳 Payment History</div>
          {payments.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No payments recorded</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Receipt No.</th>
                    <th>Period</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Txn ID</th>
                    <th>Date</th>
                    {user?.role !== "student" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="mono" style={{color:"var(--accent)",fontWeight:700}}>{p.receipt_no}</td>
                      <td>{p.period_label}</td>
                      <td className="mono" style={{color:"var(--green)",fontWeight:700}}>{fmt(p.amount)}</td>
                      <td><span className="badge badge-blue">{p.payment_mode}</span></td>
                      <td className="mono text-muted text-sm">{p.transaction_ref||"—"}</td>
                      <td className="text-muted">{new Date(p.paid_on).toLocaleDateString("en-IN")}</td>
                      {user?.role !== "student" && (
                        <td>
                          <button 
                            className="btn btn-red btn-sm"
                            style={{ padding: "4px 8px", fontSize: 11, background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)" }}
                            onClick={() => handleDeletePayment(p.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab==="attendance" && (<div className="card"><div className="card-title">📅 Attendance History</div>{attendance.length===0?<div className="empty-state"><div className="empty-text">No attendance records</div></div>:<div className="table-wrap"><table><thead><tr><th>Month</th><th>Year</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Percentage</th></tr></thead><tbody>{attendance.map((a)=>(<tr key={a.id}><td style={{fontWeight:600}}>{MONTHS[a.month-1]}</td><td>{a.year}</td><td>{a.total_days}</td><td style={{color:"var(--green)",fontWeight:600}}>{a.present}</td><td style={{color:"var(--red)",fontWeight:600}}>{a.total_days-a.present}</td><td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"var(--bg3)",borderRadius:4,height:6}}><div style={{width:`${a.percentage}%`,background:pctColor(a.percentage),height:"100%",borderRadius:4}}/></div><span style={{color:pctColor(a.percentage),fontWeight:700,minWidth:40}}>{a.percentage}%</span></div></td></tr>))}</tbody></table></div>}</div>)}
      {tab==="performance" && (<div className="card"><div className="card-title">📊 Test Performance</div>{tests.length===0?<div className="empty-state"><div className="empty-text">No test records</div></div>:<div className="table-wrap"><table><thead><tr><th>Test Name</th><th>Subject</th><th>Marks</th><th>Out of</th><th>Percentage</th><th>Grade</th><th>Date</th></tr></thead><tbody>{tests.map((t,i)=>(<tr key={i}><td style={{fontWeight:600}}>{t.test_name}</td><td className="text-muted">{t.subject||"—"}</td><td className="mono" style={{fontWeight:700}}>{t.marks}</td><td className="mono text-muted">{t.total_marks}</td><td style={{color:gradeColor(t.percentage),fontWeight:700}}>{t.percentage}%</td><td><span style={{background:gradeColor(t.percentage),color:"#fff",padding:"2px 10px",borderRadius:6,fontSize:12,fontWeight:800}}>{grade(t.percentage)}</span></td><td className="text-muted">{new Date(t.test_date).toLocaleDateString("en-IN")}</td></tr>))}</tbody></table></div>}</div>)}
    </div>
  );
}
