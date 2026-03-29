// ── Academy Settings Page ─────────────────────────────────────────────────────
// Lets the academy owner update their name, logo, favicon, colors, contact info
import { useState, useRef } from "react";
import { useAcademy } from "../context/AcademyContext";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const SECTION = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 12, marginTop: 24 };

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ImageUploader({ label, currentUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Validate file type client-side before uploading
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, WebP, GIF, SVG, or ICO.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setPreview(base64);
      setUploading(true);
      try {
        // Use /upload/platform so the image goes to the academy_branding folder
        // This avoids the "Display name cannot contain slashes" Cloudinary error
        const res = await API.post("/upload/platform", { image: base64 });
        onUploaded(res.data.url);
      } catch (err) {
        const msg = err.response?.data?.error || "Upload failed. Please try again.";
        setError(msg);
        setPreview(currentUrl || null); // revert preview on error
      } finally { setUploading(false); }
    };
    reader.onerror = () => setError("Could not read file. Please try again.");
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 12, overflow: "hidden",
        background: "var(--bg3)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {preview
          ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 24, color: "var(--text3)" }}>🖼</span>}
      </div>
      <div>
        <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : `Upload ${label}`}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon" style={{ display: "none" }} onChange={handleFile} />
        {error && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{error}</div>}
      </div>
    </div>
  );
}

export default function AcademySettings() {
  const { academy } = useAcademy();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name:          academy?.name || "",
    tagline:       academy?.tagline || "",
    email:         academy?.email || "",
    phone:         academy?.phone || "",
    website:       academy?.website || "",
    address:       academy?.address || "",
    city:          academy?.city || "",
    state:         academy?.state || "",
    primary_color: academy?.primary_color || "2563EB",
    accent_color:  academy?.accent_color  || "38BDF8",
    logo_url:      academy?.logo_url || "",
    favicon_url:   academy?.favicon_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  if (user?.role !== "super_admin") {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <div className="empty-text">Only the Super Admin can change academy settings.</div>
      </div>
    );
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Academy name is required."); return; }
    setSaving(true); setError(""); setSaved(false);
    try {
      await API.put(`/academy/settings`, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh the page so AcademyContext reloads new branding
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to save settings.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Academy Settings</div>
          <div className="page-sub">Manage your academy's branding, contact info, and appearance</div>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>

        {/* ── Branding ── */}
        <div style={SECTION}>Branding</div>
        <Field label="Academy Name" hint="This appears in the sidebar and all reports.">
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Nishchay Academy" />
        </Field>
        <Field label="Tagline" hint="Short description shown on login screen.">
          <input value={form.tagline} onChange={e => set("tagline", e.target.value)} placeholder="e.g. Excellence in Education" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <Field label="Logo">
            <ImageUploader label="Logo" currentUrl={form.logo_url} onUploaded={url => set("logo_url", url)} />
          </Field>
          <Field label="Favicon">
            <ImageUploader label="Favicon" currentUrl={form.favicon_url} onUploaded={url => set("favicon_url", url)} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <Field label="Primary Color">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={`#${form.primary_color}`}
                onChange={e => set("primary_color", e.target.value.replace("#", ""))}
                style={{ width: 44, height: 36, padding: 2, borderRadius: 6, cursor: "pointer" }}
              />
              <input value={form.primary_color} onChange={e => set("primary_color", e.target.value)}
                placeholder="2563EB" style={{ flex: 1 }} />
            </div>
          </Field>
          <Field label="Accent Color">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={`#${form.accent_color}`}
                onChange={e => set("accent_color", e.target.value.replace("#", ""))}
                style={{ width: 44, height: 36, padding: 2, borderRadius: 6, cursor: "pointer" }}
              />
              <input value={form.accent_color} onChange={e => set("accent_color", e.target.value)}
                placeholder="38BDF8" style={{ flex: 1 }} />
            </div>
          </Field>
        </div>

        {/* ── Contact ── */}
        <div style={SECTION}>Contact Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="academy@example.com" />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Website">
            <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://example.com" />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Nagpur" />
          </Field>
        </div>
        <Field label="Address">
          <textarea value={form.address} onChange={e => set("address", e.target.value)}
            rows={2} placeholder="Full address" style={{ resize: "vertical" }} />
        </Field>

        {/* ── Save ── */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 16 }}>
            {error}
          </div>
        )}
        {saved && (
          <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--green)", marginBottom: 16 }}>
            ✅ Settings saved! Reloading to apply changes…
          </div>
        )}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
