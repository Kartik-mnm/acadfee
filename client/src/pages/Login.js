import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import logo from "../logo.png";

export default function Login() {
  const { login } = useAuth();
  const [panel, setPanel]   = useState(null); // "admin" | "student"
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const endpoint = panel === "student" ? "/auth/student-login" : "/auth/login";
      const { data } = await API.post(endpoint, form);
      login(data.token, data.user, data.refreshToken);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="login-bg">
      <div className="login-card">

        {/* Logo + Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64,
            background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(56,189,248,0.1))",
            border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 0 32px rgba(37,99,235,0.15)",
          }}>
            <img src={logo} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} />
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800, letterSpacing: "-0.4px",
            background: "linear-gradient(135deg, #93c5fd, #38bdf8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Nishchay Academy
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4, fontWeight: 400 }}>
            Management Portal
          </div>
        </div>

        {/* Panel chooser */}
        {!panel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", marginBottom: 4 }}>
              Select your portal to continue
            </p>

            {/* Admin portal button */}
            <button
              onClick={() => setPanel("admin")}
              style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.08))",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 14,
                padding: "16px 18px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14,
                color: "var(--text)",
                textAlign: "left",
                transition: "all 0.2s",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)";
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(59,130,246,0.12))";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,99,235,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.08))";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
                boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
              }}>🔑</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Admin Panel</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Super admin &amp; branch managers</div>
              </div>
              <div style={{ marginLeft: "auto", color: "var(--text3)", fontSize: 16 }}>→</div>
            </button>

            {/* Student portal button */}
            <button
              onClick={() => setPanel("student")}
              style={{
                background: "linear-gradient(135deg, rgba(16,217,160,0.08), rgba(10,200,150,0.05))",
                border: "1px solid rgba(16,217,160,0.15)",
                borderRadius: 14,
                padding: "16px 18px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14,
                color: "var(--text)",
                textAlign: "left",
                transition: "all 0.2s",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(16,217,160,0.3)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(16,217,160,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(16,217,160,0.15)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #059669, #10d9a0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
                boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
              }}>🎓</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Student Portal</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>View fees, attendance &amp; scores</div>
              </div>
              <div style={{ marginLeft: "auto", color: "var(--text3)", fontSize: 16 }}>→</div>
            </button>
          </div>
        )}

        {/* Login form */}
        {panel && (
          <div>
            {/* Panel pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 10,
              background: panel === "admin"
                ? "rgba(37,99,235,0.08)"
                : "rgba(16,217,160,0.08)",
              border: `1px solid ${ panel === "admin" ? "rgba(59,130,246,0.2)" : "rgba(16,217,160,0.2)" }`,
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
              <button
                onClick={() => { setPanel(null); setError(""); setForm({ email: "", password: "" }); }}
                style={{
                  background: "rgba(148,163,184,0.08)", border: "1px solid var(--border)",
                  borderRadius: 6, color: "var(--text3)", cursor: "pointer",
                  width: 26, height: 26, fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text3)"; }}
              >✕</button>
            </div>

            <form onSubmit={handle} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label>Email address</label>
                <input
                  type="email"
                  placeholder={panel === "admin" ? "admin@academy.com" : "student@example.com"}
                  value={form.email}
                  onChange={(e) => f("email", e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => f("password", e.target.value)}
                  required
                />
              </div>

              {error && (
                <div style={{
                  padding: "10px 14px",
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  borderRadius: 8,
                  color: "var(--red)",
                  fontSize: 12.5,
                }}>⚠ {error}</div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "11px",
                  fontSize: 13.5,
                  marginTop: 4,
                  background: panel === "student"
                    ? "linear-gradient(135deg, #059669, #10d9a0)"
                    : "linear-gradient(135deg, #2563eb, #3b82f6)",
                  borderColor: panel === "student"
                    ? "rgba(16,217,160,0.3)"
                    : "rgba(59,130,246,0.3)",
                }}
              >
                {loading
                  ? "Signing in…"
                  : `Sign in to ${panel === "admin" ? "Admin Panel" : "Student Portal"} →`}
              </button>
            </form>
          </div>
        )}

        {/* Footer note */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "var(--text3)" }}>
          Nishchay Academy Management System
        </div>
      </div>
    </div>
  );
}
