import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function statusBadge(s) {
  const map = { paid: "badge-green", pending: "badge-blue", partial: "badge-yellow", overdue: "badge-red" };
  return <span className={`badge ${map[s] || "badge-gray"}`}>{s}</span>;
}

function InfoBox({ why, steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 20, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text1)" }}
      >
        <span>💡 How it works & Why use this section</span>
        <span style={{ fontSize: 18, fontWeight: 300, color: "var(--accent)", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "rgba(79,142,247,0.07)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>How it works</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                <div style={{ minWidth: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(16,185,129,0.07)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--green)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Why use this</div>
            {why.map((w, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Fees() {
  const { user } = useAuth();
  const [records,      setRecords]      = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [students,     setStudents]     = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search,       setSearch]       = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual,   setShowManual]   = useState(false);
  const [genForm, setGenForm] = useState({ branch_id: "", month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [manForm, setManForm] = useState({ student_id: "", amount_due: "", due_date: "", period_label: "" });
  const [saving, setSaving] = useState(false);
  const [manError, setManError] = useState("");
  const [msg, setMsg] = useState("");
  const [nudging, setNudging] = useState(false);

  const load = () => {
    const q = new URLSearchParams();
    if (filterBranch) q.set("branch_id", filterBranch);
    if (filterStatus) q.set("status", filterStatus);
    API.get(`/fees?${q}`).then((r) => setRecords(r.data));
  };

  useEffect(() => {
    load();
    API.get("/students?limit=1000").then((r) => {
      const res = r.data;
      setStudents(Array.isArray(res) ? res : (res.data || []));
    });
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch, filterStatus]);

  const markOverdue = async () => {
    const { data } = await API.patch("/fees/mark-overdue");
    setMsg(`✓ Marked ${data.updated} records as overdue`);
    load();
    setTimeout(() => setMsg(""), 3000);
  };

  const nudgeDefaulters = async () => {
    // Collect all unpaid records from currently filtered view
    const defaulters = filtered.filter(r => ["pending", "partial", "overdue"].includes(r.status));
    if (defaulters.length === 0) {
      setMsg("⚠ No defaulters in current view.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    
    // De-duplicate by student (optional, but let's just nudge all unpaid records)
    const recordIds = defaulters.map(r => r.id);
    
    if (!window.confirm(`Are you sure you want to send WhatsApp reminders to ${recordIds.length} fee records?`)) return;
    
    setNudging(true);
    setMsg("");
    try {
      const { data } = await API.post("/fees/nudge", { record_ids: recordIds });
      setMsg(`🚀 Successfully sent ${data.nudged} out of ${data.total} WhatsApp reminders!`);
    } catch (e) {
      setMsg("⚠ " + (e.response?.data?.error || "Failed to trigger nudge. Make sure WhatsApp is connected in Settings."));
    } finally {
      setNudging(false);
      setTimeout(() => setMsg(""), 6000);
    }
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
    setManError("");
    if (!manForm.student_id)                                        { setManError("⚠ Please select a student"); return; }
    if (!manForm.amount_due || parseFloat(manForm.amount_due) <= 0) { setManError("⚠ Amount Due must be greater than 0"); return; }
    if (!manForm.due_date)                                          { setManError("⚠ Due Date is required"); return; }
    if (!manForm.period_label)                                      { setManError("⚠ Period Label is required"); return; }
    setSaving(true);
    try {
      await API.post("/fees", manForm);
      setShowManual(false);
      setManForm({ student_id: "", amount_due: "", due_date: "", period_label: "" });
      load();
      setMsg("✓ Fee record added successfully");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setManError("⚠ " + (e.response?.data?.error || "Failed to add record"));
    } finally { setSaving(false); }
  };

  const filtered = records.filter((r) =>
    !search || r.student_name?.toLowerCase().includes(search.toLowerCase())
  );

  const balanceClass = (r) => r.amount_due - r.amount_paid > 0 ? "fee-debit" : "fee-credit";

  // Build WhatsApp message for overdue students
  const whatsappOverdue = (r) => {
    const phone = r.phone?.replace(/[^0-9]/g, "");
    if (!phone) return null;
    const wa = phone.startsWith("91") ? phone : `91${phone}`;
    const balance = Number(r.amount_due - r.amount_paid).toLocaleString("en-IN");
    const msg = encodeURIComponent(
      `Dear ${r.student_name || "Student"},\n\nThis is a reminder that your fee of \u20b9${balance} for *${r.period_label || "this period"}* is overdue.\n\nPlease clear your dues at the earliest.\n\nThank you,\n${user?.branch_name || "Academy"}`
    );
    return `https://wa.me/${wa}?text=${msg}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Fee Records</div>
          <div className="page-sub">{filtered.length} record(s)</div>
        </div>
        <div className="gap-row">
          <button className="btn" onClick={nudgeDefaulters} disabled={nudging || filtered.length === 0} style={{ background: "var(--green)", color: "white", border: "1px solid rgba(16,185,129,0.5)" }}>
            {nudging ? "⏳ Nudging..." : "💬 Nudge Defaulters"}
          </button>
          <button className="btn btn-secondary" onClick={markOverdue}>⚠ Mark Overdue</button>
          <button className="btn btn-secondary" onClick={() => { setManError(""); setShowManual(true); }}>+ Manual Record</button>
          <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>⚡ Generate Monthly</button>
        </div>
      </div>

      <InfoBox
        steps={[
          "Click ⚡ Generate Monthly — system auto-creates fee records for all active students in a branch based on their batch fees.",
          "Each record tracks: Amount Due, Amount Paid, Balance, Due Date, and Status (pending / partial / paid / overdue).",
          "When a student pays, go to Payments → Record Payment — the fee record status updates automatically.",
          "Click ⚠ Mark Overdue any time to flag all records past their due date so you can follow up faster.",
          "Use + Manual Record for custom fees like exam fees, registration, or one-time charges.",
        ]}
        why={[
          "Never lose track of who has paid and who hasn't — everything is in one place.",
          "Saves hours every month vs. maintaining Excel sheets manually.",
          "Overdue tracking lets you send WhatsApp reminders directly from the fee records.",
          "Partial payments are supported — students can pay in installments.",
          "Balance auto-calculates as students pay, so your accounts are always accurate.",
        ]}
      />

      {msg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>
      )}

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
                  <th>Amount Due</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const waLink = whatsappOverdue(r);
                  return (
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
                      <td className="mono fee-credit">{fmt(r.amount_paid)}</td>
                      <td className={`mono ${balanceClass(r)}`}>{fmt(r.amount_due - r.amount_paid)}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td>
                        {/* FIX: WhatsApp button shown for ALL non-paid statuses */}
                        {(r.status === "overdue" || r.status === "pending" || r.status === "partial") && waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm"
                            title="Send WhatsApp reminder"
                            style={{
                              background: "rgba(37,211,102,0.12)",
                              color: "#25d366",
                              border: "1px solid rgba(37,211,102,0.3)",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            💬 WA
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
              <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
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

      {/* Manual Record Modal */}
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
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} – {s.batch_name || "No batch"} ({s.branch_name || ""})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount Due (₹) *</label>
                  <input type="number" min="1" placeholder="e.g. 2500" value={manForm.amount_due} onChange={(e) => setManForm({ ...manForm, amount_due: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input type="date" value={manForm.due_date} onChange={(e) => setManForm({ ...manForm, due_date: e.target.value })} />
                </div>
                <div className="form-group full">
                  <label>Period Label *</label>
                  <input placeholder="e.g. June 2025" value={manForm.period_label} onChange={(e) => setManForm({ ...manForm, period_label: e.target.value })} />
                </div>
              </div>
              {manError && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, fontSize: 13 }} className="fee-debit">
                  {manError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowManual(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addManual} disabled={saving}>
                {saving ? "Saving…" : "Add Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
