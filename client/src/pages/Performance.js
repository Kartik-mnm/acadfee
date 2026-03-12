import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

export default function Performance() {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: "", subject: "", total_marks: "", test_date: new Date().toISOString().split("T")[0], batch_id: "", branch_id: "" });
  const [saving, setSaving] = useState(false);

  const load = () => API.get("/tests").then((r) => setTests(r.data));

  useEffect(() => {
    load();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, []);

  const createTest = async () => {
    setSaving(true);
    try {
      await API.post("/tests", form);
      setShowTestModal(false); load();
    } finally { setSaving(false); }
  };

  const openResults = async (test) => {
    setSelectedTest(test);
    const [resData, stuData] = await Promise.all([
      API.get(`/tests/${test.id}/results`),
      API.get(`/students${test.branch_id ? `?branch_id=${test.branch_id}` : ""}`)
    ]);
    // Merge existing results with all students
    const existingMap = {};
    resData.data.forEach((r) => existingMap[r.student_id] = r.marks);
    const filtered = stuData.data.filter((s) => !test.batch_id || s.batch_id == test.batch_id);
    setResults(filtered.map((s) => ({ student_id: s.id, student_name: s.name, marks: existingMap[s.id] ?? "" })));
    setShowResultModal(true);
  };

  const saveResults = async () => {
    setSaving(true);
    try {
      const valid = results.filter((r) => r.marks !== "" && r.marks !== null);
      await API.post(`/tests/${selectedTest.id}/results`, { results: valid });
      setShowResultModal(false); load();
    } finally { setSaving(false); }
  };

  const delTest = async (id) => {
    if (!window.confirm("Delete this test?")) return;
    await API.delete(`/tests/${id}`); load();
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const grade = (pct) => pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F";
  const gradeColor = (pct) => pct >= 70 ? "badge-green" : pct >= 50 ? "badge-yellow" : "badge-red";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Performance</div>
          <div className="page-sub">Test scores and student results</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: "", subject: "", total_marks: "", test_date: new Date().toISOString().split("T")[0], batch_id: "", branch_id: "" }); setShowTestModal(true); }}>
          + Create Test
        </button>
      </div>

      <div className="card">
        {tests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-text">No tests created yet</div>
            <div className="empty-sub">Create a test to start tracking performance</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Test Name</th><th>Subject</th>
                  {user.role === "super_admin" && <th>Branch</th>}
                  <th>Batch</th><th>Total Marks</th><th>Date</th><th>Results</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="text-muted">{t.subject || "—"}</td>
                    {user.role === "super_admin" && <td className="text-muted">{t.branch_name}</td>}
                    <td className="text-muted">{t.batch_name || "All"}</td>
                    <td className="mono">{t.total_marks}</td>
                    <td className="text-muted">{new Date(t.test_date).toLocaleDateString("en-IN")}</td>
                    <td><span className="badge badge-blue">{t.result_count} entered</span></td>
                    <td>
                      <div className="gap-row">
                        <button className="btn btn-success btn-sm" onClick={() => openResults(t)}>📝 Results</button>
                        <button className="btn btn-danger btn-sm" onClick={() => delTest(t.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Test Modal */}
      {showTestModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowTestModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Create New Test</div>
              <button className="modal-close" onClick={() => setShowTestModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Test Name *</label>
                  <input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Monthly Test – March" />
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <input value={form.subject} onChange={(e) => f("subject", e.target.value)} placeholder="Physics, Maths..." />
                </div>
                <div className="form-group">
                  <label>Total Marks *</label>
                  <input type="number" value={form.total_marks} onChange={(e) => f("total_marks", e.target.value)} placeholder="100" />
                </div>
                <div className="form-group">
                  <label>Test Date</label>
                  <input type="date" value={form.test_date} onChange={(e) => f("test_date", e.target.value)} />
                </div>
                {user.role === "super_admin" && (
                  <div className="form-group">
                    <label>Branch</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">All Branches</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Batch</label>
                  <select value={form.batch_id} onChange={(e) => f("batch_id", e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTestModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTest} disabled={saving}>{saving ? "Creating…" : "Create Test"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Results Modal */}
      {showResultModal && selectedTest && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowResultModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">📝 {selectedTest.name} — Enter Results</div>
              <button className="modal-close" onClick={() => setShowResultModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: 14, fontSize: 13 }}>Total Marks: <strong>{selectedTest.total_marks}</strong></p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Student</th><th>Marks (out of {selectedTest.total_marks})</th><th>%</th><th>Grade</th></tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const pct = r.marks !== "" ? Math.round((r.marks / selectedTest.total_marks) * 100) : null;
                      return (
                        <tr key={r.student_id}>
                          <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                          <td>
                            <input type="number" value={r.marks} min="0" max={selectedTest.total_marks}
                              placeholder="—"
                              onChange={(e) => setResults((prev) => prev.map((x, j) => j === i ? { ...x, marks: e.target.value } : x))}
                              style={{ width: 90 }} />
                          </td>
                          <td style={{ fontWeight: 700, color: pct !== null ? (pct >= 70 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)") : "var(--text2)" }}>
                            {pct !== null ? `${pct}%` : "—"}
                          </td>
                          <td>{pct !== null ? <span className={`badge ${gradeColor(pct)}`}>{grade(pct)}</span> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResultModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveResults} disabled={saving}>{saving ? "Saving…" : "✓ Save Results"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
