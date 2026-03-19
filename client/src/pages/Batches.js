import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const EMPTY = { name: "", subjects: "", fee_monthly: "", fee_quarterly: "", fee_yearly: "", fee_course: "", branch_id: "", start_date: "", end_date: "" };
const fmt = (n) => n ? `₹${Number(n).toLocaleString("en-IN")}` : "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "—";

function batchStatus(b) {
  const today = new Date(); today.setHours(0,0,0,0);
  if (b.end_date && new Date(b.end_date) < today) return { label: "Ended", cls: "badge-red" };
  if (b.start_date && new Date(b.start_date) > today) return { label: "Upcoming", cls: "badge-yellow" };
  return { label: "Active", cls: "badge-green" };
}

export default function Batches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      else await API.post("/batches", form);
      setShowModal(false); load();
    } catch (e) { setError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this batch?")) return;
    await API.delete(`/batches/${id}`); load();
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Batches & Courses</div>
          <div className="page-sub">Manage batches, fee structures and batch dates</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Batch</button>
      </div>

      <div className="card">
        {batches.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📚</div><div className="empty-text">No batches yet</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch Name</th><th>Subjects</th>
                  {user.role === "super_admin" && <th>Branch</th>}
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
                      {user.role === "super_admin" && <td>{b.branch_name}</td>}
                      <td className="mono">{fmt(b.fee_monthly)}</td>
                      <td className="mono">{fmt(b.fee_yearly)}</td>
                      <td className="text-muted">{fmtDate(b.start_date)}</td>
                      <td className="text-muted">{fmtDate(b.end_date)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
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
        )}
      </div>

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
                {user.role === "super_admin" && (
                  <div className="form-group full">
                    <label>Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Monthly Fee (₹)</label>
                  <input type="number" value={form.fee_monthly} onChange={(e) => f("fee_monthly", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Quarterly Fee (₹)</label>
                  <input type="number" value={form.fee_quarterly} onChange={(e) => f("fee_quarterly", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Yearly Fee (₹)</label>
                  <input type="number" value={form.fee_yearly} onChange={(e) => f("fee_yearly", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Course / One-time Fee (₹)</label>
                  <input type="number" value={form.fee_course} onChange={(e) => f("fee_course", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Batch Start Date</label>
                  <input type="date" value={form.start_date} onChange={(e) => f("start_date", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Batch End Date</label>
                  <input type="date" value={form.end_date} onChange={(e) => f("end_date", e.target.value)} />
                </div>
                <div className="form-group full" style={{ background: "rgba(79,142,247,0.06)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>
                  💡 When end date passes, students of this batch will automatically show as <strong>inactive</strong> on their ID cards.
                </div>
              </div>
              {error && <div className="error-msg" style={{ marginTop: 12 }}>⚠ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : editing ? "Update" : "Add Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
