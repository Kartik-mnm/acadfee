import { useState, useEffect } from "react";
import API from "../api";

const EMPTY = { name: "", email: "", password: "", role: "branch_manager", branch_id: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    API.get("/auth/users").then((r) => setUsers(r.data));
    API.get("/branches").then((r) => setBranches(r.data));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setError("");
    try {
      await API.post("/auth/users", form);
      setShowModal(false); setForm(EMPTY); load();
    } catch (e) { setError(e.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-sub">Manage logins for branch managers and admins</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(""); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td className="mono text-muted">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "super_admin" ? "badge-red" : "badge-blue"}`}>
                      {u.role === "super_admin" ? "Super Admin" : "Branch Manager"}
                    </span>
                  </td>
                  <td>{u.branch_name || <span className="text-muted">All Branches</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add New User</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Full Name *</label>
                  <input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="User's name" />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input type="password" value={form.password} onChange={(e) => f("password", e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select value={form.role} onChange={(e) => f("role", e.target.value)}>
                    <option value="branch_manager">Branch Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                {form.role === "branch_manager" && (
                  <div className="form-group">
                    <label>Assign Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {error && <div className="error-msg" style={{ marginTop: 10 }}>⚠ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
