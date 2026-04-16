import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";
import QRCode from "qrcode";

// ── Mobile detection hook ──────────────────────────────────────────────────────
function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
}

// ── Enquiry card — Luminescent design (matches reference image exactly) ────────
function MobileEnquiryCard({ e, onApprove, onReject, onPreview, onPrint }) {
  const isApproved = e.status === "approved";
  const isRejected = e.status === "rejected";
  const isPending  = e.status === "pending";

  // initials from name
  const initials = (e.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const statusStyle = isApproved
    ? { background: "#006d35", color: "#3fff8b" }
    : isRejected
    ? { background: "#a70138", color: "#ff6e84" }
    : { background: "#5c4a00", color: "#fbbf24" };

  const date = e.created_at
    ? new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <div style={{
      background: "#121a28",
      borderRadius: 16,
      marginBottom: 14,
      overflow: "hidden",
    }}>
      {/* Card inner */}
      <div style={{ background: "#182030", borderRadius: 16, padding: "18px 16px" }}>

        {/* Top row: avatar + name/id + status */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Avatar circle with initials */}
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #4963ff, #9ba8ff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 16, color: "#e6ebfc" }}>
                {e.name}
              </div>
              <div style={{ fontSize: 11, color: "#a5abbb", marginTop: 2 }}>
                ID: #ENQ-{String(e.id).padStart(4, "0")}
              </div>
            </div>
          </div>
          {/* Status badge */}
          <span style={{
            ...statusStyle,
            fontSize: 10, fontWeight: 700, padding: "4px 10px",
            borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.05em",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {e.status}
          </span>
        </div>

        {/* Info rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {/* Phone */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ba8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.62 2 2 0 0 1 3.58 1.44h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.09 6.09l.87-.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span style={{ fontSize: 13, color: "#e6ebfc", fontFamily: "monospace" }}>{e.phone || "—"}</span>
          </div>
          {/* Branch */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ba8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span style={{ fontSize: 13, color: "#a5abbb" }}>{e.branch_name || "—"}</span>
          </div>
          {/* Course — bold, matches reference */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ba8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            <span style={{ fontSize: 13, color: "#e6ebfc", fontWeight: 700 }}>{e.batch_name || "—"}</span>
          </div>
          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ba8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: 13, color: "#a5abbb" }}>{date}</span>
          </div>
        </div>

        {/* Action row */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}>
          {/* Left: edit/pencil icon */}
          <button
            onClick={() => onPreview(e)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 8px", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Preview"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5abbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          {/* Right: action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {isPending && (
              <>
                <button
                  onClick={() => onApprove(e.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: "#006d35", color: "#3fff8b",
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Approve
                </button>
                <button
                  onClick={() => onReject(e.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: "#a70138", color: "#ff6e84",
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Reject
                </button>
              </>
            )}
            {/* Print Enquiry button — shown for all statuses */}
            <button
              onClick={() => onPrint(e)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "#1d2637", color: "#9ba8ff",
                fontSize: 13, fontWeight: 700,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Enquiry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admissions() {
  const { user }    = useAuth();
  const { academy } = useAcademy();
  const isMobile    = useIsMobile();
  const [enquiries, setEnquiries] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState("");
  const [filter,    setFilter]    = useState("pending");

  const slug         = academy?.slug || "";
  const admissionUrl = slug
    ? `${window.location.origin}/apply?slug=${slug}`
    : `${window.location.origin}/apply`;

  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!admissionUrl) return;
    QRCode.toDataURL(admissionUrl, {
      width: 200, margin: 1, errorCorrectionLevel: "M",
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
      await API.post(`/admission/enquiries/${id}/approve`);
      setMsg("\u2705 Approved! Student created successfully.");
      load();
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setMsg("\u26a0\ufe0f " + (e.response?.data?.error || "Failed"));
    }
  };

  const reject = async (id) => {
    if (!window.confirm("Reject this enquiry?")) return;
    await API.patch(`/admission/enquiries/${id}/reject`);
    load();
  };

  const buildFormHtml = (enq, { showPrintButton }) => {
    let ex = {};
    if (enq.extra) {
      try { ex = typeof enq.extra === "string" ? JSON.parse(enq.extra) : enq.extra; } catch { ex = {}; }
    }
    const photoUrl       = enq.photo_url || ex.photo_url || "";
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
    const accentColor    = academy?.primary_color
      ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`)
      : "#cc0000";
    const academyName = academy?.name || "Academy";

    const printBtnHtml = showPrintButton
      ? `<div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 28px;background:${accentColor};color:white;border:none;border-radius:6px;font-size:15px;cursor:pointer;font-weight:900">Print FORM</button></div>`
      : "";

    return `<!DOCTYPE html><html><head><title>${academyName} — Registration Form</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#e8e8e8;padding:20px 16px}@media print{body{background:white;padding:0}.no-print{display:none!important}}.form-wrap{max-width:720px;margin:0 auto;background:white;box-shadow:0 4px 32px rgba(0,0,0,0.18);border-radius:4px}.header{padding:20px 28px 16px;border-bottom:4px solid ${accentColor}}.academy-name{font-size:32px;font-weight:900;color:${accentColor};letter-spacing:2px;line-height:1}.academy-addr{font-size:11px;color:#333;margin-top:8px;line-height:1.8;text-align:center}.form-title-bar{text-align:center;padding:10px;border-bottom:2px solid ${accentColor}}.form-title-text{font-size:17px;font-weight:900;color:${accentColor};letter-spacing:3px;text-decoration:underline}.body{padding:18px 28px}.top-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:20px}.photo-box{width:100px;height:120px;border:2px solid #333;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fafafa;border-radius:2px;flex-shrink:0;font-size:13px;font-weight:900;color:#333}.inp{display:inline-block;width:100%;padding:3px 2px;border:none;border-bottom:1.5px solid #333;background:transparent;font-size:13px;font-family:Arial,sans-serif;color:#000;min-height:22px}.lbl{font-size:12px;font-weight:700;color:#111;white-space:nowrap}.num{font-size:12px;font-weight:700;color:#111;min-width:22px}.field-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}.divider{border-top:1px solid #ccc;margin-bottom:14px}.addr-box{flex:1;min-height:55px;border:1px solid #999;padding:6px 8px;border-radius:2px;font-size:13px;white-space:pre-wrap}.declaration{border:2px solid #333;border-radius:4px;padding:14px 18px;margin-bottom:18px}.decl-title{text-align:center;font-size:13px;font-weight:900;color:${accentColor};text-decoration:underline;margin-bottom:12px;letter-spacing:1px}.decl-text{font-size:12px;line-height:2;color:#111}.blank{display:inline-block;border-bottom:1px solid #333}.sign-row{display:flex;justify-content:space-between;margin-top:20px;font-size:12px}.footer-note{text-align:center;font-size:11px;color:#888;margin-top:10px;padding-bottom:16px}</style>
</head><body>
<div class="form-wrap">
  <div class="header"><div style="text-align:center">
    <div class="academy-name">${academyName.toUpperCase()}</div>
    ${academy?.address ? `<div class="academy-addr">${academy.address}</div>` : ""}
    ${academy?.phone ? `<div class="academy-addr">Mob: ${academy.phone}${academy.phone2 ? ", " + academy.phone2 : ""}${academy.email ? " | " + academy.email : ""}</div>` : ""}
  </div></div>
  <div class="form-title-bar"><span class="form-title-text">REGISTRATION FORM</span></div>
  <div class="body">
    <div class="top-row">
      <div style="flex:1">
        <div class="field-row"><span class="lbl">AADHAR NO. :</span><div class="inp">${aadhar}</div></div>
        <div class="field-row"><span class="lbl" style="min-width:60px">BRANCH :</span><div class="inp">${enq.branch_name || ""}</div></div>
        <div class="field-row"><span class="lbl" style="min-width:60px">COURSE :</span><div class="inp">${enq.batch_name || ""}</div></div>
      </div>
      <div class="photo-box">${photoUrl ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover"/>` : "PHOTO"}</div>
    </div>
    <div class="divider"></div>
    <div class="field-row"><span class="num">1)</span><span class="lbl" style="min-width:190px">FULL NAME OF STUDENT :</span><div class="inp" style="flex:1">${enq.name||""}</div></div>
    <div class="field-row"><span class="num">2)</span><span class="lbl" style="min-width:190px">FATHER NAME :</span><div class="inp" style="flex:1">${fatherName}</div></div>
    <div class="field-row"><span class="num">3)</span><span class="lbl" style="min-width:190px">MOTHER NAME :</span><div class="inp" style="flex:1">${motherName}</div></div>
    <div class="field-row"><span class="num">4)</span><span class="lbl" style="min-width:130px">DATE OF BIRTH :</span><div class="inp" style="flex:2">${dob}</div><span class="num" style="margin-left:12px">5)</span><span class="lbl">AGE :</span><div class="inp" style="width:60px">${age}</div></div>
    <div class="field-row"><span class="num">6)</span><span class="lbl" style="min-width:190px">MOTHER TONGUE :</span><div class="inp" style="flex:1">${motherTongue}</div></div>
    <div class="field-row"><span class="num">7)</span><span class="lbl" style="min-width:190px">PREVIOUS SCHOOL :</span><div class="inp" style="flex:1">${previousSchool}</div></div>
    <div class="field-row"><span class="num">8)</span><span class="lbl">MEDIUM :</span><div class="inp" style="width:100px">${medium}</div><span class="lbl" style="margin-left:10px">CLASS :</span><div class="inp" style="width:80px">${className}</div><span class="lbl" style="margin-left:10px">PERCENT :</span><div class="inp" style="width:80px">${percent}</div></div>
    <div class="field-row"><span class="num">9)</span><span class="lbl" style="min-width:230px">NAME OF PARENT OR GUARDIAN :</span><div class="inp" style="flex:1">${guardianName}</div></div>
    <div class="field-row" style="align-items:flex-start"><span class="num">10)</span><span class="lbl" style="min-width:80px">ADDRESS :</span><div class="addr-box">${enq.address||""}</div></div>
    <div class="divider"></div>
    <div class="field-row"><span class="num">11)</span><span class="lbl" style="min-width:220px">STUDENT MOBILE NUMBER :</span><div class="inp" style="flex:1">${enq.phone||""}</div></div>
    <div class="field-row"><span class="num">12)</span><span class="lbl" style="min-width:220px">PARENT MOBILE NUMBER :</span><div class="inp" style="flex:1">${enq.parent_phone||""}</div></div>
    <div class="field-row"><span class="num">13)</span><span class="lbl" style="min-width:220px">EMAIL ID :</span><div class="inp" style="flex:1">${enq.email||""}</div></div>
    <div style="border-top:2px solid #333;margin:18px 0"></div>
    <div class="declaration">
      <div class="decl-title">DECLARATION BY PARENTS / GUARDIAN</div>
      <div class="decl-text">I <span class="blank" style="min-width:180px">&nbsp;</span> REQUEST TO ADMIT MY SON / DAUGHTER IN CLASS <span class="blank" style="min-width:60px">&nbsp;</span> OF ${academyName.toUpperCase()}. I AGREE TO THE TERMS AND CONDITIONS OF THE INSTITUTE AND ASSURE TO ABIDE BY THEM. I ALSO UNDERTAKE TO PAY THE FEES LEVIED.</div>
      <div class="sign-row"><div>DATE : <span class="blank" style="min-width:130px">&nbsp;</span></div><div>SIGNATURE : ___________________</div></div>
    </div>
    <div class="footer-note">For Official Use : 200/- Form Fees &nbsp;|&nbsp; Receiver Sign : _______________</div>
  </div>
</div>
${printBtnHtml}</body></html>`;
  };

  const previewForm = (enq) => { const w = window.open("", "_blank"); w.document.write(buildFormHtml(enq, { showPrintButton: false })); w.document.close(); };
  const printForm   = (enq) => { const w = window.open("", "_blank"); w.document.write(buildFormHtml(enq, { showPrintButton: true  })); w.document.close(); };

  const filtered    = enquiries.filter((e) => filter === "all" ? true : e.status === filter);
  const statusColor = (s) => s === "approved" ? "badge-green" : s === "rejected" ? "badge-red" : "badge-yellow";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Admissions</div>
          <div className="page-sub">Manage admission enquiries for {academy?.name || "your academy"}</div>
        </div>
      </div>

      {/* Admission link card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Your Academy's Admission Link</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {qrDataUrl ? (
              <div style={{ background: "white", padding: 12, borderRadius: 12, border: "2px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                <img src={qrDataUrl} alt="Admission QR" style={{ width: 160, height: 160, display: "block" }} />
              </div>
            ) : (
              <div style={{ width: 160, height: 160, background: "var(--bg3)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)" }}>Generating…</div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => { const a = document.createElement("a"); a.href = qrDataUrl; a.download = "admission-qr.png"; a.click(); }}>Download QR</button>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, marginBottom: 8, color: "var(--text2)" }}>
              This link is <strong>unique to {academy?.name || "your academy"}</strong>. Share it with students.
            </div>
            <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 13, color: "var(--accent)", marginBottom: 10, wordBreak: "break-all" }}>
              {admissionUrl}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(admissionUrl).then(() => alert("Link copied!"))}>Copy Link</button>
              <button className="btn btn-secondary btn-sm" onClick={() => window.open(admissionUrl, "_blank")}>Open Form</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const w = window.open("", "_blank");
                const ac = academy?.primary_color ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`) : "#cc0000";
                w.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f0f0;font-family:Arial"><div style="text-align:center;background:white;padding:32px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15)"><div style="font-size:20px;font-weight:900;color:${ac};margin-bottom:4px">${academy?.name?.toUpperCase() || "ACADEMY"}</div><div style="font-size:13px;color:#555;margin-bottom:20px">Scan to fill Admission Form</div><img src="${qrDataUrl}" style="width:200px;height:200px"/><div style="font-size:11px;color:#888;margin-top:16px">${admissionUrl}</div></div></body></html>`);
                w.document.close(); setTimeout(() => w.print(), 400);
              }}>Print QR</button>
            </div>
          </div>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>{msg}</div>}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({enquiries.filter((e) => s === "all" ? true : e.status === s).length})
          </button>
        ))}
      </div>

      {/* Enquiries list */}
      {loading ? (
        <div className="loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">No {filter} enquiries</div>
        </div>
      ) : isMobile ? (
        // ── MOBILE: Luminescent cards ──────────────────────────────────────
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#a5abbb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Enquiries ({filtered.length})
          </div>
          {filtered.map((e) => (
            <MobileEnquiryCard
              key={e.id}
              e={e}
              onApprove={approve}
              onReject={reject}
              onPreview={previewForm}
              onPrint={printForm}
            />
          ))}
        </div>
      ) : (
        // ── DESKTOP: table ────────────────────────────────────────────────
        <div className="card">
          <div className="card-title">Enquiries ({filtered.length})</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Photo</th><th>Name</th><th>Phone</th>
                  <th>Branch</th><th>Course</th><th>Date</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  let thumbUrl = e.photo_url || "";
                  if (!thumbUrl && e.extra) { try { const ex = typeof e.extra === "string" ? JSON.parse(e.extra) : e.extra; thumbUrl = ex.photo_url || ""; } catch {} }
                  return (
                    <tr key={e.id}>
                      <td className="mono text-muted">{e.id}</td>
                      <td>
                        <div style={{ width:36,height:36,borderRadius:"50%",overflow:"hidden",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>
                          {thumbUrl ? <img src={thumbUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : "👤"}
                        </div>
                      </td>
                      <td style={{ fontWeight:600 }}>{e.name}</td>
                      <td className="text-muted">{e.phone}</td>
                      <td className="text-muted">{e.branch_name || "—"}</td>
                      <td className="text-muted">{e.batch_name || "—"}</td>
                      <td className="text-muted">{new Date(e.created_at).toLocaleDateString("en-IN")}</td>
                      <td><span className={`badge ${statusColor(e.status)}`}>{e.status}</span></td>
                      <td>
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                          {e.status === "pending" && (<>
                            <button className="btn btn-sm btn-secondary" onClick={() => previewForm(e)}>Preview</button>
                            <button className="btn btn-sm btn-success"   onClick={() => approve(e.id)}>Approve</button>
                            <button className="btn btn-sm btn-danger"    onClick={() => reject(e.id)}>Reject</button>
                          </>)}
                          {e.status === "approved" && <button className="btn btn-sm btn-secondary" onClick={() => printForm(e)}>Print</button>}
                          {e.status === "rejected" && <button className="btn btn-sm btn-secondary" onClick={() => previewForm(e)}>Preview</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
