import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import QRCode from "qrcode";

export default function Admissions() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState("");
  const [filter,    setFilter]    = useState("pending");

  const admissionUrl = `${window.location.origin}/apply`;
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(admissionUrl, { width: 200, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a1628", light: "#ffffff" } })
      .then(setQrDataUrl).catch(console.error);
  }, [admissionUrl]);

  const load = () => {
    setLoading(true);
    API.get("/admission/enquiries").then((r) => setEnquiries(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      const { data } = await API.post(`/admission/enquiries/${id}/approve`);
      setMsg(`✅ Approved! Student created successfully.`);
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

  // Print the EXACT Nishchay Academy registration form with all student data
  const printForm = (enq) => {
    // Safely parse extra JSON — handles string, object, or null
    let ex = {};
    if (enq.extra) {
      try {
        ex = typeof enq.extra === "string" ? JSON.parse(enq.extra) : enq.extra;
      } catch { ex = {}; }
    }

    // Photo: prefer dedicated column, then extra JSON
    const photoUrl = enq.photo_url || ex.photo_url || "";

    // All fields from extra (filled in by student on /apply)
    const aadhar         = ex.aadhar          || "";
    const fatherName     = ex.father_name     || "";
    const motherName     = ex.mother_name     || "";
    const dob            = ex.dob             || "";
    const age            = ex.age             || "";
    const motherTongue   = ex.mother_tongue   || "";
    const previousSchool = ex.previous_school || "";
    const medium         = ex.medium          || "";
    const className      = ex.class_name      || "";
    const percent        = ex.percent         || "";
    const guardianName   = ex.guardian_name   || "";

    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html>
<html><head><title>Registration Form — ${enq.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; background: #e8e8e8; padding: 20px 16px; }
  @media print { body { background: white; padding:0; } .no-print { display:none !important; } }
  .form-wrap { max-width: 720px; margin: 0 auto; background: white; box-shadow: 0 4px 32px rgba(0,0,0,0.18); border-radius: 4px; }
  .header { padding: 20px 28px 16px; border-bottom: 4px solid #cc0000; }
  .header-inner { display: flex; align-items: center; justify-content: center; gap: 20px; }
  .academy-name { font-size: 36px; font-weight: 900; color: #cc0000; font-family: 'Arial Black', Arial, sans-serif; letter-spacing: 2px; line-height: 1; }
  .academy-addr { font-size: 11px; color: #333; margin-top: 8px; line-height: 1.8; text-align: center; }
  .form-title-bar { text-align: center; padding: 10px; border-bottom: 2px solid #cc0000; }
  .form-title-text { font-size: 17px; font-weight: 900; color: #cc0000; letter-spacing: 3px; text-decoration: underline; }
  .body { padding: 18px 28px; }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 20px; }
  .photo-box { width: 100px; height: 120px; border: 2px solid #333; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fafafa; border-radius: 2px; flex-shrink: 0; font-size: 13px; font-weight: 900; color: #333; }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; }
  .inp { display: inline-block; width: 100%; padding: 3px 2px; border: none; border-bottom: 1.5px solid #333; background: transparent; font-size: 13px; font-family: Arial,sans-serif; color: #000; min-height: 22px; vertical-align: bottom; }
  .lbl { font-size: 12px; font-weight: 700; color: #111; white-space: nowrap; }
  .num { font-size: 12px; font-weight: 700; color: #111; min-width: 22px; }
  .field-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .divider { border-top: 1px solid #ccc; margin-bottom: 14px; }
  .addr-box { flex:1; min-height: 55px; border: 1px solid #999; padding: 6px 8px; border-radius: 2px; font-size: 13px; font-family: Arial,sans-serif; color: #000; background: white; white-space: pre-wrap; word-break: break-word; }
  .declaration { border: 2px solid #333; border-radius: 4px; padding: 14px 18px; margin-bottom: 18px; }
  .decl-title { text-align: center; font-size: 13px; font-weight: 900; color: #cc0000; text-decoration: underline; margin-bottom: 12px; letter-spacing: 1px; }
  .decl-text { font-size: 12px; line-height: 2; color: #111; }
  .blank { display: inline-block; border-bottom: 1px solid #333; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 20px; font-size: 12px; }
  .footer-note { text-align: center; font-size: 11px; color: #888; margin-top: 10px; padding-bottom: 16px; }
  .print-btn { padding: 10px 28px; background: #cc0000; color: white; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; font-weight: 900; letter-spacing: 1px; }
</style></head><body>
<div class="form-wrap">
  <div class="header"><div class="header-inner"><div style="text-align:center">
    <div class="academy-name">NISHCHAY ACADEMY</div>
    <div class="academy-addr">
      Branch 1. Beside P.D. Hospital, Dabha, Khadgaon Road, Wadi, Nagpur- 23<br/>
      Branch 2. 1st Floor, Seva Medical, Dattwadi, Nagpur- 23<br/>
      Branch 3. G-34 , Sai Regency , Ravinagar , Nagpur -01<br/>
      Mob: 8208145483, 9371333013 &nbsp;|&nbsp; nishchayacademy20@gmail.com
    </div>
  </div></div></div>
  <div class="form-title-bar"><span class="form-title-text">REGISTRATION FORM</span></div>
  <div class="body">
    <div class="top-row">
      <div style="flex:1">
        <div class="field-row"><span class="lbl">AADHAR NO. :</span><div class="inp">${aadhar}</div></div>
        <div class="field-row"><span class="lbl" style="min-width:60px">BRANCH :</span><div class="inp">${enq.branch_name || ""}</div></div>
        <div class="field-row"><span class="lbl" style="min-width:60px">COURSE :</span><div class="inp">${enq.batch_name || ""}</div></div>
      </div>
      <div class="photo-box">${photoUrl ? `<img src="${photoUrl}" alt="Photo"/>` : "PHOTO"}</div>
    </div>
    <div class="divider"></div>
    <div class="field-row"><span class="num">1)</span><span class="lbl" style="min-width:190px">FULL NAME OF STUDENT :</span><div class="inp" style="flex:1">${enq.name || ""}</div></div>
    <div class="field-row"><span class="num">2)</span><span class="lbl" style="min-width:190px">FATHER NAME :</span><div class="inp" style="flex:1">${fatherName}</div></div>
    <div class="field-row"><span class="num">3)</span><span class="lbl" style="min-width:190px">MOTHER NAME :</span><div class="inp" style="flex:1">${motherName}</div></div>
    <div class="field-row">
      <span class="num">4)</span><span class="lbl" style="min-width:130px">DATE OF BIRTH :</span><div class="inp" style="flex:2">${dob}</div>
      <span class="num" style="margin-left:12px">5)</span><span class="lbl">AGE :</span><div class="inp" style="width:60px">${age}</div>
    </div>
    <div class="field-row"><span class="num">6)</span><span class="lbl" style="min-width:190px">MOTHER TONGUE :</span><div class="inp" style="flex:1">${motherTongue}</div></div>
    <div class="field-row"><span class="num">7)</span><span class="lbl" style="min-width:190px">PREVIOUS SCHOOL :</span><div class="inp" style="flex:1">${previousSchool}</div></div>
    <div class="field-row">
      <span class="num">8)</span><span class="lbl">MEDIUM :</span><div class="inp" style="width:100px">${medium}</div>
      <span class="lbl" style="margin-left:10px">CLASS :</span><div class="inp" style="width:80px">${className}</div>
      <span class="lbl" style="margin-left:10px">PERCENT :</span><div class="inp" style="width:80px">${percent}</div>
    </div>
    <div class="field-row"><span class="num">9)</span><span class="lbl" style="min-width:230px">NAME OF PARENT OR GUARDIAN :</span><div class="inp" style="flex:1">${guardianName}</div></div>
    <div class="field-row" style="align-items:flex-start">
      <span class="num">10)</span><span class="lbl" style="min-width:80px">ADDRESS :</span>
      <div class="addr-box">${enq.address || ""}</div>
    </div>
    <div class="divider"></div>
    <div class="field-row"><span class="num">11)</span><span class="lbl" style="min-width:220px">STUDENT MOBILE NUMBER :</span><div class="inp" style="flex:1">${enq.phone || ""}</div></div>
    <div class="field-row"><span class="num">12)</span><span class="lbl" style="min-width:220px">PARENT MOBILE NUMBER :</span><div class="inp" style="flex:1">${enq.parent_phone || ""}</div></div>
    <div class="field-row"><span class="num">13)</span><span class="lbl" style="min-width:220px">EMAIL ID :</span><div class="inp" style="flex:1">${enq.email || ""}</div></div>
    <div style="border-top:2px solid #333;margin:18px 0"></div>
    <div class="declaration">
      <div class="decl-title">DECLARATION BY PARENTS / GUARDIAN</div>
      <div class="decl-text">I <span class="blank" style="min-width:180px">&nbsp;</span> REQUEST TO ADMIT MY SON / DAUGHTER IN CLASS <span class="blank" style="min-width:60px">&nbsp;</span> OF THE NISHCHAY ACADEMY, NAGPUR. I AGREE TO THE TERMS AND CONDITIONS OF THE INSTITUTE AND ASSURE TO ABIDE BY THEM. I ALSO UNDERTAKE TO PAY THE FEES LEVIED.</div>
      <div class="sign-row">
        <div>DATE : <span class="blank" style="min-width:130px">&nbsp;</span></div>
        <div>SIGNATURE : ___________________</div>
      </div>
    </div>
    <div class="footer-note">For Official Use : 200/- Form Fees &nbsp;|&nbsp; Receiver Sign : _______________</div>
  </div>
</div>
<div class="no-print" style="text-align:center;margin-top:20px">
  <button class="print-btn" onclick="window.print()">🖨 PRINT FORM</button>
</div>
</body></html>`);
    w.document.close();
  };

  const filtered    = enquiries.filter((e) => filter === "all" ? true : e.status === filter);
  const statusColor = (s) => s === "approved" ? "badge-green" : s === "rejected" ? "badge-red" : "badge-yellow";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🎓 Admissions</div>
          <div className="page-sub">Manage admission enquiries</div>
        </div>
      </div>

      {/* QR Code card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📱 Admission QR Code</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {qrDataUrl ? (
              <div style={{ background: "white", padding: 12, borderRadius: 12, border: "2px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                <img src={qrDataUrl} alt="Admission QR" style={{ width: 160, height: 160, display: "block" }} />
              </div>
            ) : (
              <div style={{ width: 160, height: 160, background: "var(--bg3)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)" }}>Generating…</div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => { const a = document.createElement("a"); a.href = qrDataUrl; a.download = "admission-qr.png"; a.click(); }}>⬇ Download QR</button>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--text2)" }}>Share this link or print the QR code. Students scan it to fill the admission form — no login required!</div>
            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: "var(--accent)", marginBottom: 10, wordBreak: "break-all" }}>{admissionUrl}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(admissionUrl).then(() => alert("Link copied!"))}>📋 Copy Link</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const w = window.open("", "_blank");
                w.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f0f0;font-family:Arial"><div style="text-align:center;background:white;padding:32px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15)"><div style="font-size:20px;font-weight:900;color:#0a1628;margin-bottom:4px">NISHCHAY ACADEMY</div><div style="font-size:13px;color:#555;margin-bottom:20px">Scan to fill Admission Form</div><img src="${qrDataUrl}" style="width:200px;height:200px"/><div style="font-size:11px;color:#888;margin-top:16px">${admissionUrl}</div></div></body></html>`);
                w.document.close(); setTimeout(() => w.print(), 400);
              }}>🖨 Print QR</button>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(79,142,247,0.08)", borderRadius: 8, fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
              <strong>How it works:</strong><br/>
              1. Student scans QR → form opens in browser<br/>
              2. They fill name, phone, photo, course details<br/>
              3. Enquiry appears here for you to approve/reject<br/>
              4. On approve → student is automatically created with photo
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
          <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">No {filter} enquiries</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Photo</th><th>Name</th><th>Phone</th><th>Branch</th><th>Course</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  // Safely get photo from either column or extra
                  let thumbUrl = e.photo_url || "";
                  if (!thumbUrl && e.extra) {
                    try { const ex = typeof e.extra === "string" ? JSON.parse(e.extra) : e.extra; thumbUrl = ex.photo_url || ""; } catch {}
                  }
                  return (
                    <tr key={e.id}>
                      <td className="mono text-muted">{e.id}</td>
                      <td>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          {thumbUrl ? <img src={thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                        </div>
                      </td>
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
                            <span className="text-muted" style={{ fontSize: 11, alignSelf: "center" }}>Student created</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
