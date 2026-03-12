import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function Receipt({ payment, onClose }) {
  const ref = useRef();
  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Receipt</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 16px; }
        .academy { font-size: 22px; font-weight: 900; }
        .branch  { font-size: 13px; color: #555; }
        .title   { font-size: 15px; font-weight: 700; margin-top: 8px; text-transform: uppercase; letter-spacing: .08em; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #ddd; }
        .total { font-size: 16px; font-weight: 900; display: flex; justify-content: space-between; margin-top: 12px; }
        .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #888; }
      </style></head><body>${ref.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  if (!payment) return null;
  const p = payment;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div className="modal-title">🧾 Fee Receipt</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div ref={ref} className="receipt">
            <div className="receipt-header">
              <div className="receipt-academy">🎓 AcadFee Institute</div>
              <div className="receipt-branch">{p.branch_name} · {p.branch_address}</div>
              <div className="receipt-title">Fee Receipt</div>
            </div>
            <div className="receipt-row"><span>Receipt No.</span><strong className="mono">{p.receipt_no}</strong></div>
            <div className="receipt-row"><span>Student Name</span><strong>{p.student_name}</strong></div>
            <div className="receipt-row"><span>Batch / Course</span><strong>{p.batch_name || "—"}</strong></div>
            <div className="receipt-row"><span>Period</span><strong>{p.period_label || "—"}</strong></div>
            <div className="receipt-row"><span>Payment Mode</span><strong style={{ textTransform: "uppercase" }}>{p.payment_mode}</strong></div>
            {p.transaction_ref && <div className="receipt-row"><span>Txn Reference</span><strong>{p.transaction_ref}</strong></div>}
            <div className="receipt-row"><span>Payment Date</span><strong>{new Date(p.paid_on).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong></div>
            <div className="receipt-row"><span>Collected By</span><strong>{p.collected_by_name}</strong></div>
            <hr style={{ margin: "10px 0", border: "none", borderTop: "2px solid #111" }} />
            <div className="receipt-total">
              <span>Amount Paid</span>
              <span>{fmt(p.amount)}</span>
            </div>
            {p.amount_due - p.amount_paid > 0 && (
              <div style={{ fontSize: 12, color: "#d00", marginTop: 6, textAlign: "right" }}>
                Balance Due: {fmt(p.amount_due - p.amount_paid)}
              </div>
            )}
            <div className="receipt-footer">
              Thank you for your payment!<br />
              This is a computer-generated receipt. No signature required.
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

  const openPay = () => { setForm({ fee_record_id: "", amount: "", payment_mode: "cash", transaction_ref: "", paid_on: new Date().toISOString().split("T")[0], notes: "" }); setError(""); setShowModal(true); };

  const pay = async () => {
    setSaving(true); setError("");
    try {
      const { data } = await API.post("/payments", form);
      setShowModal(false); load();
      // Fetch full receipt details
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

  // Auto-fill amount when fee record selected
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
