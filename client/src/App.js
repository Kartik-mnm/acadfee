import { useState, useEffect } from "react";
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
import StudentDashboard from "./pages/StudentDashboard";
import logo from "./logo.png";
import "./App.css";

function Layout() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => t === "dark" ? "light" : "dark");

  if (!user) return <Login />;
  if (user.role === "student") return <StudentDashboard />;

  const nav = [
    { id: "dashboard",   label: "Dashboard",   icon: "⬛" },
    { id: "students",    label: "Students",    icon: "👤" },
    { id: "batches",     label: "Batches",     icon: "📚" },
    { id: "attendance",  label: "Attendance",  icon: "📅" },
    { id: "performance", label: "Performance", icon: "📊" },
    { id: "fees",        label: "Fee Records", icon: "📋" },
    { id: "payments",    label: "Payments",    icon: "💳" },
    { id: "expenses",    label: "Expenses",    icon: "💰" },
    { id: "reports",     label: "Reports",     icon: "📈" },
    { id: "idcards",     label: "ID Cards",    icon: "🪪" },
    ...(user.role === "super_admin" ? [{ id: "users", label: "Users", icon: "🔑" }] : []),
  ];

  const pages = {
    dashboard: Dashboard, students: Students, batches: Batches,
    attendance: Attendance, performance: Performance,
    fees: Fees, payments: Payments, expenses: Expenses,
    reports: Reports, idcards: IDCards, users: Users
  };
  const Page = pages[page] || Dashboard;

  const goTo = (id) => { setPage(id); setSidebarOpen(false); };

  return (
    <div className="app-shell">
      {/* Hamburger Button */}
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Nishchay Academy" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <div className="brand-title">NISHCHAY</div>
            <div className="brand-sub">ACADEMY</div>
          </div>
          {/* Theme Toggle */}
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map((n) => (
            <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => goTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{user.name[0]}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role === "super_admin" ? "Super Admin" : user.branch_name}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>⬅ Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Page onNavigate={goTo} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
