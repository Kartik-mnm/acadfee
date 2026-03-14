import { useState, useEffect } from "react";
import API from "../api";

const EMPTY = { name: "", email: "", password: "", role: "branch_manager", branch_id: "" };

export default function Users() {
  const [users, setUsers]       = useState([]);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [visiblePass, setVisiblePass] = useState({});
  const [msg, setMsg]           = useState("");

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

  const del = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone!`)) return;
    try {
      await API.delete(`/auth/users/${u.id}`);
      setMsg("✅ User deleted successfully");
      load();
    } catch (e) { setMsg("⚠ " + (e.response?.data?.error || "Failed to delete")); }
    setTimeout(() => setMsg(""), 3000);
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 4) return;
    try {
      await API.patch(`/auth/users/${selectedUser.id}/password`, { password: newPassword });
      setMsg(`✅ Password updated for ${selectedUser.name}`);
      setShowPassModal(false); setNewPassword(""); load();
    } catch (e) { setMsg("⚠ Failed to update password"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const togglePass = (id) => setVisiblePass((p) => ({ ...p, [id]: !p[id] }));
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-sub">Manage logins for branch managers</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(""); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Password</th><th>Actions</th></tr>
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
                  <td>
                    {u.password_hint ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="mono" style={{ fontSize: 13, letterSpacing: ".05em" }}>
                          {visiblePass[u.id] ? u.password_hint : "••••••••"}
                        </span>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => togglePass(u.id)}
                          style={{ padding: "3px 8px", fontSize: 11 }}
                        >
                          {visiblePass[u.id] ? "🙈 Hide" : "👁 Show"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 12 }}>Not set</span>
                    )}
                  </td>
                  <td>
                    <div className="gap-row">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setSelectedUser(u); setNewPassword(""); setShowPassModal(true); }}
                      >
                        🔑 Reset
                      </button>
                      {u.role !== "super_admin" && (
                        <button className="btn btn-danger btn-sm" onClick={() => del(u)}>
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
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
                  <input type="text" value={form.password} onChange={(e) => f("password", e.target.value)} placeholder="Min 6 characters" />
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

      {/* Reset Password Modal */}
      {showPassModal && selectedUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPassModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">🔑 Reset Password</div>
              <button className="modal-close" onClick={() => setShowPassModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>{selectedUser.name}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{selectedUser.email}</div>
              </div>
              {selectedUser.password_hint && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(79,142,247,0.08)", borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--text2)" }}>Current Password: </span>
                  <strong style={{ color: "var(--accent)" }}>{selectedUser.password_hint}</strong>
                </div>
              )}
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPassModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={resetPassword}>✓ Update Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
