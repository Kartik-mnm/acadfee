import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [branchStats, setBranchStats] = useState([]);
  const [trend, setTrend] = useState([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (user.role === "super_admin") {
      API.get("/branches").then((r) => setBranches(r.data));
    }
  }, [user]);

  useEffect(() => {
    const q = branchFilter ? `?branch_id=${branchFilter}` : "";
    API.get(`/reports/dashboard${q}`).then((r) => setData(r.data));
    API.get(`/reports/monthly-trend${q}`).then((r) => setTrend(r.data));
    if (user.role === "super_admin" && !branchFilter) {
      API.get("/reports/by-branch").then((r) => setBranchStats(r.data));
    }
  }, [branchFilter, user]);

  if (!data) return <div className="loading">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">
            {user.role === "super_admin" ? "All Branches Overview" : `Branch: ${user.branch_name}`}
          </div>
        </div>
        {user.role === "super_admin" && (
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-label">Active Students</div>
          <div className="stat-value blue">{data.active_students}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Collected</div>
          <div className="stat-value green">{fmt(data.total_collected)}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Pending Dues</div>
          <div className="stat-value yellow">{fmt(data.total_due)}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Overdue Records</div>
          <div className="stat-value red">{data.overdue_count}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Monthly Trend */}
        <div className="card">
          <div className="card-title">Monthly Collection Trend</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3248" />
                <XAxis dataKey="month" tick={{ fill: "#8b93aa", fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${v/1000}k`} tick={{ fill: "#8b93aa", fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [fmt(v), "Collected"]}
                  contentStyle={{ background: "#1e2535", border: "1px solid #2a3248", borderRadius: 8, color: "#e8eaf0" }}
                />
                <Bar dataKey="collected" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="card-title">Recent Payments</div>
          {data.recent_payments.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-text">No payments yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_payments.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.student_name}</div>
                        {user.role === "super_admin" && <div className="text-muted text-sm">{p.branch_name}</div>}
                      </td>
                      <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>{fmt(p.amount)}</td>
                      <td><span className="badge badge-blue">{p.payment_mode}</span></td>
                      <td className="text-muted">{new Date(p.paid_on).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Branch Comparison (super admin only) */}
      {user.role === "super_admin" && !branchFilter && branchStats.length > 0 && (
        <div className="card">
          <div className="card-title">Branch-wise Summary</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Branch</th><th>Students</th><th>Collected</th><th>Pending</th></tr>
              </thead>
              <tbody>
                {branchStats.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{b.branch}</td>
                    <td>{b.students}</td>
                    <td className="mono" style={{ color: "var(--green)" }}>{fmt(b.collected)}</td>
                    <td className="mono" style={{ color: "var(--yellow)" }}>{fmt(b.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
