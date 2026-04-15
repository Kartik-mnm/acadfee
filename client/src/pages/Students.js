import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import StudentProfile from "./StudentProfile";

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
        const { data } = await API.post("/upload/platform", { image: base64 });
        setPreview(data.url);
        onChange(data.url);
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || "Upload failed";
        setUploadErr("\u26a0 Upload failed: " + msg);
        onChange(base64);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div
        onClick={() => !uploading && inputRef.current.click()}
        style={{
          width: 80, height: 80, borderRadius: "50%", cursor: uploading ? "wait" : "pointer",
          background: "linear-gradient(135deg,#3b82f6,#06b6d4)",
          border: "2px dashed rgba(99,143,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0, position: "relative",
        }}
      >
        {preview
          ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 28, color: "#fff" }}>\ud83d\udc64</span>}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 10, textAlign: "center", padding: 4,
          }}>Uploading...</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => inputRef.current.click()} disabled={uploading}>
            {uploading ? "Uploading..." : preview ? "Change Photo" : "Upload Photo"}
          </button>
          {preview && (
            <button type="button" className="btn btn-danger btn-sm"
              onClick={() => { setPreview(""); onChange(""); setUploadErr(""); }}
              disabled={uploading}>Remove</button>
          )}
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>JPG/PNG/WebP, max 5MB</div>
        {uploadErr && (
          <div style={{
            marginTop: 6, fontSize: 11, color: "var(--red)",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 6, padding: "5px 8px",
          }}>{uploadErr}</div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}

function Pagination({ page, totalPages, total, limit, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
      <div className="text-muted" style={{ fontSize: 13 }}>
        Showing {((page-1)*limit)+1}&ndash;{Math.min(page*limit, total)} of <strong>{total}</strong> students
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page-1)} disabled={page===1}>&larr; Prev</button>
        {pages.map((p, i) =>
          p === "..."
            ? <span key={i} className="text-muted" style={{ padding: "4px 8px" }}>...</span>
            : <button key={p} className={`btn btn-sm ${p===page ? "btn-primary" : "btn-secondary"}`} onClick={() => onPage(p)}>{p}</button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page+1)} disabled={page===totalPages}>Next &rarr;</button>
      </div>
    </div>
  );
}

function AvatarCircle({ photoUrl, name, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
      background: "linear-gradient(135deg,#3b82f6,#06b6d4)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4,
    }}>
      {photoUrl
        ? <img src={photoUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.38 }}>
            {name?.split(" ").map(w => w[0]).join("").substring(0,2).toUpperCase() || "\ud83d\udc64"}
          </span>}
    </div>
  );
}

// ── Luminescent-style mobile student card (matches zip design exactly) ────────────────
function StudentCardMobile({ s, i, page, LIMIT, user, onProfile, onEdit, onPortal, onDevices, onEmail, onDelete }) {
  const isActive = s.status === "active";
  return (
    <div style={{
      background: "#0d1321",
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    }}>
      {/* Inner card */}
      <div style={{ background: "#182030", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Top: avatar + name + status */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AvatarCircle photoUrl={s.photo_url} name={s.name} size={56} />
            <div>
              <div
                style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "#e6ebfc", cursor: "pointer" }}
                onClick={() => onProfile(s.id)}
              >{s.name}</div>
              <div style={{ fontSize: 12, color: "#a5abbb", marginTop: 2 }}>{s.email || s.phone || ""}</div>
            </div>
          </div>
          <span style={{
            background: isActive ? "#006d35" : "#a70138",
            color: isActive ? "#3fff8b" : "#ff6e84",
            fontSize: 10, fontWeight: 700, padding: "4px 12px",
            borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.05em",
            whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8,
          }}>{s.status || "active"}</span>
        </div>

        {/* Course + Branch rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>\ud83c\udf93</span>
            <span style={{ fontSize: 13, color: "#a5abbb" }}>
              Course: <span style={{ color: "#e6ebfc", fontWeight: 600 }}>{s.batch_name || "—"}</span>
            </span>
          </div>
          {user.role === "super_admin" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>\ud83d\udccd</span>
              <span style={{ fontSize: 13, color: "#a5abbb" }}>
                Branch: <span style={{ color: "#e6ebfc", fontWeight: 600 }}>{s.branch_name || "—"}</span>
              </span>
            </div>
          )}
        </div>

        {/* Action buttons row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
          paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)"
        }}>
          {[
            { label: "\u270f", title: "Edit", fn: () => onEdit(s), color: "#9ba8ff" },
            { label: "\u2139", title: "Profile", fn: () => onProfile(s.id), color: "#9ba8ff" },
            { label: "\ud83c\udf93", title: "Portal", fn: () => onPortal(s), color: "#3fff8b" },
            { label: "\ud83d���", title: "Email", fn: () => onEmail(s), color: "#3fff8b" },
            { label: "\ud83d\uddd1", title: "Delete", fn: () => onDelete(s.id), color: "#ff6e84" },
          ].map((btn) => (
            <button
              key={btn.title}
              title={btn.title}
              onClick={btn.fn}
              style={{
                background: "#1d2637",
                border: "none",
                borderRadius: "50%",
                width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "transform 0.15s",
                margin: "0 auto",
              }}
              onTouchStart={e => e.currentTarget.style.transform = "scale(0.88)"}
              onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
            >
              {btn.label}
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
    } catch (e) { setMsg("\u26a0 " + (e.response?.data?.error || "Failed to load")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const revokeSession = async (tokenId) => {
    if (!window.confirm("Remove this device? The student will be logged out on that device.")) return;
    try { await API.delete(`/auth/student-sessions/${tokenId}`); setMsg("\u2705 Device removed"); load(); }
    catch { setMsg("\u26a0 Failed to remove"); }
  };

  const revokeAll = async () => {
    if (!window.confirm(`Log out ${student.name} from ALL devices?`)) return;
    try { const { data } = await API.delete(`/auth/student-sessions-all/${student.id}`); setMsg(`\u2705 Revoked ${data.revoked} session(s)`); load(); }
    catch { setMsg("\u26a0 Failed"); }
  };

  const updateLimit = async () => {
    setSavingLimit(true);
    try { await API.patch(`/auth/student-device-limit/${student.id}`, { limit: parseInt(newLimit) }); setDeviceLimit(parseInt(newLimit)); setMsg(`\u2705 Limit updated to ${newLimit}`); }
    catch { setMsg("\u26a0 Failed to update limit"); }
    finally { setSavingLimit(false); setTimeout(() => setMsg(""), 3000); }
  };

  const fmtTime = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div className="modal-title">\ud83d\udcf1 Device Sessions &mdash; {student.name}</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ background: "var(--bg3)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Max Concurrent Logins</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="number" min="1" max="10" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} style={{ width: 80 }}/>
              <button className="btn btn-primary btn-sm" onClick={updateLimit} disabled={savingLimit}>{savingLimit ? "Saving..." : "Update"}</button>
              <span className="text-muted" style={{ fontSize: 12 }}>Currently: <strong>{deviceLimit}</strong></span>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Active Sessions ({sessions.length} / {deviceLimit})</div>
          {loading
            ? <div className="text-muted" style={{ fontSize: 13 }}>Loading...</div>
            : sessions.length === 0
              ? <div className="text-muted" style={{ fontSize: 13 }}>No active sessions</div>
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sessions.map((s, i) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Device {i+1}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>Logged in: {fmtTime(s.created_at)}</div>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => revokeSession(s.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
          {msg && <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, fontSize: 13 }}>{msg}</div>}
        </div>
        <div className="modal-footer">
          {sessions.length > 0 && <button className="btn btn-danger" onClick={revokeAll}>Logout All Devices</button>}
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
    const params = new URLSearchParams({ page: p, limit: LIMIT });
    if (q)      params.set("search",    q);
    if (branch) params.set("branch_id", branch);
    if (status) params.set("status",    status);
    API.get(`/students?${params}`)
      .then((r) => {
        const res = r.data;
        if (res && res.data) {
          setStudents(res.data); setPage(res.page);
          setTotalPages(res.totalPages); setTotal(res.total);
        } else {
          setStudents(Array.isArray(res) ? res : []);
          setTotal(Array.isArray(res) ? res.length : 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(1, "", filterBranch, filterStatus);
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch, filterStatus]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { load(1, val, filterBranch, filterStatus); }, 400);
  };

  const handlePage = (p) => load(p, search, filterBranch, filterStatus);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setError(""); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s.id);
    setForm({ ...s, dob: s.dob?.split("T")[0]||"", admission_date: s.admission_date?.split("T")[0]||"", photo_url: s.photo_url||"" });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editing) await API.put(`/students/${editing}`, form);
      else         await API.post("/students", form);
      setShowModal(false);
      load(page, search, filterBranch, filterStatus);
    } catch (e) { setError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    await API.delete(`/students/${id}`);
    load(page, search, filterBranch, filterStatus);
  };

  const filteredBatches = user.role === "super_admin" && form.branch_id
    ? batches.filter((b) => b.branch_id == form.branch_id)
    : user.role === "branch_manager" ? batches.filter((b) => b.branch_id == user.branch_id) : batches;

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const openPortal = (s) => { setPortalStudent(s); setPortalPassword(""); setPortalMsg(""); };

  const sendEmail = async (s) => {
    if (!s.email) { alert("This student has no email address!"); return; }
    if (!window.confirm(`Send fee summary email to ${s.name} at ${s.email}?`)) return;
    try { await API.post(`/students/${s.id}/send-email`); alert(`\u2705 Email sent to ${s.email}!`); }
    catch (e) { alert("\u26a0 Failed: " + (e.response?.data?.error || e.message)); }
  };

  const savePortal = async () => {
    if (!portalPassword || portalPassword.length < 4) { setPortalMsg("\u26a0 Password must be at least 4 characters"); return; }
    try {
      await API.post("/auth/set-student-password", { student_id: portalStudent.id, password: portalPassword });
      setPortalMsg("\u2705 Portal password set!"); setPortalPassword("");
    } catch (e) { setPortalMsg("\u26a0 Failed to set password"); }
  };

  if (profileId) return <StudentProfile studentId={profileId} onBack={() => setProfileId(null)} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Students</div>
          <div className="page-sub">{total} student(s) total</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Student</button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input className="search-input" placeholder="Search by name / phone / roll no / email..."
          value={search} onChange={(e) => handleSearch(e.target.value)} />
        {user.role === "super_admin" && (
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

      {loading ? (
        <div className="loading">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">\ud83d\udc64</div>
            <div className="empty-text">No students found</div>
            {search && <div className="empty-sub">Try a different search term</div>}
          </div>
        </div>
      ) : isMobile ? (
        // ── MOBILE: Luminescent card layout (matches zip design exactly) ──
        <div>
          {students.map((s, i) => (
            <StudentCardMobile
              key={s.id}
              s={s} i={i} page={page} LIMIT={LIMIT} user={user}
              onProfile={setProfileId}
              onEdit={openEdit}
              onPortal={openPortal}
              onDevices={setDevicesStudent}
              onEmail={sendEmail}
              onDelete={del}
            />
          ))}
          {/* Add new student CTA card */}
          <div
            onClick={openAdd}
            style={{
              background: "#0d1321", borderRadius: 16, marginBottom: 12,
              border: "2px dashed rgba(155,168,255,0.25)",
              padding: 24, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8,
              cursor: "pointer", color: "#a5abbb",
            }}
          >
            <span style={{ fontSize: 32 }}>\ud83d\udc64</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e6ebfc" }}>Add New Student</div>
            <div style={{ fontSize: 12, color: "#a5abbb" }}>Expand your academy</div>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPage={handlePage} />
        </div>
      ) : (
        // ── DESKTOP: original table layout ──
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Photo</th><th>Name</th><th>Batch</th>
                  {user.role === "super_admin" && <th>Branch</th>}
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
                    {user.role === "super_admin" && <td>{s.branch_name}</td>}
                    <td className="mono">{s.phone}</td>
                    <td><span className={`badge ${s.status==="active" ? "badge-green" : "badge-gray"}`}>{s.status}</span></td>
                    <td>
                      <div className="gap-row">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                        <button className="btn btn-success btn-sm" onClick={() => openPortal(s)} title="Portal Password">\ud83c\udf93</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDevicesStudent(s)} title="Device Sessions">\ud83d\udcf1</button>
                        <button className="btn btn-success btn-sm" onClick={() => sendEmail(s)} title="Send Email">\ud83d���</button>
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

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">{editing ? "Edit Student" : "Add New Student"}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Profile Photo</label>
                <PhotoUpload key={editing||"new"} value={form.photo_url} onChange={(url) => f("photo_url", url)} />
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
                {user.role === "super_admin" && (
                  <div className="form-group"><label>Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id",e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group"><label>Batch</label>
                  <select value={form.batch_id} onChange={(e) => f("batch_id",e.target.value)}>
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
              {error && <div className="error-msg" style={{ marginTop: 12 }}>\u26a0 {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Student" : "Add Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {portalStudent && (
        <div className="modal-overlay" onClick={(e) => e.target===e.currentTarget && setPortalStudent(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">\ud83c\udf93 Student Portal Access</div>
              <button className="modal-close" onClick={() => setPortalStudent(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>{portalStudent.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{portalStudent.email}</div>
              </div>
              <div className="form-group">
                <label>Portal Password</label>
                <input type="password" placeholder="Enter password for student"
                  value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} />
              </div>
              {portalMsg && <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, fontSize: 13 }}>{portalMsg}</div>}
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
