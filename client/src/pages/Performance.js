import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

const todayISO = () => new Date().toISOString().split("T")[0];

const fetchAllStudents = (query = "") =>
  API.get(`/students?limit=1000${query}`).then((r) => {
    const res = r.data;
    return Array.isArray(res) ? res : (res.data || []);
  });

function MiniAvatar({ student }) {
  const [imgError, setImgError] = useState(false);
  const showPhoto = student?.photo_url && !imgError;
  return (
    <div style={{
      width:32, height:32, borderRadius:"50%", flexShrink:0,
      background: showPhoto ? "var(--bg3)" : "linear-gradient(135deg, var(--accent), #7c3aed)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:13, fontWeight:700, color:"#fff", overflow:"hidden",
    }}>
      {showPhoto
        ? <img src={student.photo_url} alt={student.student_name}
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={() => setImgError(true)} />
        : (student?.student_name?.[0] || "?").toUpperCase()}
    </div>
  );
}

// ── Test card (replaces <table> row) ─────────────────────────────────────────
function TestCard({ t, user, onResults, onDelete }) {
  const entered = parseInt(t.result_count || 0);
  const hasResults = entered > 0;
  return (
    <div style={{
      background:"var(--bg3, #1e293b)",
      borderRadius:16,
      padding:"18px 16px 14px",
      marginBottom:12,
    }}>
      {/* Top row: test name + result badge */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ fontFamily:"'Manrope',sans-serif", fontSize:22, fontWeight:800, color:"var(--text)", letterSpacing:"-0.5px", lineHeight:1.1 }}>
          {t.name}
        </div>
        <span style={{
          background: hasResults ? "#006d35" : "rgba(155,168,255,0.15)",
          color: hasResults ? "#3fff8b" : "#9ba8ff",
          borderRadius:100, padding:"4px 12px",
          fontSize:11, fontWeight:700, whiteSpace:"nowrap", marginLeft:8,
          display:"flex", alignItems:"center", gap:4,
        }}>
          {hasResults && <span>&#10003;</span>} {entered} Entered
        </span>
      </div>

      {/* Subject chips */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
        {t.subject && (
          <span style={{
            background:"rgba(155,168,255,0.15)", color:"#9ba8ff",
            borderRadius:100, padding:"3px 10px", fontSize:11, fontWeight:700,
            textTransform:"uppercase", letterSpacing:"0.04em",
          }}>{t.subject}</span>
        )}
        {t.batch_name && (
          <span style={{
            background:"rgba(255,255,255,0.06)", color:"var(--text3)",
            borderRadius:100, padding:"3px 10px", fontSize:11, fontWeight:600,
          }}>{t.batch_name}</span>
        )}
      </div>

      {/* Branch + Course grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 12px", marginBottom:12 }}>
        {user.role === "super_admin" && t.branch_name && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>BRANCH</div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{t.branch_name}</div>
          </div>
        )}
        {t.batch_name && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>COURSE</div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{t.batch_name}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>TOTAL MARKS</div>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{t.total_marks}</div>
        </div>
      </div>

      {/* Date */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>DATE</div>
        <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:14 }}>&#128197;</span>
          {new Date(t.test_date).toLocaleDateString("en-IN")}
        </div>
      </div>

      {/* Actions row */}
      <div style={{
        display:"flex", gap:10,
        borderTop:"1px solid rgba(255,255,255,0.05)",
        paddingTop:12,
      }}>
        <button
          onClick={() => onResults(t)}
          style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            background:"rgba(155,168,255,0.1)", border:"none",
            borderRadius:10, padding:"10px 0",
            color:"#9ba8ff", fontWeight:700, fontSize:13, cursor:"pointer",
          }}
        >
          <span style={{ fontSize:15 }}>&#128202;</span> Results
        </button>
        <button
          onClick={() => onDelete(t.id)}
          style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            background:"rgba(255,110,132,0.1)", border:"none",
            borderRadius:10, padding:"10px 0",
            color:"#ff6e84", fontWeight:700, fontSize:13, cursor:"pointer",
          }}
        >
          <span style={{ fontSize:15 }}>&#128465;</span> Delete
        </button>
      </div>
    </div>
  );
}

export default function Performance() {
  const { user } = useAuth();
  const [tests,           setTests]           = useState([]);
  const [batches,         setBatches]         = useState([]);
  const [branches,        setBranches]        = useState([]);
  const [showTestModal,   setShowTestModal]   = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedTest,    setSelectedTest]    = useState(null);
  const [results,         setResults]         = useState([]);
  const [loadingResults,  setLoadingResults]  = useState(false);
  const [createError,     setCreateError]     = useState("");
  const [form, setForm] = useState({
    name:"", subject:"", total_marks:"", test_date:todayISO(), batch_id:"", branch_id:"",
  });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const load = (p = 1) => API.get(`/tests?page=${p}&limit=${LIMIT}`).then((r) => {
    if (r.data.data) {
      setTests(r.data.data);
      setPage(r.data.page);
      setTotalPages(r.data.totalPages);
      setTotal(r.data.total);
    } else {
      setTests(r.data);
      setTotal(r.data.length);
    }
  }).catch(() => {});

  useEffect(() => {
    load();
    API.get("/batches").then((r) => setBatches(r.data)).catch(() => {});
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  const createTest = async () => {
    setCreateError("");
    if (!form.name.trim())    { setCreateError("Test name is required.");  return; }
    if (!form.total_marks)    { setCreateError("Total marks is required."); return; }
    if (user.role === "super_admin" && !form.branch_id) { setCreateError("Please select a branch."); return; }
    setSaving(true);
    try {
      await API.post("/tests", { ...form, test_date: form.test_date || todayISO() });
      setShowTestModal(false);
      load();
    } catch (e) {
      setCreateError(e.response?.data?.error || "Failed to create test");
    } finally { setSaving(false); }
  };

  const openResults = async (test) => {
    setSelectedTest(test);
    setLoadingResults(true);
    setShowResultModal(true);
    setResults([]);
    try {
      const batchQuery = test.batch_id ? `&batch_id=${test.batch_id}` : "";
      const branchQuery = test.branch_id ? `&branch_id=${test.branch_id}` : "";
      const [resData, allStudents] = await Promise.all([
        API.get(`/tests/${test.id}/results`),
        fetchAllStudents(`${branchQuery}${batchQuery}`),
      ]);
      const existingRows = Array.isArray(resData.data?.data) ? resData.data.data
        : Array.isArray(resData.data) ? resData.data : [];
      const existingMap = {};
      existingRows.forEach((r) => { existingMap[r.student_id] = r.marks; });
      const filtered = allStudents.filter(
        (s) => !test.batch_id || String(s.batch_id) === String(test.batch_id)
      );
      setResults(filtered.map((s) => ({
        student_id:s.id, student_name:s.name, photo_url:s.photo_url||"",
        roll_no:s.roll_no||"", marks:existingMap[s.id] ?? "",
      })));
    } catch (e) {
      console.error("openResults error:", e.message);
    } finally { setLoadingResults(false); }
  };

  const saveResults = async () => {
    setSaving(true);
    try {
      const valid = results.filter((r) => r.marks !== "" && r.marks !== null && r.marks !== undefined);
      if (valid.length === 0) { alert("Enter at least one mark before saving."); return; }
      await API.post(`/tests/${selectedTest.id}/results`, { results: valid });
      setShowResultModal(false);
      load();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to save results");
    } finally { setSaving(false); }
  };

  const delTest = async (id) => {
    if (!window.confirm("Delete this test and all its results?")) return;
    await API.delete(`/tests/${id}`).catch(() => {});
    load();
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const grade = (pct) => pct>=90?"A+":pct>=80?"A":pct>=70?"B":pct>=60?"C":pct>=50?"D":"F";
  const gradeColor = (pct) => pct>=70?"badge-green":pct>=50?"badge-yellow":"badge-red";
  const rankedResults = [...results]
    .filter((r) => r.marks !== "" && r.marks !== null && r.marks !== undefined)
    .sort((a, b) => parseFloat(b.marks) - parseFloat(a.marks));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Performance</div>
          <div className="page-sub">Track, analyze, and manage student assessments across branches.</div>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setForm({ name:"", subject:"", total_marks:"", test_date:todayISO(), batch_id:"", branch_id:"" });
          setCreateError("");
          setShowTestModal(true);
        }}>+ Create Test</button>
      </div>

      {/* Test cards — no table */}
      {tests.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">&#128202;</div>
            <div className="empty-text">No tests created yet</div>
            <div className="empty-sub">Create a test to start tracking performance</div>
          </div>
        </div>
      ) : (
        <div>
          {tests.map((t) => (
            <TestCard
              key={t.id}
              t={t}
              user={user}
              onResults={openResults}
              onDelete={delTest}
            />
          ))}
          {/* Schedule new test CTA card */}
          <div
            onClick={() => { setForm({ name:"", subject:"", total_marks:"", test_date:todayISO(), batch_id:"", branch_id:"" }); setCreateError(""); setShowTestModal(true); }}
            style={{
              border:"2px dashed rgba(155,168,255,0.2)",
              borderRadius:16, padding:"24px 16px",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              gap:8, cursor:"pointer", marginBottom:12,
              background:"transparent",
            }}
          >
            <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(155,168,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:"#9ba8ff" }}>+</div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>Schedule New Test</div>
            <div style={{ fontSize:12, color:"var(--text3)" }}>Add a new assessment to the batch timeline</div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20, flexWrap:"wrap", gap:10, padding:"0 10px" }}>
          <div style={{ fontSize:13, color:"var(--text3)" }}>Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} of <strong>{total}</strong></div>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => load(page-1)} disabled={page===1}>← Prev</button>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{page}</span>
              <span style={{ fontSize:13, color:"var(--text3)" }}>/ {totalPages}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => load(page+1)} disabled={page===totalPages}>Next →</button>
          </div>
        </div>
      )}

      {/* ── Create Test Modal ── */}
      {showTestModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowTestModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Create New Test</div>
              <button className="modal-close" onClick={() => setShowTestModal(false)}>&#10005;</button>
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
                  <input type="number" min="1" value={form.total_marks} onChange={(e) => f("total_marks", e.target.value)} placeholder="100" />
                </div>
                <div className="form-group">
                  <label>Test Date</label>
                  <input type="date" value={form.test_date} onChange={(e) => f("test_date", e.target.value)} />
                </div>
                {user.role === "super_admin" && (
                  <div className="form-group">
                    <label>Branch *</label>
                    <select value={form.branch_id} onChange={(e) => f("branch_id", e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Batch <span style={{ fontWeight:400, color:"var(--text3)" }}>(optional)</span></label>
                  <select value={form.batch_id} onChange={(e) => f("batch_id", e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              {createError && (
                <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:8, fontSize:13, color:"var(--red)" }}>
                  &#9888; {createError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTestModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTest} disabled={saving}>{saving ? "Creating…" : "Create Test"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Results Modal ── */}
      {showResultModal && selectedTest && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowResultModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">&#128202; {selectedTest.name} — Enter Results</div>
              <button className="modal-close" onClick={() => setShowResultModal(false)}>&#10005;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom:14, fontSize:13, color:"var(--text2)" }}>
                Total Marks: <strong>{selectedTest.total_marks}</strong>
                {rankedResults.length > 0 && (
                  <span style={{ marginLeft:12, color:"var(--green)" }}>&#10003; {rankedResults.length} entered</span>
                )}
              </p>
              {loadingResults ? (
                <div className="loading">Loading students…</div>
              ) : results.length === 0 ? (
                <div className="empty-state" style={{ padding:24 }}>
                  <div className="empty-icon">&#128101;</div>
                  <div className="empty-text">No students found for this test</div>
                  <div className="empty-sub">
                    {selectedTest.batch_id ? "No students in the selected batch. Check batch assignments in Students." : "No students found in this branch."}
                  </div>
                </div>
              ) : (
                <>
                  {rankedResults.length > 0 && (
                    <div style={{ marginBottom:20 }}>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"var(--text2)" }}>&#127942; Current Rankings</div>
                      <div className="table-wrap"><table>
                        <thead><tr><th>#</th><th>Photo</th><th>Student</th><th>Marks</th><th>%</th><th>Grade</th></tr></thead>
                        <tbody>{rankedResults.map((r, i) => {
                          const pct = Math.round((parseFloat(r.marks) / parseFloat(selectedTest.total_marks)) * 100);
                          const medal = i===0 ? "&#129351;" : i===1 ? "&#129352;" : i===2 ? "&#129353;" : `${i+1}.`;
                          return (
                            <tr key={r.student_id} style={{ background: i<3 ? "rgba(79,142,247,0.05)" : undefined }}>
                              <td data-label="#" style={{ fontWeight:800, fontSize:16 }} dangerouslySetInnerHTML={{ __html: medal }} />
                              <td data-label="Photo"><MiniAvatar student={r} /></td>
                              <td data-label="Student" style={{ fontWeight:600 }}>{r.student_name}</td>
                              <td data-label="Marks" className="mono" style={{ fontWeight:700 }}>{r.marks} / {selectedTest.total_marks}</td>
                              <td data-label="%" style={{ fontWeight:700, color: pct>=70?"var(--green)":pct>=50?"var(--yellow)":"var(--red)" }}>{pct}%</td>
                              <td data-label="Grade"><span className={`badge ${gradeColor(pct)}`}>{grade(pct)}</span></td>
                            </tr>
                          );
                        })}</tbody>
                      </table></div>
                    </div>
                  )}
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"var(--text2)" }}>&#9998; Enter / Update Marks</div>
                  <div className="table-wrap"><table>
                    <thead><tr>
                      <th>Photo</th><th>Student</th>
                      <th>Marks (out of {selectedTest.total_marks})</th>
                      <th>%</th><th>Grade</th>
                    </tr></thead>
                    <tbody>{results.map((r, i) => {
                      const pct = r.marks !== "" && r.marks !== null
                        ? Math.round((parseFloat(r.marks) / parseFloat(selectedTest.total_marks)) * 100)
                        : null;
                      return (
                        <tr key={r.student_id}>
                          <td data-label="Photo"><MiniAvatar student={r} /></td>
                          <td data-label="Student" style={{ fontWeight:600 }}>
                            {r.student_name}
                            {r.roll_no && <div style={{ fontSize:11, color:"var(--text3)", fontFamily:"monospace" }}>{r.roll_no}</div>}
                          </td>
                          <td data-label="Marks">
                            <input type="number" value={r.marks} min="0" max={selectedTest.total_marks}
                              placeholder="—"
                              onChange={(e) => setResults((prev) =>
                                prev.map((x, j) => j===i ? { ...x, marks: e.target.value } : x)
                              )}
                              style={{ width:90 }}
                            />
                          </td>
                          <td data-label="%" style={{ fontWeight:700, color: pct!==null?(pct>=70?"var(--green)":pct>=50?"var(--yellow)":"var(--red)"):"var(--text2)" }}>
                            {pct !== null ? `${pct}%` : "—"}
                          </td>
                          <td data-label="Grade">{pct!==null ? <span className={`badge ${gradeColor(pct)}`}>{grade(pct)}</span> : "—"}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResultModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveResults} disabled={saving || loadingResults}>
                {saving ? "Saving…" : "&#10003; Save Results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
