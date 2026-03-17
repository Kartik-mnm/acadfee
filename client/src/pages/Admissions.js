import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import QRCode from "qrcode";

export default function Admissions() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState("");
  const [filter, setFilter]       = useState("pending");

  // QR code URL for admission form
  const admissionUrl = `${window.location.origin}/apply`;
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(admissionUrl, {
      width: 200, margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a1628", light: "#ffffff" }
    }).then(setQrDataUrl).catch(console.error);
  }, [admissionUrl]);

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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>

          {/* QR Image */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {qrDataUrl ? (
              <div style={{ background: "white", padding: 12, borderRadius: 12, border: "2px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                <img src={qrDataUrl} alt="Admission QR" style={{ width: 160, height: 160, display: "block" }} />
              </div>
            ) : (
              <div style={{ width: 160, height: 160, background: "var(--bg3)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)" }}>
                Generating…
              </div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const a = document.createElement("a");
              a.href = qrDataUrl; a.download = "admission-qr.png"; a.click();
            }}>⬇ Download QR</button>
          </div>

          {/* Link + instructions */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--text2)" }}>
              Share this link or print the QR code. Students scan it to fill the admission form — no login required!
            </div>
            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: "var(--accent)", marginBottom: 10, wordBreak: "break-all" }}>
              {admissionUrl}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(admissionUrl).then(() => alert("Link copied!"))}>
                📋 Copy Link
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const w = window.open("", "_blank");
                w.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f0f0;font-family:Arial">
                  <div style="text-align:center;background:white;padding:32px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15)">
                    <div style="font-size:20px;font-weight:900;color:#0a1628;margin-bottom:4px">NISHCHAY ACADEMY</div>
                    <div style="font-size:13px;color:#555;margin-bottom:20px">Scan to fill Admission Form</div>
                    <img src="${qrDataUrl}" style="width:200px;height:200px" />
                    <div style="font-size:11px;color:#888;margin-top:16px">${admissionUrl}</div>
                  </div>
                </body></html>`);
                w.document.close(); setTimeout(() => w.print(), 400);
              }}>🖨 Print QR</button>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(79,142,247,0.08)", borderRadius: 8, fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
              <strong>How it works:</strong><br />
              1. Student scans QR → form opens in browser<br />
              2. They fill name, phone, course details<br />
              3. Enquiry appears here for you to approve/reject<br />
              4. On approve → student is automatically created
            </div>
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
