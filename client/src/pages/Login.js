import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";

// Retry a function up to maxAttempts times on 500/503/network errors
// Shows a countdown between retries so users know what's happening
async function withRetry(fn, { maxAttempts = 3, delayMs = 5000, onRetry } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const isServerError = !status || status >= 500; // 500, 503, network error
      const isLastAttempt  = attempt === maxAttempts;

      if (!isServerError || isLastAttempt) throw err;

      // Server is starting up — wait and retry
      if (onRetry) onRetry(attempt, maxAttempts, delayMs);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export default function Login() {
  const { login }   = useAuth();
  const { academy } = useAcademy();
  const [panel, setPanel]             = useState("student");
  const [form, setForm]               = useState({ email: "", password: "" });
  const [newPassword, setNewPassword] = useState("");
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [retryMsg, setRetryMsg]       = useState(""); // "Server waking up, retrying in 4s..."
  const [countdown, setCountdown]     = useState(0);
  const countdownRef = useRef(null);

  const urlParams  = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("reset_token");

  const [platformLogoUrl, setPlatformLogoUrl] = useState(
    () => { try { return localStorage.getItem("exponent_logo_url") || null; } catch { return null; } }
  );
  useEffect(() => {
    if (!academy) {
      fetch("https://api.exponentgrow.in/platform/auth/public-branding")
        .then(r => r.json())
        .then(data => {
          if (data.logo_url) {
            setPlatformLogoUrl(data.logo_url);
            try { localStorage.setItem("exponent_logo_url", data.logo_url); } catch {}
          }
        }).catch(() => {});
    }
  }, [academy]);

  // Cleanup countdown timer on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const startCountdown = (totalMs) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    let secs = Math.round(totalMs / 1000);
    setCountdown(secs);
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) clearInterval(countdownRef.current);
    }, 1000);
  };

  const academyName  = academy?.name || "Exponent Platform";
  const primaryColor = academy?.primary_color
    ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`)
    : "#2563eb";
  const accentColor  = academy?.accent_color
    ? (academy.accent_color.startsWith("#") ? academy.accent_color : `#${academy.accent_color}`)
    : "#38bdf8";
  const logoUrl = academy?.logo_url || platformLogoUrl || null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setRetryMsg(""); setLoading(true);
    try {
      const endpoint = panel === "student" ? "/auth/student-login" : "/auth/login";
      await withRetry(
        () => API.post(endpoint, form).then(({ data }) => login(data.token, data.user, data.refreshToken)),
        {
          maxAttempts: 3,
          delayMs: 6000,
          onRetry: (attempt, max, delayMs) => {
            setRetryMsg(`Server is starting up… retrying (${attempt}/${max - 1})`);
            startCountdown(delayMs);
          },
        }
      );
    } catch (err) {
      setRetryMsg("");
      const status = err?.response?.status;
      if (!status || status >= 500) {
        // After all retries failed — friendly message
        setError("Server is busy. Please wait a moment and try again.");
      } else {
        const msg = err?.response?.data?.error || "Invalid credentials. Please try again.";
        setError(msg);
      }
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
      onClick={() => { setPanel(to); setError(""); setSuccess(""); setRetryMsg(""); }}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text3)", marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
    >
      ← Back
    </button>
  );

  const DefaultLogo = ({ size = 42 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path d="M10 10H22M10 16H18M10 22H22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className="login-bg" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64,
          background: `linear-gradient(135deg, ${primaryColor}26, ${accentColor}1a)`,
          border: `1px solid ${accentColor}33`,
          borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: `0 8px 32px ${primaryColor}2a`,
        }}>
          {logoUrl
            ? <img src={logoUrl} alt={academyName} style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 8 }} />
            : <DefaultLogo size={42} />}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", color: "#ffffff" }}>
          {academyName}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.06)", padding: "5px 12px",
          borderRadius: 100, fontSize: 11, color: "var(--text3)", marginTop: 12,
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          🔒 Authorized Access Only
        </div>
      </div>

      {/* Card */}
      <div className="login-card" style={{ width: "100%", maxWidth: 420, padding: "32px", boxSizing: "border-box" }}>

        {resetToken ? (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Set a new password</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8 }}>Enter your new password below.</div>
            <div className="form-group">
              <label>New Password (min 6 characters)</label>
              <input type="password" placeholder="Enter new password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required autoFocus minLength={6} />
            </div>
            {error   && <div style={{ padding:"10px 14px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, color:"var(--red)", fontSize:12.5 }}>⚠ {error}</div>}
            {success && <div style={{ padding:"10px 14px", background:"rgba(16,185,129,0.08)",  border:"1px solid rgba(16,185,129,0.2)",  borderRadius:8, color:"var(--green)",fontSize:12.5 }}>✓ {success}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width:"100%", justifyContent:"center", padding:"11px",
                background:`linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
              {loading ? "Resetting..." : "Set New Password"}
            </button>
          </form>

        ) : panel === "forgot" ? (
          <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Back to="admin" />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Forgot your password?</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8, lineHeight: 1.6 }}>Enter your email and we’ll send a reset link.</div>
            <div className="form-group">
              <label>Email address</label>
              <input type="email" placeholder="admin@academy.com" value={form.email}
                onChange={e => f("email", e.target.value)} required autoFocus
                style={{ padding:"12px", background:"rgba(0,0,0,0.2)" }} />
            </div>
            {error   && <div style={{ padding:"10px 14px", background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:8, color:"var(--red)", fontSize:12.5 }}>⚠ {error}</div>}
            {success && <div style={{ padding:"10px 14px", background:"rgba(16,185,129,0.08)",  border:"1px solid rgba(16,185,129,0.2)",  borderRadius:8, color:"var(--green)",fontSize:12.5 }}>✓ {success}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width:"100%", justifyContent:"center", padding:"12px",
                background:`linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                boxShadow:`0 4px 14px ${primaryColor}40` }}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

        ) : (
          <div>
            {/* Tab switcher */}
            <div style={{ display:"flex", background:"rgba(0,0,0,0.25)", borderRadius:8, padding:4, marginBottom:28,
              border:"1px solid rgba(255,255,255,0.05)" }}>
              {[{id:"student",label:"Student"},{id:"admin",label:"Admin"}].map(tab => (
                <button key={tab.id} type="button"
                  onClick={() => { setPanel(tab.id); setError(""); setRetryMsg(""); }}
                  style={{
                    flex:1, padding:"10px 0", borderRadius:6, border:"none", cursor:"pointer",
                    background: panel===tab.id ? (tab.id==="student" ? "rgba(16,217,160,0.15)" : `${primaryColor}26`) : "transparent",
                    color: panel===tab.id ? (tab.id==="student" ? "#10d9a0" : primaryColor) : "var(--text3)",
                    fontWeight: panel===tab.id ? 600 : 500, transition:"all 0.2s", fontSize:13
                  }}>{tab.label}</button>
              ))}
            </div>

            <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="form-group">
                <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.5px", color:"var(--text3)", marginBottom:6 }}>Email Address</label>
                <input type="email" placeholder={panel==="admin" ? "admin@academy.com" : "your@email.com"}
                  value={form.email} onChange={e => f("email", e.target.value)}
                  required autoFocus style={{ background:"rgba(0,0,0,0.2)", padding:"12px" }} />
              </div>

              <div className="form-group">
                <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.5px", color:"var(--text3)", marginBottom:6 }}>Password</label>
                <input type="password" placeholder="Your password"
                  value={form.password} onChange={e => f("password", e.target.value)}
                  required style={{ background:"rgba(0,0,0,0.2)", padding:"12px" }} />
              </div>

              {panel === "admin" && (
                <div style={{ display:"flex", justifyContent:"flex-start", marginTop:-4, marginBottom:8 }}>
                  <button type="button"
                    onClick={() => { setPanel("forgot"); setError(""); setRetryMsg(""); }}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:primaryColor, padding:0, fontWeight:500 }}>
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Server waking up — shown instead of error during retries */}
              {retryMsg && (
                <div style={{
                  padding:"12px 14px", background:"rgba(251,191,36,0.08)",
                  border:"1px solid rgba(251,191,36,0.25)", borderRadius:8,
                  color:"var(--yellow)", fontSize:12.5,
                  display:"flex", alignItems:"center", gap:8
                }}>
                  <span style={{ fontSize:18, animation:"spin 1s linear infinite", display:"inline-block" }}>⏳</span>
                  <div>
                    <div style={{ fontWeight:600 }}>{retryMsg}</div>
                    {countdown > 0 && (
                      <div style={{ fontSize:11, marginTop:2, opacity:0.8 }}>Trying again in {countdown}s…</div>
                    )}
                  </div>
                </div>
              )}

              {/* Error — shown only after all retries exhausted */}
              {error && !retryMsg && (
                <div style={{
                  padding:"10px 14px", background:"rgba(248,113,113,0.08)",
                  border:"1px solid rgba(248,113,113,0.2)", borderRadius:8,
                  color:"var(--red)", fontSize:12.5
                }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{
                  width:"100%", justifyContent:"center", padding:"13px", fontSize:14,
                  marginTop:4, fontWeight:600, border:"none", color:"#fff",
                  background: panel==="student"
                    ? "linear-gradient(135deg, #059669, #10d9a0)"
                    : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                  boxShadow: panel==="student"
                    ? "0 4px 14px rgba(16,217,160,0.3)"
                    : `0 4px 14px ${primaryColor}40`,
                  opacity: loading ? 0.75 : 1,
                }}>
                {loading
                  ? (retryMsg ? "Retrying…" : "Signing in…")
                  : `Login to ${academyName}`}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display:"flex", gap:16, marginTop:32, fontSize:11, color:"var(--text3)", opacity:0.7, fontWeight:500 }}>
        <a href="/privacy" style={{ color:"var(--text3)", textDecoration:"none" }}>Privacy Policy</a>
        <span>·</span>
        <a href="/terms" style={{ color:"var(--text3)", textDecoration:"none" }}>Terms of Service</a>
        <span>·</span>
        <a href="/contact" style={{ color:"var(--text3)", textDecoration:"none" }}>Contact</a>
      </div>
    </div>
  );
}
