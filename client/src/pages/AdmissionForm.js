import { useState, useEffect, useRef } from "react";
import API from "../api";

export default function AdmissionForm() {
  const [branches, setBranches] = useState([]);
  const [batches,  setBatches]  = useState([]);
  const [form, setForm] = useState({
    name: "", father_name: "", mother_name: "", dob: "",
    phone: "", parent_phone: "", email: "", address: "",
    batch_id: "", branch_id: "",
    // Optional fields
    aadhar: "", admission_class: "", entrance: "",
    age: "", mother_tongue: "", previous_school: "",
    medium: "", class_name: "", percent: "",
    photo_url: ""
  });
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef();

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
      } catch {
        f("photo_url", base64); // fallback
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
      await API.post("/admission/enquiry", {
        ...form,
        // merge extra fields into address notes
        extra: JSON.stringify({
          father_name: form.father_name,
          mother_name: form.mother_name,
          dob: form.dob,
          aadhar: form.aadhar,
          age: form.age,
          mother_tongue: form.mother_tongue,
          previous_school: form.previous_school,
          medium: form.medium,
          class_name: form.class_name,
          percent: form.percent,
          entrance: form.entrance,
          admission_class: form.admission_class,
          photo_url: form.photo_url,
        })
      });
      setSubmitted(true);
    } catch (e) {
      setError(e.response?.data?.error || "Submission failed. Please try again.");
    } finally { setSaving(false); }
  };

  const inp = {
    width: "100%", padding: "6px 0", borderTop: "none", borderLeft: "none",
    borderRight: "none", borderBottom: "1.5px solid #333", background: "transparent",
    fontSize: 13, outline: "none", fontFamily: "Arial, sans-serif"
  };
  const label = { fontSize: 12, fontWeight: 700, color: "#111", whiteSpace: "nowrap" };

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "40px", textAlign: "center", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0a1628", marginBottom: 8 }}>Form Submitted!</div>
        <div style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>
          Thank you for registering at<br /><strong>Nishchay Academy</strong>.<br />
          Our team will contact you shortly.
        </div>
        <div style={{ marginTop: 20, padding: "12px", background: "#f0f7ff", borderRadius: 8, fontSize: 13, color: "#1565c0" }}>
          📞 8208145483 / 9371333013
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#f0f0f0", minHeight: "100vh", padding: "20px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.15)", borderRadius: 4 }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 24px", borderBottom: "3px solid #cc0000", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 80, height: 80, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/logo.png" alt="Nishchay Academy" style={{ width: 80, height: 80, objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#cc0000", fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: 1 }}>
              NISHCHAY ACADEMY
            </div>
            <div style={{ fontSize: 11, color: "#333", marginTop: 4, lineHeight: 1.6 }}>
              Branch 1. Beside P.D. Hospital, Dabha, Khadgaon Road, Wadi, Nagpur- 23<br />
              Branch 2. 1st Floor, Seva Medical, Dattwadi, Nagpur- 23<br />
              Mob: 8208145483, 9371333013 &nbsp;|&nbsp; nishchayacademy20@gmail.com
            </div>
          </div>
        </div>

        {/* ── Form Title ── */}
        <div style={{ textAlign: "center", padding: "10px", borderBottom: "2px solid #cc0000" }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#cc0000", letterSpacing: 2, textDecoration: "underline" }}>
            REGISTRATION FORM
          </span>
        </div>

        <div style={{ padding: "16px 24px" }}>

          {error && (
            <div style={{ background: "#fff0f0", border: "1px solid #cc0000", borderRadius: 6, padding: "8px 12px", marginBottom: 12, color: "#cc0000", fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Top Row: Aadhar + Photo ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={label}>AADHAR NO. :</span>
                <input style={{ ...inp, flex: 1 }} value={form.aadhar} onChange={(e) => f("aadhar", e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={label}>ADMISSION FOR CLASS :</span>
                <input style={{ ...inp, flex: 1 }} value={form.admission_class} onChange={(e) => f("admission_class", e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={label}>ENTRANCE :</span>
                <input style={{ ...inp, flex: 1 }} value={form.entrance} onChange={(e) => f("entrance", e.target.value)} />
              </div>
            </div>

            {/* Photo Box */}
            <div
              onClick={() => photoRef.current.click()}
              style={{
                width: 90, height: 110, border: "1.5px solid #333", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", flexShrink: 0, overflow: "hidden",
                background: "#fafafa", borderRadius: 2, position: "relative"
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: 1 }}>PHOTO</div>
                  <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>Click to upload</div>
                </>
              )}
              {uploadingPhoto && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#555" }}>
                  Uploading…
                </div>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => handlePhoto(e.target.files[0])} />
          </div>

          <div style={{ borderTop: "1px solid #ddd", marginBottom: 12 }} />

          {/* ── Main Fields ── */}
          {[
            { num: "1)", label: "FULL NAME OF STUDENT :", key: "name", required: true },
            { num: "2)", label: "FATHER NAME :", key: "father_name", required: false },
            { num: "3)", label: "MOTHER NAME :", key: "mother_name", required: false },
          ].map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ ...label, minWidth: 20 }}>{row.num}</span>
              <span style={{ ...label, minWidth: 160 }}>
                {row.label} {row.required && <span style={{ color: "#cc0000" }}>*</span>}
              </span>
              <input style={{ ...inp, flex: 1 }} value={form[row.key]} onChange={(e) => f(row.key, e.target.value)} />
            </div>
          ))}

          {/* DOB + Age */}
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ ...label, minWidth: 20 }}>4)</span>
              <span style={{ ...label, minWidth: 130 }}>DATE OF BIRTH :</span>
              <input type="date" style={{ ...inp, flex: 1 }} value={form.dob} onChange={(e) => f("dob", e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ ...label, minWidth: 20 }}>5)</span>
              <span style={{ ...label }}>AGE ON DATE OF ADMISSION :</span>
              <input style={{ ...inp, width: 60 }} value={form.age} onChange={(e) => f("age", e.target.value)} />
            </div>
          </div>

          {[
            { num: "6)", label: "MOTHER TONGUE :", key: "mother_tongue" },
            { num: "7)", label: "PREVIOUS SCHOOL :", key: "previous_school" },
          ].map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ ...label, minWidth: 20 }}>{row.num}</span>
              <span style={{ ...label, minWidth: 160 }}>{row.label}</span>
              <input style={{ ...inp, flex: 1 }} value={form[row.key]} onChange={(e) => f(row.key, e.target.value)} />
            </div>
          ))}

          {/* Medium + Class + Percent */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...label, minWidth: 20 }}>8)</span>
            <span style={label}>MEDIUM :</span>
            <input style={{ ...inp, width: 100 }} value={form.medium} onChange={(e) => f("medium", e.target.value)} />
            <span style={label}>CLASS :</span>
            <input style={{ ...inp, width: 80 }} value={form.class_name} onChange={(e) => f("class_name", e.target.value)} />
            <span style={label}>PERCENT :</span>
            <input style={{ ...inp, width: 80 }} value={form.percent} onChange={(e) => f("percent", e.target.value)} />
          </div>

          {/* Branch + Course */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...label, minWidth: 20 }}>9)</span>
            <span style={{ ...label, minWidth: 90 }}>BRANCH :</span>
            <select style={{ ...inp, flex: 1, cursor: "pointer" }} value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
              <option value="">Select Branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span style={{ ...label, minWidth: 90 }}>COURSE :</span>
            <select style={{ ...inp, flex: 1, cursor: "pointer" }} value={form.batch_id} onChange={(e) => f("batch_id", e.target.value)}>
              <option value="">Select Course</option>
              {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Name of Parent */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ ...label, minWidth: 20 }}>10)</span>
            <span style={{ ...label, minWidth: 200 }}>NAME OF PARENT OR GUARDIAN :</span>
            <input style={{ ...inp, flex: 1 }} value={form.guardian_name} onChange={(e) => f("guardian_name", e.target.value)} />
          </div>

          {/* Address */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
            <span style={{ ...label, minWidth: 20 }}>11)</span>
            <span style={{ ...label, minWidth: 80 }}>ADDRESS :</span>
            <textarea
              style={{ ...inp, flex: 1, resize: "none", height: 50, borderBottom: "none", border: "1px solid #999", padding: "4px 8px", borderRadius: 2 }}
              value={form.address} onChange={(e) => f("address", e.target.value)}
            />
          </div>

          <div style={{ borderTop: "1px solid #ddd", marginBottom: 10 }} />

          {/* Contact fields */}
          {[
            { num: "12)", label: "STUDENT MOBILE NUMBER :", key: "phone", required: true, type: "tel" },
            { num: "13)", label: "PARENT MOBILE NUMBER :", key: "parent_phone", required: true, type: "tel" },
            { num: "14)", label: "EMAIL ID :", key: "email", required: false, type: "email" },
          ].map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ ...label, minWidth: 20 }}>{row.num}</span>
              <span style={{ ...label, minWidth: 200 }}>
                {row.label} {row.required && <span style={{ color: "#cc0000" }}>*</span>}
              </span>
              <input type={row.type || "text"} style={{ ...inp, flex: 1 }}
                value={form[row.key]} onChange={(e) => f(row.key, e.target.value)} />
            </div>
          ))}

          <div style={{ borderTop: "2px solid #333", margin: "16px 0" }} />

          {/* Declaration */}
          <div style={{ border: "2px solid #333", borderRadius: 4, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 900, color: "#cc0000", textDecoration: "underline", marginBottom: 10, letterSpacing: 1 }}>
              DECLARATION BY PARENTS / GUARDIAN
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: "#111" }}>
              I <span style={{ display: "inline-block", minWidth: 200, borderBottom: "1px solid #333" }}>&nbsp;</span> REQUEST TO ADMIT MY SON / DAUGHTER IN CLASS <span style={{ display: "inline-block", minWidth: 60, borderBottom: "1px solid #333" }}>&nbsp;</span> OF THE NISHCHAY ACADEMY, NAGPUR. I AGREE TO THE TERMS AND CONDITIONS OF THE INSTITUTE AND ASSURE TO ABIDE BY THEM. I ALSO UNDERTAKE TO PAY THE FEES LEVIED.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <div style={{ fontSize: 12 }}>
                DATE: <span style={{ display: "inline-block", minWidth: 120, borderBottom: "1px solid #333" }}>&nbsp;</span>
              </div>
              <div style={{ fontSize: 12 }}>SIGNATURE. ________________</div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={submit} disabled={saving}
            style={{
              width: "100%", padding: "12px", background: saving ? "#888" : "#cc0000",
              color: "white", border: "none", borderRadius: 6, fontSize: 15,
              fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", letterSpacing: 1
            }}>
            {saving ? "Submitting…" : "SUBMIT REGISTRATION FORM"}
          </button>

          <div style={{ textAlign: "center", fontSize: 11, color: "#888", marginTop: 10, paddingBottom: 16 }}>
            For Official Use : 200/- Form Fees &nbsp;|&nbsp; Receiver Sign: _______________
          </div>
        </div>
      </div>
    </div>
  );
}
