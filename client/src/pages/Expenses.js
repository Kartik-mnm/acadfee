import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EMPTY = { title: "", amount: "", category: "Other", expense_date: new Date().toISOString().split("T")[0], notes: "", branch_id: "" };

export default function Expenses() {
  const { user } = useAuth();
  const [expenses,   setExpenses]   = useState([]);
  const [summary,    setSummary]    = useState([]);
  const [branches,   setBranches]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = () => {
    const q = new URLSearchParams({ month, year });
    if (filterBranch) q.set("branch_id", filterBranch);
    API.get(`/expenses?${q}`).then((r) => setExpenses(r.data)).catch(() => {});
    API.get(`/expenses/summary?${q}`).then((r) => setSummary(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    API.get("/expenses/categories").then((r) => setCategories(r.data)).catch(() => {});
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
  }, [month, year, filterBranch]);

  const save = async () => {
    setSaveError("");
    // Validate required fields
    if (!form.title?.trim())  { setSaveError("Title is required"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setSaveError("Amount must be greater than 0"); return; }
    if (user.role === "super_admin" && !form.branch_id) { setSaveError("Please select a branch"); return; }

    setSaving(true);
    try {
      await API.post("/expenses", {
        ...form,
        branch_id: form.branch_id ? parseInt(form.branch_id) : undefined,
        amount: parseFloat(form.amount),
      });
      setShowModal(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      setSaveError(e.response?.data?.error || "Failed to save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await API.delete(`/expenses/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to delete expense");
    }
  };

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const catColors = { Rent: "badge-red", Salary: "badge-blue", Utilities: "badge-yellow", Stationery: "badge-green", Marketing: "badge-blue", Maintenance: "badge-yellow", Other: "badge-gray" };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Expenses</div>
          <div className="page-sub">Track branch-wise expenses</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setSaveError(""); setShowModal(true); }}>+ Add Expense</button>
      </div>

      <div className="filters-bar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {user.role === "super_admin" && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card red">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value red">{fmt(total)}</div>
        </div>
        {summary.slice(0, 3).map((s, i) => (
          <div key={i} className="stat-card yellow">
            <div className="stat-label">{s.category}</div>
            <div className="stat-value yellow">{fmt(s.total)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <div className="empty-text">No expenses for {MONTHS[month - 1]} {year}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  {user.role === "super_admin" && <th>Branch</th>}
                  <th>Category</th><th>Amount</th><th>Date</th><th>Notes</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.title || e.description || "—"}</td>
                    {user.role === "super_admin" && <td className="text-muted">{e.branch_name}</td>}
                    <td><span className={`badge ${catColors[e.category] || "badge-gray"}`}>{e.category}</span></td>
                    <td className="mono" style={{ color: "var(--red)", fontWeight: 700 }}>{fmt(e.amount)}</td>
                    <td className="text-muted">{new Date(e.expense_date).toLocaleDateString("en-IN")}</td>
                    <td className="text-muted">{e.notes || e.paid_to || "—"}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => del(e.id)}>Del</button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={user.role === "super_admin" ? 3 : 2} style={{ fontWeight: 800, textAlign: "right" }}>TOTAL</td>
                  <td className="mono" style={{ color: "var(--red)", fontWeight: 800 }}>{fmt(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Expense</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => f("title", e.target.value)}
                    placeholder="e.g. Monthly Rent"
                  />
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={(e) => f("amount", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => f("category", e.target.value)}>
                    {(categories.length ? categories : ["Rent","Salary","Utilities","Stationery","Marketing","Maintenance","Other"]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => f("expense_date", e.target.value)}
                  />
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
                <div className="form-group full">
                  <label>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => f("notes", e.target.value)}
                    placeholder="Optional details..."
                    rows={3}
                  />
                </div>
              </div>
              {saveError && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, fontSize: 13, color: "var(--red)", border: "1px solid var(--red)" }}>
                  ⚠ {saveError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
