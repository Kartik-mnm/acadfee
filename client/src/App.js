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

const NAV_ICONS = {
  dashboard:   "\u25a6",
  students:    "\u25c9",
  admissions:  "\u2726",
  batches:     "\u25a4",
  attendance:  "\u25a3",
  performance: "\u25c8",
  fees:        "\u25ce",
  payments:    "\u2b21",
  expenses:    "\u25c7",
  reports:     "\u25b2",
  idcards:     "\u25fb",
  qrscanner:   "\u229e",
  users:       "\u25ac",
  settings:    "\u2699",
};

// Bottom nav: 4 key tabs + More
const BOTTOM_TABS = [
  { id: "dashboard",  label: "Home",       emoji: "\ud83c\udfe0" },
  { id: "students",   label: "Students",   emoji: "\ud83d\udc64" },
  { id: "fees",       label: "Fees",       emoji: "\ud83d\udcb3" },
  { id: "attendance", label: "Attendance", emoji: "\u2705" },
  { id: "__more__",   label: "More",       emoji: "\u2630" },
];

function UpgradeModal({ onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:16,padding:"32px 28px",maxWidth:440,width:"100%",position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:16,background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--text3)",lineHeight:1 }}>\u2715</button>
        <div style={{ textAlign:"center",marginBottom:24 }}>
          <div style={{ fontSize:36,marginBottom:8 }}>\ud83d\ude80</div>
          <div style={{ fontSize:20,fontWeight:800,color:"var(--text1)",marginBottom:4 }}>Upgrade Your Plan</div>
          <div style={{ fontSize:13,color:"var(--text3)",lineHeight:1.6 }}>Reach out to us and we'll get you upgraded within minutes.</div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <a href="https://wa.me/918956419453?text=Hi%20Kartik%2C%20I%20want%20to%20upgrade%20my%20Exponent%20academy%20plan." target="_blank" rel="noreferrer"
            style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.3)",borderRadius:12,textDecoration:"none" }}>
            <span style={{ fontSize:28 }}>\ud83d\udcac</span>
            <div><div style={{ fontWeight:700,fontSize:14,color:"#25d366" }}>WhatsApp</div><div style={{ fontSize:12,color:"var(--text3)" }}>+91 89564 19453 \u2014 fastest response</div></div>
          </a>
          <a href="tel:+918956419453"
            style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:12,textDecoration:"none" }}>
            <span style={{ fontSize:28 }}>\ud83d\udcde</span>
            <div><div style={{ fontWeight:700,fontSize:14,color:"var(--accent)" }}>Call Us</div><div style={{ fontSize:12,color:"var(--text3)" }}>+91 89564 19453</div></div>
          </a>
          <a href="mailto:aspirantth@gmail.com?subject=Upgrade%20Request"
            style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:12,textDecoration:"none" }}>
            <span style={{ fontSize:28 }}>\u2709\ufe0f</span>
            <div><div style={{ fontWeight:700,fontSize:14,color:"var(--purple,#a855f7)" }}>Email</div><div style={{ fontSize:12,color:"var(--text3)" }}>aspirantth@gmail.com</div></div>
          </a>
        </div>
        <div style={{ marginTop:20,fontSize:11,color:"var(--text3)",textAlign:"center" }}>We typically respond within a few hours \u2014 Mon to Sat.</div>
      </div>
    </div>
  );
}

function TrialBanner({ academy, onUpgrade }) {
  if (!academy?.trial_ends_at || academy?.plan !== "trial") return null;
  const msLeft = new Date(academy.trial_ends_at) - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  if (daysLeft > 7 || daysLeft < 0) return null;
  const urgent = daysLeft <= 2;
  return (
    <div style={{ background:urgent?"rgba(239,68,68,0.12)":"rgba(251,191,36,0.10)",border:`1px solid ${urgent?"rgba(239,68,68,0.35)":"rgba(251,191,36,0.3)"}`,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",margin:"0 0 16px",flexWrap:"wrap",gap:8 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
        <span style={{ fontSize:16 }}>{urgent?"\ud83d\udea8":"\u23f3"}</span>
        <span style={{ fontSize:13,fontWeight:600,color:urgent?"var(--red)":"var(--yellow)" }}>
          {daysLeft<=0?"Your free trial has expired!":`Your free trial expires in ${daysLeft} day${daysLeft===1?"":"s"}!`}
        </span>
      </div>
      <button className="btn btn-sm" style={{ background:urgent?"rgba(239,68,68,0.2)":"rgba(251,191,36,0.15)",color:urgent?"var(--red)":"var(--yellow)",border:"none" }} onClick={onUpgrade}>
        Contact Us to Upgrade \u2192
      </button>
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
  const [isMobile, setIsMobile]       = useState(() => window.innerWidth <= 768);
  const mainRef = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
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
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16 }}>
      <div style={{ fontSize:32,animation:"spin 1s linear infinite" }}>\u27f3</div>
      <div style={{ fontSize:14,color:"var(--text3)" }}>Loading...</div>
    </div>
  );

  if (!user) return <Login />;
  if (user.role === "student") return <ErrorBoundary page="Student Dashboard"><StudentDashboard /></ErrorBoundary>;

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

  const pages = { dashboard:Dashboard,students:Students,admissions:Admissions,batches:Batches,attendance:Attendance,performance:Performance,fees:Fees,payments:Payments,expenses:Expenses,reports:Reports,idcards:IDCards,qrscanner:QRScanner,users:Users,settings:AcademySettings };
  const Page  = pages[page] || Dashboard;
  const goTo  = (id) => { setPage(id); setSidebarOpen(false); };
  const groups = [{ key:"overview",label:"Overview" },{ key:"academic",label:"Academic" },{ key:"finance",label:"Finance" },{ key:"tools",label:"Tools" }];

  const academyWords = (academy?.name || "Academy").split(" ");
  const brandTitle   = academyWords[0].toUpperCase();
  const brandSub     = academyWords.slice(1).join(" ") || "Portal";

  const visibleIds = new Set(nav.map(n => n.id));
  const bottomTabs = BOTTOM_TABS.filter(t => t.id === "__more__" || visibleIds.has(t.id));

  return (
    <div className="app-shell">
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {/* ── Mobile top header (replaces hamburger) ── */}
      {isMobile ? (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 60, zIndex: 2000,
          background: "#121a28",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px",
          boxShadow: "0 2px 16px rgba(61,90,254,0.08)",
        }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background:"none",border:"none",color:"#9ba8ff",fontSize:22,cursor:"pointer",padding:4,lineHeight:1,WebkitTapHighlightColor:"transparent" }}
            >\u2630</button>
            <span style={{ fontFamily:"Manrope,sans-serif",fontWeight:700,fontSize:16,color:"#e6ebfc" }}>
              {academy?.name || "Exponent"}
            </span>
          </div>
          {/* Theme toggle — visible on mobile topbar */}
          <button
            onClick={toggleTheme}
            style={{ background:"#1d2637",border:"none",borderRadius:10,width:36,height:36,fontSize:16,cursor:"pointer",color:"#a5abbb",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent" }}
            title="Toggle theme"
          >
            {theme === "dark" ? "\u2600" : "\u25d1"}
          </button>
        </div>
      ) : (
        /* Desktop hamburger (shown only on tablet/desktop) */
        <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          {sidebarOpen ? "\u2715" : "\u2630"}
        </button>
      )}

      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          {academy?.logo_url ? (
            <img src={academy.logo_url} alt={academy.name} style={{ width:36,height:36,objectFit:"contain",borderRadius:8 }} />
          ) : (
            <div style={{ width:36,height:36,borderRadius:8,background:"var(--blue-600)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,flexShrink:0 }}>
              {(academy?.name||"A")[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex:1,minWidth:0 }}>
            <div className="brand-title">{brandTitle}</div>
            <div className="brand-sub">{brandSub}</div>
          </div>
          {/* Theme toggle in sidebar for desktop */}
          {!isMobile && (
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === "dark" ? "\u2600" : "\u25d1"}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => {
            const items = nav.filter((n) => n.group === group.key);
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--text3)",padding:"12px 12px 4px",userSelect:"none" }}>
                  {group.label}
                </div>
                {items.map((n) => (
                  <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={() => goTo(n.id)}>
                    <span className="nav-icon" style={{ fontFamily:"monospace" }}>{NAV_ICONS[n.id]||"\u25b8"}</span>
                    <span>{n.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{user.name?.[0]?.toUpperCase()||"U"}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <div className="user-name" style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</div>
              <div className="user-role">{user.role==="super_admin"?"Super Admin":user.branch_name||"Manager"}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>\u2190 Logout</button>
        </div>
      </aside>

      <main className="main-content" ref={mainRef}>
        <TrialBanner academy={academy} onUpgrade={() => setShowUpgrade(true)} />
        <ErrorBoundary page={page} onNavigate={goTo}>
          <Page onNavigate={goTo} />
        </ErrorBoundary>
      </main>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav className="mobile-bottom-nav" aria-label="Bottom navigation">
        {bottomTabs.map((tab) => (
          <button
            key={tab.id}
            className={`mobile-bottom-nav-item ${tab.id !== "__more__" && page === tab.id ? "active" : ""}`}
            onClick={() => tab.id === "__more__" ? setSidebarOpen(true) : goTo(tab.id)}
            aria-label={tab.label}
          >
            <span className="mobile-bottom-nav-icon">{tab.emoji}</span>
            <span className="mobile-bottom-nav-label">{tab.label}</span>
          </button>
        ))}
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
  return <AcademyProvider><AuthProvider><Layout /></AuthProvider></AcademyProvider>;
}
