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
    <div style={{
      width:32, height:32, borderRadius:"50%", flexShrink:0,
      background: showPhoto ? "var(--bg3)" : "linear-gradient(135deg,var(--accent),#7c3aed)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:13, fontWeight:700, color:"#fff", overflow:"hidden"
    }}>
      {showPhoto
        ? <img src={student.photo_url} alt={student.student_name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}
            onError={() => setImgError(true)} />
        : (student?.student_name?.[0] || "?").toUpperCase()}
    </div>
  );
}

// ── Working Day Calendar ─────────────────────────────────────────────────────
function WorkingDayCalendar({ month, year, branchId, user, branches, onWorkingDaysChanged }) {
  const [workingDays, setWorkingDays] = useState({});
  const [saving,      setSaving]      = useState(null);
  const [showCal,     setShowCal]     = useState(false);
  const [calBranchId, setCalBranchId] = useState(branchId || "");

  useEffect(() => { setCalBranchId(branchId || ""); }, [branchId]);

  const effectiveBranchId = calBranchId || (user.role !== "super_admin" ? user.branch_id : null);

  const loadWorkingDays = useCallback(() => {
    if (!effectiveBranchId) return;
    const q = new URLSearchParams({ month, year, branch_id: effectiveBranchId });
    API.get(`/working-days?${q}`).then((r) => {
      const map = {};
      r.data.forEach((d) => { map[d.date.split("T")[0]] = { is_working: d.is_working, note: d.note }; });
      setWorkingDays(map);
    }).catch(() => {});
  }, [month, year, effectiveBranchId]);

  useEffect(() => { if (showCal && effectiveBranchId) loadWorkingDays(); }, [showCal, loadWorkingDays, effectiveBranchId]);

  const toggleDay = async (dateStr, currentIsWorking) => {
    if (!effectiveBranchId) return;
    setSaving(dateStr);
    try {
      const newVal = !currentIsWorking;
      if (newVal === true && workingDays[dateStr]) {
        // Reverting to working day = delete the holiday override
        await API.delete(`/working-days/${dateStr}?branch_id=${effectiveBranchId}`);
        setWorkingDays((prev) => { const n = { ...prev }; delete n[dateStr]; return n; });
      } else {
        await API.post("/working-days", {
          date: dateStr, is_working: newVal,
          branch_id: effectiveBranchId,
          note: newVal ? null : "Holiday",
        });
        setWorkingDays((prev) => ({ ...prev, [dateStr]: { is_working: newVal, note: newVal ? null : "Holiday" } }));
      }
      // Notify parent so working days count refreshes
      onWorkingDaysChanged?.();
    } catch (e) { alert("Failed: " + (e.response?.data?.error || e.message)); }
    finally { setSaving(null); }
  };

  const today      = new Date().toISOString().split("T")[0];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const getDateStr = (d) => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // Working count = only past + today dates (don't count future as working)
  const currentDate = today.startsWith(`${year}-${String(month).padStart(2,"0")}`) ? parseInt(today.split("-")[2]) : daysInMonth;
  const isCurrentMonth = today.startsWith(`${year}-${String(month).padStart(2,"0")}`);
  const countUpTo = isCurrentMonth ? currentDate : daysInMonth;

  const workingCount = days.filter((d) => {
    if (!d || d > countUpTo) return false;
    const ds = getDateStr(d);
    return workingDays[ds] ? workingDays[ds].is_working : true;
  }).length;

  return (
    <div style={{ marginBottom: 16 }}>
      <button className="btn btn-secondary" onClick={() => setShowCal(!showCal)}
        style={{ display:"flex", alignItems:"center", gap:8 }}>
        🗓️ Manage Working Days
        {effectiveBranchId && (
          <span style={{ background:"var(--bg3)",borderRadius:12,padding:"1px 8px",fontSize:11,color:"var(--text2)" }}>
            {workingCount} working days
          </span>
        )}
      </button>

      {showCal && (
        <div style={{ marginTop:12,background:"var(--glass-thin)",backdropFilter:"blur(16px)",border:"1px solid var(--border)",borderRadius:12,padding:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8 }}>
            <div style={{ fontWeight:700,fontSize:14 }}>📅 {MONTHS[month-1]} {year} — Working Days</div>
            <div style={{ fontSize:12,color:"var(--text2)" }}>Click a day to toggle working / holiday</div>
          </div>

          {user.role === "super_admin" && !branchId && (
            <div style={{ marginBottom:14,padding:"10px 14px",background:"rgba(79,142,247,0.08)",border:"1px solid var(--accent)",borderRadius:8,display:"flex",alignItems:"center",gap:12 }}>
              <span style={{ fontSize:13,fontWeight:600,flexShrink:0 }}>Select branch:</span>
              <select value={calBranchId} onChange={(e) => { setCalBranchId(e.target.value); setWorkingDays({}); }} style={{ flex:1 }}>
                <option value="">— Choose a branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {!effectiveBranchId ? (
            <div style={{ textAlign:"center",padding:"20px 0",color:"var(--text2)",fontSize:13 }}>
              ☝️ Please select a branch above
            </div>
          ) : (
            <>
              <div style={{ display:"flex",gap:16,marginBottom:12,fontSize:12 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:12,height:12,background:"var(--green)",borderRadius:3 }}/> Working</div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:12,height:12,background:"var(--red)",borderRadius:3 }}/> Holiday</div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}><div style={{ width:12,height:12,background:"var(--text3)",borderRadius:3,opacity:0.4 }}/> Future (not counted)</div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4 }}>
                {DAYS_SHORT.map((d) => <div key={d} style={{ textAlign:"center",fontSize:11,color:"var(--text2)",fontWeight:700,padding:"4px 0" }}>{d}</div>)}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4 }}>
                {days.map((d, i) => {
                  if (!d) return <div key={`e${i}`} />;
                  const dateStr   = getDateStr(d);
                  const record    = workingDays[dateStr];
                  const isWorking = record ? record.is_working : true;
                  const isToday   = dateStr === today;
                  const isFuture  = isCurrentMonth && d > currentDate;
                  const isSaving  = saving === dateStr;
                  return (
                    <button key={dateStr}
                      onClick={() => !isFuture && toggleDay(dateStr, isWorking)}
                      disabled={isSaving || isFuture}
                      title={
                        isFuture ? "Future date — not counted yet" :
                        record?.note || (isWorking ? "Working — click to mark holiday" : "Holiday — click to mark working")
                      }
                      style={{
                        padding:"6px 4px", borderRadius:6,
                        border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: isFuture ? "rgba(148,163,184,0.06)"
                          : isSaving  ? "var(--bg3)"
                          : isWorking ? "rgba(16,217,160,0.15)"
                          :             "rgba(239,68,68,0.15)",
                        color: isFuture ? "var(--text3)"
                          : isWorking ? "var(--green)"
                          :             "var(--red)",
                        fontWeight: isToday ? 900 : 600,
                        fontSize: 13, cursor: isFuture ? "default" : "pointer",
                        textAlign:"center", lineHeight:1.2,
                        opacity: isFuture ? 0.35 : 1,
                      }}>
                      {isSaving ? "…" : d}
                      {!isWorking && !isFuture && <div style={{ fontSize:8,marginTop:1 }}>holiday</div>}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop:12,fontSize:11,color:"var(--text3)" }}>
                ℹ️ Only past &amp; today are counted. Future days appear greyed out.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Attendance Component ────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const [records,      setRecords]      = useState([]);
  const [batches,      setBatches]      = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [month,        setMonth]        = useState(new Date().getMonth()+1);
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBatch,  setFilterBatch]  = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [bulkData,     setBulkData]     = useState([]);
  const [saving,       setSaving]       = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [msg,          setMsg]          = useState("");
  const [workingInfo,  setWorkingInfo]  = useState(null); // {working_days, total_days, holidays}

  const activeBranchId = filterBranch || (user.role !== "super_admin" ? user.branch_id : null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ month, year });
    if (filterBranch) q.set("branch_id", filterBranch);
    API.get(`/attendance?${q}`).then((r) => setRecords(r.data));
  }, [month, year, filterBranch]);

  const loadWorkingDaysCount = useCallback(() => {
    if (!activeBranchId) { setWorkingInfo(null); return; }
    API.get(`/attendance/working-days-count?month=${month}&year=${year}&branch_id=${activeBranchId}`)
      .then((r) => setWorkingInfo(r.data))
      .catch(() => setWorkingInfo(null));
  }, [month, year, activeBranchId]);

  useEffect(() => { loadWorkingDaysCount(); }, [loadWorkingDaysCount]);

  useEffect(() => {
    load();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [month, year, filterBranch]);

  // ── Auto-generate attendance from QR data ──────────────────────────────────
  const generateMonth = async () => {
    if (!activeBranchId) {
      setMsg("⚠️ Please select a branch first");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setGenerating(true);
    try {
      const { data } = await API.post("/attendance/generate-month", {
        month, year, branch_id: activeBranchId,
      });
      setMsg(`✓ Done: ${data.created} created, ${data.updated} updated. Working days this month: ${data.total_working_days}`);
      load();
      loadWorkingDaysCount();
    } catch (e) {
      setMsg("⚠ " + (e.response?.data?.error || "Failed to generate"));
    } finally {
      setGenerating(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  // ── Manual bulk entry ───────────────────────────────────────────────────────
  const openBulk = () => {
    const q = filterBranch ? `&branch_id=${filterBranch}` : "";
    fetchAllStudents(q).then((all) => {
      const filtered = filterBatch ? all.filter((s) => String(s.batch_id) === String(filterBatch)) : all;
      const defaultDays = workingInfo?.working_days ?? 26;
      setBulkData(filtered.map((s) => {
        const existing = records.find((r) => String(r.student_id) === String(s.id));
        return {
          student_id:   s.id,
          student_name: s.name,
          photo_url:    s.photo_url || "",
          total_days:   existing ? existing.total_days : defaultDays,
          present:      existing ? existing.present    : 0,
          month, year,
        };
      }));
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

  const updateBulk = (idx, key, val) =>
    setBulkData((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const pct      = (present, total) => total > 0 ? Math.round((present / total) * 100) : 0;
  const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

  // Summary stats
  const totalStudents  = records.length;
  const avgPct         = totalStudents > 0 ? Math.round(records.reduce((s, r) => s + parseFloat(r.percentage || 0), 0) / totalStudents) : 0;
  const belowThreshold = records.filter((r) => parseFloat(r.percentage || 0) < 75).length;
  const fullPresent    = records.filter((r) => parseInt(r.present) > 0 && parseInt(r.present) === parseInt(r.total_days)).length;

  // Fix: filter by batch_id (not batch name which is fragile)
  const filtered = filterBatch
    ? records.filter((r) => {
        const batch = batches.find((b) => String(b.id) === String(filterBatch));
        return batch && r.batch_name === batch.name;
      })
    : records;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Attendance</div>
          <div className="page-sub">
            Monthly attendance — auto-synced at 10 PM daily
            {workingInfo && activeBranchId && (
              <span style={{ marginLeft:8,color:"var(--green)",fontWeight:600 }}>
                · {workingInfo.working_days} working days
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <button className="btn btn-secondary" onClick={generateMonth} disabled={generating}
            title="Sync attendance from QR scan data right now">
            {generating ? "⏳ Syncing…" : "🔄 Sync from QR"}
          </button>
          <button className="btn btn-primary" onClick={openBulk}>+ Manual Entry</button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom:16,padding:"10px 14px",background:"var(--glass-thin)",backdropFilter:"blur(16px)",border:"1px solid var(--border)",borderRadius:8,fontSize:13 }}>
          {msg}
        </div>
      )}

      {/* Info banner */}
      <div style={{ marginBottom:16,padding:"12px 16px",background:"rgba(37,99,235,0.07)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:10,fontSize:12,color:"var(--text2)",lineHeight:1.8 }}>
        <div style={{ display:"flex",flexWrap:"wrap",gap:20,alignItems:"flex-start" }}>
          <div>
            <strong style={{ color:"var(--blue-400)" }}>🧠 How it works</strong><br/>
            • QR entry + exit = 1 present day (auto-counted)<br/>
            • Every night at 10 PM, attendance auto-syncs for all branches<br/>
            • Absent = working days − scanned days<br/>
            • Click <strong>🔄 Sync from QR</strong> to update right now
          </div>
          {workingInfo && activeBranchId && (
            <div style={{ background:"rgba(16,217,160,0.08)",border:"1px solid rgba(16,217,160,0.2)",borderRadius:8,padding:"8px 14px",fontSize:12 }}>
              <div style={{ color:"var(--text3)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4 }}>This month</div>
              <div style={{ color:"var(--green)",fontWeight:700,fontSize:16 }}>{workingInfo.working_days} <span style={{ fontSize:11,fontWeight:500 }}>working days</span></div>
              <div style={{ color:"var(--text3)",fontSize:11,marginTop:2 }}>{workingInfo.holidays} holiday(s) · {workingInfo.counted_days} days elapsed</div>
            </div>
          )}
        </div>
      </div>

      <div className="filters-bar">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {user.role === "super_admin" && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All Batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Working Day Calendar */}
      {user.role !== "student" && (
        <WorkingDayCalendar
          month={month} year={year}
          branchId={filterBranch || (user.role !== "super_admin" ? user.branch_id : null)}
          user={user}
          branches={branches}
          onWorkingDaysChanged={loadWorkingDaysCount}
        />
      )}

      {/* Summary stats */}
      {records.length > 0 && (
        <div className="stat-grid" style={{ marginBottom:16 }}>
          <div className="stat-card blue">
            <div className="stat-label">Total Students</div>
            <div className="stat-value blue">{totalStudents}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Avg Attendance</div>
            <div className="stat-value green">{avgPct}%</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Below 75%</div>
            <div className="stat-value red">{belowThreshold}</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-label">Full Present</div>
            <div className="stat-value yellow">{fullPresent}</div>
          </div>
        </div>
      )}

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-text">No records for {MONTHS[month-1]} {year}</div>
            <div className="empty-sub">
              Click <strong>🔄 Sync from QR</strong> to auto-fill from today’s scans,
              or <strong>+ Manual Entry</strong> to enter manually.
            </div>
          </div>
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Student</th>
                {user.role === "super_admin" && <th>Branch</th>}
                <th>Batch</th>
                <th>Working Days</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const absent = Math.max(0, parseInt(r.total_days) - parseInt(r.present));
                const pctVal = parseFloat(r.percentage || 0);
                return (
                  <tr key={r.id}>
                    <td><MiniAvatar student={r} /></td>
                    <td style={{ fontWeight:600 }}>{r.student_name}</td>
                    {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                    <td className="text-muted">{r.batch_name || "—"}</td>
                    <td>
                      <span className="mono" style={{ fontWeight:600 }}>{r.total_days}</span>
                    </td>
                    <td style={{ color:"var(--green)",fontWeight:600 }}>{r.present}</td>
                    <td style={{ color: absent > 0 ? "var(--red)" : "var(--text3)", fontWeight: absent > 0 ? 700 : 400 }}>
                      {absent}
                    </td>
                    <td>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ flex:1,background:"rgba(148,163,184,0.12)",borderRadius:4,height:6,minWidth:60 }}>
                          <div style={{ width:`${Math.min(pctVal,100)}%`,background:pctColor(pctVal),height:"100%",borderRadius:4,transition:"width 0.4s ease" }}/>
                        </div>
                        <span style={{ color:pctColor(pctVal),fontWeight:700,minWidth:44,textAlign:"right" }}>
                          {pctVal}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Manual Entry — {MONTHS[month-1]} {year}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {workingInfo && (
                <div style={{ marginBottom:12,padding:"8px 14px",background:"rgba(16,217,160,0.08)",border:"1px solid rgba(16,217,160,0.2)",borderRadius:8,fontSize:12,color:"var(--green)" }}>
                  📅 <strong>{workingInfo.working_days} working days</strong> this month ({workingInfo.counted_days} days elapsed, {workingInfo.holidays} holiday(s)).
                  Total Days pre-filled; adjust Present if needed.
                </div>
              )}
              {bulkData.length === 0 ? (
                <div className="empty-state"><div className="empty-text">No students found for this filter</div></div>
              ) : (
                <div className="table-wrap"><table>
                  <thead>
                    <tr><th>Photo</th><th>Student</th><th>Total Days</th><th>Present</th><th>Absent</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {bulkData.map((r,i) => {
                      const absentVal = Math.max(0, parseInt(r.total_days||0) - parseInt(r.present||0));
                      const pctVal    = pct(r.present, r.total_days);
                      return (
                        <tr key={r.student_id}>
                          <td>
                            <div style={{ width:30,height:30,borderRadius:"50%",overflow:"hidden",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>
                              {r.photo_url
                                ? <img src={r.photo_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                                : r.student_name?.[0]?.toUpperCase() || "?"}
                            </div>
                          </td>
                          <td style={{ fontWeight:600 }}>{r.student_name}</td>
                          <td>
                            <input type="number" value={r.total_days} min="0" max="31"
                              onChange={(e) => updateBulk(i,"total_days",parseInt(e.target.value)||0)}
                              style={{ width:70 }}/>
                          </td>
                          <td>
                            <input type="number" value={r.present} min="0" max={r.total_days}
                              onChange={(e) => updateBulk(i,"present",Math.min(parseInt(e.target.value)||0, r.total_days))}
                              style={{ width:70 }}/>
                          </td>
                          <td style={{ color: absentVal > 0 ? "var(--red)" : "var(--text3)", fontWeight: absentVal > 0 ? 700 : 400 }}>
                            {absentVal}
                          </td>
                          <td style={{ color:pctColor(pctVal),fontWeight:700 }}>{pctVal}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBulk} disabled={saving}>
                {saving ? "Saving…" : "✓ Save Attendance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
