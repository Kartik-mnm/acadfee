import { useState, useEffect } from "react";
import API from "../api";

const EMPTY_USER   = { name: "", email: "", password: "", role: "branch_manager", branch_id: "" };
const EMPTY_BRANCH = { name: "", address: "", phone: "", roll_prefix: "" };

export default function Users() {
  const [users,    setUsers]    = useState([]);
  const [branches, setBranches] = useState([]);
  const [tab,      setTab]      = useState("users");

  const [showUserModal,   setShowUserModal]   = useState(false);
  const [showPassModal,   setShowPassModal]   = useState(false);
  const [selectedUser,    setSelectedUser]    = useState(null);
  const [newPassword,     setNewPassword]     = useState("");
  const [userForm,        setUserForm]        = useState(EMPTY_USER);
  const [savingUser,      setSavingUser]      = useState(false);
  const [userError,       setUserError]       = useState("");

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchForm,      setBranchForm]      = useState(EMPTY_BRANCH);
  const [editingBranch,   setEditingBranch]   = useState(null);
  const [savingBranch,    setSavingBranch]    = useState(false);
  const [branchError,     setBranchError]     = useState("");

  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = () => {
    API.get("/auth/users").then((r) => setUsers(r.data));
    API.get("/branches").then((r) => setBranches(r.data));
  };
  useEffect(load, []);

  // ── User actions ──────────────────────────────────────────────────────────
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

  // ── Branch actions ────────────────────────────────────────────────────────
  const openAddBranch  = ()  => {
    setBranchForm(EMPTY_BRANCH);
    setEditingBranch(null);
    setBranchError("");
    setShowBranchModal(true);
  };
  const openEditBranch = (b) => {
    setBranchForm({
      name:        b.name        || "",
      address:     b.address     || "",
      phone:       b.phone       || "",
      roll_prefix: b.roll_prefix || "",
    });
    setEditingBranch(b);
    setBranchError("");
    setShowBranchModal(true);
  };

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
    } catch (e) { flash("\u26a0 " + (e.response?.data?.error || "Cannot delete — branch may have students or batches linked.")); }
  };

  const f  = (k, v) => setUserForm((p)   => ({ ...p, [k]: v }));
  const bf = (k, v) => setBranchForm((p) => ({ ...p, [k]: v }));

  // Roll preview: combine academy prefix (not available here) + branch prefix
  const rollPreview = branchForm.roll_prefix
    ? `${branchForm.roll_prefix.toUpperCase()}0001`
    : null;

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

      <div className="gap-row" style={{ marginBottom: 20 }}>
        <button
          className={`btn ${tab === "users" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("users")}
        >
          {"\uD83D\uDC64"} Users ({users.length})
        </button>
        <button
          className={`btn ${tab === "branches" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("branches")}
        >
          {"\uD83C\uDFEB"} Branches ({branches.length})
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>
      )}

      {/* ── USERS TAB ──────────────────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="card">
          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{"\uD83D\uDC64"}</div>
              <div className="empty-text">No users yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Actions</th></tr>
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
                        <div className="gap-row">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSelectedUser(u); setNewPassword(""); setShowPassModal(true); }}
                          >
                            Reset Password
                          </button>
                          {u.role !== "super_admin" && (
                            <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>Delete</button>
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

      {/* ── BRANCHES TAB ───────────────────────────────────────────────────── */}
      {tab === "branches" && (
        <div className="card">
          {branches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{"\uD83C\uDFEB"}</div>
              <div className="empty-text">No branches yet</div>
              <div className="empty-sub">Add your first branch to get started.</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAddBranch}>+ Add First Branch</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th>Roll Prefix</th>
                    <th>Address</th>
                    <th>Phone</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{"\uD83C\uDFEB"} {b.name}</td>
                      <td>
                        {b.roll_prefix
                          ? <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, background: "var(--bg3)", padding: "2px 8px", borderRadius: 6, letterSpacing: 1 }}>{b.roll_prefix}</span>
                          : <span className="text-muted" style={{ fontSize: 12 }}>Not set</span>
                        }
                      </td>
                      <td className="text-muted">{b.address || "\u2014"}</td>
                      <td className="mono text-muted">{b.phone || "\u2014"}</td>
                      <td>
                        <div className="gap-row">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditBranch(b)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteBranch(b)}>Delete</button>
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

      {/* ── ADD/EDIT USER MODAL ──────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUserModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add New User</div>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>{"\u2715"}</button>
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
              {userError && <div className="error-msg" style={{ marginTop: 10 }}>{"\u26a0"} {userError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={savingUser}>
                {savingUser ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ─────────────────────────────────────────────── */}
      {showPassModal && selectedUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPassModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Reset Password</div>
              <button className="modal-close" onClick={() => setShowPassModal(false)}>{"\u2715"}</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>{selectedUser.name}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{selectedUser.email}</div>
              </div>
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
              <button className="btn btn-primary" onClick={resetPassword}>Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD/EDIT BRANCH MODAL ────────────────────────────────────────────── */}
      {showBranchModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBranchModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">{editingBranch ? "Edit Branch" : "+ Add New Branch"}</div>
              <button className="modal-close" onClick={() => setShowBranchModal(false)}>{"\u2715"}</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Branch Name *</label>
                  <input
                    value={branchForm.name}
                    onChange={(e) => bf("name", e.target.value)}
                    placeholder="e.g. Dattawadi Branch, Ravinagar Branch"
                    autoFocus
                  />
                </div>

                {/* Roll number prefix — the key new field */}
                <div className="form-group full">
                  <label>
                    Roll Number Prefix
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)", marginLeft: 6 }}>
                      (branch-level, max 4 letters)
                    </span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      value={branchForm.roll_prefix}
                      onChange={(e) => bf("roll_prefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 4))}
                      placeholder="e.g. DW"
                      maxLength={4}
                      style={{
                        width: 100,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        fontSize: 16,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                      }}
                    />
                    {rollPreview && (
                      <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
                        Students in this branch will get roll numbers like{" "}
                        <strong style={{ fontFamily: "monospace", color: "var(--cyan-300, #22d3ee)", fontSize: 13 }}>
                          {rollPreview}
                        </strong>
                        <br />
                        <span style={{ fontSize: 11 }}>(academy prefix + this prefix + serial)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group full">
                  <label>Address</label>
                  <input
                    value={branchForm.address}
                    onChange={(e) => bf("address", e.target.value)}
                    placeholder="Branch address (optional)"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    value={branchForm.phone}
                    onChange={(e) => bf("phone", e.target.value)}
                    placeholder="Branch contact number"
                  />
                </div>
              </div>
              {branchError && (
                <div className="error-msg" style={{ marginTop: 10 }}>{"\u26a0"} {branchError}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBranchModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBranch} disabled={savingBranch}>
                {savingBranch ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
