import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fetchAllStudents = (query = "") =>
  API.get(`/students?limit=1000${query}`).then((r) => {
    const res = r.data;
    return Array.isArray(res) ? res : (res.data || []);
  });

function MiniAvatar({ student }) {
  const [imgError, setImgError] = useState(false);
  const showPhoto = student?.photo_url && !imgError;
  return (
    <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0, background:showPhoto?"var(--bg3)":"linear-gradient(135deg,var(--accent),#7c3aed)", display:"flex",alignItems:"center",justifyContent:"center", fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden" }}>
      {showPhoto
        ? <img src={student.photo_url} alt={student.student_name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={() => setImgError(true)} />
        : (student?.student_name?.[0] || "?").toUpperCase()}
    </div>
  );
}

// #53 — Working Day Calendar
function WorkingDayCalendar({ month, year, branchId, user }) {
  const [workingDays, setWorkingDays] = useState({});
  const [saving, setSaving] = useState(null);
  const [showCal, setShowCal] = useState(false);

  const loadWorkingDays = useCallback(() => {
    const q = new URLSearchParams({ month, year });
    if (branchId) q.set("branch_id", branchId);
    API.get(`/working-days?${q}`).then((r) => {
      const map = {};
      r.data.forEach((d) => { map[d.date.split("T")[0]] = { is_working: d.is_working, note: d.note }; });
      setWorkingDays(map);
    }).catch(() => {});
  }, [month, year, branchId]);

  useEffect(() => { if (showCal) loadWorkingDays(); }, [showCal, loadWorkingDays]);

  const toggleDay = async (dateStr, currentIsWorking) => {
    setSaving(dateStr);
    try {
      const newVal = !currentIsWorking;
      const bid = branchId || user.branch_id;
      if (newVal === true && workingDays[dateStr]) {
        await API.delete(`/working-days/${dateStr}?branch_id=${bid}`);
        setWorkingDays((prev) => { const n = { ...prev }; delete n[dateStr]; return n; });
      } else {
        await API.post("/working-days", { date: dateStr, is_working: newVal, branch_id: bid, note: newVal ? null : "Holiday" });
        setWorkingDays((prev) => ({ ...prev, [dateStr]: { is_working: newVal, note: newVal ? null : "Holiday" } }));
      }
    } catch (e) { alert("Failed: " + (e.response?.data?.error || e.message)); }
    finally { setSaving(null); }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const today = new Date().toISOString().split("T")[0];
  const getDateStr = (d) => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const workingCount = days.filter((d) => { if (!d) return false; const ds = getDateStr(d); return workingDays[ds] ? workingDays[ds].is_working : true; }).length;

  return (
    <div style={{ marginBottom: 16 }}>
      <button className="btn btn-secondary" onClick={() => setShowCal(!showCal)} style={{ display:"flex",alignItems:"center",gap:8 }}>
        🗓️ Manage Working Days
        <span style={{ background:"var(--bg3)",borderRadius:12,padding:"1px 8px",fontSize:11,color:"var(--text2)" }}>
          {workingCount} working · {daysInMonth - workingCount} holidays
        </span>
      </button>
      {showCal && (
        <div style={{ marginTop:12,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:12,padding:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontWeight:700,fontSize:14 }}>📅 {MONTHS[month-1]} {year} — Working Days</div>
            <div style={{ fontSize:12,color:"var(--text2)" }}>Click a day to toggle</div>
          </div>
          <div style={{ display:"flex",gap:16,marginBottom:12,fontSize:12 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:12,height:12,background:"var(--green)",borderRadius:3 }}/> Working</div>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:12,height:12,background:"var(--red)",borderRadius:3 }}/> Holiday (not counted)</div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4 }}>
            {DAYS_SHORT.map((d) => <div key={d} style={{ textAlign:"center",fontSize:11,color:"var(--text2)",fontWeight:700,padding:"4px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4 }}>
            {days.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const dateStr = getDateStr(d);
              const record = workingDays[dateStr];
              const isWorking = record ? record.is_working : true;
              const isToday = dateStr === today;
              const isSaving = saving === dateStr;
              return (
                <button key={dateStr} onClick={() => toggleDay(dateStr, isWorking)} disabled={isSaving}
                  title={record?.note || (isWorking ? "Working day" : "Holiday")}
                  style={{ padding:"6px 4px",borderRadius:6,border:isToday?"2px solid var(--accent)":"1px solid var(--border)", background:isSaving?"var(--bg3)":isWorking?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)", color:isWorking?"var(--green)":"var(--red)",fontWeight:isToday?900:600,fontSize:13,cursor:"pointer",textAlign:"center",lineHeight:1.2 }}>
                  {isSaving ? "…" : d}
                  {!isWorking && <div style={{ fontSize:8,marginTop:1 }}>holiday</div>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop:12,fontSize:12,color:"var(--text2)" }}>ℹ️ Holidays are not counted in QR scan attendance.</div>
        </div>
      )}
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const [records,setRecords]           = useState([]);
  const [batches,setBatches]           = useState([]);
  const [branches,setBranches]         = useState([]);
  const [month,setMonth]               = useState(new Date().getMonth()+1);
  const [year,setYear]                 = useState(new Date().getFullYear());
  const [filterBranch,setFilterBranch] = useState("");
  const [filterBatch,setFilterBatch]   = useState("");
  const [showModal,setShowModal]       = useState(false);
  const [bulkData,setBulkData]         = useState([]);
  const [saving,setSaving]             = useState(false);
  const [msg,setMsg]                   = useState("");

  const load = useCallback(() => {
    const q = new URLSearchParams({ month, year });
    if (filterBranch) q.set("branch_id", filterBranch);
    API.get(`/attendance?${q}`).then((r) => setRecords(r.data));
  }, [month, year, filterBranch]);

  useEffect(() => {
    load();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [month, year, filterBranch]);

  const openBulk = () => {
    const q = filterBranch ? `&branch_id=${filterBranch}` : "";
    fetchAllStudents(q).then((all) => {
      const filtered = filterBatch ? all.filter((s) => s.batch_id == filterBatch) : all;
      setBulkData(filtered.map((s) => ({ student_id:s.id,student_name:s.name,photo_url:s.photo_url||"",total_days:26,present:26,month,year })));
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

  const updateBulk = (idx, key, val) => setBulkData((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  const pct = (present, total) => total > 0 ? Math.round((present / total) * 100) : 0;
  const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Attendance</div><div className="page-sub">Monthly attendance summary</div></div>
        <button className="btn btn-primary" onClick={openBulk}>+ Enter Attendance</button>
      </div>
      {msg && <div style={{ marginBottom:16,padding:"10px 14px",background:"var(--bg3)",borderRadius:8,fontSize:13 }}>{msg}</div>}
      <div className="filters-bar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>{MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}</select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>{[2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}</select>
        {user.role==="super_admin"&&(<select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}><option value="">All Branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>)}
        <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}><option value="">All Batches</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      </div>

      {/* #53 — Working Day Calendar (admins only) */}
      {user.role !== "student" && (
        <WorkingDayCalendar month={month} year={year}
          branchId={filterBranch || (user.role !== "super_admin" ? user.branch_id : null)}
          user={user} />
      )}

      <div className="card">
        {records.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📅</div><div className="empty-text">No attendance records for {MONTHS[month-1]} {year}</div><div className="empty-sub">Click "Enter Attendance" to add</div></div>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Photo</th><th>Student</th>{user.role==="super_admin"&&<th>Branch</th>}<th>Batch</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Percentage</th></tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r.id}>
                <td><MiniAvatar student={r} /></td>
                <td style={{ fontWeight:600 }}>{r.student_name}</td>
                {user.role==="super_admin"&&<td className="text-muted">{r.branch_name}</td>}
                <td className="text-muted">{r.batch_name||"—"}</td>
                <td>{r.total_days}</td>
                <td style={{ color:"var(--green)",fontWeight:600 }}>{r.present}</td>
                <td style={{ color:"var(--red)",fontWeight:600 }}>{r.total_days-r.present}</td>
                <td><div style={{ display:"flex",alignItems:"center",gap:8 }}><div style={{ flex:1,background:"var(--bg3)",borderRadius:4,height:6 }}><div style={{ width:`${r.percentage}%`,background:pctColor(r.percentage),height:"100%",borderRadius:4 }}/></div><span style={{ color:pctColor(r.percentage),fontWeight:700,minWidth:40 }}>{r.percentage}%</span></div></td>
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
                      <td><div style={{ width:30,height:30,borderRadius:"50%",overflow:"hidden",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>{r.photo_url?<img src={r.photo_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:r.student_name?.[0]?.toUpperCase()||"?"}</div></td>
                      <td style={{ fontWeight:600 }}>{r.student_name}</td>
                      <td><input type="number" value={r.total_days} min="0" max="31" onChange={(e)=>updateBulk(i,"total_days",e.target.value)} style={{ width:70 }}/></td>
                      <td><input type="number" value={r.present} min="0" max={r.total_days} onChange={(e)=>updateBulk(i,"present",e.target.value)} style={{ width:70 }}/></td>
                      <td style={{ color:pctColor(pct(r.present,r.total_days)),fontWeight:700 }}>{pct(r.present,r.total_days)}%</td>
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
