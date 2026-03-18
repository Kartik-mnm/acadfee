import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Helper: unwrap paginated /students response
const fetchAllStudents = (query = "") =>
  API.get(`/students?limit=1000${query}`).then((r) => {
    const res = r.data;
    return Array.isArray(res) ? res : (res.data || []);
  });

// #33 — Student mini-avatar for attendance table
function MiniAvatar({ student }) {
  const [imgError, setImgError] = useState(false);
  const showPhoto = student?.photo_url && !imgError;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: showPhoto ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), #7c3aed)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden",
    }}>
      {showPhoto
        ? <img src={student.photo_url} alt={student.student_name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgError(true)} />
        : (student?.student_name?.[0] || "?").toUpperCase()
      }
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBatch, setFilterBatch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    const q = new URLSearchParams({ month, year });
    if (filterBranch) q.set("branch_id", filterBranch);
    API.get(`/attendance?${q}`).then((r) => setRecords(r.data));
  };

  useEffect(() => {
    load();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [month, year, filterBranch]);

  const openBulk = () => {
    const q = filterBranch ? `&branch_id=${filterBranch}` : "";
    // Fix: use fetchAllStudents which unwraps paginated response
    fetchAllStudents(q).then((allStudents) => {
      const filtered = filterBatch ? allStudents.filter((s) => s.batch_id == filterBatch) : allStudents;
      setBulkData(filtered.map((s) => ({
        student_id: s.id, student_name: s.name, photo_url: s.photo_url || "",
        total_days: 26, present: 26, month, year
      })));
      setShowModal(true);
    });
  };

  const saveBulk = async () => {
    setSaving(true);
    try {
      const { data } = await API.post("/attendance/bulk", { records: bulkData });
      setMsg(`✓ Saved attendance for ${data.saved} students`);
      setShowModal(false); load();
    } catch (e) { setMsg("⚠ Failed to save"); }
    finally { setSaving(false); setTimeout(() => setMsg(""), 3000); }
  };

  const updateBulk = (idx, key, val) => {
    setBulkData((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const pct = (present, total) => total > 0 ? Math.round((present / total) * 100) : 0;
  const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Attendance</div><div className="page-sub">Monthly attendance summary</div></div>
        <button className="btn btn-primary" onClick={openBulk}>+ Enter Attendance</button>
      </div>
      {msg && <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>}
      <div className="filters-bar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>{[2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}</select>
        {user.role === "super_admin" && (<select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}><option value="">All Branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>)}
        <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}><option value="">All Batches</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      </div>
      <div className="card">
        {records.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📅</div><div className="empty-text">No attendance records for {MONTHS[month - 1]} {year}</div><div className="empty-sub">Click "Enter Attendance" to add</div></div>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Photo</th><th>Student</th>{user.role==="super_admin"&&<th>Branch</th>}<th>Batch</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Percentage</th></tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r.id}>
                <td><MiniAvatar student={r} /></td>
                <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                {user.role==="super_admin"&&<td className="text-muted">{r.branch_name}</td>}
                <td className="text-muted">{r.batch_name||"—"}</td>
                <td>{r.total_days}</td>
                <td style={{ color: "var(--green)", fontWeight: 600 }}>{r.present}</td>
                <td style={{ color: "var(--red)", fontWeight: 600 }}>{r.total_days - r.present}</td>
                <td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,background:"var(--bg3)",borderRadius:4,height:6}}><div style={{width:`${r.percentage}%`,background:pctColor(r.percentage),height:"100%",borderRadius:4}}/></div><span style={{color:pctColor(r.percentage),fontWeight:700,minWidth:40}}>{r.percentage}%</span></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header"><div className="modal-title">Enter Attendance — {MONTHS[month-1]} {year}</div><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              {bulkData.length===0?<div className="empty-state"><div className="empty-text">No students found</div></div>:(
                <div className="table-wrap"><table>
                  <thead><tr><th>Photo</th><th>Student</th><th>Total Days</th><th>Present</th><th>%</th></tr></thead>
                  <tbody>{bulkData.map((r,i)=>(
                    <tr key={r.student_id}>
                      <td><div style={{width:30,height:30,borderRadius:"50%",overflow:"hidden",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{r.photo_url?<img src={r.photo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:r.student_name?.[0]?.toUpperCase()||"?"}</div></td>
                      <td style={{fontWeight:600}}>{r.student_name}</td>
                      <td><input type="number" value={r.total_days} min="0" max="31" onChange={(e)=>updateBulk(i,"total_days",e.target.value)} style={{width:70}}/></td>
                      <td><input type="number" value={r.present} min="0" max={r.total_days} onChange={(e)=>updateBulk(i,"present",e.target.value)} style={{width:70}}/></td>
                      <td style={{color:pctColor(pct(r.present,r.total_days)),fontWeight:700}}>{pct(r.present,r.total_days)}%</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveBulk} disabled={saving}>{saving?"Saving…":"✓ Save Attendance"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
