import { useState, useEffect } from "react";
import API from "../api";

const EMPTY_USER   = { name: "", email: "", password: "", role: "branch_manager", branch_id: "" };
const EMPTY_BRANCH = { name: "", address: "", phone: "" };

export default function Users() {
  const [users,    setUsers]    = useState([]);
  const [branches, setBranches] = useState([]);
  const [tab,      setTab]      = useState("users"); // "users" | "branches"

  // User modal
  const [showUserModal,  setShowUserModal]  = useState(false);
  const [showPassModal,  setShowPassModal]  = useState(false);
  const [selectedUser,   setSelectedUser]   = useState(null);
  const [newPassword,    setNewPassword]    = useState("");
  const [userForm,       setUserForm]       = useState(EMPTY_USER);
  const [savingUser,     setSavingUser]     = useState(false);
  const [userError,      setUserError]      = useState("");

  // Branch modal
  const [showBranchModal,setShowBranchModal]= useState(false);
  const [branchForm,     setBranchForm]     = useState(EMPTY_BRANCH);
  const [editingBranch,  setEditingBranch]  = useState(null); // null = create, object = edit
  const [savingBranch,   setSavingBranch]   = useState(false);
  const [branchError,    setBranchError]    = useState("");

  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = () => {
    API.get("/auth/users").then((r) => setUsers(r.data));
    API.get("/branches").then((r) => setBranches(r.data));
  };
  useEffect(load, []);

  // ── User actions ────────────────────────────────────────────────────────────────
  const saveUser = async () => {
    setSavingUser(true); setUserError("");
    try {
      await API.post("/auth/users", userForm);
      setShowUserModal(false); setUserForm(EMPTY_USER); load();
      flash("\u2705 User created successfully");
    } catch (e) { setUserError(e.response?.data?.error || "Failed"); }
    finally { setSavingUser(false); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone!`)) return;
    try {
      await API.delete(`/auth/users/${u.id}`);
      flash("\u2705 User deleted"); load();
    } catch (e) { flash("\u26a0 " + (e.response?.data?.error || "Failed to delete")); }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 4) return;
    try {
      await API.patch(`/auth/users/${selectedUser.id}/password`, { password: newPassword });
      flash(`\u2705 Password updated for ${selectedUser.name}`);
      setShowPassModal(false); setNewPassword(""); load();
    } catch { flash("\u26a0 Failed to update password"); }
  };

  // ── Branch actions ─────────────────────────────────────────────────────────────
  const openAddBranch  = ()  => { setBranchForm(EMPTY_BRANCH); setEditingBranch(null); setBranchError(""); setShowBranchModal(true); };
  const openEditBranch = (b) => { setBranchForm({ name: b.name, address: b.address || "", phone: b.phone || "" }); setEditingBranch(b); setBranchError(""); setShowBranchModal(true); };

  const saveBranch = async () => {
    if (!branchForm.name.trim()) { setBranchError("Branch name is required"); return; }
    setSavingBranch(true); setBranchError("");
    try {
      if (editingBranch) {
        await API.put(`/branches/${editingBranch.id}`, branchForm);
        flash("\u2705 Branch updated");
      } else {
        await API.post("/branches", branchForm);
        flash("\u2705 Branch created");
      }
      setShowBranchModal(false); load();
    } catch (e) { setBranchError(e.response?.data?.error || "Failed to save branch"); }
    finally { setSavingBranch(false); }
  };

  const deleteBranch = async (b) => {
    if (!window.confirm(`Delete branch "${b.name}"?\nThis will fail if students or batches are linked to it.`)) return;
    try {
      await API.delete(`/branches/${b.id}`);
      flash("\u2705 Branch deleted"); load();
    } catch (e) { flash("\u26a0 " + (e.response?.data?.error || "Cannot delete branch — it may have students or batches linked.")); }
  };

  const f  = (k, v) => setUserForm((p)   => ({ ...p, [k]: v }));
  const bf = (k, v) => setBranchForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Manage</div>
          <div className="page-sub">Manage users and branches for your academy</div>
        </div>
        <div className="gap-row">
          {tab === "users" && (
            <button className="btn btn-primary" onClick={() => { setUserForm(EMPTY_USER); setUserError(""); setShowUserModal(true); }}>
              + Add User
            </button>
          )}
          {tab === "branches" && (
            <button className="btn btn-primary" onClick={openAddBranch}>
              + Add Branch
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="gap-row" style={{ marginBottom: 20 }}>
        <button className={`btn ${tab === "users" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("users")}>
          \uD83D\uDC64 Users ({users.length})
        </button>
        <button className={`btn ${tab === "branches" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("branches")}>
          \uD83C\uDFEB Branches ({branches.length})
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>
      )}

      {/* ── USERS TAB ─────────────────────────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="card">
          {users.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">\uD83D\uDC64</div><div className="empty-text">No users yet</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Actions</th></tr></thead>
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
                        <div className="gap-row">
                          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedUser(u); setNewPassword(""); setShowPassModal(true); }}>\uD83D\uDD11 Reset Password</button>
                          {u.role !== "super_admin" && (
                            <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>\uD83D\uDDD1 Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BRANCHES TAB ──────────────────────────────────────────────────────────── */}
      {tab === "branches" && (
        <div className="card">
          {branches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">\uD83C\uDFEB</div>
              <div className="empty-text">No branches yet</div>
              <div className="empty-sub">Add your first branch to get started. Each branch can have its own batches, students, and staff.</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAddBranch}>+ Add First Branch</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Branch Name</th><th>Address</th><th>Phone</th><th>Actions</th></tr></thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>\uD83C\uDFEB {b.name}</td>
                      <td className="text-muted">{b.address || "\u2014"}</td>
                      <td className="mono text-muted">{b.phone || "\u2014"}</td>
                      <td>
                        <div className="gap-row">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditBranch(b)}>\u270E Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteBranch(b)}>\uD83D\uDDD1 Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ADD/EDIT USER MODAL ──────────────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUserModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add New User</div>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>\u2715</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Full Name *</label>
                  <input value={userForm.name} onChange={(e) => f("name", e.target.value)} placeholder="User's name" />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={userForm.email} onChange={(e) => f("email", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input type="text" value={userForm.password} onChange={(e) => f("password", e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select value={userForm.role} onChange={(e) => f("role", e.target.value)}>
                    <option value="branch_manager">Branch Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                {userForm.role === "branch_manager" && (
                  <div className="form-group">
                    <label>Assign Branch *</label>
                    <select value={userForm.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {userError && <div className="error-msg" style={{ marginTop: 10 }}>\u26a0 {userError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={savingUser}>{savingUser ? "Creating\u2026" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ──────────────────────────────────────────────────────────── */}
      {showPassModal && selectedUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPassModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">\uD83D\uDD11 Reset Password</div>
              <button className="modal-close" onClick={() => setShowPassModal(false)}>\u2715</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>{selectedUser.name}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{selectedUser.email}</div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPassModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={resetPassword}>\u2713 Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD/EDIT BRANCH MODAL ───────────────────────────────────────────────────────── */}
      {showBranchModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBranchModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">{editingBranch ? "\u270E Edit Branch" : "+ Add New Branch"}</div>
              <button className="modal-close" onClick={() => setShowBranchModal(false)}>\u2715</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Branch Name *</label>
                  <input value={branchForm.name} onChange={(e) => bf("name", e.target.value)} placeholder="e.g. Main Branch, North Campus" autoFocus />
                </div>
                <div className="form-group full">
                  <label>Address</label>
                  <input value={branchForm.address} onChange={(e) => bf("address", e.target.value)} placeholder="Branch address (optional)" />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={branchForm.phone} onChange={(e) => bf("phone", e.target.value)} placeholder="Branch contact number" />
                </div>
              </div>
              {branchError && <div className="error-msg" style={{ marginTop: 10 }}>\u26a0 {branchError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBranchModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBranch} disabled={savingBranch}>{savingBranch ? "Saving\u2026" : editingBranch ? "Update Branch" : "Create Branch"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
