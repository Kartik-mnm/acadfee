import { useState } from "react";
import API from "../api";

const API_URL = process.env.REACT_APP_API_URL || "https://acadfee.onrender.com";

const FEATURE_LIST = [
  { key: "attendance",    label: "Attendance",    icon: "📋", desc: "Track daily student attendance" },
  { key: "tests",         label: "Tests",         icon: "📝", desc: "Performance & test results" },
  { key: "expenses",      label: "Expenses",      icon: "💸", desc: "Branch expense tracking" },
  { key: "admissions",    label: "Admissions",    icon: "📱", desc: "Online admission enquiry form" },
  { key: "notifications", label: "Notifications", icon: "🔔", desc: "FCM push notifications" },
  { key: "id_cards",      label: "ID Cards",      icon: "🪪", desc: "Student ID card generation" },
  { key: "qr_scanner",   label: "QR Scanner",    icon: "⊞",  desc: "QR-based attendance scanner" },
  { key: "reports",       label: "Reports",       icon: "📊", desc: "Financial reports & analytics" },
];

const PRESET_COLORS = [
  "2563EB","6366F1","8B5CF6","EC4899","EF4444",
  "F97316","F59E0B","10B981","06B6D4","64748B",
];

const PLANS = [
  { id: "basic",      label: "Basic",      desc: "200 students, 3 branches" },
  { id: "pro",        label: "Pro",        desc: "500 students, 10 branches" },
  { id: "enterprise", label: "Enterprise", desc: "Unlimited" },
];

const DEFAULT_FEATURES = {
  attendance: true, tests: true, expenses: true, admissions: true,
  notifications: true, id_cards: true, qr_scanner: true, reports: true,
};

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 44, height: 24, borderRadius: 12, cursor: "pointer",
      background: checked ? "var(--accent)" : "var(--border2)",
      position: "relative", transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 2,
        left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%",
        background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
        transition: "left 0.2s",
      }} />
    </div>
  );
}

// Upload helper using the /upload/platform endpoint (no academy auth required)
async function uploadImage(base64DataUrl) {
  const res = await fetch(`${API_URL}/api/upload/platform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64DataUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url;
}

function ImageField({ label, hint, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr("Max 5MB"); return; }
    setUploading(true); setErr("");
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const url = await uploadImage(e.target.result);
        onChange(url);
      } catch (ex) { setErr(ex.message); }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="form-group full">
      <label>{label} <span style={{ color: "var(--text3)", fontWeight: 400 }}>{hint}</span></label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{
          width: 54, height: 54, borderRadius: 10, flexShrink: 0,
          background: "var(--bg3)", border: "1px solid var(--border2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", fontSize: 22,
        }}>
          {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                 : <span style={{ opacity: 0.25 }}>🖼</span>}
        </div>
        <div style={{ flex: 1 }}>
          <input value={value || ""} onChange={e => onChange(e.target.value)}
            placeholder="Paste Cloudinary/image URL…" style={{ marginBottom: 6 }} />
          <label style={{
            display: "inline-block", padding: "5px 12px",
            background: "var(--bg3)", border: "1px solid var(--border2)",
            borderRadius: 6, cursor: uploading ? "not-allowed" : "pointer",
            fontSize: 12, color: "var(--text2)",
          }}>
            {uploading ? "⏳ Uploading…" : "📁 Upload File"}
            <input type="file" accept="image/*" disabled={uploading} style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </label>
          {value && (
            <button type="button" onClick={() => onChange("")}
              style={{ marginLeft: 8, background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>
              ✕ Remove
            </button>
          )}
          {err && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

export default function AcademyEditModal({ academy, onClose, onSaved }) {
  const normalise = (f) => {
    const out = { ...DEFAULT_FEATURES };
    if (f) FEATURE_LIST.forEach(({ key }) => { out[key] = f[key] !== false; });
    return out;
  };

  const [form, setForm]   = useState({ ...academy, features: normalise(academy.features) });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");
  const [tab,    setTab]    = useState("info");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFeature = (key, val) => setForm(f => ({
    ...f, features: { ...normalise(f.features), [key]: Boolean(val) },
  }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      await API.put(`/platform/academies/${academy.id}`, {
        ...form, features: normalise(form.features),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved(); }, 800);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save");
      setSaving(false);
    }
  };

  const primaryHex = form.primary_color
    ? (form.primary_color.startsWith("#") ? form.primary_color : `#${form.primary_color}`)
    : "#6366f1";
  const accentHex = form.accent_color
    ? (form.accent_color.startsWith("#") ? form.accent_color : `#${form.accent_color}`)
    : "#a78bfa";

  const tabs = [
    { id: "info",     label: "ℹ Info" },
    { id: "branding", label: "🎨 Branding" },
    { id: "contact",  label: "📞 Contact" },
    { id: "features", label: "🔧 Features" },
    { id: "limits",   label: "📈 Limits" },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: primaryHex, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}>
              {form.logo_url
                ? <img src={form.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : form.name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="modal-title">{academy.name}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>/{academy.slug} · ID {academy.id}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="tab-bar">
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="modal-body">

          {/* INFO */}
          {tab === "info" && (
            <div className="form-grid">
              <div className="form-group full">
                <label>Academy Name *</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="form-group full">
                <label>Tagline</label>
                <input value={form.tagline || ""} onChange={e => set("tagline", e.target.value)} placeholder="e.g. Empowering students since 2015" />
              </div>
              <div className="form-group"><label>City</label><input value={form.city || ""} onChange={e => set("city", e.target.value)} /></div>
              <div className="form-group"><label>State</label><input value={form.state || ""} onChange={e => set("state", e.target.value)} /></div>
              <div className="form-group"><label>Pincode</label><input value={form.pincode || ""} onChange={e => set("pincode", e.target.value)} /></div>
              <div className="form-group"><label>Slug <span style={{ color: "var(--text3)", fontWeight: 400 }}>(read-only)</span></label><input value={form.slug || ""} readOnly style={{ opacity: 0.5, cursor: "not-allowed" }} /></div>
            </div>
          )}

          {/* BRANDING */}
          {tab === "branding" && (
            <div>
              {/* Live preview */}
              <div style={{ background: `linear-gradient(135deg, ${primaryHex}18, ${accentHex}0e)`, border: `1px solid ${primaryHex}33`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Live Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 11, background: primaryHex, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 19, overflow: "hidden" }}>
                    {form.logo_url
                      ? <img src={form.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : form.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{form.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{form.tagline || "No tagline"}</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: primaryHex }} />
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: accentHex }} />
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <ImageField label="Logo Image" hint="(sidebar & login)" value={form.logo_url || ""} onChange={v => set("logo_url", v)} />
                <ImageField label="Favicon / App Icon" hint="(32×32 or 64×64 PNG)" value={form.favicon_url || ""} onChange={v => set("favicon_url", v)} />

                <div className="form-group">
                  <label>Primary Color</label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    {PRESET_COLORS.map(c => (
                      <div key={c} className="color-swatch" onClick={() => set("primary_color", c)}
                        style={{ background: `#${c}`, border: `2px solid ${(form.primary_color || "").toUpperCase() === c.toUpperCase() ? "var(--text1)" : "transparent"}`, transform: (form.primary_color || "").toUpperCase() === c.toUpperCase() ? "scale(1.2)" : undefined }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={primaryHex} onChange={e => set("primary_color", e.target.value.replace("#", ""))}
                      style={{ width: 36, height: 34, padding: 2, borderRadius: 6, border: "1px solid var(--border2)", cursor: "pointer", background: "var(--bg3)" }} />
                    <input value={form.primary_color || ""} onChange={e => set("primary_color", e.target.value.replace("#", ""))}
                      placeholder="2563EB" maxLength={6} style={{ fontFamily: "monospace", textTransform: "uppercase", flex: 1 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Accent Color</label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    {PRESET_COLORS.map(c => (
                      <div key={c} className="color-swatch" onClick={() => set("accent_color", c)}
                        style={{ background: `#${c}`, border: `2px solid ${(form.accent_color || "").toUpperCase() === c.toUpperCase() ? "var(--text1)" : "transparent"}` }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={accentHex} onChange={e => set("accent_color", e.target.value.replace("#", ""))}
                      style={{ width: 36, height: 34, padding: 2, borderRadius: 6, border: "1px solid var(--border2)", cursor: "pointer", background: "var(--bg3)" }} />
                    <input value={form.accent_color || ""} onChange={e => set("accent_color", e.target.value.replace("#", ""))}
                      placeholder="38BDF8" maxLength={6} style={{ fontFamily: "monospace", textTransform: "uppercase", flex: 1 }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONTACT */}
          {tab === "contact" && (
            <div className="form-grid">
              <div className="form-group"><label>Primary Phone</label><input type="tel" value={form.phone || ""} onChange={e => set("phone", e.target.value)} /></div>
              <div className="form-group"><label>Secondary Phone</label><input type="tel" value={form.phone2 || ""} onChange={e => set("phone2", e.target.value)} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} /></div>
              <div className="form-group"><label>Website</label><input value={form.website || ""} onChange={e => set("website", e.target.value)} placeholder="https://" /></div>
              <div className="form-group full">
                <label>Full Address <span style={{ color: "var(--text3)", fontWeight: 400 }}>(shown on receipts & forms)</span></label>
                <textarea value={form.address || ""} onChange={e => set("address", e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {/* FEATURES */}
          {tab === "features" && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                💡 Disabled features are hidden from the academy’s sidebar and cannot be accessed.
              </div>
              {FEATURE_LIST.map(f => {
                const isOn = (form.features || {})[f.key] !== false;
                return (
                  <div key={f.key} className={`toggle-row ${isOn ? "on" : "off"}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: isOn ? `${primaryHex}22` : "var(--bg4)", display: "flex", alignItems: "center", justifyContent: "center" }}>{f.icon}</div>
                      <div>
                        <div className="toggle-label">{f.label}</div>
                        <div className="toggle-desc">{f.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isOn ? "var(--green)" : "var(--red)" }}>{isOn ? "ON" : "OFF"}</span>
                      <Toggle checked={isOn} onChange={v => setFeature(f.key, v)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIMITS */}
          {tab === "limits" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Subscription Plan</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {PLANS.map(p => (
                    <div key={p.id} onClick={() => set("plan", p.id)} style={{
                      flex: 1, padding: "12px", borderRadius: 9, cursor: "pointer",
                      border: `2px solid ${form.plan === p.id ? "var(--accent)" : "var(--border2)"}`,
                      background: form.plan === p.id ? "var(--accent-glow)" : "var(--bg3)",
                      transition: "all 0.15s",
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: form.plan === p.id ? "var(--accent2)" : "var(--text1)" }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Max Students</label><input type="number" min={1} value={form.max_students || 200} onChange={e => set("max_students", parseInt(e.target.value) || 200)} /></div>
                <div className="form-group"><label>Max Branches</label><input type="number" min={1} value={form.max_branches || 3} onChange={e => set("max_branches", parseInt(e.target.value) || 3)} /></div>
                <div className="form-group full">
                  <label>Subscription Expiry <span style={{ color: "var(--text3)", fontWeight: 400 }}>(leave blank for no expiry)</span></label>
                  <input type="date" value={form.trial_ends_at ? form.trial_ends_at.split("T")[0] : ""} onChange={e => set("trial_ends_at", e.target.value || null)} />
                </div>
                <div className="form-group full">
                  <label>Access Status</label>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {[true, false].map(v => (
                      <div key={String(v)} onClick={() => set("is_active", v)} style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                        border: `2px solid ${form.is_active === v ? (v ? "var(--green)" : "var(--red)") : "var(--border2)"}`,
                        background: form.is_active === v ? (v ? "var(--green-dim)" : "var(--red-dim)") : "var(--bg3)",
                        transition: "all 0.15s",
                      }}>
                        <div style={{ fontWeight: 700, color: v ? "var(--green)" : "var(--red)" }}>{v ? "✓ Active" : "✗ Suspended"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="alert alert-danger" style={{ marginTop: 14 }}>⚠ {error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || saved}
            style={{ minWidth: 140, justifyContent: "center", background: saved ? "var(--green)" : undefined }}>
            {saved ? "✓ Saved!" : saving ? "Saving…" : "✓ Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
