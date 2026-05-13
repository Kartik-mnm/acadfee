import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import OnboardingChecklist from "./OnboardingChecklist";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { SkeletonStatGrid, SkeletonChart, SkeletonRecentPayments } from "../components/Skeleton";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtShort = (n) => {
  const num = Number(n || 0);
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000)   return `₹${(num / 1000).toFixed(0)}k`;
  return `₹${num}`;
};

const ONBOARDING_DISMISSED_KEY = "onboarding_checklist_dismissed";

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid rgba(99,102,241,0.3)", borderRadius:10, padding:"10px 16px", boxShadow:"0 8px 32px rgba(0,0,0,0.35)", fontSize:12 }}>
      <div style={{ color:"var(--text3)", marginBottom:4, fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ color:"#818cf8", fontWeight:800, fontSize:16 }}>{fmt(payload[0].value)}</div>
    </div>
  );
}

function CustomYTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--text3)" fontSize={10} fontWeight={600}>
      {fmtShort(payload.value)}
    </text>
  );
}

function CollectionChart({ trend }) {
  if (!trend || trend.length === 0) {
    return (
      <div className="card" style={{ padding:28, display:"flex", alignItems:"center", justifyContent:"center", minHeight:220 }}>
        <div style={{ textAlign:"center", color:"var(--text3)" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>&#128202;</div>
          <div style={{ fontSize:13, fontWeight:600 }}>No collection data yet</div>
          <div style={{ fontSize:11, marginTop:4 }}>Start recording payments to see trends</div>
        </div>
      </div>
    );
  }
  const current    = trend[trend.length - 1];
  const previous   = trend[trend.length - 2];
  const currentVal = parseFloat(current?.collected  || 0);
  const prevVal    = parseFloat(previous?.collected || 0);
  const pctChange  = prevVal > 0 ? (((currentVal - prevVal) / prevVal) * 100).toFixed(1) : null;
  const isUp       = pctChange === null ? true : parseFloat(pctChange) >= 0;
  return (
    <div className="card" style={{ padding:"24px 20px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Collected this month</div>
          <div style={{ fontSize:28, fontWeight:900, color:"var(--text1)", lineHeight:1, fontFamily:"monospace" }}>{fmt(currentVal)}</div>
        </div>
        {pctChange !== null && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:20, background: isUp ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", border:`1px solid ${isUp ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, fontSize:12, fontWeight:700, color: isUp ? "var(--green)" : "var(--red)", whiteSpace:"nowrap" }}>
            {isUp ? "↗" : "↘"}{isUp ? "+" : ""}{pctChange}% vs last month
          </div>
        )}
      </div>
      <div style={{ height:150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend} barCategoryGap="28%" margin={{ top:4, right:4, left:0, bottom:0 }}>
            <defs>
              <linearGradient id="bar-ci" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                <stop offset="100%" stopColor="#4338ca" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="bar-pi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.07)" strokeDasharray="4 4" />
            <XAxis dataKey="month" tick={{ fill:"var(--text3)", fontSize:10, fontWeight:600 }} axisLine={false} tickLine={false} tickFormatter={m => m?.split(" ")[0]?.toUpperCase().substring(0,3)} />
            <YAxis tick={<CustomYTick />} axisLine={false} tickLine={false} width={42} />
            <Tooltip content={<BarTooltip />} cursor={{ fill:"rgba(99,102,241,0.06)", radius:6 }} />
            <Bar dataKey="collected" radius={[6,6,2,2]} maxBarSize={44}>
              {trend.map((_, index) => (
                <Cell key={`c-${index}`}
                  fill={index === trend.length - 1 ? "url(#bar-ci)" : "url(#bar-pi)"}
                  stroke={index === trend.length - 1 ? "rgba(129,140,248,0.4)" : "transparent"}
                  strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:"flex", gap:20, marginTop:8, paddingTop:8, borderTop:"1px solid var(--border2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--text3)" }}>
          <div style={{ width:10, height:10, borderRadius:2, background:"linear-gradient(135deg,#818cf8,#4338ca)" }} />Current month
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--text3)" }}>
          <div style={{ width:10, height:10, borderRadius:2, background:"rgba(99,102,241,0.3)" }} />Previous months
        </div>
      </div>
    </div>
  );
}

// ── Recent Payment Card — single item ─────────────────────────────────────────
function PaymentCard({ p, showBranch }) {
  return (
    <div style={{
      background: "var(--bg3, #1e293b)",
      borderRadius: 12,
      padding: "8px 14px",
      marginBottom: 6,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 2 }}>
        <div style={{
          fontWeight: 700, fontSize: 13, color: "var(--text)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px"
        }}>
          {p.student_name}
          {showBranch && (
            <span style={{ fontSize:10, color:"var(--text3)", marginLeft:6, fontWeight:500, textTransform:"uppercase" }}>• {p.branch_name}</span>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#3fff8b", fontFamily: "monospace" }}>
          {fmt(p.amount)}
        </div>
      </div>
      
      <div style={{ display:"flex", alignItems:"center", justifyContent: "space-between" }}>
        <span style={{ fontSize:11, color:"var(--text3)" }}>
          {new Date(p.paid_on).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
        </span>
        <span style={{
          background:"rgba(155,168,255,0.08)", color:"#9ba8ff",
          borderRadius:4, padding:"1px 6px",
          fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.02em",
        }}>{p.payment_mode?.toUpperCase()}</span>
      </div>
    </div>
  );
}

// ── Branch Performance Card — single branch ───────────────────────────────────
function BranchCard({ b }) {
  const total   = parseFloat(b.collected) + parseFloat(b.pending);
  const collPct = total > 0 ? Math.round((parseFloat(b.collected) / total) * 100) : 0;
  return (
    <div style={{
      background:"var(--bg3, #1e293b)",
      borderRadius:14,
      padding:"16px",
      marginBottom:10,
    }}>
      {/* Branch header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{
          width:36, height:36, borderRadius:10,
          background:"linear-gradient(135deg,rgba(155,168,255,0.2),rgba(73,99,255,0.1))",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontWeight:800, fontSize:14, color:"#9ba8ff",
        }}>{b.branch?.[0]?.toUpperCase() || "B"}</div>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>{b.branch}</div>
          <div style={{ fontSize:11, fontWeight:600, color:"#3fff8b", textTransform:"uppercase", letterSpacing:"0.06em" }}>OPERATING</div>
        </div>
      </div>
      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 16px" }}>
        <div>
          <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>STUDENTS</div>
          <div style={{ fontSize:20, fontWeight:800, color:"var(--text)" }}>{b.students}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>COLLECTED</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#3fff8b" }}>{fmt(b.collected)}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>PENDING</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#fbbf24" }}>{fmt(b.pending)}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>COLLECTION %</div>
          <div style={{ fontSize:20, fontWeight:800, color: collPct >= 80 ? "#3fff8b" : collPct >= 60 ? "#fbbf24" : "#ff6e84" }}>{collPct}%</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData]               = useState(null);
  const [branchStats, setBranchStats] = useState([]);
  const [trend, setTrend]             = useState([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [timeRange, setTimeRange] = useState("this_month");
  const [branches, setBranches]       = useState([]);
  const [isNewAcademy, setIsNewAcademy] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);

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
        const hasBatches = r.data.length > 0;
        API.get("/students?limit=1").then(s => {
          const hasStudents = (s.data?.total || s.data?.data?.length || s.data?.length || 0) > 0;
          const steps = [];
          if (hasBatches)  steps.push("batch");
          if (hasStudents) steps.push("student");
          setCompletedSteps(steps);
          setIsNewAcademy(!hasStudents);
        }).catch(() => setIsNewAcademy(false));
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (branchFilter) params.append("branch_id", branchFilter);
    if (timeRange) params.append("time_range", timeRange);
    const q = `?${params.toString()}`;

    // Single combined call — replaces 3 separate round trips
    API.get(`/reports/dashboard-full${q}`).then(r => {
      const d = r.data;
      setData({
        active_students: d.active_students,
        total_collected: d.total_collected,
        total_due:       d.total_due,
        overdue_count:   d.overdue_count,
        recent_payments: d.recent_payments,
        branch_performance: d.branch_performance,
      });
      setTrend(d.monthly_trend || []);
      if (user.role === "super_admin" && !branchFilter)
        setBranchStats(d.branch_performance || []);
    }).catch(() => {});
  }, [branchFilter, timeRange, user]);

  if (!data) {
    return (
      <div style={{ animation: "fadeUp 0.3s ease both" }}>
        <div className="page-header">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-sub">Loading latest statistics...</div>
          </div>
        </div>
        <SkeletonStatGrid />
        <div className="grid-2">
          <SkeletonChart />
          <SkeletonRecentPayments />
        </div>
      </div>
    );
  }

  const statCards = [
    { key:"students",  color:"blue",   label:"Active Students", value:data.active_students,      suffix:"",         icon:"&#9673;", hint:"Total enrolled", target: "students", state: { filterStatus: "active" } },
    { key:"collected", color:"green",  label:"Total Collected", value:fmt(data.total_collected), suffix:"",         icon:"&#11041;", hint: timeRange === "this_month" ? "This month" : "All time", target: "payments" },
    { key:"due",       color:"yellow", label:"Pending Dues",    value:fmt(data.total_due),       suffix:"",         icon:"&#9678;", hint: timeRange === "this_month" ? "This month" : "Outstanding", target: "fees", state: { filterStatus: "pending" } },
    { key:"overdue",   color:"red",    label:"Overdue",         value:data.overdue_count,        suffix:" records", icon:"&#9650;", hint: timeRange === "this_month" ? "This month" : "Needs attention", target: "fees", state: { filterStatus: "overdue" } },
  ];

  const showChecklist = isNewAcademy && user.role === "super_admin" && !checklistDismissed;
  const recentPayments = (data.recent_payments || []).slice(0, 4);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{user.role === "super_admin" ? "All branches overview" : `Branch: ${user.branch_name}`}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)} style={{ width:140 }}>
            <option value="this_month">This Month</option>
            <option value="all_time">All Time</option>
          </select>
          {user.role === "super_admin" && (
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ width:200 }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {showChecklist && (
        <div style={{ marginBottom:24 }}>
          <OnboardingChecklist onNavigate={onNavigate} completedSteps={completedSteps} />
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
            <button onClick={dismissChecklist}
              style={{ background:"transparent", border:"1px solid rgba(148,163,184,0.2)", borderRadius:8, padding:"5px 16px", fontSize:12, color:"var(--text3)", cursor:"pointer", fontWeight:600 }}>
              &#10005; I'll do it later
            </button>
          </div>
        </div>
      )}

      <div className="stat-grid">
        {statCards.map(s => (
          <div key={s.key} className={`stat-card ${s.color}`}
            onClick={() => s.target && onNavigate?.(s.target, s.state)}
            style={{ cursor: s.target ? 'pointer' : 'default' }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div className="stat-label">{s.label}</div>
              <div style={{
                width:32, height:32, borderRadius:8,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
                background: s.color==="blue" ? "rgba(59,130,246,0.12)" : s.color==="green" ? "rgba(16,217,160,0.12)" : s.color==="yellow" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)",
                color: s.color==="blue" ? "var(--blue-400)" : s.color==="green" ? "var(--green)" : s.color==="yellow" ? "var(--yellow)" : "var(--red)",
              }} dangerouslySetInnerHTML={{ __html: s.icon }} />
            </div>
            <div className={`stat-value ${s.color}`}>{s.value}{s.suffix}</div>
            <div className="stat-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Charts row — stacked on mobile, side-by-side on desktop */}
      <div className="grid-2" style={{ marginBottom:24 }}>
        <CollectionChart trend={trend} />

        {/* Recent payments — div cards, no table */}
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>RECENT PAYMENTS</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>Latest transactions</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate?.("payments")}>View all</button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="empty-state" style={{ padding:24 }}>
              <div className="empty-text">No payments yet</div>
            </div>
          ) : (
            <div>
              {recentPayments.map((p, i) => (
                <PaymentCard key={i} p={p} showBranch={user.role === "super_admin"} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Branch performance — div cards, no table */}
      {user.role === "super_admin" && !branchFilter && branchStats.length > 0 && (
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>BRANCH PERFORMANCE</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>All branches at a glance</div>
            </div>
          </div>
          <div>
            {branchStats.map((b, i) => <BranchCard key={i} b={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}
