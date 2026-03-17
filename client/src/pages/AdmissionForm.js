import { useState, useEffect } from "react";
import API from "../api";

export default function AdmissionForm() {
  const [branches, setBranches] = useState([]);
  const [batches,  setBatches]  = useState([]);
  const [form, setForm] = useState({
    name: "", phone: "", parent_phone: "", email: "",
    batch_id: "", address: "", branch_id: ""
  });
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    API.get("/admission/form-data").then((r) => {
      setBranches(r.data.branches);
      setBatches(r.data.batches);
    }).catch(() => {});
  }, []);

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const filteredBatches = form.branch_id
    ? batches.filter((b) => b.branch_id == form.branch_id)
    : batches;

  const submit = async () => {
    if (!form.name || !form.phone) { setError("Name and phone are required"); return; }
    setSaving(true); setError("");
    try {
      await API.post("/admission/enquiry", form);
      setSubmitted(true);
    } catch (e) {
      setError(e.response?.data?.error || "Submission failed. Please try again.");
    } finally { setSaving(false); }
  };

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a1628, #1565c0)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "48px 40px", textAlign: "center", maxWidth: 400, width: "100%" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0a1628", marginBottom: 8 }}>Application Submitted!</div>
        <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
          Thank you for your interest in Nishchay Academy.<br />
          Our team will review your application and contact you shortly.
        </div>
        <div style={{ marginTop: 24, padding: "12px 20px", background: "#f0f7ff", borderRadius: 10, fontSize: 13, color: "#1565c0" }}>
          📞 For enquiries call: <strong>8956419453</strong>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a1628, #1565c0)", padding: "20px 16px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 20 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#f0d060", letterSpacing: 1 }}>NISHCHAY ACADEMY</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Admission Enquiry Form</div>
        </div>

        {/* Form Card */}
        <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ background: "linear-gradient(135deg, #0a1628, #1565c0)", padding: "20px 24px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>📝 Student Details</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Fill in your details to apply for admission</div>
          </div>

          <div style={{ padding: "24px" }}>
            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #f75f5f", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f75f5f", fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                  Student Name *
                </label>
                <input
                  style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  placeholder="Enter full name"
                  value={form.name} onChange={(e) => f("name", e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Phone *</label>
                  <input style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    placeholder="Student phone" type="tel"
                    value={form.phone} onChange={(e) => f("phone", e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Parent Phone</label>
                  <input style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    placeholder="Parent phone" type="tel"
                    value={form.parent_phone} onChange={(e) => f("parent_phone", e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Email</label>
                <input style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  placeholder="Email address" type="email"
                  value={form.email} onChange={(e) => f("email", e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Branch</label>
                <select style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }}
                  value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                  <option value="">Select branch</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Course / Batch</label>
                <select style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }}
                  value={form.batch_id} onChange={(e) => f("batch_id", e.target.value)}>
                  <option value="">Select course</option>
                  {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.fee_monthly ? ` — ₹${b.fee_monthly}/mo` : ""}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Address</label>
                <textarea style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", minHeight: 70, boxSizing: "border-box" }}
                  placeholder="Home address"
                  value={form.address} onChange={(e) => f("address", e.target.value)} />
              </div>

              <button
                onClick={submit} disabled={saving}
                style={{ width: "100%", padding: "13px", background: saving ? "#888" : "linear-gradient(135deg, #0a1628, #1565c0)", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", marginTop: 4 }}>
                {saving ? "Submitting…" : "Submit Application →"}
              </button>

              <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>
                By submitting, you agree to be contacted by Nishchay Academy
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,0.5)", fontSize: 12, paddingBottom: 20 }}>
          NISHCHAY ACADEMY · 8956419453
        </div>
      </div>
    </div>
  );
}
