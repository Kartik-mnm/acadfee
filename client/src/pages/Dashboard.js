import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import OnboardingChecklist from "./OnboardingChecklist";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// Key to persist the "dismissed" state across sessions
const ONBOARDING_DISMISSED_KEY = "onboarding_checklist_dismissed";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
      <div style={{ color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 700, fontSize: 13 }}>{fmt(p.value)}</div>)}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const { user }    = useAuth();
  const [data, setData]               = useState(null);
  const [branchStats, setBranchStats] = useState([]);
  const [trend, setTrend]             = useState([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches]       = useState([]);
  const [isNewAcademy, setIsNewAcademy] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Check if onboarding was dismissed. Stored per-user so each admin gets their own state.
  const dismissedKey = `${ONBOARDING_DISMISSED_KEY}_${user?.id}`;
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem(dismissedKey) === "1"
  );

  const dismissChecklist = () => {
    localStorage.setItem(dismissedKey, "1");
    setChecklistDismissed(true);
  };

  useEffect(() => {
    if (user.role === "super_admin") {
      API.get("/branches").then(r => setBranches(r.data));
      API.get("/batches").then(r => {
        const hasBatches  = r.data.length > 0;
        API.get("/students?limit=1").then(s => {
          const hasStudents = (s.data?.total || s.data?.data?.length || s.data?.length || 0) > 0;
          const steps = [];
          if (hasBatches)  steps.push("batch");
          if (hasStudents) steps.push("student");
          setCompletedSteps(steps);
          // Show checklist only if the academy is brand new (no students yet)
          setIsNewAcademy(!hasStudents);
        }).catch(() => setIsNewAcademy(false));
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const q = branchFilter ? `?branch_id=${branchFilter}` : "";
    API.get(`/reports/dashboard${q}`).then(r => setData(r.data));
    API.get(`/reports/monthly-trend${q}`).then(r => setTrend(r.data));
    if (user.role === "super_admin" && !branchFilter)
      API.get("/reports/by-branch").then(r => setBranchStats(r.data));
  }, [branchFilter, user]);

  if (!data) return <div className="loading">Loading dashboard…</div>;

  const statCards = [
    { key: "students", color: "blue",   label: "Active Students", value: data.active_students, suffix: "",        icon: "◉", hint: "Total enrolled" },
    { key: "collected",color: "green",  label: "Total Collected",  value: fmt(data.total_collected), suffix: "", icon: "⬡", hint: "All time" },
    { key: "due",      color: "yellow", label: "Pending Dues",     value: fmt(data.total_due), suffix: "",       icon: "◎", hint: "Outstanding" },
    { key: "overdue",  color: "red",    label: "Overdue",          value: data.overdue_count, suffix: " records",icon: "▲", hint: "Needs attention" },
  ];

  const showChecklist = isNewAcademy && user.role === "super_admin" && !checklistDismissed;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{user.role === "super_admin" ? "All branches overview" : `Branch: ${user.branch_name}`}</div>
        </div>
        {user.role === "super_admin" && (
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Onboarding checklist — dismissible */}
      {showChecklist && (
        <div style={{ position: "relative" }}>
          <OnboardingChecklist onNavigate={onNavigate} completedSteps={completedSteps} />
          {/* Dismiss button — sits in the top-right corner of the checklist card */}
          <button
            onClick={dismissChecklist}
            title="Hide this checklist"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(148,163,184,0.1)",
              border: "1px solid rgba(148,163,184,0.15)",
              borderRadius: 8,
              padding: "5px 14px",
              fontSize: 12,
              color: "var(--text3)",
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s",
              zIndex: 10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(148,163,184,0.18)";
              e.currentTarget.style.color = "var(--text2)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(148,163,184,0.1)";
              e.currentTarget.style.color = "var(--text3)";
            }}
          >
            <span style={{ fontSize: 14 }}>✕</span> I'll do it later
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        {statCards.map(s => (
          <div key={s.key} className={`stat-card ${s.color}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="stat-label">{s.label}</div>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                background: s.color === "blue" ? "rgba(59,130,246,0.12)" : s.color === "green" ? "rgba(16,217,160,0.12)" : s.color === "yellow" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)",
                color: s.color === "blue" ? "var(--blue-400)" : s.color === "green" ? "var(--green)" : s.color === "yellow" ? "var(--yellow)" : "var(--red)"
              }}>{s.icon}</div>
            </div>
            <div className={`stat-value ${s.color}`} style={{ marginTop: 12 }}>{s.value}{s.suffix}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><div className="card-title" style={{ marginBottom: 2 }}>Collection Trend</div><div style={{ fontSize: 11, color: "var(--text3)" }}>Last 12 months</div></div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `₹${v/1000}k`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="collected" stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><div className="card-title" style={{ marginBottom: 2 }}>Recent Payments</div><div style={{ fontSize: 11, color: "var(--text3)" }}>Latest transactions</div></div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate?.("payments")}>View all</button>
          </div>
          {data.recent_payments?.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-text">No payments yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Amount</th><th>Mode</th><th>Date</th></tr></thead>
                <tbody>
                  {data.recent_payments?.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.student_name}</div>
                        {user.role === "super_admin" && <div className="text-muted text-sm">{p.branch_name}</div>}
                      </td>
                      <td><span style={{ color: "var(--green)", fontWeight: 700, fontFamily: "monospace" }}>{fmt(p.amount)}</span></td>
                      <td><span className="badge badge-blue">{p.payment_mode}</span></td>
                      <td style={{ color: "var(--text3)", fontSize: 12 }}>{new Date(p.paid_on).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Branch performance */}
      {user.role === "super_admin" && !branchFilter && branchStats.length > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><div className="card-title" style={{ marginBottom: 2 }}>Branch Performance</div><div style={{ fontSize: 11, color: "var(--text3)" }}>All branches at a glance</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Branch</th><th>Students</th><th>Collected</th><th>Pending</th><th>Collection %</th></tr></thead>
              <tbody>
                {branchStats.map((b, i) => {
                  const total   = parseFloat(b.collected) + parseFloat(b.pending);
                  const collPct = total > 0 ? Math.round((parseFloat(b.collected) / total) * 100) : 0;
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,rgba(37,99,235,0.15),rgba(56,189,248,0.1))", border: "1px solid rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--blue-400)" }}>{b.branch?.[0]?.toUpperCase() || "B"}</div>
                          <span style={{ fontWeight: 600 }}>{b.branch}</span>
                        </div>
                      </td>
                      <td><span style={{ fontWeight: 600 }}>{b.students}</span></td>
                      <td><span style={{ color: "var(--green)", fontWeight: 700, fontFamily: "monospace" }}>{fmt(b.collected)}</span></td>
                      <td><span style={{ color: "var(--yellow)", fontWeight: 600, fontFamily: "monospace" }}>{fmt(b.pending)}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, background: "rgba(148,163,184,0.08)", borderRadius: 4, height: 5 }}>
                            <div style={{ width: `${collPct}%`, height: "100%", background: collPct >= 80 ? "var(--green)" : collPct >= 60 ? "var(--yellow)" : "var(--red)", borderRadius: 4, transition: "width 0.6s ease" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, color: collPct >= 80 ? "var(--green)" : collPct >= 60 ? "var(--yellow)" : "var(--red)" }}>{collPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
