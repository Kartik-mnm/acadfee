import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import logo from "../logo.png";

export default function Login() {
  const { login } = useAuth();
  const [panel, setPanel] = useState(null); // "admin" or "student"
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const endpoint = panel === "student" ? "/auth/student-login" : "/auth/login";
      const { data } = await API.post(endpoint, form);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: panel ? 420 : 480 }}>
        {/* Logo & Title */}
        <img src={logo} alt="Nishchay Academy" style={{ width: 90, marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
        <div className="login-title" style={{ textAlign: "center" }}>NISHCHAY ACADEMY</div>
        

        {/* Panel Selection */}
        {!panel && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16, textAlign: "center" }}>
              Choose your portal to continue
            </div>
            <div style={{ display: "flex", gap: 14, flexDirection: "column" }}>
              {/* Admin Panel Button */}
              <button
                onClick={() => setPanel("admin")}
                style={{
                  background: "linear-gradient(135deg, var(--accent), #2563eb)",
                  border: "none", borderRadius: 12, padding: "18px 20px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                  color: "#fff", textAlign: "left", transition: "transform .15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <div style={{ fontSize: 36 }}>🔑</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Admin Panel</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                    Super Admin & Branch Managers
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 20, opacity: 0.7 }}>→</div>
              </button>

              {/* Student Panel Button */}
              <button
                onClick={() => setPanel("student")}
                style={{
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  border: "none", borderRadius: 12, padding: "18px 20px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                  color: "#fff", textAlign: "left", transition: "transform .15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <div style={{ fontSize: 36 }}>🎓</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Student Portal</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                    View fees, attendance & test scores
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 20, opacity: 0.7 }}>→</div>
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        {panel && (
          <div style={{ marginTop: 24 }}>
            {/* Panel indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
              padding: "10px 14px", borderRadius: 10,
              background: panel === "admin" ? "rgba(79,142,247,0.12)" : "rgba(5,150,105,0.12)",
              border: `1px solid ${panel === "admin" ? "var(--accent)" : "#10b981"}`,
            }}>
              <span style={{ fontSize: 20 }}>{panel === "admin" ? "🔑" : "🎓"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {panel === "admin" ? "Admin Panel" : "Student Portal"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>
                  {panel === "admin" ? "Staff & managers login" : "Students login here"}
                </div>
              </div>
              <button
                onClick={() => { setPanel(null); setError(""); setForm({ email: "", password: "" }); }}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 18 }}
              >✕</button>
            </div>

            <form onSubmit={handle}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Email</label>
                <input
                  type="email"
                  placeholder={panel === "admin" ? "admin@academy.com" : "your.email@example.com"}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Password</label>
                <input
                  type="password" placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              {error && <div className="error-msg" style={{ marginBottom: 12 }}>⚠ {error}</div>}

              <button
                className="btn btn-primary"
                style={{
                  width: "100%", justifyContent: "center", padding: "11px",
                  background: panel === "student" ? "linear-gradient(135deg, #059669, #10b981)" : undefined
                }}
                disabled={loading}
              >
                {loading ? "Signing in..." : `Sign in to ${panel === "admin" ? "Admin Panel" : "Student Portal"} →`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
