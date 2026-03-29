import { useState, useEffect, useRef } from "react";
import API from "../api";

// Resolve academy slug from URL ?slug=nishchay
function resolveSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || localStorage.getItem("academy_slug") || null;
}

export default function AdmissionForm() {
  const [branches, setBranches] = useState([]);
  const [batches,  setBatches]  = useState([]);
  const [academy,  setAcademy]  = useState(null);
  const [academyId, setAcademyId] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    name: "", father_name: "", mother_name: "", dob: "", phone: "",
    parent_phone: "", email: "", address: "", batch_id: "", branch_id: "",
    aadhar: "", age: "", mother_tongue: "", previous_school: "",
    medium: "", class_name: "", percent: "", guardian_name: "", photo_url: "",
  });
  const [saving,         setSaving]         = useState(false);
  const [submitted,      setSubmitted]       = useState(false);
  const [error,          setError]           = useState("");
  const [photoPreview,   setPhotoPreview]    = useState("");
  const [uploadingPhoto, setUploadingPhoto]  = useState(false);
  const photoRef = useRef();

  const slug = resolveSlug();

  useEffect(() => {
    // If no slug, show a "invalid link" message
    if (!slug) { setNotFound(true); return; }

    // Fetch academy branding via slug
    fetch(`https://acadfee.onrender.com/api/academy/config?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.name) { setAcademy(d); }
        else { setNotFound(true); }
      })
      .catch(() => setNotFound(true));

    // Fetch branches & batches SCOPED to this academy via slug
    API.get(`/admission/form-data?slug=${slug}`)
      .then((r) => {
        setBranches(r.data.branches);
        setBatches(r.data.batches);
        if (r.data.academy_id) setAcademyId(r.data.academy_id);
      })
      .catch(() => {});
  }, []);

  const accentColor  = academy?.primary_color
    ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`)
    : "#cc0000";
  const academyName  = academy?.name   || "Academy";
  const academyPhone = academy?.phone  || "";
  const academyPhone2= academy?.phone2 || "";
  const academyEmail = academy?.email  || "";
  const academyAddr  = academy?.address || "";
  const contactLine  = [academyPhone, academyPhone2].filter(Boolean).join(", ");

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const filteredBatches = form.branch_id ? batches.filter((b) => b.branch_id == form.branch_id) : batches;

  const handlePhoto = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB"); return; }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      setPhotoPreview(base64);
      try {
        const { data } = await API.post("/upload/photo", { image: base64 });
        f("photo_url", data.url);
        setPhotoPreview(data.url);
      } catch {
        f("photo_url", base64);
      }
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.name)         { setError("Full name is required"); return; }
    if (!form.phone)        { setError("Student mobile number is required"); return; }
    if (!form.parent_phone) { setError("Parent mobile number is required"); return; }
    setSaving(true); setError("");
    try {
      const extraData = {
        father_name: form.father_name, mother_name: form.mother_name,
        dob: form.dob, aadhar: form.aadhar, age: form.age,
        mother_tongue: form.mother_tongue, previous_school: form.previous_school,
        medium: form.medium, class_name: form.class_name, percent: form.percent,
        guardian_name: form.guardian_name, photo_url: form.photo_url,
      };
      // ✅ Pass both slug and academy_id so the backend links this enquiry to the correct academy
      await API.post("/admission/enquiry", {
        name: form.name, phone: form.phone,
        parent_phone: form.parent_phone, email: form.email,
        address: form.address, batch_id: form.batch_id, branch_id: form.branch_id,
        extra: JSON.stringify(extraData),
        slug,           // so backend can resolve academy even if academy_id is null
        academy_id: academyId, // direct ID if available
      });
      setSubmitted(true);
    } catch (e) {
      setError(e.response?.data?.error || "Submission failed. Please try again.");
    } finally { setSaving(false); }
  };

  const printForm = () => {
    const branchName = branches.find((b) => b.id == form.branch_id)?.name || "";
    const batchName  = batches.find((b)  => b.id == form.batch_id)?.name  || "";
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Registration Form</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#e8e8e8;padding:20px 16px}@media print{body{background:white;padding:0}.no-print{display:none}}.form-wrap{max-width:720px;margin:0 auto;background:white;box-shadow:0 4px 32px rgba(0,0,0,0.18);border-radius:4px}.header{padding:20px 28px 16px;border-bottom:4px solid ${accentColor}}.academy-name{font-size:32px;font-weight:900;color:${accentColor};letter-spacing:2px;line-height:1}.academy-addr{font-size:11px;color:#333;margin-top:8px;line-height:1.8;text-align:center}.form-title-bar{text-align:center;padding:10px;border-bottom:2px solid ${accentColor}}.form-title-text{font-size:17px;font-weight:900;color:${accentColor};letter-spacing:3px;text-decoration:underline}.body{padding:18px 28px}.top-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:20px}.photo-box{width:100px;height:120px;border:2px solid #333;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fafafa;border-radius:2px;flex-shrink:0;font-size:13px;font-weight:900;color:#333}.inp{width:100%;padding:3px 2px;border:none;border-bottom:1.5px solid #333;background:transparent;font-size:13px}.lbl{font-size:12px;font-weight:700;color:#111;white-space:nowrap}.field-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}.num{font-size:12px;font-weight:700;color:#111;min-width:22px}.divider{border-top:1px solid #ccc;margin-bottom:14px}.addr-box{flex:1;min-height:55px;border:1px solid #999;padding:6px 8px;border-radius:2px;font-size:13px;white-space:pre-wrap}.declaration{border:2px solid #333;border-radius:4px;padding:14px 18px;margin-bottom:18px}.decl-title{text-align:center;font-size:13px;font-weight:900;color:${accentColor};text-decoration:underline;margin-bottom:12px;letter-spacing:1px}.decl-text{font-size:12px;line-height:2;color:#111}.blank{display:inline-block;border-bottom:1px solid #333}.sign-row{display:flex;justify-content:space-between;margin-top:20px;font-size:12px}.footer-note{text-align:center;font-size:11px;color:#888;margin-top:10px;padding-bottom:16px}</style>
    </head><body><div class="form-wrap">
      <div class="header"><div style="text-align:center">
        <div class="academy-name">${academyName.toUpperCase()}</div>
        ${academyAddr ? `<div class="academy-addr">${academyAddr}</div>` : ""}
        ${contactLine ? `<div class="academy-addr">Mob: ${contactLine}${academyEmail ? " | " + academyEmail : ""}</div>` : ""}
      </div></div>
      <div class="form-title-bar"><span class="form-title-text">REGISTRATION FORM</span></div>
      <div class="body">
        <div class="top-row"><div style="flex:1">
          <div class="field-row"><span class="lbl">AADHAR NO. :</span><div class="inp">${form.aadhar||""}</div></div>
          <div class="field-row"><span class="lbl" style="min-width:60px">BRANCH :</span><div class="inp">${branchName}</div></div>
          <div class="field-row"><span class="lbl" style="min-width:60px">COURSE :</span><div class="inp">${batchName}</div></div>
        </div>
        <div class="photo-box">${form.photo_url ? `<img src="${form.photo_url}" style="width:100%;height:100%;object-fit:cover"/>` : "PHOTO"}</div></div>
        <div class="divider"></div>
        <div class="field-row"><span class="num">1)</span><span class="lbl" style="min-width:190px">FULL NAME OF STUDENT :</span><div class="inp" style="flex:1">${form.name||""}</div></div>
        <div class="field-row"><span class="num">2)</span><span class="lbl" style="min-width:190px">FATHER NAME :</span><div class="inp" style="flex:1">${form.father_name||""}</div></div>
        <div class="field-row"><span class="num">3)</span><span class="lbl" style="min-width:190px">MOTHER NAME :</span><div class="inp" style="flex:1">${form.mother_name||""}</div></div>
        <div class="field-row"><span class="num">4)</span><span class="lbl" style="min-width:130px">DATE OF BIRTH :</span><div class="inp" style="flex:2">${form.dob||""}</div><span class="num" style="margin-left:12px">5)</span><span class="lbl">AGE :</span><div class="inp" style="width:60px">${form.age||""}</div></div>
        <div class="field-row"><span class="num">6)</span><span class="lbl" style="min-width:190px">MOTHER TONGUE :</span><div class="inp" style="flex:1">${form.mother_tongue||""}</div></div>
        <div class="field-row"><span class="num">7)</span><span class="lbl" style="min-width:190px">PREVIOUS SCHOOL :</span><div class="inp" style="flex:1">${form.previous_school||""}</div></div>
        <div class="field-row"><span class="num">8)</span><span class="lbl">MEDIUM :</span><div class="inp" style="width:100px">${form.medium||""}</div><span class="lbl" style="margin-left:10px">CLASS :</span><div class="inp" style="width:80px">${form.class_name||""}</div><span class="lbl" style="margin-left:10px">PERCENT :</span><div class="inp" style="width:80px">${form.percent||""}</div></div>
        <div class="field-row"><span class="num">9)</span><span class="lbl" style="min-width:230px">NAME OF PARENT OR GUARDIAN :</span><div class="inp" style="flex:1">${form.guardian_name||""}</div></div>
        <div class="field-row" style="align-items:flex-start"><span class="num">10)</span><span class="lbl" style="min-width:80px">ADDRESS :</span><div class="addr-box">${form.address||""}</div></div>
        <div class="divider"></div>
        <div class="field-row"><span class="num">11)</span><span class="lbl" style="min-width:220px">STUDENT MOBILE NUMBER :</span><div class="inp" style="flex:1">${form.phone||""}</div></div>
        <div class="field-row"><span class="num">12)</span><span class="lbl" style="min-width:220px">PARENT MOBILE NUMBER :</span><div class="inp" style="flex:1">${form.parent_phone||""}</div></div>
        <div class="field-row"><span class="num">13)</span><span class="lbl" style="min-width:220px">EMAIL ID :</span><div class="inp" style="flex:1">${form.email||""}</div></div>
        <div style="border-top:2px solid #333;margin:18px 0"></div>
        <div class="declaration"><div class="decl-title">DECLARATION BY PARENTS / GUARDIAN</div><div class="decl-text">I <span class="blank" style="min-width:180px">&nbsp;</span> REQUEST TO ADMIT MY SON / DAUGHTER IN CLASS <span class="blank" style="min-width:60px">&nbsp;</span> OF ${academyName.toUpperCase()}. I AGREE TO THE TERMS AND CONDITIONS OF THE INSTITUTE AND ASSURE TO ABIDE BY THEM. I ALSO UNDERTAKE TO PAY THE FEES LEVIED.</div><div class="sign-row"><div>DATE : <span class="blank" style="min-width:130px">&nbsp;</span></div><div>SIGNATURE : ___________________</div></div></div>
        <div class="footer-note">For Official Use : 200/- Form Fees &nbsp;|&nbsp; Receiver Sign : _______________</div>
      </div></div>
      <div class="no-print" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="padding:10px 28px;background:${accentColor};color:white;border:none;border-radius:6px;font-size:15px;cursor:pointer;font-weight:900">🖸 PRINT</button></div>
    </body></html>`);
    w.document.close();
  };

  const inp = { width: "100%", padding: "5px 2px", border: "none", borderBottom: "1.5px solid #333", background: "transparent", fontSize: 13, outline: "none", fontFamily: "Arial, sans-serif", color: "#000" };
  const lbl = { fontSize: 12, fontWeight: 700, color: "#111", whiteSpace: "nowrap" };

  // Invalid link
  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "40px", textAlign: "center", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0a1628", marginBottom: 8 }}>Invalid Admission Link</div>
        <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>This admission form link is invalid or the academy no longer exists. Please contact the academy directly for the correct link.</div>
      </div>
    </div>
  );

  // Loading
  if (!academy) return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#555" }}>Loading form…</div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "40px", textAlign: "center", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0a1628", marginBottom: 8 }}>Form Submitted!</div>
        <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>Thank you for registering at<br/><strong>{academyName}</strong>.<br/>Our team will contact you shortly.</div>
        {contactLine && <div style={{ marginTop: 20, padding: "12px", background: "#f0f7ff", borderRadius: 8, fontSize: 13, color: accentColor }}>📞 {contactLine}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ background: "#e8e8e8", minHeight: "100vh", padding: "20px 16px" }}>
      <style>{`.admission-form input,.admission-form select,.admission-form textarea{color:#000!important;-webkit-text-fill-color:#000!important}.admission-form input::placeholder{color:#999!important}.admission-form select option{color:#000;background:white}`}</style>
      <div className="admission-form" style={{ maxWidth: 720, margin: "0 auto", background: "white", boxShadow: "0 4px 32px rgba(0,0,0,0.18)", borderRadius: 4 }}>
        <div style={{ padding: "20px 28px 16px", borderBottom: `4px solid ${accentColor}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            {academy?.logo_url ? (<img src={academy.logo_url} alt={academyName} style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }} />) : (<div style={{ width: 72, height: 72, borderRadius: 12, background: accentColor, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 32, fontWeight: 900, flexShrink: 0 }}>{academyName[0]?.toUpperCase()}</div>)}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: accentColor, letterSpacing: 2, lineHeight: 1 }}>{academyName.toUpperCase()}</div>
              {academyAddr && <div style={{ fontSize: 11, color: "#333", marginTop: 6, lineHeight: 1.8 }}>{academyAddr}</div>}
              {contactLine && <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>Mob: {contactLine}{academyEmail ? ` | ${academyEmail}` : ""}</div>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "10px", borderBottom: `2px solid ${accentColor}` }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: accentColor, letterSpacing: 3, textDecoration: "underline" }}>REGISTRATION FORM</span>
        </div>
        <div style={{ padding: "18px 28px" }}>
          {error && <div style={{ background: "#fff0f0", border: `1px solid ${accentColor}`, borderRadius: 6, padding: "8px 12px", marginBottom: 12, color: accentColor, fontSize: 13 }}>⚠️ {error}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><span style={lbl}>AADHAR NO. :</span><input style={{ ...inp }} value={form.aadhar} onChange={(e) => f("aadhar", e.target.value)} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><span style={{ ...lbl, minWidth: 60 }}>BRANCH :</span><select style={{ ...inp, cursor: "pointer", background: "white" }} value={form.branch_id} onChange={(e) => { f("branch_id", e.target.value); f("batch_id", ""); }}><option value="">Select Branch</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ ...lbl, minWidth: 60 }}>COURSE :</span><select style={{ ...inp, cursor: "pointer", background: "white" }} value={form.batch_id} onChange={(e) => f("batch_id", e.target.value)}><option value="">{form.branch_id ? "Select Course" : "Select Branch First"}</option>{filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div onClick={() => !uploadingPhoto && photoRef.current.click()} style={{ width: 100, height: 120, border: "2px solid #333", cursor: uploadingPhoto ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fafafa", borderRadius: 2, position: "relative", flexShrink: 0 }}>
                {photoPreview ? <img src={photoPreview} alt="Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <><div style={{ fontSize: 13, fontWeight: 900, color: "#333", letterSpacing: 1 }}>PHOTO</div><div style={{ fontSize: 10, color: "#888", marginTop: 4, textAlign: "center", padding: "0 4px" }}>Click to upload</div></>}
                {uploadingPhoto && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 10, gap: 4 }}><div style={{ width: 20, height: 20, border: `2px solid ${accentColor}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Uploading…</div>}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              {photoPreview && !uploadingPhoto && <button type="button" onClick={() => { setPhotoPreview(""); f("photo_url", ""); }} style={{ fontSize: 10, color: accentColor, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remove</button>}
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files[0])} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid #ccc", marginBottom: 14 }} />
          {[{num:"1)",label:"FULL NAME OF STUDENT :",key:"name",required:true},{num:"2)",label:"FATHER NAME :",key:"father_name"},{num:"3)",label:"MOTHER NAME :",key:"mother_name"}].map((row) => (<div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><span style={{ ...lbl, minWidth: 22 }}>{row.num}</span><span style={{ ...lbl, minWidth: 190 }}>{row.label}{row.required && <span style={{ color: accentColor }}> *</span>}</span><input style={{ ...inp, flex: 1 }} value={form[row.key]} onChange={(e) => f(row.key, e.target.value)} /></div>))}
          <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 2 }}><span style={{ ...lbl, minWidth: 22 }}>4)</span><span style={{ ...lbl, minWidth: 130 }}>DATE OF BIRTH :</span><input type="date" style={{ ...inp, flex: 1 }} value={form.dob} onChange={(e) => f("dob", e.target.value)} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}><span style={{ ...lbl, minWidth: 22 }}>5)</span><span style={lbl}>AGE :</span><input style={{ ...inp, width: 60 }} value={form.age} onChange={(e) => f("age", e.target.value)} placeholder="yrs" /></div>
          </div>
          {[{num:"6)",label:"MOTHER TONGUE :",key:"mother_tongue"},{num:"7)",label:"PREVIOUS SCHOOL :",key:"previous_school"}].map((row) => (<div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><span style={{ ...lbl, minWidth: 22 }}>{row.num}</span><span style={{ ...lbl, minWidth: 190 }}>{row.label}</span><input style={{ ...inp, flex: 1 }} value={form[row.key]} onChange={(e) => f(row.key, e.target.value)} /></div>))}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}><span style={{ ...lbl, minWidth: 22 }}>8)</span><span style={lbl}>MEDIUM :</span><input style={{ ...inp, width: 100 }} value={form.medium} onChange={(e) => f("medium", e.target.value)} /><span style={lbl}>CLASS :</span><input style={{ ...inp, width: 80 }} value={form.class_name} onChange={(e) => f("class_name", e.target.value)} /><span style={lbl}>PERCENT :</span><input style={{ ...inp, width: 80 }} value={form.percent} onChange={(e) => f("percent", e.target.value)} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><span style={{ ...lbl, minWidth: 22 }}>9)</span><span style={{ ...lbl, minWidth: 230 }}>NAME OF PARENT OR GUARDIAN :</span><input style={{ ...inp, flex: 1 }} value={form.guardian_name} onChange={(e) => f("guardian_name", e.target.value)} /></div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}><span style={{ ...lbl, minWidth: 22 }}>10)</span><span style={{ ...lbl, minWidth: 80 }}>ADDRESS :</span><textarea style={{ flex: 1, resize: "none", height: 55, border: "1px solid #999", padding: "6px 8px", borderRadius: 2, fontSize: 13, outline: "none", fontFamily: "Arial, sans-serif", color: "#000", background: "white" }} value={form.address} onChange={(e) => f("address", e.target.value)} /></div>
          <div style={{ borderTop: "1px solid #ccc", marginBottom: 14 }} />
          {[{num:"11)",label:"STUDENT MOBILE NUMBER :",key:"phone",required:true,type:"tel"},{num:"12)",label:"PARENT MOBILE NUMBER :",key:"parent_phone",required:true,type:"tel"},{num:"13)",label:"EMAIL ID :",key:"email",type:"email"}].map((row) => (<div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><span style={{ ...lbl, minWidth: 22 }}>{row.num}</span><span style={{ ...lbl, minWidth: 220 }}>{row.label}{row.required && <span style={{ color: accentColor }}> *</span>}</span><input type={row.type || "text"} style={{ ...inp, flex: 1 }} value={form[row.key]} onChange={(e) => f(row.key, e.target.value)} /></div>))}
          <div style={{ borderTop: "2px solid #333", margin: "18px 0" }} />
          <div style={{ border: "2px solid #333", borderRadius: 4, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 900, color: accentColor, textDecoration: "underline", marginBottom: 12, letterSpacing: 1 }}>DECLARATION BY PARENTS / GUARDIAN</div>
            <div style={{ fontSize: 12, lineHeight: 2, color: "#111" }}>I <span style={{ display: "inline-block", minWidth: 180, borderBottom: "1px solid #333" }}>&nbsp;</span> REQUEST TO ADMIT MY SON / DAUGHTER IN CLASS <span style={{ display: "inline-block", minWidth: 60, borderBottom: "1px solid #333" }}>&nbsp;</span> OF {academyName.toUpperCase()}. I AGREE TO THE TERMS AND CONDITIONS OF THE INSTITUTE AND ASSURE TO ABIDE BY THEM. I ALSO UNDERTAKE TO PAY THE FEES LEVIED.</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}><div style={{ fontSize: 12 }}>DATE : <span style={{ display: "inline-block", minWidth: 130, borderBottom: "1px solid #333" }}>&nbsp;</span></div><div style={{ fontSize: 12 }}>SIGNATURE : ___________________</div></div>
          </div>
          <button onClick={printForm} type="button" style={{ width: "100%", padding: "10px", background: "#0a1628", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginBottom: 10 }}>🖸 Print This Form</button>
          <button onClick={submit} disabled={saving || uploadingPhoto} style={{ width: "100%", padding: "13px", background: (saving || uploadingPhoto) ? "#999" : accentColor, color: "white", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 900, cursor: (saving || uploadingPhoto) ? "not-allowed" : "pointer", letterSpacing: 2 }}>{saving ? "SUBMITTING…" : uploadingPhoto ? "PLEASE WAIT — UPLOADING PHOTO…" : "SUBMIT REGISTRATION FORM"}</button>
          <div style={{ textAlign: "center", fontSize: 11, color: "#888", marginTop: 10, paddingBottom: 16 }}>For Official Use : 200/- Form Fees &nbsp;|&nbsp; Receiver Sign : _______________</div>
        </div>
      </div>
    </div>
  );
}
