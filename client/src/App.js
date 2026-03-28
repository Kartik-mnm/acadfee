import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AcademyProvider, useAcademy } from "./context/AcademyContext";
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
import AcademySignup from "./pages/AcademySignup";
import AcademySettings from "./pages/AcademySettings";
import "./App.css";

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
  settings:    "⚙",
};

// ── Trial expiry banner ────────────────────────────────────────────────────────
function TrialBanner({ academy, onSettings }) {
  if (!academy?.trial_ends_at || academy?.plan !== "trial") return null;
  const msLeft = new Date(academy.trial_ends_at) - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  if (daysLeft > 7 || daysLeft < 0) return null;

  const urgent = daysLeft <= 2;
  return (
    <div style={{
      background: urgent ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.10)",
      border: `1px solid ${urgent ? "rgba(239,68,68,0.35)" : "rgba(251,191,36,0.3)"}`,
      borderRadius: 10, padding: "10px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      margin: "0 0 16px", flexWrap: "wrap", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{urgent ? "🚨" : "⏳"}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: urgent ? "var(--red)" : "var(--yellow)" }}>
          {daysLeft <= 0
            ? "Your free trial has expired!"
            : `Your free trial expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}!`}
        </span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          Ends on {new Date(academy.trial_ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      <button
        className="btn btn-sm"
        style={{ background: urgent ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)", color: urgent ? "var(--red)" : "var(--yellow)", border: "none" }}
        onClick={() => onSettings?.()}
      >
        Contact Us to Upgrade →
      </button>
    </div>
  );
}

function Layout() {
  const { user, logout }     = useAuth();
  const { academy, loading } = useAcademy();
  const [page, setPage]             = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme]           = useState(() => localStorage.getItem("theme") || "dark");
  const mainRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [page]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", flexDirection: "column", gap: 16,
        background: "var(--bg1)", color: "var(--text1)"
      }}>
        <div style={{ fontSize: 32, animation: "spin 1s linear infinite" }}>⟳</div>
        <div style={{ fontSize: 14, color: "var(--text3)" }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Login />;
  if (user.role === "student") return <StudentDashboard />;

  const f = academy?.features || {};
  const nav = [
    { id: "dashboard",   label: "Dashboard",   group: "overview", show: true },
    { id: "students",    label: "Students",    group: "academic", show: true },
    { id: "admissions",  label: "Admissions",  group: "academic", show: f.admissions !== false },
    { id: "batches",     label: "Batches",     group: "academic", show: true },
    { id: "attendance",  label: "Attendance",  group: "academic", show: f.attendance !== false },
    { id: "performance", label: "Performance", group: "academic", show: f.tests !== false },
    { id: "fees",        label: "Fee Records", group: "finance",  show: true },
    { id: "payments",    label: "Payments",    group: "finance",  show: true },
    { id: "expenses",    label: "Expenses",    group: "finance",  show: f.expenses !== false },
    { id: "reports",     label: "Reports",     group: "finance",  show: f.reports !== false },
    { id: "idcards",     label: "ID Cards",    group: "tools",    show: f.id_cards !== false },
    { id: "qrscanner",   label: "QR Scanner",  group: "tools",    show: f.qr_scanner !== false },
    ...(user.role === "super_admin" ? [
      { id: "users",    label: "Users",    group: "tools", show: true },
      { id: "settings", label: "Settings", group: "tools", show: true },
    ] : []),
  ].filter((n) => n.show);

  const pages = {
    dashboard: Dashboard, students: Students, admissions: Admissions,
    batches: Batches, attendance: Attendance, performance: Performance,
    fees: Fees, payments: Payments, expenses: Expenses,
    reports: Reports, idcards: IDCards, qrscanner: QRScanner,
    users: Users, settings: AcademySettings,
  };
  const Page = pages[page] || Dashboard;
  const goTo = (id) => { setPage(id); setSidebarOpen(false); };

  const groups = [
    { key: "overview", label: "Overview" },
    { key: "academic", label: "Academic" },
    { key: "finance",  label: "Finance" },
    { key: "tools",    label: "Tools" },
  ];

  const academyWords = (academy?.name || "Academy").split(" ");
  const brandTitle   = academyWords[0].toUpperCase();
  const brandSub     = academyWords.slice(1).join(" ") || "Portal";

  return (
    <div className="app-shell">
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
        {sidebarOpen ? "✕" : "☰"}
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          {academy?.logo_url ? (
            <img src={academy.logo_url} alt={academy.name}
              style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: "var(--blue-600)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 18, flexShrink: 0
            }}>
              {(academy?.name || "A")[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-title">{brandTitle}</div>
            <div className="brand-sub">{brandSub}</div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? "☀" : "◑"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => {
            const items = nav.filter((n) => n.group === group.key);
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.12em", color: "var(--text3)",
                  padding: "12px 12px 4px", userSelect: "none",
                }}>
                  {group.label}
                </div>
                {items.map((n) => (
                  <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => goTo(n.id)}>
                    <span className="nav-icon" style={{ fontFamily: "monospace" }}>{NAV_ICONS[n.id] || "▸"}</span>
                    <span>{n.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</div>
              <div className="user-role">{user.role === "super_admin" ? "Super Admin" : user.branch_name || "Manager"}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>← Logout</button>
        </div>
      </aside>

      <main className="main-content" ref={mainRef}>
        {/* Trial expiry banner — shown at the top of every page */}
        <TrialBanner academy={academy} onSettings={() => goTo("settings")} />
        <Page onNavigate={goTo} />
      </main>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === "/apply")  return <AdmissionForm />;
  if (window.location.pathname === "/signup") return <AcademySignup />;
  return (
    <AcademyProvider>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </AcademyProvider>
  );
}
