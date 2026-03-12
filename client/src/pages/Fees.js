import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function statusBadge(s) {
  const map = { paid: "badge-green", pending: "badge-blue", partial: "badge-yellow", overdue: "badge-red" };
  return <span className={`badge ${map[s] || "badge-gray"}`}>{s}</span>;
}

export default function Fees() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [students, setStudents] = useState([]);
  const [genForm, setGenForm] = useState({ branch_id: "", month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [manForm, setManForm] = useState({ student_id: "", amount_due: "", due_date: "", period_label: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    const q = new URLSearchParams();
    if (filterBranch) q.set("branch_id", filterBranch);
    if (filterStatus) q.set("status", filterStatus);
    API.get(`/fees?${q}`).then((r) => setRecords(r.data));
  };

  useEffect(() => {
    load();
    API.get("/students").then((r) => setStudents(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch, filterStatus]);

  const markOverdue = async () => {
    const { data } = await API.patch("/fees/mark-overdue");
    setMsg(`✓ Marked ${data.updated} records as overdue`);
    load(); setTimeout(() => setMsg(""), 3000);
  };

  const generate = async () => {
    setSaving(true); setMsg("");
    try {
      const bid = user.role === "super_admin" ? genForm.branch_id : user.branch_id;
      const { data } = await API.post("/fees/generate", { ...genForm, branch_id: bid });
      setMsg(`✓ Generated ${data.created} fee records for ${data.label}`);
      setShowGenerate(false); load();
    } catch (e) { setMsg("⚠ " + (e.response?.data?.error || "Failed")); }
    finally { setSaving(false); }
  };

  const addManual = async () => {
    setSaving(true);
    try {
      await API.post("/fees", manForm);
      setShowManual(false); load();
    } catch (e) { setMsg("⚠ " + (e.response?.data?.error || "Failed")); }
    finally { setSaving(false); }
  };

  const filtered = records.filter((r) => {
    if (search && !r.student_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Fee Records</div>
          <div className="page-sub">{filtered.length} record(s)</div>
        </div>
        <div className="gap-row">
          <button className="btn btn-secondary" onClick={markOverdue}>⚠ Mark Overdue</button>
          <button className="btn btn-secondary" onClick={() => setShowManual(true)}>+ Manual Record</button>
          <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>⚡ Generate Monthly</button>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>}

      <div className="filters-bar">
        <input className="search-input" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {user.role === "super_admin" && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">No fee records</div>
            <div className="empty-sub">Generate monthly records or add manually</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {user.role === "super_admin" && <th>Branch</th>}
                  <th>Batch</th><th>Period</th><th>Due Date</th>
                  <th>Amount Due</th><th>Paid</th><th>Balance</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                      <div className="text-muted text-sm mono">{r.phone}</div>
                    </td>
                    {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                    <td className="text-muted">{r.batch_name || "—"}</td>
                    <td>{r.period_label || "—"}</td>
                    <td className="text-muted">{new Date(r.due_date).toLocaleDateString("en-IN")}</td>
                    <td className="mono">{fmt(r.amount_due)}</td>
                    <td className="mono" style={{ color: "var(--green)" }}>{fmt(r.amount_paid)}</td>
                    <td className="mono" style={{ color: r.amount_due - r.amount_paid > 0 ? "var(--red)" : "var(--green)" }}>
                      {fmt(r.amount_due - r.amount_paid)}
                    </td>
                    <td>{statusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowGenerate(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">⚡ Generate Fee Records</div>
              <button className="modal-close" onClick={() => setShowGenerate(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text2)", marginBottom: 16, fontSize: 13 }}>
                Automatically creates fee records for all active students based on their batch fee and discount.
              </p>
              <div className="form-grid">
                {user.role === "super_admin" && (
                  <div className="form-group full">
                    <label>Branch *</label>
                    <select value={genForm.branch_id} onChange={(e) => setGenForm({ ...genForm, branch_id: e.target.value })}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Month</label>
                  <select value={genForm.month} onChange={(e) => setGenForm({ ...genForm, month: e.target.value })}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <input type="number" value={genForm.year} onChange={(e) => setGenForm({ ...genForm, year: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generate} disabled={saving}>{saving ? "Generating…" : "Generate"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Modal */}
      {showManual && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowManual(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Manual Fee Record</div>
              <button className="modal-close" onClick={() => setShowManual(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Student *</label>
                  <select value={manForm.student_id} onChange={(e) => setManForm({ ...manForm, student_id: e.target.value })}>
                    <option value="">Select Student</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name} – {s.batch_name || "No batch"}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount Due (₹) *</label>
                  <input type="number" value={manForm.amount_due} onChange={(e) => setManForm({ ...manForm, amount_due: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input type="date" value={manForm.due_date} onChange={(e) => setManForm({ ...manForm, due_date: e.target.value })} />
                </div>
                <div className="form-group full">
                  <label>Period Label</label>
                  <input value={manForm.period_label} onChange={(e) => setManForm({ ...manForm, period_label: e.target.value })} placeholder="e.g. June 2025" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowManual(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addManual} disabled={saving}>{saving ? "Saving…" : "Add Record"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
