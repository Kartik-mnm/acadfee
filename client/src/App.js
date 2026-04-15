import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AcademyProvider, useAcademy } from "./context/AcademyContext";
import ErrorBoundary from "./components/ErrorBoundary";
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
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Contact from "./pages/Contact";
import "./App.css";
import "./mobile.css"; // ← Luminescent Academy mobile design system

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
  users:       "▬",
  settings:    "⚙",
};

// Bottom nav — 5 tabs shown on mobile, icons match Luminescent design
const BOTTOM_NAV_TABS = [
  { id: "dashboard",  label: "Home",       emoji: "🏠" },
  { id: "students",   label: "Students",   emoji: "👤" },
  { id: "fees",       label: "Fees",       emoji: "💳" },
  { id: "attendance", label: "Attendance", emoji: "✅" },
  { id: "__more__",   label: "More",       emoji: "☰" },
];

// ── Upgrade Contact Modal ──────────────────────────────────────
function UpgradeModal({ onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "32px 28px",
        maxWidth: 440, width: "100%", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 16,
          background: "none", border: "none", fontSize: 20,
          cursor: "pointer", color: "var(--text3)", lineHeight: 1,
        }}>✕</button>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text1)", marginBottom: 4 }}>Upgrade Your Plan</div>
          <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>Reach out to us and we’ll get you upgraded within minutes.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a href="https://wa.me/918956419453?text=Hi%20Kartik%2C%20I%20want%20to%20upgrade%20my%20Exponent%20academy%20plan."
            target="_blank" rel="noreferrer"
            style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
              background:"rgba(37,211,102,0.1)", border:"1px solid rgba(37,211,102,0.3)",
              borderRadius:12, textDecoration:"none" }}>
            <span style={{ fontSize: 28 }}>💬</span>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"#25d366" }}>WhatsApp</div>
              <div style={{ fontSize:12, color:"var(--text3)" }}>+91 89564 19453 — fastest response</div>
            </div>
          </a>
          <a href="tel:+918956419453"
            style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
              background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.25)",
              borderRadius:12, textDecoration:"none" }}>
            <span style={{ fontSize: 28 }}>📞</span>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"var(--accent)" }}>Call Us</div>
              <div style={{ fontSize:12, color:"var(--text3)" }}>+91 89564 19453</div>
            </div>
          </a>
          <a href="mailto:aspirantth@gmail.com?subject=Upgrade%20Request%20%E2%80%94%20Exponent%20Plan"
            style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
              background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.25)",
              borderRadius:12, textDecoration:"none" }}>
            <span style={{ fontSize: 28 }}>✉️</span>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"var(--purple,#a855f7)" }}>Email</div>
              <div style={{ fontSize:12, color:"var(--text3)" }}>aspirantth@gmail.com</div>
            </div>
          </a>
        </div>
        <div style={{ marginTop:20, fontSize:11, color:"var(--text3)", textAlign:"center" }}>
          We typically respond within a few hours — Mon to Sat.
        </div>
      </div>
    </div>
  );
}

// ── Trial expiry banner ───────────────────────────────────────────────────
function TrialBanner({ academy, onUpgrade }) {
  if (!academy?.trial_ends_at || academy?.plan !== "trial") return null;
  const msLeft   = new Date(academy.trial_ends_at) - Date.now();
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
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>{urgent ? "🚨" : "⏳"}</span>
        <span style={{ fontSize:13, fontWeight:600, color: urgent ? "var(--red)" : "var(--yellow)" }}>
          {daysLeft <= 0 ? "Your free trial has expired!"
            : `Your free trial expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}!`}
        </span>
        <span style={{ fontSize:12, color:"var(--text3)" }}>
          Ends on {new Date(academy.trial_ends_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
        </span>
      </div>
      <button className="btn btn-sm"
        style={{ background: urgent ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)",
          color: urgent ? "var(--red)" : "var(--yellow)", border: "none" }}
        onClick={onUpgrade}>Contact Us to Upgrade →</button>
    </div>
  );
}

function Layout() {
  const { user, logout }     = useAuth();
  const { academy, loading } = useAcademy();
  const [page, setPage]               = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme]             = useState(() => localStorage.getItem("theme") || "dark");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const mainRef = useRef(null);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [page]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (loading) return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", flexDirection:"column", gap:16,
      background:"var(--bg1)", color:"var(--text1)"
    }}>
      <div style={{ fontSize:32, animation:"spin 1s linear infinite" }}>⟳</div>
      <div style={{ fontSize:14, color:"var(--text3)" }}>Loading...</div>
    </div>
  );

  if (!user) return <Login />;
  if (user.role === "student") return (
    <ErrorBoundary page="Student Dashboard">
      <StudentDashboard />
    </ErrorBoundary>
  );

  const f   = academy?.features || {};
  const nav = [
    { id:"dashboard",   label:"Dashboard",   group:"overview", show:true },
    { id:"students",    label:"Students",    group:"academic", show:true },
    { id:"admissions",  label:"Admissions",  group:"academic", show:f.admissions !== false },
    { id:"batches",     label:"Batches",     group:"academic", show:true },
    { id:"attendance",  label:"Attendance",  group:"academic", show:f.attendance !== false },
    { id:"performance", label:"Performance", group:"academic", show:f.tests !== false },
    { id:"fees",        label:"Fee Records", group:"finance",  show:true },
    { id:"payments",    label:"Payments",    group:"finance",  show:true },
    { id:"expenses",    label:"Expenses",    group:"finance",  show:f.expenses !== false },
    { id:"reports",     label:"Reports",     group:"finance",  show:f.reports !== false },
    { id:"idcards",     label:"ID Cards",    group:"tools",    show:f.id_cards !== false },
    { id:"qrscanner",   label:"QR Scanner",  group:"tools",    show:f.qr_scanner !== false },
    ...(user.role === "super_admin" ? [
      { id:"users",    label:"Users",    group:"tools", show:true },
      { id:"settings", label:"Settings", group:"tools", show:true },
    ] : []),
  ].filter((n) => n.show);

  const pages = {
    dashboard:Dashboard, students:Students, admissions:Admissions,
    batches:Batches, attendance:Attendance, performance:Performance,
    fees:Fees, payments:Payments, expenses:Expenses, reports:Reports,
    idcards:IDCards, qrscanner:QRScanner, users:Users, settings:AcademySettings,
  };
  const Page = pages[page] || Dashboard;
  const goTo = (id) => { setPage(id); setSidebarOpen(false); };

  const groups = [
    { key:"overview", label:"Overview" },
    { key:"academic", label:"Academic" },
    { key:"finance",  label:"Finance"  },
    { key:"tools",    label:"Tools"    },
  ];

  const academyWords = (academy?.name || "Academy").split(" ");
  const brandTitle   = academyWords[0].toUpperCase();
  const brandSub     = academyWords.slice(1).join(" ") || "Portal";

  const visibleNavIds = new Set(nav.map(n => n.id));
  const bottomTabs    = BOTTOM_NAV_TABS.filter(t => t.id === "__more__" || visibleNavIds.has(t.id));

  const handleBottomTab = (tabId) => {
    if (tabId === "__more__") setSidebarOpen(true);
    else goTo(tabId);
  };

  const academyName = academy?.name || "Academy";

  return (
    <div className="app-shell">
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {/* ── Hamburger (desktop) ∕ Top App Bar (mobile) ─────────────────────── */}
      <button
        className="hamburger"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {/* Desktop: shows ☰ / ✕ icon */}
        <span className="hamburger-icon-text">{sidebarOpen ? "✕" : "☰"}</span>

        {/* Mobile: renders full top app bar content */}
        {isMobile && (
          <>
            {/* Left side: menu icon + academy name */}
            <span style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{
                width:32, height:32, borderRadius:8,
                background: academy?.logo_url ? "transparent" : "linear-gradient(135deg,#9ba8ff,#8999ff)",
                display:"flex", alignItems:"center", justifyContent:"center",
                overflow:"hidden", flexShrink:0,
              }}>
                {academy?.logo_url
                  ? <img src={academy.logo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:8 }} />
                  : <span style={{ fontSize:14, fontWeight:800, color:"#001c8e" }}>{(academy?.name||"A")[0].toUpperCase()}</span>
                }
              </span>
              <span style={{
                fontFamily:"'Manrope',sans-serif",
                fontWeight:800, fontSize:16,
                color:"#e6ebfc",
                letterSpacing:"-0.3px",
              }}>{academyName}</span>
            </span>
            {/* Right side: theme toggle + user avatar */}
            <span style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span
                onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                style={{
                  width:34, height:34, borderRadius:"50%",
                  background:"rgba(255,255,255,0.06)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:16, cursor:"pointer",
                }}
              >{theme === "dark" ? "☀" : "◑"}</span>
              <span style={{
                width:34, height:34, borderRadius:"50%",
                background:"linear-gradient(135deg,#9ba8ff,#8999ff)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:800, fontSize:13, color:"#001c8e",
              }}>{user.name?.[0]?.toUpperCase() || "U"}</span>
            </span>
          </>
        )}
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          {academy?.logo_url ? (
            <img src={academy.logo_url} alt={academy.name} style={{ width:36, height:36, objectFit:"contain", borderRadius:8 }} />
          ) : (
            <div style={{
              width:36, height:36, borderRadius:8, background:"var(--blue-600)", color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:18, flexShrink:0,
            }}>{(academy?.name||"A")[0].toUpperCase()}</div>
          )}
          <div style={{ flex:1, minWidth:0 }}>
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
                  fontSize:9, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:"0.12em", color:"var(--text3)",
                  padding:"12px 12px 4px", userSelect:"none",
                }}>{group.label}</div>
                {items.map((n) => (
                  <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => goTo(n.id)}>
                    <span className="nav-icon" style={{ fontFamily:"monospace" }}>{NAV_ICONS[n.id] || "▸"}</span>
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
            <div style={{ flex:1, minWidth:0 }}>
              <div className="user-name" style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</div>
              <div className="user-role">{user.role === "super_admin" ? "Super Admin" : user.branch_name || "Manager"}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>← Logout</button>
        </div>
      </aside>

      <main className="main-content" ref={mainRef}>
        <TrialBanner academy={academy} onUpgrade={() => setShowUpgrade(true)} />
        <ErrorBoundary page={page} onNavigate={goTo}>
          <Page onNavigate={goTo} />
        </ErrorBoundary>
      </main>

      {/* ── Mobile Bottom Navigation Bar ──────────────────────────── */}
      <nav className="mobile-bottom-nav" aria-label="Bottom navigation">
        {bottomTabs.map((tab) => {
          const isActive = tab.id !== "__more__" && page === tab.id;
          return (
            <button
              key={tab.id}
              className={`mobile-bottom-nav-item ${isActive ? "active" : ""}`}
              onClick={() => handleBottomTab(tab.id)}
              aria-label={tab.label}
            >
              <span className="mobile-bottom-nav-icon">{tab.emoji}</span>
              <span className="mobile-bottom-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === "/apply")   return <AdmissionForm />;
  if (window.location.pathname === "/signup")  return <AcademySignup />;
  if (window.location.pathname === "/privacy") return <PrivacyPolicy />;
  if (window.location.pathname === "/terms")   return <TermsOfService />;
  if (window.location.pathname === "/contact") return <Contact />;
  return (
    <AcademyProvider>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </AcademyProvider>
  );
}
