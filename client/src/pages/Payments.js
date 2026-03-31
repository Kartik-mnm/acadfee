import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function InfoBox({ why, steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 20, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text1)" }}>
        <span>💡 How it works & Why use this section</span>
        <span style={{ fontSize: 18, fontWeight: 300, color: "var(--accent)", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "rgba(79,142,247,0.07)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>ℹ️ How it works</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                <div style={{ minWidth: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(16,185,129,0.07)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--green)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>✅ Why use this</div>
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

function Receipt({ payment, onClose, academy }) {
  const p = payment;
  const academyName   = academy?.name   || "Academy";
  const academyPhone  = academy?.phone  || "";
  const academyPhone2 = academy?.phone2 || "";
  const contactLine   = [academyPhone, academyPhone2].filter(Boolean).join(" / ");
  const balance       = (p.amount_due || 0) - (p.amount_paid || 0);
  const amountWords   = numberToWords(Math.round(p.amount || 0)) + " Rupees Only";
  const dueDate       = p.due_date ? new Date(p.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const paidDate      = p.paid_on  ? new Date(p.paid_on).toLocaleDateString("en-IN",  { day: "numeric", month: "long", year: "numeric" }) : "—";

  const receiptHTML = `<!DOCTYPE html><html><head><title>Fee Receipt - ${p.receipt_no}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#fff;color:#000}
.page{width:750px;margin:20px auto}.copies{display:flex}.copy{width:375px;border:2px solid #000}
.copy+.copy{border-left:1px dashed #999}.copy-inner{padding:12px 14px}
.hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:10px}
.academy-name{font-size:17px;font-weight:900;text-transform:uppercase}
.academy-addr{font-size:10px;color:#333;line-height:1.5;margin-top:2px}
.receipt-title-box{border:2px solid #000;text-align:center;padding:5px;margin:10px 0}
.receipt-title-box h2{font-size:16px;font-weight:900;letter-spacing:.05em}
.info-table{width:100%;border-collapse:collapse;margin-bottom:8px}
.info-table td{padding:4px 2px;font-size:11px;vertical-align:top}
.info-table .lbl{font-weight:700;width:90px;color:#333}.info-table .colon{width:10px}.info-table .val{font-weight:600}
.fee-table{width:100%;border-collapse:collapse;margin:8px 0}
.fee-table th{background:#e0e0e0;border:1px solid #999;padding:5px 6px;font-size:11px;text-align:left}
.fee-table td{border:1px solid #ccc;padding:5px 6px;font-size:11px}.fee-table .ac{text-align:right;font-weight:700}
.fee-table .sr td{background:#e8e8e8;font-weight:700}
.summary-table{width:100%;border-collapse:collapse;margin-top:4px}
.summary-table td{padding:4px 6px;font-size:11px;border:1px solid #ccc}
.summary-table .lbl{font-weight:700;background:#f5f5f5}.summary-table .val{text-align:right;font-weight:700}
.summary-table .br td{background:#fff3cd}
.words-box{border:1px solid #ccc;padding:5px 8px;margin-top:8px;font-size:10px}
.footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;padding-top:8px;border-top:1px solid #ccc}
.footer-note{font-size:9px;color:#666}.sign-box{text-align:center;font-size:10px}
.sign-line{border-top:1px solid #333;width:100px;margin:20px auto 4px}
@media print{body{margin:0}.page{margin:0;width:100%}.no-print{display:none}}</style>
</head><body>
<div class="page"><div class="copies">
${[1,2].map(()=>`<div class="copy"><div class="copy-inner">
<div class="hdr"><div class="academy-name">${academyName}</div>
<div class="academy-addr">${p.branch_name||""}</div>
${contactLine?`<div class="academy-addr">Contact: ${contactLine}</div>`:""}</div>
<div class="receipt-title-box"><h2>FEES RECEIPT</h2></div>
<table class="info-table"><tr>
<td class="lbl">Receipt No.</td><td class="colon">:</td><td class="val" style="font-family:monospace">${p.receipt_no}</td>
<td class="lbl" style="text-align:right">Date</td><td class="colon">:</td><td class="val">${paidDate}</td></tr></table>
<table class="info-table" style="border-top:1px solid #ccc;padding-top:6px;margin-top:4px">
<tr><td class="lbl">Student Name</td><td class="colon">:</td><td class="val" colspan="3">${p.student_name}</td></tr>
<tr><td class="lbl">Father's Name</td><td class="colon">:</td><td class="val" colspan="3">${p.parent_name||"—"}</td></tr>
<tr><td class="lbl">Batch/Course</td><td class="colon">:</td><td class="val">${p.batch_name||"—"}</td>
<td class="lbl" style="text-align:right">Branch</td><td class="colon">:</td><td class="val">${p.branch_name||"—"}</td></tr>
<tr><td class="lbl">Period</td><td class="colon">:</td><td class="val">${p.period_label||"—"}</td>
<td class="lbl" style="text-align:right">Due Date</td><td class="colon">:</td><td class="val" style="color:#c00;font-weight:900">${dueDate}</td></tr>
<tr><td class="lbl">Payment Mode</td><td class="colon">:</td><td class="val" colspan="3">${(p.payment_mode||"").toUpperCase()}${p.transaction_ref?" — "+p.transaction_ref:""}</td></tr></table>
<table class="fee-table"><thead><tr><th>Fee Details</th><th class="ac">Amount</th></tr></thead><tbody>
<tr><td>${p.period_label||"Tuition Fee"}</td><td class="ac">₹${Number(p.amount_due||0).toLocaleString("en-IN")}</td></tr>
<tr class="sr"><td></td><td class="ac">₹${Number(p.amount_due||0).toLocaleString("en-IN")}</td></tr></tbody></table>
<table class="summary-table">
<tr><td class="lbl" style="width:60%">Total Fee</td><td class="val">₹${Number(p.amount_due||0).toLocaleString("en-IN")}</td></tr>
<tr><td class="lbl">Paid Fee</td><td class="val">₹${Number(p.amount_paid||0).toLocaleString("en-IN")}</td></tr>
<tr class="br"><td class="lbl">Balance Fee</td><td class="val" style="color:${balance>0?"#c00":"#090"}">₹${Number(balance).toLocaleString("en-IN")}</td></tr></table>
<div class="words-box"><span style="font-weight:700">Rupees </span>${amountWords}</div>
<div class="footer"><div class="footer-note">Computer generated receipt.<br/>No signature required.</div>
<div class="sign-box"><div class="sign-line"></div>Authorized Signatory</div></div>
</div></div>`).join("")}
</div></div><script>window.onload=()=>window.print();</script></body></html>`;

  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(receiptHTML);
    w.document.close();
  };

  const balance2 = (p.amount_due || 0) - (p.amount_paid || 0);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
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
  // FIX: removed student_id from form — backend now looks it up from fee_record_id
  const [form, setForm] = useState({ fee_record_id: "", amount: "", payment_mode: "cash", transaction_ref: "", paid_on: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const load = () => {
    const q = filterBranch ? `?branch_id=${filterBranch}` : "";
    API.get(`/payments${q}`).then((r) => setPayments(r.data));
  };

  useEffect(() => {
    load();
    // Load ALL fee records that have outstanding balance (pending + partial + overdue)
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
      // FIX: only send fee_record_id (no student_id) — backend resolves student from fee record
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
      // Fetch full payment details for receipt
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

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payments</div>
          <div className="page-sub">{filtered.length} transaction(s)</div>
        </div>
        <button className="btn btn-primary" onClick={openPay}>+ Record Payment</button>
      </div>

      <InfoBox
        steps={[
          "A student comes to pay fees — click + Record Payment at the top right.",
          "Select the fee record (student name + period auto-fills), enter the amount received, choose payment mode (Cash / UPI / Bank Transfer / Cheque).",
          "Click ✓ Record & Get Receipt — a professional double-copy receipt is instantly generated and printed.",
          "The fee record status auto-updates: Pending → Partial (if part-paid) → Paid (if fully paid).",
          "All payments are logged here with receipt numbers. Click 🧾 Receipt on any row to reprint at any time.",
        ]}
        why={[
          "Instant professional receipts — no more handwritten slips that get lost.",
          "Every payment is recorded with date, mode, and reference number for full audit trail.",
          "Supports partial payments — students can pay in installments across months.",
          "Receipt has the academy name, branch, student, period, and balance clearly printed.",
          "All data syncs to Fee Records and Reports automatically — zero double-entry.",
        ]}
      />

      <div className="filters-bar">
        <input className="search-input" placeholder="Search student / receipt no…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {user.role === "super_admin" && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <div className="empty-text">No payments recorded</div>
            <div className="empty-sub">Click + Record Payment to get started</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt No.</th><th>Student</th>
                  {user.role === "super_admin" && <th>Branch</th>}
                  <th>Period</th><th>Amount</th><th>Mode</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontSize: 12, color: "var(--text2)" }}>{p.receipt_no}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.student_name}</div>
                      <div className="text-muted text-sm mono">{p.phone}</div>
                    </td>
                    {user.role === "super_admin" && <td className="text-muted">{p.branch_name}</td>}
                    <td className="text-muted">{p.period_label || "—"}</td>
                    <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>{fmt(p.amount)}</td>
                    <td><span className="badge badge-blue">{p.payment_mode}</span></td>
                    <td className="text-muted">{new Date(p.paid_on).toLocaleDateString("en-IN")}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => viewReceipt(p.id)}>🧾 Receipt</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
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

      {receipt && <Receipt payment={receipt} onClose={() => setReceipt(null)} academy={academy} />}
    </div>
  );
}
