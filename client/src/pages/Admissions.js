import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

export default function Admissions() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState("");
  const [filter, setFilter]       = useState("pending");

  // QR code URL for admission form
  const admissionUrl = `${window.location.origin}/apply`;

  const load = () => {
    setLoading(true);
    API.get("/admission/enquiries")
      .then((r) => setEnquiries(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      const { data } = await API.post(`/admission/enquiries/${id}/approve`);
      setMsg(`✅ Approved! Student ID: NA-${String(data.student.id).padStart(5,"0")}`);
      load();
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setMsg("⚠️ " + (e.response?.data?.error || "Failed"));
    }
  };

  const reject = async (id) => {
    if (!window.confirm("Reject this enquiry?")) return;
    await API.patch(`/admission/enquiries/${id}/reject`);
    load();
  };

  const printForm = (e) => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Admission Form - ${e.name}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
      .header { text-align: center; border-bottom: 3px solid #0a1628; padding-bottom: 16px; margin-bottom: 24px; }
      .academy { font-size: 22px; font-weight: 900; color: #0a1628; letter-spacing: 1px; }
      .subtitle { font-size: 13px; color: #555; margin-top: 4px; }
      .form-title { font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; border: 2px solid #0a1628; padding: 8px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
      .field { border-bottom: 1.5px solid #ccc; padding-bottom: 6px; }
      .field-label { font-size: 9px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
      .field-value { font-size: 14px; font-weight: 600; margin-top: 3px; min-height: 20px; }
      .full { grid-column: 1 / -1; }
      .status { display: inline-block; padding: 4px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
      .status-pending  { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
      .status-approved { background: #d4edda; color: #155724; border: 1px solid #28a745; }
      .status-rejected { background: #f8d7da; color: #721c24; border: 1px solid #dc3545; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; }
      .sign-box { text-align: center; }
      .sign-line { border-top: 1.5px solid #333; width: 160px; margin: 0 auto; padding-top: 6px; font-size: 11px; color: #555; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="header">
      <div class="academy">NISHCHAY ACADEMY</div>
      <div class="subtitle">Admission Enquiry Form</div>
    </div>
    <div class="form-title">Student Admission Application</div>
    <div class="grid">
      <div class="field"><div class="field-label">Enquiry ID</div><div class="field-value">#${e.id}</div></div>
      <div class="field"><div class="field-label">Date</div><div class="field-value">${new Date(e.created_at).toLocaleDateString("en-IN")}</div></div>
      <div class="field full"><div class="field-label">Student Name</div><div class="field-value">${e.name}</div></div>
      <div class="field"><div class="field-label">Student Phone</div><div class="field-value">${e.phone || "—"}</div></div>
      <div class="field"><div class="field-label">Parent Phone</div><div class="field-value">${e.parent_phone || "—"}</div></div>
      <div class="field full"><div class="field-label">Email</div><div class="field-value">${e.email || "—"}</div></div>
      <div class="field"><div class="field-label">Branch</div><div class="field-value">${e.branch_name || "—"}</div></div>
      <div class="field"><div class="field-label">Course / Batch</div><div class="field-value">${e.batch_name || "—"}</div></div>
      <div class="field full"><div class="field-label">Address</div><div class="field-value">${e.address || "—"}</div></div>
      <div class="field"><div class="field-label">Status</div><div class="field-value"><span class="status status-${e.status}">${e.status}</span></div></div>
      ${e.student_id ? `<div class="field"><div class="field-label">Student ID</div><div class="field-value">NA-${String(e.student_id).padStart(5,"0")}</div></div>` : ""}
    </div>
    <div class="footer">
      <div class="sign-box"><div class="sign-line">Student / Parent Signature</div></div>
      <div class="sign-box"><div class="sign-line">Admin Signature</div></div>
      <div class="sign-box"><div class="sign-line">Authorized By</div></div>
    </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const filtered = enquiries.filter((e) => filter === "all" ? true : e.status === filter);

  const statusColor = (s) => s === "approved" ? "badge-green" : s === "rejected" ? "badge-red" : "badge-yellow";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🎓 Admissions</div>
          <div className="page-sub">Manage admission enquiries</div>
        </div>
      </div>

      {/* QR Code for Admission */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📱 Admission QR Code</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--text2)" }}>
              Share this link or QR code with students to fill the admission form:
            </div>
            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: "var(--accent)", marginBottom: 10 }}>
              {admissionUrl}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(admissionUrl).then(() => alert("Link copied!"))}>
              📋 Copy Link
            </button>
          </div>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({enquiries.filter((e) => s === "all" ? true : e.status === s).length})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Enquiries ({filtered.length})</div>
        {loading ? <div className="loading">Loading…</div>
        : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">No {filter} enquiries</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Phone</th><th>Branch</th><th>Course</th><th>Date</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="mono text-muted">{e.id}</td>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td className="text-muted">{e.phone}</td>
                    <td className="text-muted">{e.branch_name || "—"}</td>
                    <td className="text-muted">{e.batch_name || "—"}</td>
                    <td className="text-muted">{new Date(e.created_at).toLocaleDateString("en-IN")}</td>
                    <td><span className={`badge ${statusColor(e.status)}`}>{e.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => printForm(e)}>🖨 Print</button>
                        {e.status === "pending" && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => approve(e.id)}>✅ Approve</button>
                            <button className="btn btn-sm btn-danger"  onClick={() => reject(e.id)}>❌ Reject</button>
                          </>
                        )}
                        {e.status === "approved" && e.student_id && (
                          <span className="text-muted" style={{ fontSize: 11 }}>NA-{String(e.student_id).padStart(5,"0")}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
