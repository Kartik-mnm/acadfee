import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `\u20b9${Number(n).toLocaleString("en-IN")}`;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function statusBadge(s) {
  const map = { paid:"badge-green", pending:"badge-blue", partial:"badge-yellow", overdue:"badge-red" };
  return <span className={`badge ${map[s]||"badge-gray"}`}>{s}</span>;
}

function InfoBox({ why, steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom:16, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"var(--text1)" }}>
        <span>How it works &amp; Why use this section</span>
        <span style={{ fontSize:18, fontWeight:300, color:"var(--accent)", transform:open?"rotate(45deg)":"none", transition:"transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding:"0 18px 18px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div style={{ background:"rgba(79,142,247,0.07)", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"var(--accent)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>How it works</div>
            {steps.map((s,i) => (
              <div key={i} style={{ display:"flex", gap:10, marginBottom:8, fontSize:13, color:"var(--text2)", lineHeight:1.5 }}>
                <div style={{ minWidth:22, height:22, borderRadius:"50%", background:"var(--accent)", color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</div>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"rgba(16,185,129,0.07)", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"var(--green)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Why use this</div>
            {why.map((w,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:8, fontSize:13, color:"var(--text2)", lineHeight:1.5 }}>
                <span style={{ color:"var(--green)", fontWeight:700, flexShrink:0 }}>&#10003;</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile fee card — matches Image 1 design exactly ────────────────────────
function FeeCard({ r, user, waLink }) {
  const balance = Number(r.amount_due) - Number(r.amount_paid);
  const initials = (r.student_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  return (
    <div style={{
      background:"var(--mob-surface,#121a28)",
      borderRadius:16,
      padding:"16px 16px 14px",
      marginBottom:12,
      boxShadow:"0 12px 24px rgba(61,90,254,0.06)",
    }}>
      {/* Header: avatar + name + phone + branch/batch */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
        <div style={{
          width:44, height:44, borderRadius:12,
          background:"linear-gradient(135deg,#4963ff,#9ba8ff)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontWeight:800, fontSize:16, color:"#fff", flexShrink:0,
        }}>{initials}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:15, color:"var(--mob-on-surface,#e6ebfc)", marginBottom:2 }}>
            {r.student_name}
          </div>
          {r.phone && (
            <div style={{ fontSize:11, color:"var(--mob-on-var,#a5abbb)", display:"flex", alignItems:"center", gap:4 }}>
              <span>&#9990;</span> {r.phone}
            </div>
          )}
          <div style={{ fontSize:11, color:"var(--mob-on-var,#a5abbb)", display:"flex", alignItems:"center", gap:10, marginTop:2 }}>
            {r.branch_name && <span>&#127982; {r.branch_name}</span>}
            {r.batch_name  && <span>&#127891; {r.batch_name}</span>}
          </div>
        </div>
      </div>

      {/* Period row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>INSTALLMENT</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:15, color:"var(--mob-on-surface,#e6ebfc)" }}>{r.period_label || "&#8212;"}</div>
          {r.due_date && <div style={{ fontSize:10, color:"var(--mob-on-var,#a5abbb)", marginTop:2 }}>Due: {new Date(r.due_date).toLocaleDateString("en-IN")}</div>}
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>TOTAL FEE</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:15, color:"var(--mob-on-surface,#e6ebfc)" }}>{fmt(r.amount_due)}</div>
        </div>
      </div>

      {/* Paid / Balance row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>PAID</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:15, color:"var(--mob-secondary,#3fff8b)" }}>{fmt(r.amount_paid)}</div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>BALANCE</div>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:15, color: balance > 0 ? "var(--mob-error,#ff6e84)" : "var(--mob-secondary,#3fff8b)" }}>{fmt(balance)}</div>
        </div>
      </div>

      {/* Footer: status badge + WA button */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        {statusBadge(r.status)}
        {waLink && (r.status === "pending" || r.status === "partial" || r.status === "overdue") && (
          <a href={waLink} target="_blank" rel="noreferrer"
            style={{
              width:36, height:36, borderRadius:"50%",
              background:"rgba(37,211,102,0.12)", border:"1px solid rgba(37,211,102,0.25)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, textDecoration:"none",
            }}
            title="Send WhatsApp reminder">
            &#128172;
          </a>
        )}
      </div>
    </div>
  );
}

export default function Fees({ pageState }) {
  const { user } = useAuth();
  const [records,      setRecords]      = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [students,     setStudents]     = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  // BUG FIX: initialize directly from pageState to avoid race condition on mount
  const [filterStatus, setFilterStatus] = useState(() => pageState?.filterStatus || "");
  const [search,       setSearch]       = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual,   setShowManual]   = useState(false);
  const [genForm,  setGenForm]  = useState({ branch_id:"", month:new Date().getMonth()+1, year:new Date().getFullYear() });
  const [manForm,  setManForm]  = useState({ student_id:"", amount_due:"", due_date:"", period_label:"" });
  const [saving,   setSaving]   = useState(false);
  const [manError, setManError] = useState("");
  const [msg,      setMsg]      = useState("");
  const [nudging,  setNudging]  = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [page,      setPage]      = useState(1);
  const [totalPages,setTotalPages] = useState(1);
  const [total,     setTotal]     = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  
  useEffect(() => {
    // Sync if pageState changes after mount (e.g. re-navigation)
    if (pageState?.filterStatus && pageState.filterStatus !== filterStatus) {
      setFilterStatus(pageState.filterStatus);
    }
  }, [pageState]);

  const load = (p = 1) => {
    const q = new URLSearchParams();
    if (filterBranch) q.set("branch_id", filterBranch);
    if (filterStatus) q.set("status", filterStatus);
    q.set("page", p);
    q.set("limit", LIMIT);
    API.get(`/fees?${q}`).then((r) => {
      if (r.data.data) {
        setRecords(r.data.data);
        setPage(r.data.page);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
      } else {
        setRecords(r.data);
        setTotal(r.data.length);
      }
    });
  };

  useEffect(() => {
    // BUG FIX: reset to page 1 whenever filters change, then load
    setPage(1);
    load(1);
    API.get("/students?limit=200").then((r) => {
      const res = r.data;
      setStudents(Array.isArray(res) ? res : (res.data || []));
    });
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch, filterStatus]);

  // ── filtered must be declared BEFORE it is used in nudgeDefaulters ──────────
  const filtered = records.filter((r) =>
    !search || r.student_name?.toLowerCase().includes(search.toLowerCase())
  );

  const markOverdue = async () => {
    const { data } = await API.patch("/fees/mark-overdue");
    setMsg(`Marked ${data.updated} records as overdue`);
    load();
    setTimeout(() => setMsg(""), 3000);
  };

  const nudgeDefaulters = async () => {
    const defaulters = filtered.filter(r => ["pending","partial","overdue"].includes(r.status));
    if (defaulters.length === 0) { setMsg("No defaulters in current view."); setTimeout(() => setMsg(""), 3000); return; }
    if (!window.confirm(`Send WhatsApp reminders to ${defaulters.length} fee records?`)) return;
    setNudging(true); setMsg("");
    try {
      const { data } = await API.post("/fees/nudge", { record_ids: defaulters.map(r => r.id) });
      setMsg(`Sent ${data.nudged} of ${data.total} reminders!`);
    } catch (e) {
      setMsg(e.response?.data?.error || "Failed. Make sure WhatsApp is connected.");
    } finally { setNudging(false); setTimeout(() => setMsg(""), 6000); }
  };

  const generate = async () => {
    setSaving(true); setMsg("");
    try {
      const bid = user.role === "super_admin" ? genForm.branch_id : user.branch_id;
      const { data } = await API.post("/fees/generate", { ...genForm, branch_id:bid });
      setMsg(`Generated ${data.created} fee records for ${data.label}`);
      setShowGenerate(false); load();
    } catch (e) { setMsg(e.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  const addManual = async () => {
    setManError("");
    if (!manForm.student_id)                                        { setManError("Please select a student"); return; }
    if (!manForm.amount_due || parseFloat(manForm.amount_due) <= 0) { setManError("Amount Due must be > 0"); return; }
    if (!manForm.due_date)                                          { setManError("Due Date is required"); return; }
    if (!manForm.period_label)                                      { setManError("Period Label is required"); return; }
    setSaving(true);
    try {
      await API.post("/fees", manForm);
      setShowManual(false);
      setManForm({ student_id:"", amount_due:"", due_date:"", period_label:"" });
      load();
      setMsg("Fee record added successfully");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setManError(e.response?.data?.error || "Failed to add record");
    } finally { setSaving(false); }
  };



  const whatsappOverdue = (r) => {
    const phone = r.phone?.replace(/[^0-9]/g, "");
    if (!phone) return null;
    const wa = phone.startsWith("91") ? phone : `91${phone}`;
    const balance = Number(r.amount_due - r.amount_paid).toLocaleString("en-IN");
    const msg = encodeURIComponent(
      `Dear ${r.student_name||"Student"},\n\nThis is a reminder that your fee of \u20b9${balance} for *${r.period_label||"this period"}* is overdue.\n\nPlease clear your dues at the earliest.\n\nThank you,\n${user?.branch_name||"Academy"}`
    );
    return `https://wa.me/${wa}?text=${msg}`;
  };

  return (
    <div>
      {/* ── Page header ───────────────────────────────── */}
      <div className="page-header" style={{ alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--mob-on-var,#a5abbb)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:4 }}>ACADEMIC FINANCIAL LEDGER</div>
          <div className="page-title">Fee Records</div>
          <div className="page-sub">{filtered.length} record(s)</div>
        </div>
      </div>

      {/* ── Info box ─────────────────────────────────── */}
      <InfoBox
        steps={[
          "Click Generate Monthly — system auto-creates fee records for all active students based on their batch fees.",
          "Each record tracks: Amount Due, Amount Paid, Balance, Due Date, and Status.",
          "When a student pays, go to Payments to record it — status updates automatically.",
          "Click Mark Overdue to flag all past-due records for follow-up.",
          "Use Manual Record for custom fees like exam fees or one-time charges.",
        ]}
        why={[
          "Never lose track of who has paid and who hasn't.",
          "Saves hours every month vs. maintaining Excel sheets.",
          "Overdue tracking lets you send WhatsApp reminders directly.",
          "Partial payments are supported — students can pay in installments.",
          "Balance auto-calculates as students pay.",
        ]}
      />

      {/* ── Action buttons — 2x2 grid on mobile ─────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <button
          onClick={nudgeDefaulters}
          disabled={nudging || filtered.length === 0}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            padding:"13px 10px", borderRadius:14,
            background:nudging?"var(--bg3)":"linear-gradient(135deg,#4963ff,#9ba8ff)",
            border:"none", color:nudging?"var(--text2)":"#001c8e",
            fontWeight:800, fontSize:13, cursor:"pointer",
            boxShadow:"0 8px 20px rgba(155,168,255,0.25)",
          }}
        >
          <span style={{ fontSize:16 }}>&#128172;</span>
          {nudging ? "Nudging..." : "Nudge Defaulters"}
        </button>

        <button
          onClick={markOverdue}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            padding:"13px 10px", borderRadius:14,
            background:"var(--mob-surface-top,#1d2637)",
            border:"none", color:"var(--mob-on-surface,#e6ebfc)",
            fontWeight:700, fontSize:13, cursor:"pointer",
          }}
        >
          <span style={{ fontSize:14 }}>&#128197;</span>
          Mark Overdue
        </button>

        <button
          onClick={() => { setManError(""); setShowManual(true); }}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            padding:"13px 10px", borderRadius:14,
            background:"var(--mob-surface-top,#1d2637)",
            border:"none", color:"var(--mob-on-surface,#e6ebfc)",
            fontWeight:700, fontSize:13, cursor:"pointer",
          }}
        >
          <span style={{ fontSize:14 }}>&#128444;</span>
          Manual Record
        </button>

        <button
          onClick={() => setShowGenerate(true)}
          style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            padding:"13px 10px", borderRadius:14,
            background:"linear-gradient(135deg,#4963ff,#9ba8ff)",
            border:"none", color:"#001c8e",
            fontWeight:800, fontSize:13, cursor:"pointer",
            boxShadow:"0 8px 20px rgba(155,168,255,0.25)",
          }}
        >
          <span style={{ fontSize:16 }}>&#9889;</span>
          Generate Monthly
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom:14, padding:"10px 14px", background:"var(--bg3)", borderRadius:10, fontSize:13 }}>{msg}</div>
      )}

      {/* ── Filters ──────────────────────────────────── */}
      <div className="filters-bar">
        <input className="search-input" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
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

      {/* ── Records ──────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">&#128203;</div>
            <div className="empty-text">No fee records</div>
            <div className="empty-sub">Generate monthly records or add manually</div>
          </div>
        </div>
      ) : isMobile ? (
        /* ── Mobile card layout ─────────────────────── */
        <div>
          {filtered.map((r) => (
            <FeeCard key={r.id} r={r} user={user} waLink={whatsappOverdue(r)} />
          ))}
          {/* End of list indicator */}
          <div style={{ textAlign:"center", padding:"24px 0 8px", color:"var(--mob-on-var,#a5abbb)" }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:0.4 }}>&#128202;</div>
            <div style={{ fontSize:12, fontWeight:600 }}>End of current record list</div>
            <div style={{ fontSize:11, opacity:0.6 }}>AcadFee Ledger systems synchronized.</div>
          </div>
        </div>
      ) : (
        /* ── Desktop table layout ───────────────────── */
        <div className="card">
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
                  const balance = r.amount_due - r.amount_paid;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{r.student_name}</div>
                        <div className="text-muted text-sm mono">{r.phone}</div>
                      </td>
                      {user.role === "super_admin" && <td className="text-muted">{r.branch_name}</td>}
                      <td className="text-muted">{r.batch_name||"&#8212;"}</td>
                      <td>{r.period_label||"&#8212;"}</td>
                      <td className="text-muted">{new Date(r.due_date).toLocaleDateString("en-IN")}</td>
                      <td className="mono">{fmt(r.amount_due)}</td>
                      <td className="mono" style={{ color:"var(--green)" }}>{fmt(r.amount_paid)}</td>
                      <td className="mono" style={{ color: balance > 0 ? "var(--red)" : "var(--green)" }}>{fmt(balance)}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td>
                        {(r.status === "overdue" || r.status === "pending" || r.status === "partial") && waLink && (
                          <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-sm"
                            style={{ background:"rgba(37,211,102,0.12)", color:"#25d366", border:"1px solid rgba(37,211,102,0.3)", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:600 }}>
                            &#128172; WA
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20, flexWrap:"wrap", gap:10, padding:"0 10px" }}>
          <div style={{ fontSize:13, color:"var(--text3)" }}>Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} of <strong>{total}</strong></div>
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

      {/* ── Generate Modal ─────────────────────────── */}
      {showGenerate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowGenerate(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Generate Fee Records</div>
              <button className="modal-close" onClick={() => setShowGenerate(false)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom:16, fontSize:13 }}>Auto-creates fee records for all active students based on their batch fee and discount.</p>
              <div className="form-grid">
                {user.role === "super_admin" && (
                  <div className="form-group full">
                    <label>Branch *</label>
                    <select value={genForm.branch_id} onChange={(e) => setGenForm({...genForm,branch_id:e.target.value})}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Month</label>
                  <select value={genForm.month} onChange={(e) => setGenForm({...genForm,month:e.target.value})}>
                    {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <input type="number" value={genForm.year} onChange={(e) => setGenForm({...genForm,year:e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generate} disabled={saving}>{saving?"Generating...":"Generate"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Record Modal ────────────────────── */}
      {showManual && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowManual(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Manual Fee Record</div>
              <button className="modal-close" onClick={() => setShowManual(false)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Student *</label>
                  <select value={manForm.student_id} onChange={(e) => setManForm({...manForm,student_id:e.target.value})}>
                    <option value="">Select Student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} &#8211; {s.batch_name||"No batch"} ({s.branch_name||""})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount Due (Rs.) *</label>
                  <input type="number" min="1" placeholder="e.g. 2500" value={manForm.amount_due} onChange={(e) => setManForm({...manForm,amount_due:e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input type="date" value={manForm.due_date} onChange={(e) => setManForm({...manForm,due_date:e.target.value})} />
                </div>
                <div className="form-group full">
                  <label>Period Label *</label>
                  <input placeholder="e.g. June 2025" value={manForm.period_label} onChange={(e) => setManForm({...manForm,period_label:e.target.value})} />
                </div>
              </div>
              {manError && <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, fontSize:13, color:"var(--red)" }}>{manError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowManual(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addManual} disabled={saving}>{saving?"Saving...":"Add Record"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
