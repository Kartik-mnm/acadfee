import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const EMPTY = { name: "", subjects: "", fee_monthly: "", fee_quarterly: "", fee_yearly: "", fee_course: "", branch_id: "", start_date: "", end_date: "" };
const fmt     = (n) => n ? `₹${Number(n).toLocaleString("en-IN")}` : "₹0";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" }) : null;

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
}

function batchStatus(b) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (b.end_date && new Date(b.end_date) < today) return { label: "Ended", bg: "#3d0a0a", color: "#ff6e84" };
  if (b.start_date && new Date(b.start_date) > today) return { label: "Upcoming", bg: "#2d2200", color: "#fbbf24" };
  return { label: "Active", bg: "#003320", color: "#3fff8b" };
}

// Subject color cycles — matches image accent colors
const SUBJECT_COLORS = ["#9ba8ff", "#3fff8b", "#fbbf24", "#ff6e84", "#38bdf8", "#c084fc"];
function subjectColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[h];
}

// ── Mobile batch card — exact match to design image ───────────────────────────
function MobileBatchCard({ b, isSuperAdmin, onEdit, onDel }) {
  const st        = batchStatus(b);
  const startDate = fmtDate(b.start_date);
  const endDate   = fmtDate(b.end_date);
  const subjColor = subjectColor(b.subjects || b.name);
  const fee       = b.fee_monthly || b.fee_course || b.fee_yearly || 0;
  const initPay   = b.fee_quarterly || 0;

  return (
    <div style={{
      background: "#141b2d",
      borderRadius: 14,
      marginBottom: 14,
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* ── Top row: status badge + edit/del icons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 14px 0" }}>
        <span style={{
          background: st.bg, color: st.color,
          fontSize: 10, fontWeight: 800,
          padding: "4px 10px", borderRadius: 100,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>{st.label}</span>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Pencil icon */}
          <button onClick={() => onEdit(b)} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", lineHeight: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ba8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {/* Trash icon */}
          <button onClick={() => onDel(b.id)} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", lineHeight: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6e84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Batch name + subject ── */}
      <div style={{ padding: "10px 14px 14px" }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#e6ebfc", letterSpacing: "0.01em", marginBottom: 3, textTransform: "uppercase" }}>
          {b.name}
        </div>
        {b.subjects && (
          <div style={{ fontSize: 13, fontWeight: 600, color: subjColor, marginBottom: 14 }}>
            {b.subjects}
          </div>
        )}

        {/* ── Info rows ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {/* Branch */}
          {(isSuperAdmin || b.branch_name) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#8890a8" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8890a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Branch
              </span>
              <span style={{ color: "#c8cfdf", fontWeight: 600 }}>{b.branch_name || "—"}</span>
            </div>
          )}

          {/* Fee */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#8890a8" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8890a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Fee
            </span>
            <span style={{ color: "#c8cfdf", fontWeight: 700, fontFamily: "monospace" }}>{fmt(fee)}</span>
          </div>

          {/* Initial Payment */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#8890a8" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8890a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              Initial Payment
            </span>
            <span style={{ color: "#c8cfdf", fontWeight: 700, fontFamily: "monospace" }}>{fmt(initPay)}</span>
          </div>
        </div>

        {/* ── Date range footer ── */}
        {(startDate || endDate) && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#8890a8" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8890a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{startDate || "?"} – {endDate || "?"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Batches() {
  const { user }  = useAuth();
  const isMobile  = useIsMobile();
  const [batches,   setBatches]   = useState([]);
  const [branches,  setBranches]  = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const load = () => API.get("/batches").then((r) => setBatches(r.data));

  useEffect(() => {
    load();
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, []);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setError(""); setShowModal(true); };
  const openEdit = (b) => { setEditing(b.id); setForm({ ...b, start_date: b.start_date ? b.start_date.split("T")[0] : "", end_date: b.end_date ? b.end_date.split("T")[0] : "" }); setError(""); setShowModal(true); };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editing) await API.put(`/batches/${editing}`, form);
      else         await API.post("/batches", form);
      setShowModal(false); load();
    } catch (e) { setError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this batch?")) return;
    await API.delete(`/batches/${id}`); load();
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isSuperAdmin = user.role === "super_admin";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Batches & Courses</div>
          <div className="page-sub">Manage batches, fee structures and batch dates</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Batch</button>
      </div>

      {batches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <div className="empty-text">No batches yet</div>
        </div>
      ) : isMobile ? (
        /* ── MOBILE: cards ── */
        <div style={{ padding: "0 2px" }}>
          {batches.map((b) => (
            <MobileBatchCard key={b.id} b={b} isSuperAdmin={isSuperAdmin} onEdit={openEdit} onDel={del} />
          ))}
          {/* Add new batch card */}
          <div onClick={openAdd} style={{ background: "#141b2d", borderRadius: 14, padding: "22px 14px", marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, border: "2px dashed rgba(155,168,255,0.18)", cursor: "pointer" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ba8ff" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <div style={{ fontWeight: 700, color: "#e6ebfc", fontSize: 14 }}>Create New Batch</div>
            <div style={{ color: "#8890a8", fontSize: 12 }}>Set up fees and dates for new academic year</div>
          </div>
        </div>
      ) : (
        /* ── DESKTOP: table ── */
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch Name</th><th>Subjects</th>
                  {isSuperAdmin && <th>Branch</th>}
                  <th>Monthly</th><th>Yearly</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const st = batchStatus(b);
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.name}</td>
                      <td className="text-muted">{b.subjects || "—"}</td>
                      {isSuperAdmin && <td>{b.branch_name}</td>}
                      <td className="mono">{fmt(b.fee_monthly)}</td>
                      <td className="mono">{fmt(b.fee_yearly)}</td>
                      <td className="text-muted">{fmtDate(b.start_date) || "—"}</td>
                      <td className="text-muted">{fmtDate(b.end_date) || "—"}</td>
                      <td><span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>{st.label}</span></td>
                      <td>
                        <div className="gap-row">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(b)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(b.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? "Edit Batch" : "Add New Batch"}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Batch Name *</label>
                  <input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. JEE Mains – Morning" />
                </div>
                <div className="form-group full">
                  <label>Subjects</label>
                  <input value={form.subjects} onChange={(e) => f("subjects", e.target.value)} placeholder="Physics, Chemistry, Maths" />
                </div>
                {isSuperAdmin && (
                  <div className="form-group full">
                    <label>Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group"><label>Monthly Fee (₹)</label><input type="number" value={form.fee_monthly} onChange={(e) => f("fee_monthly", e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Quarterly Fee (₹)</label><input type="number" value={form.fee_quarterly} onChange={(e) => f("fee_quarterly", e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Yearly Fee (₹)</label><input type="number" value={form.fee_yearly} onChange={(e) => f("fee_yearly", e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Course / One-time Fee (₹)</label><input type="number" value={form.fee_course} onChange={(e) => f("fee_course", e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={(e) => f("start_date", e.target.value)} /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={(e) => f("end_date", e.target.value)} /></div>
              </div>
              {error && <div className="error-msg" style={{ marginTop: 12 }}>⚠ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Batch"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
