import { useState } from "react";
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
import logo from "./logo.png";
import "./App.css";

function Layout() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("dashboard");

  if (!user) return <Login />;

  const nav = [
    { id: "dashboard",   label: "Dashboard",    icon: "⬛" },
    { id: "students",    label: "Students",     icon: "👤" },
    { id: "batches",     label: "Batches",      icon: "📚" },
    { id: "attendance",  label: "Attendance",   icon: "📅" },
    { id: "performance", label: "Performance",  icon: "📊" },
    { id: "fees",        label: "Fee Records",  icon: "📋" },
    { id: "payments",    label: "Payments",     icon: "💳" },
    { id: "expenses",    label: "Expenses",     icon: "💰" },
    { id: "reports",     label: "Reports",      icon: "📈" },
    ...(user.role === "super_admin" ? [{ id: "users", label: "Users", icon: "🔑" }] : []),
  ];

  const pages = {
    dashboard: Dashboard, students: Students, batches: Batches,
    attendance: Attendance, performance: Performance,
    fees: Fees, payments: Payments, expenses: Expenses,
    reports: Reports, users: Users
  };
  const Page = pages[page] || Dashboard;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="Nishchay Academy" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <div>
            <div className="brand-title">NISHCHAY</div>
            <div className="brand-sub">ACADEMY</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => setPage(n.id)}
            >
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

      <main className="main-content">
        <Page onNavigate={setPage} />
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
