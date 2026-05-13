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
  const [filterCategory, setFilterCategory] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [page,      setPage]      = useState(1);
  const [totalPages,setTotalPages]   = useState(1);
  const [totalRecs, setTotalRecs]    = useState(0);
  const LIMIT = 20;
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const load = (p = 1) => {
    const q = new URLSearchParams({ month, year, page: p, limit: LIMIT });
    if (filterBranch) q.set("branch_id", filterBranch);
    if (filterCategory) q.set("category", filterCategory);
    API.get(`/expenses?${q}`).then((r) => {
      if (r.data.data) {
        setExpenses(r.data.data);
        setPage(r.data.page);
        setTotalPages(r.data.totalPages);
        setTotalRecs(r.data.total);
      } else {
        setExpenses(r.data);
        setTotalRecs(r.data.length);
      }
    }).catch(() => {});
    API.get(`/expenses/summary?month=${month}&year=${year}${filterBranch ? `&branch_id=${filterBranch}` : ""}${filterCategory ? `&category=${filterCategory}` : ""}`).then((r) => setSummary(r.data)).catch(() => {});
  };

  useEffect(() => {
    load(1);
    API.get("/expenses/categories").then((r) => setCategories(r.data)).catch(() => {});
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
  }, [month, year, filterBranch, filterCategory]);

  const save = async () => {
    setSaveError("");
    // Validate required fields
    if (!form.title?.trim())  { setSaveError("Title is required"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setSaveError("Amount must be greater than 0"); return; }
    if (user.role === "super_admin" && !form.branch_id) { setSaveError("Please select a branch"); return; }

    setSaving(true);
    try {
      if (form.id) {
        await API.put(`/expenses/${form.id}`, {
          ...form,
          branch_id: form.branch_id ? parseInt(form.branch_id) : undefined,
          amount: parseFloat(form.amount),
        });
      } else {
        await API.post("/expenses", {
          ...form,
          branch_id: form.branch_id ? parseInt(form.branch_id) : undefined,
          amount: parseFloat(form.amount),
        });
      }
      setShowModal(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      setSaveError(e.response?.data?.error || "Failed to save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const edit = (e) => {
    setForm({
      id: e.id,
      title: e.title || "",
      amount: e.amount,
      category: e.category,
      expense_date: new Date(e.expense_date).toISOString().split("T")[0],
      notes: e.notes || "",
      branch_id: e.branch_id || ""
    });
    setSaveError("");
    setShowModal(true);
  };

  const catColors = { Rent: "badge-red", Salary: "badge-blue", Utilities: "badge-yellow", Stationery: "badge-green", Marketing: "badge-blue", Maintenance: "badge-yellow", Other: "badge-gray" };

  if (isMobile) {
    return (
      <div style={{ backgroundColor: 'var(--bg1)', minHeight: '100vh', color: 'var(--text1)', paddingBottom: 100, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* HEADER */}
        <div style={{ padding: '24px 20px 10px 20px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: 'var(--text1)' }}>Expenses</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>Track branch-wise expenses</p>
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* ADD BUTTON */}
          <button 
            onClick={() => { setForm(EMPTY); setSaveError(""); setShowModal(true); }}
            style={{ 
              width: '100%', padding: '16px', borderRadius: 16, backgroundColor: 'rgba(141, 156, 255, 0.8)', color: '#fff', 
              border: 'none', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 8px 24px rgba(141, 156, 255, 0.2)', marginBottom: 24, cursor: 'pointer'
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#2d3748', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            + Add Expense
          </button>

          {/* FILTERS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text2)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Month</label>
              <div style={{ position: 'relative' }}>
                <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg2)', color: 'var(--text1)', border: 'none', borderRadius: 12, padding: '12px 14px', appearance: 'none', fontSize: 14, outline: 'none' }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text2)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Year</label>
              <div style={{ position: 'relative' }}>
                <select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg2)', color: 'var(--text1)', border: 'none', borderRadius: 12, padding: '12px 14px', appearance: 'none', fontSize: 14, outline: 'none' }}>
                  {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text2)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Branch</label>
              <div style={{ position: 'relative' }}>
                <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg2)', color: 'var(--text1)', border: 'none', borderRadius: 12, padding: '12px 14px', appearance: 'none', fontSize: 14, outline: 'none' }}>
                  <option value="">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text2)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Category</label>
              <div style={{ position: 'relative' }}>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg2)', color: 'var(--text1)', border: 'none', borderRadius: 12, padding: '12px 14px', appearance: 'none', fontSize: 14, outline: 'none' }}>
                  <option value="">All Categories</option>
                  {(categories.length ? categories : ["Rent","Salary","Utilities","Stationery","Marketing","Maintenance","Other"]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>

          {/* SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <div style={{ backgroundColor: '#1b2234', borderRadius: 20, padding: '20px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#7c8b9d', textTransform: 'uppercase', marginBottom: 12 }}>Total Expenses</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{fmt(total)}</div>
            </div>
            {summary.slice(0, 1).map((s, i) => (
              <div key={i} style={{ backgroundColor: '#1b2234', borderRadius: 20, padding: '20px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#7c8b9d', textTransform: 'uppercase', marginBottom: 12 }}>{s.category}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308' }}>{fmt(s.total)}</div>
              </div>
            ))}
          </div>

          {/* EXPENSE CARDS LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {expenses.length === 0 ? (
               <div style={{ textAlign: 'center', color: '#7c8b9d', padding: '40px 0' }}>No records found</div>
            ) : expenses.map((e) => (
              <div key={e.id} style={{ backgroundColor: '#1b2234', borderRadius: 24, padding: '20px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#eab308' }}></div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' }}>{e.category}</h3>
                   </div>
                   <button onClick={() => del(e.id)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                   </button>
                </div>
                <div style={{ fontSize: 13, color: '#a0aec0', marginBottom: 20, paddingLeft: 16 }}>{e.branch_name || 'main branch'}</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 10px', borderRadius: 6, textTransform: 'uppercase' }}>{e.title || e.category}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#a0aec0', fontSize: 12 }}>
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                         {new Date(e.expense_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                   </div>
                   <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{fmt(e.amount)}</div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 20, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 11, fontWeight: 800, color: '#7c8b9d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Total</span>
                   <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{fmt(e.amount)}.00</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MODAL IS SHARED LOGIC BUT THEMED */}
        {showModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)} style={{ zIndex: 2000 }}>
            <div className="modal" style={{ marginBottom: 90 }}>
              <div className="modal-header">
                <div className="modal-title">{form.id ? 'Edit' : 'Add'} Expense</div>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Title *</label>
                    <input value={form.title} onChange={(e) => f("title", e.target.value)} placeholder="e.g. Monthly Rent" />
                  </div>
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input type="number" min="1" value={form.amount} onChange={(e) => f("amount", e.target.value)} placeholder="0" />
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
                    <input type="date" value={form.expense_date} onChange={(e) => f("expense_date", e.target.value)} />
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
                    <textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} placeholder="Optional details..." rows={3} />
                  </div>
                </div>
                {saveError && <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bg3)", borderRadius: 6, fontSize: 13, color: "var(--red)", border: "1px solid var(--red)" }}>⚠ {saveError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add Expense"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {(categories.length ? categories : ["Rent","Salary","Utilities","Stationery","Marketing","Maintenance","Other"]).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
                    <td style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => edit(e)}>Edit</button>
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

        {totalPages > 1 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20, flexWrap:"wrap", gap:10, padding:"0 10px" }}>
            <div style={{ fontSize:13, color:"var(--text3)" }}>Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,totalRecs)} of <strong>{totalRecs}</strong></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => load(page-1)} disabled={page===1}>← Prev</button>
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{page}</span>
                <span style={{ fontSize:13, color:"var(--text3)" }}>/ {totalPages}</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => load(page+1)} disabled={page===totalPages}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{form.id ? 'Edit' : 'Add'} Expense</div>
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
