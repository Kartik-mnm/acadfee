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

// ── Working Day Calendar (unchanged) ────────────────────────────────────────
function WorkingDayCalendar({ month, year, branchId, user, branches, onWorkingDaysChanged }) {
  const [workingDays, setWorkingDays] = useState({});
  const [saving, setSaving] = useState(null);
  const [showCal, setShowCal] = useState(false);
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
        await API.delete(`/working-days/${dateStr}?branch_id=${effectiveBranchId}`);
        setWorkingDays((prev) => { const n = { ...prev }; delete n[dateStr]; return n; });
      } else {
        await API.post("/working-days", { date: dateStr, is_working: newVal, branch_id: effectiveBranchId, note: newVal ? null : "Holiday" });
        setWorkingDays((prev) => ({ ...prev, [dateStr]: { is_working: newVal, note: newVal ? null : "Holiday" } }));
      }
      onWorkingDaysChanged?.();
    } catch (e) { alert("Failed: " + (e.response?.data?.error || e.message)); }
    finally { setSaving(null); }
  };

  const today = new Date().toISOString().split("T")[0];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const getDateStr = (d) => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const currentDate = today.startsWith(`${year}-${String(month).padStart(2,"0")}`) ? parseInt(today.split("-")[2]) : daysInMonth;
  const isCurrentMonth = today.startsWith(`${year}-${String(month).padStart(2,"0")}`);
  const countUpTo = isCurrentMonth ? currentDate : daysInMonth;
  const workingCount = days.filter((d) => {
    if (!d || d > countUpTo) return false;
    const ds = getDateStr(d);
    return workingDays[ds] ? workingDays[ds].is_working : true;
  }).length;

  return (
    <div style={{ marginBottom:16 }}>
      <button className="btn btn-secondary" onClick={() => setShowCal(!showCal)}
        style={{ display:"flex", alignItems:"center", gap:8, width:"100%", justifyContent:"center" }}>
        &#128197; Manage Working Days
        {effectiveBranchId && (
          <span style={{ background:"var(--bg3)", borderRadius:12, padding:"1px 8px", fontSize:11, color:"var(--text2)" }}>
            {workingCount} working days
          </span>
        )}
      </button>
      {showCal && (
        <div style={{ marginTop:12, background:"var(--glass-thin)", backdropFilter:"blur(16px)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>&#128197; {MONTHS[month-1]} {year}</div>
            <div style={{ fontSize:12, color:"var(--text2)" }}>Tap to toggle working / holiday</div>
          </div>
          {user.role === "super_admin" && !branchId && (
            <div style={{ marginBottom:14, padding:"10px 14px", background:"rgba(79,142,247,0.08)", border:"1px solid var(--accent)", borderRadius:8, display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:13, fontWeight:600, flexShrink:0 }}>Select branch:</span>
              <select value={calBranchId} onChange={(e) => { setCalBranchId(e.target.value); setWorkingDays({}); }} style={{ flex:1 }}>
                <option value="">Choose a branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {!effectiveBranchId ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text2)", fontSize:13 }}>Please select a branch above</div>
          ) : (
            <>
              <div style={{ display:"flex", gap:16, marginBottom:12, fontSize:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:12, height:12, background:"var(--green)", borderRadius:3 }}/> Working</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:12, height:12, background:"var(--red)", borderRadius:3 }}/> Holiday</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
                {DAYS_SHORT.map((d) => <div key={d} style={{ textAlign:"center", fontSize:11, color:"var(--text2)", fontWeight:700, padding:"4px 0" }}>{d}</div>)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
                {days.map((d, i) => {
                  if (!d) return <div key={`e${i}`} />;
                  const dateStr = getDateStr(d);
                  const record = workingDays[dateStr];
                  const isWorking = record ? record.is_working : true;
                  const isToday = dateStr === today;
                  const isFuture = isCurrentMonth && d > currentDate;
                  const isSaving = saving === dateStr;
                  return (
                    <button key={dateStr}
                      onClick={() => !isFuture && toggleDay(dateStr, isWorking)}
                      disabled={isSaving || isFuture}
                      style={{
                        padding:"6px 4px", borderRadius:6,
                        border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: isFuture ? "rgba(148,163,184,0.06)" : isSaving ? "var(--bg3)" : isWorking ? "rgba(16,217,160,0.15)" : "rgba(239,68,68,0.15)",
                        color: isFuture ? "var(--text3)" : isWorking ? "var(--green)" : "var(--red)",
                        fontWeight: isToday ? 900 : 600, fontSize:13, cursor: isFuture ? "default" : "pointer",
                        textAlign:"center", lineHeight:1.2, opacity: isFuture ? 0.35 : 1,
                      }}>
                      {isSaving ? "..." : d}
                      {!isWorking && !isFuture && <div style={{ fontSize:8, marginTop:1 }}>holiday</div>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Attendance Student Card (mobile) — matches Image 3/4 design ─────────────
function AttendanceCard({ r, onMark, marking }) {
  const absent = Math.max(0, parseInt(r.total_days) - parseInt(r.present));
  const pctVal = parseFloat(r.percentage || 0);
  const pctColor = pctVal >= 75 ? "#3fff8b" : pctVal >= 50 ? "#fbbf24" : "#ff6e84";
  const initials = (r.student_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);

  return (
    <div style={{
      background:"var(--mob-surface,#121a28)",
      borderRadius:16,
      padding:"14px 16px",
      marginBottom:10,
      boxShadow:"0 12px 24px rgba(61,90,254,0.06)",
    }}>
      {/* Header: avatar + name + branch + batch */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
        {r.photo_url ? (
          <img src={r.photo_url} alt={r.student_name}
            style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}
            onError={(e) => { e.target.style.display="none"; }}
          />
        ) : (
          <div style={{
            width:40, height:40, borderRadius:"50%",
            background:"linear-gradient(135deg,#4963ff,#9ba8ff)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:800, fontSize:15, color:"#fff", flexShrink:0,
          }}>{initials}</div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:15, color:"var(--mob-on-surface,#e6ebfc)", marginBottom:2 }}>
            {r.student_name}
          </div>
          <div style={{ fontSize:11, color:"var(--mob-on-var,#a5abbb)", display:"flex", alignItems:"center", gap:10 }}>
            {r.branch_name && <span>&#127982; {r.branch_name}</span>}
            {r.batch_name  && <span>&#127891; {r.batch_name}</span>}
          </div>
        </div>
      </div>

      {/* Present / Absent action buttons */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button
          onClick={() => onMark(r, "present")}
          disabled={!!marking}
          style={{
            flex:1, padding:"8px 0", borderRadius:20,
            background:"rgba(63,255,139,0.12)",
            border:"1.5px solid rgba(63,255,139,0.3)",
            color:"#3fff8b", fontWeight:700, fontSize:12,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            opacity: marking ? 0.6 : 1,
          }}
        >
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#3fff8b", display:"inline-block" }}/>
          Present
        </button>
        <button
          onClick={() => onMark(r, "absent")}
          disabled={!!marking}
          style={{
            flex:1, padding:"8px 0", borderRadius:20,
            background:"rgba(255,110,132,0.12)",
            border:"1.5px solid rgba(255,110,132,0.3)",
            color:"#ff6e84", fontWeight:700, fontSize:12,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            opacity: marking ? 0.6 : 1,
          }}
        >
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#ff6e84", display:"inline-block" }}/>
          Absent
        </button>
      </div>

      {/* Stats row: PRESENT / ABSENT / TOTAL */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>PRESENT</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:18, color:"#3fff8b" }}>{r.present}</div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>ABSENT</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:18, color: absent > 0 ? "#ff6e84" : "var(--mob-on-var,#a5abbb)" }}>{absent}</div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>TOTAL</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:18, color:"var(--mob-on-surface,#e6ebfc)" }}>{r.total_days}</div>
        </div>
      </div>

      {/* Attendance % + progress bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em" }}>ATTENDANCE</div>
        <div style={{ flex:1, background:"rgba(255,255,255,0.07)", borderRadius:100, height:4, overflow:"hidden" }}>
          <div style={{ width:`${Math.min(pctVal,100)}%`, height:"100%", background:pctColor, borderRadius:100, transition:"width 0.4s ease" }}/>
        </div>
        <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:13, color:pctColor, minWidth:36, textAlign:"right" }}>{pctVal}%</div>
      </div>

      {pctVal < 75 && (
        <button
          onClick={() => onMark(r, "nudge")}
          style={{
            width:"100%", marginTop:12, padding:"10px 0", borderRadius:12,
            background:"rgba(37,211,102,0.1)", border:"1px solid rgba(37,211,102,0.3)",
            color:"#25D366", fontWeight:700, fontSize:12, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8
          }}
        >
          <span style={{ fontSize:16 }}>&#128172;</span>
          Nudge via WhatsApp
        </button>
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
  const [workingInfo,  setWorkingInfo]  = useState(null);
  const [search,       setSearch]       = useState("");
  const [marking,      setMarking]      = useState(null); // student_id being marked
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth <= 768);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [total,        setTotal]        = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const activeBranchId = filterBranch || (user.role !== "super_admin" ? user.branch_id : null);

  const load = useCallback((p = 1) => {
    const q = new URLSearchParams({ month, year, page: p, limit: LIMIT });
    if (filterBranch) q.set("branch_id", filterBranch);
    if (filterBatch)  q.set("batch_id", filterBatch);
    if (search)       q.set("search", search);
    API.get(`/attendance?${q}`).then((r) => {
      if (r.data.data) {
        setRecords(r.data.data);
        setPage(r.data.page);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
      } else {
        setRecords(r.data);
        setTotal(r.data.length);
        setPage(1);
        setTotalPages(1);
      }
    }).catch(() => {});
  // Bug fix: search was missing from deps — added so typing triggers a fresh fetch
  }, [month, year, filterBranch, filterBatch, search]);

  const loadWorkingDaysCount = useCallback(() => {
    if (!activeBranchId) { setWorkingInfo(null); return; }
    API.get(`/attendance/working-days-count?month=${month}&year=${year}&branch_id=${activeBranchId}`)
      .then((r) => setWorkingInfo(r.data))
      .catch(() => setWorkingInfo(null));
  }, [month, year, activeBranchId]);

  useEffect(() => { loadWorkingDaysCount(); }, [loadWorkingDaysCount]);

  // Bug fix: consolidated into one effect with correct deps (load already encapsulates search/filters)
  useEffect(() => {
    setPage(1); // Bug fix: reset page to 1 whenever any filter changes
    load(1);
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const generateMonth = async () => {
    if (!activeBranchId) { setMsg("Please select a branch first"); setTimeout(() => setMsg(""), 3000); return; }
    setGenerating(true);
    try {
      const { data } = await API.post("/attendance/generate-month", { month, year, branch_id: activeBranchId });
      setMsg(`Done: ${data.created} created, ${data.updated} updated.`);
      load(); loadWorkingDaysCount();
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed to generate");
    } finally { setGenerating(false); setTimeout(() => setMsg(""), 5000); }
  };

  // ── Mark present / absent for today ────────────────────────────────────────
  // Clicking "Present" increments present by 1 (up to total_days)
  // Clicking "Absent"  decrements present by 1 (down to 0)
  const handleMark = async (record, action) => {
    if (action === "nudge") {
      nudgeLowAttendance(record);
      return;
    }
    if (marking) return;
    setMarking(record.student_id);
    try {
      const currentPresent = parseInt(record.present) || 0;
      const totalDays      = parseInt(record.total_days) || 0;
      let newPresent;
      if (action === "present") {
        newPresent = Math.min(currentPresent + 1, totalDays);
      } else {
        newPresent = Math.max(currentPresent - 1, 0);
      }
      await API.post("/attendance", {
        student_id: record.student_id,
        month,
        year,
        total_days: totalDays,
        present:    newPresent,
      });
      // Update local state immediately for snappy UX
      setRecords((prev) => prev.map((r) => {
        if (r.student_id !== record.student_id) return r;
        const newPct = totalDays > 0 ? Math.min(Math.round((newPresent / totalDays) * 100), 100) : 0;
        return { ...r, present: newPresent, percentage: newPct };
      }));
    } catch (e) {
      setMsg("Failed to update attendance: " + (e.response?.data?.error || e.message));
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setMarking(null);
    }
  };

  const openBulk = () => {
    const q = filterBranch ? `&branch_id=${filterBranch}` : "";
    fetchAllStudents(q).then((all) => {
      const filteredStudents = filterBatch ? all.filter((s) => String(s.batch_id) === String(filterBatch)) : all;
      const defaultDays = workingInfo?.working_days ?? 26;
      setBulkData(filteredStudents.map((s) => {
        const existing = records.find((r) => String(r.student_id) === String(s.id));
        return { student_id:s.id, student_name:s.name, photo_url:s.photo_url||"", total_days:existing?existing.total_days:defaultDays, present:existing?existing.present:0, month, year };
      }));
      setShowModal(true);
    });
  };

  const saveBulk = async () => {
    setSaving(true);
    try {
      const { data } = await API.post("/attendance/bulk", { records: bulkData });
      setMsg(`Saved attendance for ${data.saved} students`);
      setShowModal(false); load();
    } catch (e) { setMsg("Failed to save"); }
    finally { setSaving(false); setTimeout(() => setMsg(""), 3000); }
  };

  const updateBulk = (idx, key, val) =>
    setBulkData((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));

  const exportToCSV = () => {
    if (records.length === 0) return;
    const headers = ["Student", "Branch", "Batch", "Working Days", "Present", "Absent", "Attendance %"];
    const rows = records.map(r => [
      r.student_name,
      r.branch_name || "",
      r.batch_name || "",
      r.total_days,
      r.present,
      Math.max(0, parseInt(r.total_days) - parseInt(r.present)),
      `${r.percentage}%`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_${MONTHS[month-1]}_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const nudgeLowAttendance = (r) => {
    const wa = r.phone?.replace(/\D/g, "");
    if (!wa) { alert("Phone number missing!"); return; }
    const msg = encodeURIComponent(
      `Dear ${r.student_name || "Student"},\n\nYour attendance for *${MONTHS[month-1]} ${year}* is currently *${r.percentage}%*, which is below the required 75%.\n\nPlease ensure you attend regularly to stay on track with your course.\n\nThank you,\n${user?.branch_name || "Academy"}`
    );
    window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
  };

  const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

  const totalStudents  = total || records.length;
  // Bug fix: divide by records.length (current page count) for average — this is intentional
  // since we only have percentage data for the current page. Label clarified to "Avg (this page)".
  const avgPct         = records.length > 0 ? Math.round(records.reduce((s, r) => s + parseFloat(r.percentage || 0), 0) / records.length) : 0;
  const belowThreshold = records.filter((r) => parseFloat(r.percentage || 0) < 75).length;
  const fullPresent    = records.filter((r) => parseInt(r.present) > 0 && parseInt(r.present) === parseInt(r.total_days)).length;

  return (
    <div>
      {/* ── Page header ─────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">Attendance</div>
          <div className="page-sub">Monthly attendance &#8212; auto-synced at 10 PM daily</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {records.some(r => parseFloat(r.percentage || 0) < 75) && (
            <button className="btn btn-secondary" onClick={() => records.filter(r => parseFloat(r.percentage || 0) < 75).forEach(nudgeLowAttendance)} style={{ border:"1px solid #25D366", color:"#25D366" }}>
              &#128172; Nudge All Low
            </button>
          )}
          <button className="btn btn-secondary" onClick={generateMonth} disabled={generating}>
            {generating ? "Syncing..." : "Sync from QR"}
          </button>
          <button className="btn btn-primary" onClick={openBulk}>+ Manual Entry</button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom:14, padding:"10px 14px", background:"var(--glass-thin)", backdropFilter:"blur(16px)", border:"1px solid var(--border)", borderRadius:8, fontSize:13 }}>{msg}</div>
      )}

      {/* ── Info box ─────────────────────────────────── */}
      <div style={{ marginBottom:16, padding:"12px 16px", background:"rgba(37,99,235,0.07)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:10, fontSize:12, color:"var(--text2)", lineHeight:1.8 }}>
        <div style={{ fontWeight:700, color:"var(--blue-400,#60a5fa)", marginBottom:4 }}>How it works</div>
        <div style={{ fontSize:12 }}>
          QR entry + exit = 1 present day (auto-counted)<br/>
          Every night at 10 PM, attendance auto-syncs for all branches<br/>
          Absent = working days &#8722; scanned days<br/>
          Click <strong>Sync from QR</strong> to update right now
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      <div className="filters-bar">
        <input className="search-input" placeholder="Search student name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
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
        <button className="btn btn-secondary btn-sm" onClick={exportToCSV} disabled={records.length === 0}>Export CSV</button>
      </div>

      {/* ── Working Day Calendar ─────────────────────── */}
      {user.role !== "student" && (
        <WorkingDayCalendar
          month={month} year={year}
          branchId={filterBranch || (user.role !== "super_admin" ? user.branch_id : null)}
          user={user} branches={branches}
          onWorkingDaysChanged={loadWorkingDaysCount}
        />
      )}

      {/* ── Summary stats bento ──────────────────────── */}
      {records.length > 0 && (
        <div className="stat-grid" style={{ marginBottom:16 }}>
          <div className="stat-card">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{totalStudents}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Attendance</div>
            <div className="stat-value green">{avgPct}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Below 75%</div>
            <div className="stat-value red">{belowThreshold}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Full Present</div>
            <div className="stat-value yellow">{fullPresent}</div>
          </div>
        </div>
      )}

      {/* ── Student list ─────────────────────────────── */}
      {records.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">&#128197;</div>
            <div className="empty-text">No records for {MONTHS[month-1]} {year}</div>
            <div className="empty-sub">Click Sync from QR or use Manual Entry</div>
          </div>
        </div>
      ) : isMobile ? (
        /* ── Mobile card layout ─────────────────────── */
        <div>
          {records.map((r) => (
            <AttendanceCard
              key={r.id}
              r={r}
              onMark={handleMark}
              marking={marking === r.student_id ? marking : null}
            />
          ))}
        </div>
      ) : (
        /* ── Desktop table layout ───────────────────── */
        <div className="card">
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>Photo</th><th>Student</th>
                {user.role === "super_admin" && <th>Branch</th>}
                <th>Batch</th><th>Working Days</th><th>Present</th><th>Absent</th><th>Attendance %</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const absent = Math.max(0, parseInt(r.total_days) - parseInt(r.present));
                const pctVal = parseFloat(r.percentage || 0);
                const initials = (r.student_name||"").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
                return (
                  <tr key={r.id}>
                    <td>
                      {r.photo_url
                        ? <img src={r.photo_url} alt="" style={{ width:32,height:32,borderRadius:"50%",objectFit:"cover" }}/>
                        : <div style={{ width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff" }}>{initials}</div>
                      }
                    </td>
                    <td style={{ fontWeight:600 }}>{r.student_name}</td>
                    {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                    <td className="text-muted">{r.batch_name||"&#8212;"}</td>
                    <td><span className="mono" style={{ fontWeight:600 }}>{r.total_days}</span></td>
                    <td style={{ color:"var(--green)",fontWeight:600 }}>{r.present}</td>
                    <td style={{ color: absent>0?"var(--red)":"var(--text3)", fontWeight: absent>0?700:400 }}>{absent}</td>
                    <td>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ flex:1,background:"rgba(148,163,184,0.12)",borderRadius:4,height:6,minWidth:60 }}>
                          <div style={{ width:`${Math.min(pctVal,100)}%`,background:pctColor(pctVal),height:"100%",borderRadius:4,transition:"width 0.4s ease" }}/>
                        </div>
                        <span style={{ color:pctColor(pctVal),fontWeight:700,minWidth:44,textAlign:"right" }}>{pctVal}%</span>
                      </div>
                    </td>
                    <td>
                      {pctVal < 75 && (
                        <button className="btn btn-secondary btn-sm" onClick={() => nudgeLowAttendance(r)} title="Nudge via WhatsApp" style={{ color:"#25D366" }}>
                          &#128172; Nudge
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20, flexWrap:"wrap", gap:10, padding:"0 10px" }}>
          <div style={{ fontSize:13, color:"var(--text3)" }}>Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} of <strong>{total}</strong></div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => load(page-1)} disabled={page===1}>← Prev</button>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{page}</span>
              <span style={{ fontSize:13, color:"var(--text3)" }}>/ {totalPages}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => load(page+1)} disabled={page===totalPages}>Next →</button>
          </div>
        </div>
      )}

      {/* ── Manual Entry Modal ───────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Manual Entry &#8212; {MONTHS[month-1]} {year}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&#10005;</button>
            </div>
            <div className="modal-body">
              {workingInfo && (
                <div style={{ marginBottom:12, padding:"8px 14px", background:"rgba(16,217,160,0.08)", border:"1px solid rgba(16,217,160,0.2)", borderRadius:8, fontSize:12, color:"var(--green)" }}>
                  {workingInfo.working_days} working days this month.
                </div>
              )}
              {bulkData.length === 0 ? (
                <div className="empty-state"><div className="empty-text">No students found</div></div>
              ) : (
                <div className="table-wrap"><table>
                  <thead>
                    <tr><th>Photo</th><th>Student</th><th>Total Days</th><th>Present</th><th>Absent</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {bulkData.map((r,i) => {
                      const absentVal = Math.max(0, parseInt(r.total_days||0) - parseInt(r.present||0));
                      const pctVal = r.total_days > 0 ? Math.round((r.present / r.total_days) * 100) : 0;
                      return (
                        <tr key={r.student_id}>
                          <td>
                            <div style={{ width:30,height:30,borderRadius:"50%",overflow:"hidden",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>
                              {r.photo_url ? <img src={r.photo_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/> : (r.student_name?.[0]?.toUpperCase()||"?")}
                            </div>
                          </td>
                          <td style={{ fontWeight:600 }}>{r.student_name}</td>
                          <td><input type="number" value={r.total_days} min="0" max="31" onChange={(e) => updateBulk(i,"total_days",parseInt(e.target.value)||0)} style={{ width:70 }}/></td>
                          <td><input type="number" value={r.present} min="0" max={r.total_days} onChange={(e) => updateBulk(i,"present",Math.min(parseInt(e.target.value)||0,r.total_days))} style={{ width:70 }}/></td>
                          <td style={{ color:absentVal>0?"var(--red)":"var(--text3)", fontWeight:absentVal>0?700:400 }}>{absentVal}</td>
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
              <button className="btn btn-primary" onClick={saveBulk} disabled={saving}>{saving?"Saving...":"Save Attendance"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
