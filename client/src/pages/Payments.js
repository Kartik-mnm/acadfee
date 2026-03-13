import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Convert number to words (Indian style)
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

function Receipt({ payment, onClose }) {
  const p = payment;
  const balance = (p.amount_due || 0) - (p.amount_paid || 0);
  const amountWords = numberToWords(Math.round(p.amount || 0)) + " Rupees Only";
  const dueDate = p.due_date ? new Date(p.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const paidDate = p.paid_on ? new Date(p.paid_on).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Fee Receipt - ${p.receipt_no}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; color: #000; }
    .page { width: 750px; margin: 20px auto; padding: 0; }

    /* Two copies side by side */
    .copies { display: flex; gap: 0; }
    .copy { width: 375px; border: 2px solid #000; padding: 0; }
    .copy + .copy { border-left: 1px dashed #999; }

    .copy-inner { padding: 12px 14px; }

    /* Header */
    .hdr { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
    .academy-name { font-size: 17px; font-weight: 900; text-transform: uppercase; }
    .academy-addr { font-size: 10px; color: #333; line-height: 1.5; margin-top: 2px; }
    .academy-phone { font-size: 10px; color: #333; }

    /* Receipt Title */
    .receipt-title-box { border: 2px solid #000; text-align: center; padding: 5px; margin: 10px 0; }
    .receipt-title-box h2 { font-size: 16px; font-weight: 900; letter-spacing: .05em; }

    /* Info rows */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .info-table td { padding: 4px 2px; font-size: 11px; vertical-align: top; }
    .info-table .lbl { font-weight: 700; width: 90px; color: #333; }
    .info-table .colon { width: 10px; }
    .info-table .val { font-weight: 600; }

    /* Fee details table */
    .fee-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .fee-table th { background: #e0e0e0; border: 1px solid #999; padding: 5px 6px; font-size: 11px; text-align: left; }
    .fee-table td { border: 1px solid #ccc; padding: 5px 6px; font-size: 11px; }
    .fee-table .amount-col { text-align: right; font-weight: 700; }
    .fee-table .total-row { background: #f0f0f0; font-weight: 900; }
    .fee-table .subtotal-row td { background: #e8e8e8; font-weight: 700; }

    /* Summary rows */
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .summary-table td { padding: 4px 6px; font-size: 11px; border: 1px solid #ccc; }
    .summary-table .lbl { font-weight: 700; background: #f5f5f5; }
    .summary-table .val { text-align: right; font-weight: 700; }
    .summary-table .balance-row td { background: #fff3cd; }

    /* Amount in words */
    .words-box { border: 1px solid #ccc; padding: 5px 8px; margin-top: 8px; font-size: 10px; }
    .words-label { font-weight: 700; }

    /* Footer */
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ccc; }
    .footer-note { font-size: 9px; color: #666; }
    .sign-box { text-align: center; font-size: 10px; }
    .sign-line { border-top: 1px solid #333; width: 100px; margin: 20px auto 4px; }

    @media print {
      body { margin: 0; }
      .page { margin: 0; width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="copies">
    ${[1,2].map(() => `
    <div class="copy">
      <div class="copy-inner">
        <!-- Header -->
        <div class="hdr">
          <div class="academy-name">NISHCHAY ACADEMY</div>
          <div class="academy-addr">${p.branch_name || ""}</div>
          <div class="academy-phone">Contact: 8956419453</div>
        </div>

        <!-- Title -->
        <div class="receipt-title-box">
          <h2>FEES RECEIPT</h2>
        </div>

        <!-- Receipt & Date -->
        <table class="info-table">
          <tr>
            <td class="lbl">Receipt No.</td><td class="colon">:</td>
            <td class="val" style="font-family:monospace;">${p.receipt_no}</td>
            <td class="lbl" style="text-align:right;">Date</td><td class="colon">:</td>
            <td class="val">${paidDate}</td>
          </tr>
        </table>

        <!-- Student Info -->
        <table class="info-table" style="border-top:1px solid #ccc; padding-top:6px; margin-top:4px;">
          <tr>
            <td class="lbl">Student Name</td><td class="colon">:</td>
            <td class="val" colspan="3">${p.student_name}</td>
          </tr>
          <tr>
            <td class="lbl">Father's Name</td><td class="colon">:</td>
            <td class="val" colspan="3">${p.parent_name || "—"}</td>
          </tr>
          <tr>
            <td class="lbl">Batch / Course</td><td class="colon">:</td>
            <td class="val">${p.batch_name || "—"}</td>
            <td class="lbl" style="text-align:right;">Branch</td><td class="colon">:</td>
            <td class="val">${p.branch_name || "—"}</td>
          </tr>
          <tr>
            <td class="lbl">Period</td><td class="colon">:</td>
            <td class="val">${p.period_label || "—"}</td>
            <td class="lbl" style="text-align:right;">Due Date</td><td class="colon">:</td>
            <td class="val" style="color:#c00; font-weight:900;">${dueDate}</td>
          </tr>
          <tr>
            <td class="lbl">Payment Mode</td><td class="colon">:</td>
            <td class="val" colspan="3">${(p.payment_mode || "").toUpperCase()}${p.transaction_ref ? " — " + p.transaction_ref : ""}</td>
          </tr>
        </table>

        <!-- Fee Table -->
        <table class="fee-table">
          <thead>
            <tr>
              <th>Student's Fee Details</th>
              <th class="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${p.period_label || "Tuition Fee"}</td>
              <td class="amount-col">₹${Number(p.amount_due || 0).toLocaleString("en-IN")}</td>
            </tr>
            <tr class="subtotal-row">
              <td></td>
              <td class="amount-col">₹${Number(p.amount_due || 0).toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>

        <!-- Summary -->
        <table class="summary-table">
          <tr>
            <td class="lbl" style="width:60%">Total Fee</td>
            <td class="val">₹${Number(p.amount_due || 0).toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td class="lbl">Paid Fee</td>
            <td class="val">₹${Number(p.amount_paid || 0).toLocaleString("en-IN")}</td>
          </tr>
          <tr class="balance-row">
            <td class="lbl">Balance Fee</td>
            <td class="val" style="color:${balance > 0 ? '#c00' : '#090'};">₹${Number(balance).toLocaleString("en-IN")}</td>
          </tr>
        </table>

        <!-- Amount in Words -->
        <div class="words-box">
          <span class="words-label">Rupees </span>${amountWords}
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-note">Computer generated receipt.<br/>No signature required.</div>
          <div class="sign-box">
            <div class="sign-line"></div>
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
    `).join("")}
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(receiptHTML);
    w.document.close();
  };

  // Preview version
  const balance2 = (p.amount_due || 0) - (p.amount_paid || 0);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">🧾 Fee Receipt</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Preview Card */}
          <div style={{ border: "2px solid var(--border)", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
            {/* Header */}
            <div style={{ background: "var(--bg3)", textAlign: "center", padding: "12px 16px", borderBottom: "2px solid var(--border)" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>NISHCHAY ACADEMY</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>{p.branch_name}</div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 6, border: "1px solid var(--border)", padding: "3px 20px", display: "inline-block", borderRadius: 4 }}>FEES RECEIPT</div>
            </div>
            <div style={{ padding: "12px 16px" }}>
              {/* Top row */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                <div><span style={{ color: "var(--text2)" }}>Receipt No. </span><strong className="mono">{p.receipt_no}</strong></div>
                <div><span style={{ color: "var(--text2)" }}>Date: </span><strong>{paidDate}</strong></div>
              </div>
              {/* Student info */}
              {[
                ["Student Name", p.student_name],
                ["Father's Name", p.parent_name || "—"],
                ["Batch / Course", p.batch_name || "—"],
                ["Period", p.period_label],
                ["Due Date", <span style={{ color: "var(--red)", fontWeight: 800 }}>{dueDate}</span>],
                ["Payment Mode", (p.payment_mode || "").toUpperCase()],
                p.transaction_ref ? ["Txn / Ref No.", p.transaction_ref] : null,
              ].filter(Boolean).map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed var(--border)", fontSize: 12 }}>
                  <span style={{ color: "var(--text2)" }}>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
              {/* Fee table */}
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
                    ["Total Fee", fmt(p.amount_due), "#000"],
                    ["Paid Fee", fmt(p.amount), "var(--green)"],
                    ["Balance Fee", fmt(balance2), balance2 > 0 ? "var(--red)" : "var(--green)"],
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
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [feeRecords, setFeeRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [form, setForm] = useState({ fee_record_id: "", amount: "", payment_mode: "cash", transaction_ref: "", paid_on: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    const q = filterBranch ? `?branch_id=${filterBranch}` : "";
    API.get(`/payments${q}`).then((r) => setPayments(r.data));
  };

  useEffect(() => {
    load();
    API.get("/fees?status=pending").then((r) => setFeeRecords(r.data));
    API.get("/fees?status=partial").then((r) => setFeeRecords((p) => [...p, ...r.data]));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch]);

  const openPay = () => {
    setForm({ fee_record_id: "", amount: "", payment_mode: "cash", transaction_ref: "", paid_on: new Date().toISOString().split("T")[0], notes: "" });
    setError(""); setShowModal(true);
  };

  const pay = async () => {
    setSaving(true); setError("");
    try {
      const { data } = await API.post("/payments", form);
      setShowModal(false); load();
      const { data: full } = await API.get(`/payments/${data.id}`);
      setReceipt(full);
    } catch (e) { setError(e.response?.data?.error || "Failed"); }
    finally { setSaving(false); }
  };

  const viewReceipt = async (id) => {
    const { data } = await API.get(`/payments/${id}`);
    setReceipt(data);
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
      setForm((p) => ({ ...p, fee_record_id: id, amount: balance }));
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

      {/* Payment Modal */}
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
                        {r.student_name} – {r.period_label} (Balance: ₹{(r.amount_due - r.amount_paid).toLocaleString("en-IN")})
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

      {receipt && <Receipt payment={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
