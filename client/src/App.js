import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Fees from "./pages/Fees";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Batches from "./pages/Batches";
import Users from "./pages/Users";
import Attendance from "./pages/Attendance";
import Performance from "./pages/Performance";
import Expenses from "./pages/Expenses";
import IDCards from "./pages/IDCards";
import QRScanner from "./pages/QRScanner";
import Admissions from "./pages/Admissions";
import AdmissionForm from "./pages/AdmissionForm";
import StudentDashboard from "./pages/StudentDashboard";
import logo from "./logo.png";
import "./App.css";

// ── Nav config with clean SVG-style icons ─────────────────────────────────
const NAV_ICONS = {
  dashboard:   "▦",
  students:    "◉",
  admissions:  "✦",
  batches:     "▤",
  attendance:  "▣",
  performance: "◈",
  fees:        "◎",
  payments:    "⬡",
  expenses:    "◇",
  reports:     "▲",
  idcards:     "◻",
  qrscanner:   "⊞",
  users:       "◬",
};

function Layout() {
  const { user, logout } = useAuth();
  const [page, setPage]             = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme]           = useState(() => localStorage.getItem("theme") || "dark");
  const mainRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Reset scroll when page changes
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [page]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (!user) return <Login />;
  if (user.role === "student") return <StudentDashboard />;

  const nav = [
    { id: "dashboard",   label: "Dashboard",   group: "overview" },
    { id: "students",    label: "Students",    group: "academic" },
    { id: "admissions",  label: "Admissions",  group: "academic" },
    { id: "batches",     label: "Batches",     group: "academic" },
    { id: "attendance",  label: "Attendance",  group: "academic" },
    { id: "performance", label: "Performance", group: "academic" },
    { id: "fees",        label: "Fee Records", group: "finance" },
    { id: "payments",    label: "Payments",    group: "finance" },
    { id: "expenses",    label: "Expenses",    group: "finance" },
    { id: "reports",     label: "Reports",     group: "finance" },
    { id: "idcards",     label: "ID Cards",    group: "tools" },
    { id: "qrscanner",   label: "QR Scanner",  group: "tools" },
    ...(user.role === "super_admin" ? [{ id: "users", label: "Users", group: "tools" }] : []),
  ];

  const pages = {
    dashboard: Dashboard, students: Students, admissions: Admissions,
    batches: Batches, attendance: Attendance, performance: Performance,
    fees: Fees, payments: Payments, expenses: Expenses,
    reports: Reports, idcards: IDCards, qrscanner: QRScanner, users: Users,
  };
  const Page = pages[page] || Dashboard;
  const goTo = (id) => { setPage(id); setSidebarOpen(false); };

  // Group nav items with section labels
  const groups = [
    { key: "overview", label: "Overview" },
    { key: "academic", label: "Academic" },
    { key: "finance",  label: "Finance" },
    { key: "tools",    label: "Tools" },
  ];

  return (
    <div className="app-shell">
      {/* Mobile hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <img
            src={logo}
            alt="Nishchay Academy"
            style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-title">NISHCHAY</div>
            <div className="brand-sub">Academy</div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? "☀" : "◑"}
          </button>
        </div>

        {/* Nav with group labels */}
        <nav className="sidebar-nav">
          {groups.map((group) => {
            const items = nav.filter((n) => n.group === group.key);
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--text3)",
                  padding: "12px 12px 4px",
                  userSelect: "none",
                }}>
                  {group.label}
                </div>
                {items.map((n) => (
                  <button
                    key={n.id}
                    className={`nav-item ${page === n.id ? "active" : ""}`}
                    onClick={() => goTo(n.id)}
                  >
                    <span className="nav-icon" style={{ fontFamily: "monospace" }}>
                      {NAV_ICONS[n.id] || "▸"}
                    </span>
                    <span>{n.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                {user.name}
              </div>
              <div className="user-role">
                {user.role === "super_admin" ? "Super Admin" : user.branch_name || "Manager"}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            ← Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" ref={mainRef}>
        <Page onNavigate={goTo} />
      </main>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === "/apply") return <AdmissionForm />;
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
