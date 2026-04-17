import { useState } from "react";

import API from "../api";

const S = {
  bg:     "#07090f",
  bg2:    "#0d1117",
  bg3:    "#131720",
  border: "#1e2535",
  t1:     "#eef1fb",
  t2:     "#8892b5",
  t3:     "#454f72",
  acc:    "#6366f1",
  pur:    "#a855f7",
  grn:    "#10b981",
  red:    "#f87171",
};

export default function AcademySignup() {
  const [form, setForm] = useState({
    owner_name: "", email: "", phone: "", academy_name: "", password: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(null); // { academy, trial_ends_at }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError("");
    const { owner_name, email, phone, academy_name, password } = form;
    if (!owner_name || !email || !phone || !academy_name || !password) {
      setError("All fields are required."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address."); return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ""))) {
      setError("Enter a valid 10-digit Indian mobile number."); return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setLoading(true);
    try {
      const res = await API.post("/onboarding/signup", {
        owner_name, email, phone, academy_name, password
      });
      setSuccess(res.data);
    } catch (_) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    const trial = new Date(success.trial_ends_at).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
    return (
      <div style={{
        minHeight: "100vh", background: S.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}>
        <div style={{
          background: S.bg2, border: `1px solid ${S.border}`,
          borderRadius: 20, padding: 40, maxWidth: 440, width: "100%",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: S.t1, marginBottom: 10 }}>
            Your academy is ready!
          </h1>
          <p style={{ fontSize: 15, color: S.t2, marginBottom: 24, lineHeight: 1.6 }}>
            <strong style={{ color: S.t1 }}>{success.academy?.name}</strong> has been created.
            Your free trial runs until <strong style={{ color: S.acc }}>{trial}</strong>.
          </p>
          <button
            onClick={() => window.location.href = "/"}
            style={{
              width: "100%", padding: "13px", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${S.acc}, ${S.pur})`,
              color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
              boxShadow: `0 6px 24px ${S.acc}44`,
            }}
          >
            🚀 Go to My Dashboard →
          </button>
          <p style={{ fontSize: 12, color: S.t3, marginTop: 16 }}>
            Log in with <strong style={{ color: S.t2 }}>{success.user?.email}</strong> and the password you just set.
          </p>
        </div>
      </div>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: S.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 50% at 50% 20%, ${S.acc}12 0%, transparent 70%)`,
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${S.acc}, ${S.pur})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px", fontWeight: 900, fontSize: 22, color: "#fff",
            boxShadow: `0 8px 24px ${S.acc}44`,
          }}>E</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: S.t1, marginBottom: 6 }}>
            Create Your Academy
          </h1>
          <p style={{ fontSize: 14, color: S.t2 }}>
            7-day free trial · No credit card required
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: S.bg2, border: `1px solid ${S.border}`,
          borderRadius: 20, padding: 32,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Owner Name">
              <Input
                placeholder="Your full name"
                value={form.owner_name}
                onChange={v => set("owner_name", v)}
              />
            </Field>
            <Field label="Email Address">
              <Input
                placeholder="you@example.com"
                type="email"
                value={form.email}
                onChange={v => set("email", v)}
              />
            </Field>
            <Field label="Phone Number">
              <Input
                placeholder="10-digit mobile number"
                type="tel"
                value={form.phone}
                onChange={v => set("phone", v)}
              />
            </Field>
            <Field label="Academy Name">
              <Input
                placeholder="e.g. Sharma Classes"
                value={form.academy_name}
                onChange={v => set("academy_name", v)}
              />
            </Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <Input
                  placeholder="Min. 6 characters"
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={v => set("password", v)}
                />
                <button
                  onClick={() => setShowPass(s => !s)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    color: S.t3, cursor: "pointer", fontSize: 13,
                  }}
                >{showPass ? "Hide" : "Show"}</button>
              </div>
            </Field>

            {error && (
              <div style={{
                background: `${S.red}14`, border: `1px solid ${S.red}30`,
                borderRadius: 8, padding: "10px 14px",
                fontSize: 13, color: S.red,
              }}>{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: "13px", borderRadius: 12, border: "none",
                background: loading
                  ? S.bg3
                  : `linear-gradient(135deg, ${S.acc}, ${S.pur})`,
                color: loading ? S.t3 : "#fff",
                fontWeight: 700, fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : `0 6px 24px ${S.acc}44`,
                transition: "all 0.2s",
              }}
            >
              {loading ? "Creating your academy..." : "🚀 Create My Academy"}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 13, color: S.t3, marginTop: 20 }}>
            Already have an account?{" "}
            <a href="/" style={{ color: S.acc, textDecoration: "none", fontWeight: 600 }}>
              Sign In
            </a>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: S.t3, marginTop: 16 }}>
          By signing up you agree to our <a href="/terms" style={{ color: S.acc, textDecoration: "none" }}>Terms of Service</a>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#454f72", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ placeholder, value, onChange, type = "text" }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "11px 14px",
        background: "#07090f",
        border: "1px solid #1e2535",
        borderRadius: 9, color: "#eef1fb", fontSize: 14,
        outline: "none", boxSizing: "border-box",
      }}
    />
  );
}
