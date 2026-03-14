import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import StudentProfile from "./StudentProfile";

const EMPTY = {
  name: "", phone: "", parent_phone: "", email: "", address: "",
  dob: "", gender: "", admission_date: new Date().toISOString().split("T")[0],
  fee_type: "monthly", admission_fee: "", discount: "0", discount_reason: "", due_day: "10",
  batch_id: "", branch_id: "", status: "active"
};

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [portalStudent, setPortalStudent] = useState(null);
  const [portalPassword, setPortalPassword] = useState("");
  const [portalMsg, setPortalMsg] = useState("");

  const load = () => {
    const q = filterBranch ? `?branch_id=${filterBranch}` : "";
    API.get(`/students${q}`).then((r) => setStudents(r.data));
  };

  useEffect(() => {
    load();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setError(""); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s.id);
    setForm({ ...s, dob: s.dob?.split("T")[0] || "", admission_date: s.admission_date?.split("T")[0] || "" });
    setError(""); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editing) await API.put(`/students/${editing}`, form);
      else await API.post("/students", form);
      setShowModal(false); load();
    } catch (e) {
      setError(e.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    await API.delete(`/students/${id}`);
    load();
  };

  const filteredBatches = user.role === "super_admin" && form.branch_id
    ? batches.filter((b) => b.branch_id == form.branch_id)
    : user.role === "branch_manager" ? batches.filter((b) => b.branch_id == user.branch_id) : batches;

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    if (q && !s.name.toLowerCase().includes(q) && !s.phone?.includes(q)) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const openPortal = (s) => { setPortalStudent(s); setPortalPassword(""); setPortalMsg(""); };

  const sendEmail = async (s) => {
    if (!s.email) { alert("This student has no email address! Please add email first."); return; }
    if (!window.confirm(`Send fee summary email to ${s.name} at ${s.email}?`)) return;
    try {
      await API.post(`/students/${s.id}/send-email`);
      alert(`✅ Email sent successfully to ${s.email}!`);
    } catch (e) { alert("⚠ Failed to send email: " + (e.response?.data?.error || e.message)); }
  };
  const savePortal = async () => {
    if (!portalPassword || portalPassword.length < 4) { setPortalMsg("⚠ Password must be at least 4 characters"); return; }
    try {
      await API.post("/auth/set-student-password", { student_id: portalStudent.id, password: portalPassword });
      setPortalMsg("✅ Portal password set! Student can now login.");
      setPortalPassword("");
    } catch (e) { setPortalMsg("⚠ Failed to set password"); }
  };

  // Show profile page if a student is selected
  if (profileId) return <StudentProfile studentId={profileId} onBack={() => setProfileId(null)} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Students</div>
          <div className="page-sub">{filtered.length} student(s) found</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Student</button>
      </div>

      <div className="filters-bar">
        <input className="search-input" placeholder="Search by name / phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
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

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <div className="empty-text">No students found</div>
            <div className="empty-sub">Add a student to get started</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Batch</th>
                  {user.role === "super_admin" && <th>Branch</th>}
                  <th>Phone</th><th>Fee Type</th><th>Due Day</th><th>Discount</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <div
                        style={{ fontWeight: 600, color: "var(--accent)", cursor: "pointer" }}
                        onClick={() => setProfileId(s.id)}
                      >
                        {s.name}
                      </div>
                      <div className="text-muted text-sm">{s.email}</div>
                    </td>
                    <td>{s.batch_name || <span className="text-muted">—</span>}</td>
                    {user.role === "super_admin" && <td>{s.branch_name}</td>}
                    <td className="mono">{s.phone}</td>
                    <td><span className="badge badge-blue">{s.fee_type}</span></td>
                    <td><span className="badge badge-gray">📅 {s.due_day || 10}th</span></td>
                    <td>{s.discount > 0 ? <span className="badge badge-yellow">{s.discount}%</span> : "—"}</td>
                    <td>
                      <span className={`badge ${s.status === "active" ? "badge-green" : "badge-gray"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <div className="gap-row">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                        <button className="btn btn-success btn-sm" onClick={() => openPortal(s)} title="Set Student Portal Password">🎓</button>
                        <button className="btn btn-success btn-sm" onClick={() => sendEmail(s)} title="Send Fee Summary Email">📧</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(s.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">{editing ? "Edit Student" : "Add New Student"}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Full Name *</label>
                  <input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Student full name" />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="Student phone" />
                </div>
                <div className="form-group">
                  <label>Parent Phone</label>
                  <input value={form.parent_phone} onChange={(e) => f("parent_phone", e.target.value)} placeholder="Parent / guardian" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" value={form.dob} onChange={(e) => f("dob", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select value={form.gender} onChange={(e) => f("gender", e.target.value)}>
                    <option value="">Select</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Admission Date</label>
                  <input type="date" value={form.admission_date} onChange={(e) => f("admission_date", e.target.value)} />
                </div>

                {user.role === "super_admin" && (
                  <div className="form-group">
                    <label>Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Batch</label>
                  <select value={form.batch_id} onChange={(e) => f("batch_id", e.target.value)}>
                    <option value="">Select Batch</option>
                    {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fee Type</label>
                  <select value={form.fee_type} onChange={(e) => f("fee_type", e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="course">Per Course</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Admission Fee (₹)</label>
                  <input type="number" value={form.admission_fee} onChange={(e) => f("admission_fee", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Discount (%)</label>
                  <input type="number" min="0" max="100" value={form.discount} onChange={(e) => f("discount", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group full">
                  <label>Discount Reason</label>
                  <input value={form.discount_reason} onChange={(e) => f("discount_reason", e.target.value)} placeholder="e.g. Sibling discount, Merit scholarship" />
                </div>
                <div className="form-group">
                  <label>Fee Due Day (1–28) 📅</label>
                  <input type="number" min="1" max="28" value={form.due_day} onChange={(e) => f("due_day", e.target.value)} placeholder="10" />
                  <span style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>Day of month when fee is due (e.g. 5 = 5th of every month)</span>
                </div>
                <div className="form-group full">
                  <label>Address</label>
                  <textarea value={form.address} onChange={(e) => f("address", e.target.value)} />
                </div>
                {editing && (
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.status} onChange={(e) => f("status", e.target.value)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              {error && <div className="error-msg" style={{ marginTop: 12 }}>⚠ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : editing ? "Update Student" : "Add Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Portal Password Modal */}
      {portalStudent && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setPortalStudent(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">🎓 Student Portal Access</div>
              <button className="modal-close" onClick={() => setPortalStudent(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>{portalStudent.name}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{portalStudent.email}</div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
                Set a password so this student can login to the <strong>Student Portal</strong> and view their fees, attendance and test scores.
              </p>
              <div className="form-group">
                <label>Portal Password</label>
                <input
                  type="password" placeholder="Enter password for student"
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                />
              </div>
              {portalMsg && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, fontSize: 13 }}>
                  {portalMsg}
                </div>
              )}
              <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(79,142,247,0.08)", borderRadius: 8, fontSize: 12, color: "var(--text2)" }}>
                <strong>Student Login Details:</strong><br />
                Email: <span style={{ color: "var(--accent)" }}>{portalStudent.email}</span><br />
                Password: <span style={{ color: "var(--accent)" }}>{portalPassword || "••••••••"}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPortalStudent(null)}>Close</button>
              <button className="btn btn-primary" onClick={savePortal}>✓ Set Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
