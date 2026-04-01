import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";
import logo from "../logo.png";

export default function Login() {
  const { login }    = useAuth();
  const { academy }  = useAcademy();
  const [panel, setPanel]           = useState(null); // "admin" | "student" | "forgot"
  const [form, setForm]             = useState({ email: "", password: "" });
  const [newPassword, setNewPassword] = useState("");
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [loading, setLoading]       = useState(false);

  // Check for reset token in URL on load
  const urlParams  = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("reset_token");

  const academyName  = academy?.name || "Academy";
  const primaryColor = academy?.primary_color
    ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`)
    : "#2563eb";
  const accentColor  = academy?.accent_color
    ? (academy.accent_color.startsWith("#") ? academy.accent_color : `#${academy.accent_color}`)
    : "#38bdf8";
  const logoUrl = academy?.logo_url || null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const endpoint = panel === "student" ? "/auth/student-login" : "/auth/login";
      const { data } = await API.post(endpoint, form);
      login(data.token, data.user, data.refreshToken);
    } catch (err) {
      // FIX: always set error from response, never crash
      const msg = err?.response?.data?.error || err?.message || "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await API.post("/auth/forgot-password", { email: form.email });
      setSuccess("Reset link sent! Check your email inbox (and spam folder).");
    } catch {
      setSuccess("If that email exists, a reset link has been sent.");
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await API.post("/auth/reset-password", { token: resetToken, password: newPassword });
      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        // Clear the token from URL and go back to login
        window.history.replaceState({}, "", window.location.pathname);
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err?.response?.data?.error || "Reset failed. The link may have expired.");
    } finally { setLoading(false); }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const Back = ({ to = null }) => (
    <button
      type="button"
      onClick={() => { setPanel(to); setError(""); setSuccess(""); }}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text3)", marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
    >
      ← Back
    </button>
  );

  return (
    <div className="login-bg">
      <div className="login-card">

        {/* Logo + Academy Name */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64,
            background: `linear-gradient(135deg, ${primaryColor}26, ${accentColor}1a)`,
            border: `1px solid ${accentColor}33`,
            borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: `0 0 32px ${primaryColor}26`,
          }}>
            {logoUrl
              ? <img src={logoUrl} alt={academyName} style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 8 }} />
              : <img src={logo} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} />
            }
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: "-0.4px",
            background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>{academyName}</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Management Portal</div>
        </div>

        {/* ── PASSWORD RESET FORM (when ?reset_token= in URL) ── */}
        {resetToken && (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Set a new password</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8 }}>Enter your new password below.</div>
            <div className="form-group">
              <label>New Password (min 6 characters)</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoFocus
                minLength={6}
              />
            </div>
            {error   && <div style={{ padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "var(--red)", fontSize: 12.5 }}>⚠ {error}</div>}
            {success && <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, color: "var(--green)", fontSize: 12.5 }}>✓ {success}</div>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "11px", background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              {loading ? "Resetting..." : "Set New Password"}
            </button>
          </form>
        )}

        {/* ── FORGOT PASSWORD FORM ── */}
        {!resetToken && panel === "forgot" && (
          <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Back to={null} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Forgot your password?</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8, lineHeight: 1.6 }}>Enter your email address and we'll send you a reset link.</div>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                placeholder="admin@academy.com"
                value={form.email}
                onChange={e => f("email", e.target.value)}
                required
                autoFocus
              />
            </div>
            {error   && <div style={{ padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "var(--red)", fontSize: 12.5 }}>⚠ {error}</div>}
            {success && <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, color: "var(--green)", fontSize: 12.5 }}>✓ {success}</div>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "11px", background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {/* ── PORTAL CHOOSER ── */}
        {!resetToken && !panel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", marginBottom: 4 }}>
              Select your portal to continue
            </p>
            {[
              { id: "admin",   icon: "🔑", label: "Admin Panel",    sub: "Super admin & branch managers", grad: `linear-gradient(135deg,${primaryColor},${accentColor})`, bg: `${primaryColor}14`, border: `${primaryColor}33` },
              { id: "student", icon: "🎓", label: "Student Portal", sub: "View fees, attendance & scores",  grad: "linear-gradient(135deg,#059669,#10d9a0)", bg: "rgba(16,217,160,0.08)", border: "rgba(16,217,160,0.15)" }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPanel(p.id); setError(""); setSuccess(""); }}
                style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%", transition: "all 0.2s" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: p.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{p.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{p.sub}</div>
                </div>
                <div style={{ color: "var(--text3)", fontSize: 16 }}>→</div>
              </button>
            ))}
          </div>
        )}

        {/* ── LOGIN FORM (Admin or Student) ── */}
        {!resetToken && (panel === "admin" || panel === "student") && (
          <div>
            <Back to={null} />
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
              padding: "10px 14px", borderRadius: 10,
              background: panel === "admin" ? `${primaryColor}14` : "rgba(16,217,160,0.08)",
              border: `1px solid ${panel === "admin" ? `${primaryColor}33` : "rgba(16,217,160,0.2)"}`,
            }}>
              <span style={{ fontSize: 18 }}>{panel === "admin" ? "🔑" : "🎓"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                  {panel === "admin" ? "Admin Panel" : "Student Portal"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>
                  {panel === "admin" ? "Staff & managers login" : "Students login here"}
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label>Email address</label>
                <input
                  type="email"
                  placeholder={panel === "admin" ? "admin@academy.com" : "student@example.com"}
                  value={form.email}
                  onChange={e => f("email", e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Password</label>
                  {/* FIX: Forgot password link only for admin */}
                  {panel === "admin" && (
                    <button
                      type="button"
                      onClick={() => { setPanel("forgot"); setError(""); setSuccess(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: primaryColor, padding: 0, fontWeight: 600 }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => f("password", e.target.value)}
                  required
                />
              </div>

              {/* FIX: error always shows here, never crashes */}
              {error && (
                <div style={{
                  padding: "10px 14px",
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  borderRadius: 8, color: "var(--red)", fontSize: 12.5,
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <span>⚠ {error}</span>
                  {/* Show forgot password hint if wrong password */}
                  {(error.toLowerCase().includes("invalid") || error.toLowerCase().includes("incorrect")) && panel === "admin" && (
                    <button
                      type="button"
                      onClick={() => { setPanel("forgot"); setError(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: primaryColor, padding: 0, textAlign: "left", fontWeight: 600 }}
                    >
                      Click here to reset your password →
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  width: "100%", justifyContent: "center",
                  padding: "11px", fontSize: 13.5, marginTop: 4,
                  background: panel === "student"
                    ? "linear-gradient(135deg, #059669, #10d9a0)"
                    : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                }}
              >
                {loading ? "Signing in…" : `Sign in to ${panel === "admin" ? "Admin Panel" : "Student Portal"} →`}
              </button>
            </form>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "var(--text3)" }}>
          {academyName} Management System
        </div>
      </div>
    </div>
  );
}
