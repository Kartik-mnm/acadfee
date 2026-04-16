import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function InfoBox({ why, steps }) {
  const [open, setOpen] = useState(false);
  return null; // hide info box in new design
}


function numberToWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + numberToWords(n%100) : "");
  if (n < 100000) return numberToWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + numberToWords(n%1000) : "");
  if (n < 10000000) return numberToWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + numberToWords(n%100000) : "");
  return numberToWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + numberToWords(n%10000000) : "");
}

function Receipt({ payment, onClose, academy, isMobile }) {
  const p = payment;
  const academyName   = academy?.name   || "Academy";
  const academyPhone  = academy?.phone  || "";
  const academyPhone2 = academy?.phone2 || "";
  const contactLine   = [academyPhone, academyPhone2].filter(Boolean).join(" / ");
  const balance       = (p.amount_due || 0) - (p.amount_paid || 0);
  const amountWords   = numberToWords(Math.round(p.amount || 0)) + " Rupees Only";
  const dueDate       = p.due_date ? new Date(p.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const paidDate      = p.paid_on  ? new Date(p.paid_on).toLocaleDateString("en-IN",  { day: "numeric", month: "long", year: "numeric" }) : "—";

  // Single receipt copy HTML — used twice
  const copyHTML = `
<div class="copy">
  <div class="copy-inner">
    <div class="hdr">
      <div class="academy-name">${academyName}</div>
      <div class="academy-addr">${p.branch_name || ""}</div>
      ${contactLine ? `<div class="academy-addr">Contact: ${contactLine}</div>` : ""}
    </div>
    <div class="receipt-title-box"><h2>FEES RECEIPT</h2></div>
    <table class="info-table"><tr>
      <td class="lbl">Receipt No.</td><td class="colon">:</td><td class="val mono">${p.receipt_no}</td>
      <td class="lbl" style="text-align:right">Date</td><td class="colon">:</td><td class="val">${paidDate}</td>
    </tr></table>
    <table class="info-table" style="border-top:1px solid #ccc;padding-top:6px;margin-top:4px">
      <tr><td class="lbl">Student Name</td><td class="colon">:</td><td class="val" colspan="3">${p.student_name}</td></tr>
      <tr><td class="lbl">Father's Name</td><td class="colon">:</td><td class="val" colspan="3">${p.parent_name || "—"}</td></tr>
      <tr>
        <td class="lbl">Batch/Course</td><td class="colon">:</td><td class="val">${p.batch_name || "—"}</td>
        <td class="lbl" style="text-align:right">Branch</td><td class="colon">:</td><td class="val">${p.branch_name || "—"}</td>
      </tr>
      <tr>
        <td class="lbl">Period</td><td class="colon">:</td><td class="val">${p.period_label || "—"}</td>
        <td class="lbl" style="text-align:right">Due Date</td><td class="colon">:</td><td class="val" style="color:#c00;font-weight:900">${dueDate}</td>
      </tr>
      <tr>
        <td class="lbl">Payment Mode</td><td class="colon">:</td>
        <td class="val" colspan="3">${(p.payment_mode || "").toUpperCase()}${p.transaction_ref ? " — " + p.transaction_ref : ""}</td>
      </tr>
    </table>
    <table class="fee-table">
      <thead><tr><th>Fee Details</th><th class="ac">Amount</th></tr></thead>
      <tbody>
        <tr><td>${p.period_label || "Tuition Fee"}</td><td class="ac">₹${Number(p.amount_due || 0).toLocaleString("en-IN")}</td></tr>
        <tr class="sr"><td></td><td class="ac">₹${Number(p.amount_due || 0).toLocaleString("en-IN")}</td></tr>
      </tbody>
    </table>
    <table class="summary-table">
      <tr><td class="lbl" style="width:60%">Total Fee</td><td class="val">₹${Number(p.amount_due || 0).toLocaleString("en-IN")}</td></tr>
      <tr><td class="lbl">Paid Fee</td><td class="val">₹${Number(p.amount_paid || 0).toLocaleString("en-IN")}</td></tr>
      <tr class="br"><td class="lbl">Balance Fee</td><td class="val" style="color:${balance > 0 ? "#c00" : "#090"}">₹${Number(balance).toLocaleString("en-IN")}</td></tr>
    </table>
    <div class="words-box"><span style="font-weight:700">Rupees </span>${amountWords}</div>
    <div class="footer">
      <div class="footer-note">Computer generated receipt.<br/>No signature required.</div>
      <div class="sign-box"><div class="sign-line"></div>Authorized Signatory</div>
    </div>
  </div>
</div>`;

  const receiptHTML = `<!DOCTYPE html><html><head><title>Fee Receipt - ${p.receipt_no}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,sans-serif; background:#fff; color:#000; }
.page { width:780px; margin:20px auto; }

/* ── Two copies side by side with a visible cut gap in between ── */
.copies {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.copy {
  width: 375px;
  border: 2px solid #000;
  flex-shrink: 0;
}
.copy-inner { padding: 12px 14px; }

/* ── Cut line separator ── */
.cut-separator {
  width: 30px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  position: relative;
}
.cut-separator::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  border-left: 2px dashed #aaa;
}
.cut-icon {
  background: #fff;
  padding: 4px 0;
  font-size: 16px;
  z-index: 1;
  line-height: 1;
  transform: rotate(90deg);
}
.cut-label {
  background: #fff;
  padding: 2px 0;
  font-size: 7px;
  color: #aaa;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  z-index: 1;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.hdr { text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:10px; }
.academy-name { font-size:17px; font-weight:900; text-transform:uppercase; }
.academy-addr { font-size:10px; color:#333; line-height:1.5; margin-top:2px; }
.receipt-title-box { border:2px solid #000; text-align:center; padding:5px; margin:10px 0; }
.receipt-title-box h2 { font-size:16px; font-weight:900; letter-spacing:.05em; }
.info-table { width:100%; border-collapse:collapse; margin-bottom:8px; }
.info-table td { padding:4px 2px; font-size:11px; vertical-align:top; }
.info-table .lbl { font-weight:700; width:90px; color:#333; }
.info-table .colon { width:10px; }
.info-table .val { font-weight:600; }
.mono { font-family:monospace; }
.fee-table { width:100%; border-collapse:collapse; margin:8px 0; }
.fee-table th { background:#e0e0e0; border:1px solid #999; padding:5px 6px; font-size:11px; text-align:left; }
.fee-table td { border:1px solid #ccc; padding:5px 6px; font-size:11px; }
.fee-table .ac { text-align:right; font-weight:700; }
.fee-table .sr td { background:#e8e8e8; font-weight:700; }
.summary-table { width:100%; border-collapse:collapse; margin-top:4px; }
.summary-table td { padding:4px 6px; font-size:11px; border:1px solid #ccc; }
.summary-table .lbl { font-weight:700; background:#f5f5f5; }
.summary-table .val { text-align:right; font-weight:700; }
.summary-table .br td { background:#fff3cd; }
.words-box { border:1px solid #ccc; padding:5px 8px; margin-top:8px; font-size:10px; }
.footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top:16px; padding-top:8px; border-top:1px solid #ccc; }
.footer-note { font-size:9px; color:#666; }
.sign-box { text-align:center; font-size:10px; }
.sign-line { border-top:1px solid #333; width:100px; margin:20px auto 4px; }

@media print {
  body { margin:0; }
  .page { margin:0; width:100%; }
  .no-print { display:none; }
}
</style>
</head><body>
<div class="page">
  <div class="copies">
    ${copyHTML}
    <div class="cut-separator">
      <span class="cut-label">cut here</span>
      <span class="cut-icon">✂</span>
      <span class="cut-label">cut here</span>
    </div>
    ${copyHTML}
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;

  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(receiptHTML);
    w.document.close();
  };

  const balance2 = (p.amount_due || 0) - (p.amount_paid || 0);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, marginBottom: isMobile ? 80 : 0 }}>
        <div className="modal-header">
          <div className="modal-title">🧾 Fee Receipt — {p.receipt_no}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ border: "2px solid var(--border)", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
            <div style={{ background: "var(--bg3)", textAlign: "center", padding: "12px 16px", borderBottom: "2px solid var(--border)" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{academyName.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>{p.branch_name}</div>
              {contactLine && <div style={{ fontSize: 11, color: "var(--text2)" }}>📞 {contactLine}</div>}
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 6, border: "1px solid var(--border)", padding: "3px 20px", display: "inline-block", borderRadius: 4 }}>FEES RECEIPT</div>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                <div><span style={{ color: "var(--text2)" }}>Receipt No. </span><strong className="mono">{p.receipt_no}</strong></div>
                <div><span style={{ color: "var(--text2)" }}>Date: </span><strong>{paidDate}</strong></div>
              </div>
              {[
                ["Student Name", p.student_name],
                ["Father's Name", p.parent_name || "—"],
                ["Batch / Course", p.batch_name || "—"],
                ["Period", p.period_label || "—"],
                ["Due Date", <span style={{ color: "var(--red)", fontWeight: 800 }}>{dueDate}</span>],
                ["Payment Mode", (p.payment_mode || "").toUpperCase()],
                p.transaction_ref ? ["Txn / Ref No.", p.transaction_ref] : null,
              ].filter(Boolean).map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed var(--border)", fontSize: 12 }}>
                  <span style={{ color: "var(--text2)" }}>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
              <div style={{ margin: "10px 0", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: "var(--bg3)", padding: "5px 10px", fontWeight: 700, fontSize: 11 }}>
                  <span>Fee Details</span><span>Amount</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", fontSize: 12 }}>
                  <span>{p.period_label || "Tuition Fee"}</span>
                  <strong>{fmt(p.amount_due)}</strong>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg3)", padding: "5px 10px" }}>
                  {[
                    ["Total Fee",   fmt(p.amount_due), "var(--text)"],
                    ["Paid Fee",    fmt(p.amount),     "var(--green)"],
                    ["Balance Fee", fmt(balance2),     balance2 > 0 ? "var(--red)" : "var(--green)"],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{l}</span>
                      <span style={{ fontWeight: 800, color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text2)", fontStyle: "italic" }}>
                <strong>Rupees</strong> {amountWords}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={print}>🖨 Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

export default function Payments() {
  const { user }    = useAuth();
  const { academy } = useAcademy();
  const [payments,     setPayments]     = useState([]);
  const [feeRecords,   setFeeRecords]   = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [search,       setSearch]       = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [receipt,      setReceipt]      = useState(null);
  const [form, setForm] = useState({ fee_record_id: "", amount: "", payment_mode: "cash", transaction_ref: "", paid_on: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  const load = () => {
    const q = filterBranch ? `?branch_id=${filterBranch}` : "";
    API.get(`/payments${q}`).then((r) => setPayments(r.data));
  };

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    load();
    Promise.all([
      API.get("/fees?status=pending"),
      API.get("/fees?status=partial"),
      API.get("/fees?status=overdue"),
    ]).then(([p, pa, o]) => {
      setFeeRecords([...p.data, ...pa.data, ...o.data]);
    });
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch]);

  const openPay = () => {
    setForm({ fee_record_id: "", amount: "", payment_mode: "cash", transaction_ref: "", paid_on: new Date().toISOString().split("T")[0], notes: "" });
    setError(""); setShowModal(true);
  };

  const pay = async () => {
    setError("");
    if (!form.fee_record_id) { setError("Please select a fee record."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Please enter a valid amount."); return; }
    setSaving(true);
    try {
      const { data } = await API.post("/payments", {
        fee_record_id:   form.fee_record_id,
        amount:          form.amount,
        payment_mode:    form.payment_mode,
        transaction_ref: form.transaction_ref || undefined,
        paid_on:         form.paid_on,
        notes:           form.notes || undefined,
      });
      setShowModal(false);
      load();
      const { data: full } = await API.get(`/payments/${data.id}`);
      setReceipt(full);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to record payment");
    } finally { setSaving(false); }
  };

  const viewReceipt = async (id) => {
    try {
      const { data } = await API.get(`/payments/${id}`);
      setReceipt(data);
    } catch (e) {
      alert("Failed to load receipt: " + (e.response?.data?.error || e.message));
    }
  };

  const filtered = payments.filter((p) => {
    if (search && !p.student_name?.toLowerCase().includes(search.toLowerCase()) && !p.receipt_no?.includes(search)) return false;
    return true;
  });

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const selectRecord = (id) => {
    const rec = feeRecords.find((r) => r.id == id);
    if (rec) {
      const balance = rec.amount_due - rec.amount_paid;
      setForm((p) => ({ ...p, fee_record_id: id, amount: balance > 0 ? balance : "" }));
    } else {
      setForm((p) => ({ ...p, fee_record_id: id }));
    }
  };

  const totalRevenue = filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div style={{ backgroundColor: '#0f1423', minHeight: '100vh', color: '#fff', paddingBottom: 100, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: '#0f1423' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ color: 'rgb(141, 156, 255)', fontSize: 20, fontWeight: 600, letterSpacing: '0.02em' }}>Payments</div>
        </div>
        <button 
          style={{ backgroundColor: 'rgb(141, 156, 255)', color: '#0f1423', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          onClick={openPay}
        >
          Record
        </button>
      </div>

      <div style={{ padding: '0 20px', marginTop: 10 }}>
        {/* SEARCH & FILTERS */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Search Database</label>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1b2234', borderRadius: 12, padding: '12px 16px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c8b9d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 12 }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              placeholder="Search student name, receipt ID..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, width: '100%', outline: 'none' }}
            />
          </div>
        </div>

        {user.role === 'super_admin' && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Branch Location</label>
            <div style={{ position: 'relative' }}>
              <select 
                value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                style={{ width: '100%', backgroundColor: '#1b2234', color: '#e2e8f0', border: 'none', borderRadius: 12, padding: '14px 16px', fontSize: 14, appearance: 'none', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <svg style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c8b9d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        )}

        {/* TOTAL REVENUE */}
        <div style={{ backgroundColor: '#1b2234', borderRadius: 16, padding: '24px 20px', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Total Revenue (Monthly)</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 16 }}>₹{totalRevenue.toLocaleString('en-IN')}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(141, 156, 255, 0.1)', padding: '6px 12px', borderRadius: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(141, 156, 255)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
            <span style={{ color: 'rgb(141, 156, 255)', fontSize: 11, fontWeight: 800 }}>+12.4% vs last month</span>
          </div>
        </div>

        {/* RECENT RECORDS HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Recent Records</div>
          <button style={{ background: 'none', border: 'none', color: 'rgb(141, 156, 255)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Download CSV</button>
        </div>

        {/* CARDS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#7c8b9d', fontSize: 14 }}>
              No payments recorded yet. 
            </div>
          ) : filtered.map(p => {
            const mode = (p.payment_mode || "CASH").toUpperCase();
            let modeBg = 'rgba(141, 156, 255, 0.1)';
            let modeColor = 'rgb(141, 156, 255)';
            if (mode === 'ONLINE' || mode === 'UPI' || mode === 'BANK TRANSFER') {
               modeBg = 'rgba(236, 72, 153, 0.1)';
               modeColor = '#ec4899';
            }

            const month = new Date(p.paid_on).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();

            return (
              <div key={p.id} style={{ backgroundColor: '#1b2234', borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center' }}>
                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#3541bd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 16 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                
                {/* Context */}
                <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                     {p.student_name}
                   </div>
                   <div style={{ fontSize: 10, fontWeight: 600, color: '#7c8b9d', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                     <span>{p.receipt_no}</span>
                     <span>•</span>
                     <span>{p.period_label ? p.period_label.toUpperCase() : month}</span>
                   </div>
                   
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <div style={{ fontSize: 16, fontWeight: 800, color: 'rgb(141, 156, 255)' }}>₹{Number(p.amount||0).toLocaleString('en-IN')}</div>
                     <div style={{ backgroundColor: modeBg, color: modeColor, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>{mode}</div>
                   </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <button onClick={() => viewReceipt(p.id)} style={{ backgroundColor: '#232b42', border: 'none', borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', cursor: 'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </button>
                  <button style={{ backgroundColor: '#232b42', border: 'none', borderRadius: 8, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', cursor: 'pointer' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        
        {filtered.length > 0 && (
          <button style={{ width: '100%', marginTop: 24, padding: '14px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, color: '#e2e8f0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Load More Transactions
          </button>
        )}
      </div>

      {/* FAB */}
      <div style={{ position: 'fixed', bottom: 94, right: 20, zIndex: 100 }}>
        <button 
          style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgb(141, 156, 255)', border: 'none', color: '#0f1423', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 30px rgba(141, 156, 255, 0.4)' }} 
          onClick={openPay}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ marginBottom: isMobile ? 80 : 0 }}>
            <div className="modal-header">
              <div className="modal-title">Record Payment</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Fee Record (Student – Period) *</label>
                  <select value={form.fee_record_id} onChange={(e) => selectRecord(e.target.value)}>
                    <option value="">Select fee record…</option>
                    {feeRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.student_name} – {r.period_label || "Manual"} [{r.status}] (Balance: ₹{(r.amount_due - r.amount_paid).toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={(e) => f("amount", e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Payment Mode *</label>
                  <select value={form.payment_mode} onChange={(e) => f("payment_mode", e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Transaction / Ref No.</label>
                  <input value={form.transaction_ref} onChange={(e) => f("transaction_ref", e.target.value)} placeholder="UPI txn ID / cheque no." />
                </div>
                <div className="form-group">
                  <label>Payment Date</label>
                  <input type="date" value={form.paid_on} onChange={(e) => f("paid_on", e.target.value)} />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} placeholder="Optional remarks…" style={{ minHeight: 50 }} />
                </div>
              </div>
              {error && <div className="error-msg" style={{ marginTop: 10 }}>⚠ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={pay} disabled={saving}>
                {saving ? "Processing…" : "✓ Record & Get Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && <Receipt payment={receipt} onClose={() => setReceipt(null)} academy={academy} isMobile={isMobile} />}
    </div>
  );
}
