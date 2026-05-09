import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import StudentProfile from "./StudentProfile";
import { SkeletonTable, SkeletonBox } from "../components/Skeleton";

const EMPTY = {
  name: "", phone: "", parent_phone: "", email: "", address: "",
  dob: "", gender: "", admission_date: new Date().toISOString().split("T")[0],
  fee_type: "monthly", admission_fee: "", discount: "0", discount_reason: "",
  due_day: "10", batch_id: "", branch_id: "", status: "active", photo_url: ""
};

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
}

function PhotoUpload({ value, onChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState(value || "");
  const [uploadErr, setUploadErr] = useState("");

  useEffect(() => { setPreview(value || ""); }, [value]);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    setUploadErr("");
    setUploading(true);
    const reader = new FileReader();
    reader.onerror = () => { setUploadErr("Could not read file."); setUploading(false); };
    reader.onload = async (e) => {
      const base64 = e.target.result;
      setPreview(base64);
      try {
        const { data } = await API.post("/upload/photo", { image: base64 });
        setPreview(data.url);
        onChange(data.url);
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || "Upload failed";
        setUploadErr("⚠ Upload failed: " + msg);
        onChange(base64);
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display:"flex",alignItems:"flex-start",gap:14 }}>
      <div onClick={() => !uploading && inputRef.current.click()}
        style={{ width:80,height:80,borderRadius:"50%",cursor:uploading?"wait":"pointer",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",border:"2px dashed rgba(99,143,255,0.4)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,position:"relative" }}>
        {preview ? <img src={preview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : <span style={{ fontSize:28,color:"#fff" }}>👤</span>}
        {uploading && <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,textAlign:"center",padding:4 }}>Uploading...</div>}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()} disabled={uploading}>
            {uploading ? "Uploading..." : preview ? "Change Photo" : "Upload Photo"}
          </button>
          {preview && <button type="button" className="btn btn-danger btn-sm" onClick={() => { setPreview(""); onChange(""); setUploadErr(""); }} disabled={uploading}>Remove</button>}
        </div>
        <div className="text-muted" style={{ fontSize:11,marginTop:4 }}>JPG/PNG/WebP, max 5MB</div>
        {uploadErr && <div style={{ marginTop:6,fontSize:11,color:"var(--red)",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"5px 8px" }}>{uploadErr}</div>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display:"none" }} onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}

function Pagination({ page, totalPages, total, limit, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i===1||i===totalPages||Math.abs(i-page)<=2) pages.push(i);
    else if (pages[pages.length-1]!=="...") pages.push("...");
  }
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,flexWrap:"wrap",gap:8 }}>
      <div className="text-muted" style={{ fontSize:13 }}>Showing {((page-1)*limit)+1}–{Math.min(page*limit,total)} of <strong>{total}</strong></div>
      <div style={{ display:"flex",gap:6 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page-1)} disabled={page===1}>← Prev</button>
        {pages.map((p,i) => p==="..." ? <span key={i} className="text-muted" style={{ padding:"4px 8px" }}>...</span>
          : <button key={p} className={`btn btn-sm ${p===page?"btn-primary":"btn-secondary"}`} onClick={() => onPage(p)}>{p}</button>)}
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page+1)} disabled={page===totalPages}>Next →</button>
      </div>
    </div>
  );
}

function AvatarCircle({ photoUrl, name, size=36 }) {
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5 }}>
      {photoUrl ? <img src={photoUrl} alt={name} style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : <span style={{ color:"#fff" }}>👤</span>}
    </div>
  );
}

// ── Luminescent student card for mobile ──────────────────────────────────────
function MobileStudentCard({ s, idx, isSuperAdmin, onEdit, onProfile, onPortal, onDevices, onEmail, onDel }) {
  const isActive = s.status === "active";
  return (
    <div style={{
      background: "#0d1321",
      borderRadius: 16,
      padding: 2,
      marginBottom: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      overflow: "hidden",
    }}>
      <div style={{
        background: "#182030",
        borderRadius: 14,
        padding: "18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}>
        {/* Top row: avatar + name + status */}
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:56,height:56,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:"rgba(155,168,255,0.15)",border:"2px solid rgba(155,168,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#9ba8ff" }}>
              {s.photo_url
                ? <img src={s.photo_url} alt={s.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                : (s.name||" ")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily:"Manrope,sans-serif",fontWeight:700,fontSize:16,color:"#e6ebfc",cursor:"pointer" }} onClick={() => onProfile(s.id)}>{s.name}</div>
              <div style={{ fontSize:12,color:"#a5abbb",marginTop:1 }}>{s.email || s.phone || "—"}</div>
            </div>
          </div>
          <span style={{
            background: isActive ? "#006d35" : "#a70138",
            color: isActive ? "#3fff8b" : "#ff6e84",
            fontSize: 10, fontWeight: 700, padding: "4px 10px",
            borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.05em",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{s.status}</span>
        </div>

        {/* Meta rows */}
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14,paddingLeft:4 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:13 }}>
            <span style={{ fontSize:16 }}>🎓</span>
            <span style={{ color:"#a5abbb",fontWeight:600 }}>Course: </span>
            <span style={{ color:"#e6ebfc" }}>{s.batch_name || "—"}</span>
          </div>
          {isSuperAdmin && (
            <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:13 }}>
              <span style={{ fontSize:16 }}>📍</span>
              <span style={{ color:"#a5abbb",fontWeight:600 }}>Branch: </span>
              <span style={{ color:"#e6ebfc" }}>{s.branch_name || "—"}</span>
            </div>
          )}
          {s.phone && (
            <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:13 }}>
              <span style={{ fontSize:16 }}>📞</span>
              <span style={{ color:"#a5abbb",fontWeight:600 }}>Phone: </span>
              <span style={{ color:"#e6ebfc",fontFamily:"monospace" }}>{s.phone}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          {[
            { icon:"✏️", label:"Edit",    action:() => onEdit(s) },
            { icon:"ℹ️", label:"Info",    action:() => onProfile(s.id) },
            { icon:"🎓", label:"Portal",  action:() => onPortal(s) },
            { icon:"📱", label:"Devices", action:() => onDevices(s) },
            { icon:"🗑️", label:"Delete",  action:() => onDel(s.id) },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.action}
              style={{ padding:"8px 4px",borderRadius:12,background:"#1d2637",border:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer",WebkitTapHighlightColor:"transparent",transition:"all 0.15s" }}
              title={btn.label}>
              <span style={{ fontSize:18,lineHeight:1 }}>{btn.icon}</span>
              <span style={{ fontSize:9,color:"#a5abbb",fontWeight:600 }}>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeviceSessionsModal({ student, onClose }) {
  const [sessions,    setSessions]    = useState([]);
  const [deviceLimit, setDeviceLimit] = useState(2);
  const [newLimit,    setNewLimit]    = useState(2);
  const [loading,     setLoading]     = useState(true);
  const [savingLimit, setSavingLimit] = useState(false);
  const [msg,         setMsg]         = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/auth/student-sessions/${student.id}`);
      setSessions(data.sessions); setDeviceLimit(data.device_limit); setNewLimit(data.device_limit);
    } catch (e) { setMsg("⚠ " + (e.response?.data?.error || "Failed to load")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const revokeSession = async (tokenId) => {
    if (!window.confirm("Remove this device?")) return;
    try { await API.delete(`/auth/student-sessions/${tokenId}`); setMsg("✅ Device removed"); load(); }
    catch { setMsg("⚠ Failed to remove"); }
  };

  const revokeAll = async () => {
    if (!window.confirm(`Log out ${student.name} from ALL devices?`)) return;
    try { const { data } = await API.delete(`/auth/student-sessions-all/${student.id}`); setMsg(`✅ Revoked ${data.revoked} session(s)`); load(); }
    catch { setMsg("⚠ Failed"); }
  };

  const updateLimit = async () => {
    setSavingLimit(true);
    try { await API.patch(`/auth/student-device-limit/${student.id}`,{ limit:parseInt(newLimit) }); setDeviceLimit(parseInt(newLimit)); setMsg(`✅ Limit updated to ${newLimit}`); }
    catch { setMsg("⚠ Failed to update limit"); }
    finally { setSavingLimit(false); setTimeout(() => setMsg(""),3000); }
  };

  const fmtTime = (d) => new Date(d).toLocaleString("en-IN",{ dateStyle:"medium",timeStyle:"short" });

  return (
    <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <div className="modal-title">📱 Device Sessions — {student.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background:"var(--bg3)",borderRadius:10,padding:"14px 16px",marginBottom:16 }}>
            <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>Max Concurrent Logins</div>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <input type="number" min="1" max="10" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} style={{ width:80 }}/>
              <button className="btn btn-primary btn-sm" onClick={updateLimit} disabled={savingLimit}>{savingLimit?"Saving...":"Update"}</button>
              <span className="text-muted" style={{ fontSize:12 }}>Currently: <strong>{deviceLimit}</strong></span>
            </div>
          </div>
          <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>Active Sessions ({sessions.length} / {deviceLimit})</div>
          {loading ? <div className="text-muted" style={{ fontSize:13 }}>Loading...</div>
            : sessions.length===0 ? <div className="text-muted" style={{ fontSize:13 }}>No active sessions</div>
            : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {sessions.map((s,i) => (
                  <div key={s.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--bg3)",borderRadius:8,border:"1px solid var(--border)" }}>
                    <div><div style={{ fontWeight:600,fontSize:13 }}>Device {i+1}</div><div className="text-muted" style={{ fontSize:11 }}>Logged in: {fmtTime(s.created_at)}</div></div>
                    <button className="btn btn-danger btn-sm" onClick={() => revokeSession(s.id)}>Remove</button>
                  </div>
                ))}
              </div>}
          {msg && <div style={{ marginTop:12,padding:"8px 12px",background:"var(--bg3)",borderRadius:6,fontSize:13 }}>{msg}</div>}
        </div>
        <div className="modal-footer">
          {sessions.length>0 && <button className="btn btn-danger" onClick={revokeAll}>Logout All Devices</button>}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Students() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [students,       setStudents]       = useState([]);
  const [batches,        setBatches]        = useState([]);
  const [branches,       setBranches]       = useState([]);
  const [search,         setSearch]         = useState("");
  const [filterBranch,   setFilterBranch]   = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [showModal,      setShowModal]      = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [form,           setForm]           = useState(EMPTY);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [profileId,      setProfileId]      = useState(null);
  const [portalStudent,  setPortalStudent]  = useState(null);
  const [portalPassword, setPortalPassword] = useState("");
  const [portalMsg,      setPortalMsg]      = useState("");
  const [devicesStudent, setDevicesStudent] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [total,          setTotal]          = useState(0);
  const LIMIT = 20;
  const searchTimer = useRef(null);

  const load = useCallback((p=1, q="", branch="", status="") => {
    setLoading(true);
    const params = new URLSearchParams({ page:p, limit:LIMIT });
    if (q)      params.set("search",q);
    if (branch) params.set("branch_id",branch);
    if (status) params.set("status",status);
    API.get(`/students?${params}`)
      .then((r) => {
        const res = r.data;
        if (res && res.data) { setStudents(res.data); setPage(res.page); setTotalPages(res.totalPages); setTotal(res.total); }
        else { setStudents(Array.isArray(res)?res:[]); setTotal(Array.isArray(res)?res.length:0); }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(1,"",filterBranch,filterStatus);
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role==="super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch, filterStatus]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { load(1,val,filterBranch,filterStatus); }, 400);
  };

  const handlePage = (p) => load(p,search,filterBranch,filterStatus);
  const openAdd  = () => { setEditing(null); setForm(EMPTY); setError(""); setShowModal(true); };
  const openEdit = (s) => { setEditing(s.id); setForm({ ...s, dob:s.dob?.split("T")[0]||"", admission_date:s.admission_date?.split("T")[0]||"", photo_url:s.photo_url||"" }); setError(""); setShowModal(true); };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editing) await API.put(`/students/${editing}`,form);
      else         await API.post("/students",form);
      setShowModal(false);
      load(page,search,filterBranch,filterStatus);
    } catch (e) { setError(e.response?.data?.error||"Save failed"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    await API.delete(`/students/${id}`);
    load(page,search,filterBranch,filterStatus);
  };

  const filteredBatches = user.role==="super_admin" && form.branch_id
    ? batches.filter((b) => b.branch_id==form.branch_id)
    : user.role==="branch_manager" ? batches.filter((b) => b.branch_id==user.branch_id) : batches;

  const f = (k,v) => setForm((p) => ({ ...p, [k]:v }));

  const handleBatchChange = (batchId) => {
    f("batch_id", batchId);
    if (!batchId) return;

    const selectedBatch = batches.find(b => b.id == batchId);
    if (selectedBatch) {
      // If the batch has a per-course fee, auto-fill admission_fee and set type to course
      if (selectedBatch.fee_course > 0) {
        setForm(prev => ({
          ...prev,
          batch_id: batchId,
          admission_fee: selectedBatch.fee_course,
          fee_type: "course"
        }));
      } else if (selectedBatch.fee_monthly > 0) {
        // If it's a monthly batch, we can still set it to monthly just in case
        f("fee_type", "monthly");
      }
    }
  };

  const openPortal = (s) => { setPortalStudent(s); setPortalPassword(""); setPortalMsg(""); };

  const sendEmail = async (s) => {
    if (!s.email) { alert("This student has no email address!"); return; }
    if (!window.confirm(`Send fee summary email to ${s.name} at ${s.email}?`)) return;
    try { await API.post(`/students/${s.id}/send-email`); alert(`✅ Email sent to ${s.email}!`); }
    catch (e) { alert("⚠ Failed: "+(e.response?.data?.error||e.message)); }
  };

  const savePortal = async () => {
    if (!portalPassword||portalPassword.length<4) { setPortalMsg("⚠ Password must be at least 4 characters"); return; }
    try { await API.post("/auth/set-student-password",{ student_id:portalStudent.id, password:portalPassword }); setPortalMsg("✅ Portal password set!"); setPortalPassword(""); }
    catch (e) { setPortalMsg("⚠ Failed to set password"); }
  };

  if (profileId) return <StudentProfile studentId={profileId} onBack={() => setProfileId(null)} />;

  const isSuperAdmin = user.role === "super_admin";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Students</div>
          <div className="page-sub">{total} student(s) total</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Student</button>
      </div>

      {/* ── Filter bar ── */}
      <div className="filters-bar">
        <input className="search-input" placeholder="Search by name / phone / roll no / email..."
          value={search} onChange={(e) => handleSearch(e.target.value)} />
        {isSuperAdmin && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        isMobile ? (
          <div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ background: "var(--bg3)", borderRadius: 16, padding: "20px 16px", marginBottom: 12, border: "1px solid var(--border2)" }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <SkeletonBox width="56px" height="56px" borderRadius="50%" />
                  <div style={{ flex: 1 }}>
                    <SkeletonBox width="140px" height="16px" marginBottom="8px" />
                    <SkeletonBox width="100px" height="12px" />
                  </div>
                </div>
                <SkeletonBox width="100%" height="12px" marginBottom="8px" />
                <SkeletonBox width="80%" height="12px" marginBottom="14px" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(j => <SkeletonBox key={j} width="100%" height="32px" borderRadius="12px" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SkeletonTable rows={10} />
        )
      ) : students.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-text">No students found</div>
          {search && <div className="empty-sub">Try a different search term</div>}
        </div>
      ) : isMobile ? (
        // ── MOBILE: Luminescent card layout ──────────────────────────────
        <div>
          {students.map((s, i) => (
            <MobileStudentCard
              key={s.id}
              s={s}
              idx={((page-1)*LIMIT)+i+1}
              isSuperAdmin={isSuperAdmin}
              onEdit={openEdit}
              onProfile={(id) => setProfileId(id)}
              onPortal={openPortal}
              onDevices={(st) => setDevicesStudent(st)}
              onEmail={sendEmail}
              onDel={del}
            />
          ))}
          {/* Add student card at the bottom */}
          <div onClick={openAdd}
            style={{ background:"#0d1321",borderRadius:16,padding:2,marginBottom:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",overflow:"hidden",cursor:"pointer" }}>
            <div style={{ background:"#182030",borderRadius:14,padding:"24px 16px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,border:"2px dashed rgba(155,168,255,0.2)" }}>
              <span style={{ fontSize:32,color:"#9ba8ff" }}>+</span>
              <div style={{ fontWeight:700,color:"#e6ebfc",fontSize:14 }}>Add New Student</div>
              <div style={{ fontSize:12,color:"#a5abbb" }}>Expand your academy</div>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={handlePage} />
        </div>
      ) : (
        // ── DESKTOP: table layout ─────────────────────────────────────────
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Photo</th><th>Name</th><th>Batch</th>
                  {isSuperAdmin && <th>Branch</th>}
                  <th>Phone</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted">{((page-1)*LIMIT)+i+1}</td>
                    <td><AvatarCircle photoUrl={s.photo_url} name={s.name} size={36} /></td>
                    <td>
                      <div className="student-link" onClick={() => setProfileId(s.id)}>{s.name}</div>
                      <div className="text-muted text-sm">{s.email}</div>
                    </td>
                    <td>{s.batch_name || <span className="text-muted">--</span>}</td>
                    {isSuperAdmin && <td>{s.branch_name}</td>}
                    <td className="mono">{s.phone}</td>
                    <td><span className={`badge ${s.status==="active"?"badge-green":"badge-gray"}`}>{s.status}</span></td>
                    <td>
                      <div className="gap-row">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                        <button className="btn btn-success btn-sm" onClick={() => openPortal(s)} title="Portal Password">🎓</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDevicesStudent(s)} title="Device Sessions">📱</button>
                        <button className="btn btn-success btn-sm" onClick={() => sendEmail(s)} title="Send Email">📧</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(s.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={handlePage} />
        </div>
      )}

      {/* ── Add/Edit modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">{editing?"Edit Student":"Add New Student"}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom:20 }}>
                <label>Profile Photo</label>
                <PhotoUpload key={editing||"new"} value={form.photo_url} onChange={(url) => f("photo_url",url)} />
              </div>
              <div className="form-grid">
                <div className="form-group full"><label>Full Name *</label><input value={form.name} onChange={(e) => f("name",e.target.value)} placeholder="Student full name" /></div>
                <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => f("phone",e.target.value)} /></div>
                <div className="form-group"><label>Parent Phone</label><input value={form.parent_phone} onChange={(e) => f("parent_phone",e.target.value)} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => f("email",e.target.value)} /></div>
                <div className="form-group"><label>Date of Birth</label><input type="date" value={form.dob} onChange={(e) => f("dob",e.target.value)} /></div>
                <div className="form-group"><label>Gender</label>
                  <select value={form.gender} onChange={(e) => f("gender",e.target.value)}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div className="form-group"><label>Admission Date</label><input type="date" value={form.admission_date} onChange={(e) => f("admission_date",e.target.value)} /></div>
                {isSuperAdmin && (
                  <div className="form-group"><label>Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id",e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group"><label>Batch</label>
                  <select value={form.batch_id} onChange={(e) => handleBatchChange(e.target.value)}>
                    <option value="">Select Batch</option>
                    {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Fee Type</label>
                  <select value={form.fee_type} onChange={(e) => f("fee_type",e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="course">Per Course</option>
                  </select>
                </div>
                <div className="form-group"><label>Admission Fee (Rs.)</label><input type="number" value={form.admission_fee} onChange={(e) => f("admission_fee",e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Discount (%)</label><input type="number" min="0" max="100" value={form.discount} onChange={(e) => f("discount",e.target.value)} placeholder="0" /></div>
                <div className="form-group full"><label>Discount Reason</label><input value={form.discount_reason} onChange={(e) => f("discount_reason",e.target.value)} placeholder="e.g. Sibling discount" /></div>
                <div className="form-group"><label>Fee Due Day (1-28)</label><input type="number" min="1" max="28" value={form.due_day} onChange={(e) => f("due_day",e.target.value)} placeholder="10" /></div>
                <div className="form-group full"><label>Address</label><textarea value={form.address} onChange={(e) => f("address",e.target.value)} /></div>
                {editing && (
                  <div className="form-group"><label>Status</label>
                    <select value={form.status} onChange={(e) => f("status",e.target.value)}>
                      <option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              {error && <div className="error-msg" style={{ marginTop:12 }}>⚠ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Saving...":editing?"Update Student":"Add Student"}</button>
            </div>
          </div>
        </div>
      )}

      {portalStudent && (
        <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget && setPortalStudent(null)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <div className="modal-title">🎓 Student Portal Access</div>
              <button className="modal-close" onClick={() => setPortalStudent(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom:16,padding:"10px 14px",background:"var(--bg3)",borderRadius:8 }}>
                <div style={{ fontWeight:700 }}>{portalStudent.name}</div>
                <div className="text-muted" style={{ fontSize:12 }}>{portalStudent.email}</div>
              </div>
              <div className="form-group">
                <label>Portal Password</label>
                <input type="password" placeholder="Enter password for student" value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} />
              </div>
              {portalMsg && <div style={{ marginTop:10,padding:"8px 12px",background:"var(--bg3)",borderRadius:6,fontSize:13 }}>{portalMsg}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPortalStudent(null)}>Close</button>
              <button className="btn btn-primary" onClick={savePortal}>Set Password</button>
            </div>
          </div>
        </div>
      )}

      {devicesStudent && <DeviceSessionsModal student={devicesStudent} onClose={() => setDevicesStudent(null)} />}
    </div>
  );
}
