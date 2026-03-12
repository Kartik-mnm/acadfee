import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await API.post("/auth/login", form);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
        <div className="login-title">AcadFee</div>
        <div className="login-sub">Coaching Institute Fee Management</div>

        <form onSubmit={handle}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input
              type="email" placeholder="admin@academy.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
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

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "11px" }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: "var(--bg3)", borderRadius: 8, fontSize: 12, color: "var(--text2)" }}>
          <strong style={{ color: "var(--text)" }}>Default Super Admin</strong><br />
          Email: admin@academy.com<br />
          Password: Admin@1234
        </div>
      </div>
    </div>
  );
}
