import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import logo from "../logo.png";
import QRCode from "qrcode";

export default function IDCards() {
  const { user } = useAuth();
  const [students, setStudents]     = useState([]);
  const [branches, setBranches]     = useState([]);
  const [batches, setBatches]       = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBatch, setFilterBatch]   = useState("");
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);
  const [qrDataUrl, setQrDataUrl]   = useState("");
  const [loadingQr, setLoadingQr]   = useState(false);
  const printRef = useRef();

  useEffect(() => {
    API.get("/students").then((r) => setStudents(r.data));
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, []);

  // Generate QR whenever a student is selected
  useEffect(() => {
    if (!selected) { setQrDataUrl(""); return; }
    setLoadingQr(true);
    API.get(`/qrscan/token/${selected.id}`)
      .then(async (r) => {
        const url = await QRCode.toDataURL(r.data.token, {
          width: 120, margin: 1,
          color: { dark: "#1a1f35", light: "#ffffff" }
        });
        setQrDataUrl(url);
      })
      .catch(() => setQrDataUrl(""))
      .finally(() => setLoadingQr(false));
  }, [selected]);

  const filtered = students.filter((s) => {
    if (filterBranch && s.branch_id != filterBranch) return false;
    if (filterBatch  && s.batch_id  != filterBatch)  return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const printCard = () => {
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>ID Card - ${selected.name}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Arial',sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f0f0; }
        .card { width:340px; background:linear-gradient(135deg,#1a1f35 0%,#2d3561 100%); border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.3); }
        .card-header { background:linear-gradient(90deg,#c9a227,#f0d060,#c9a227); padding:12px 16px; display:flex; align-items:center; gap:10px; }
        .card-header img { width:40px; height:40px; object-fit:contain; }
        .academy-name { font-size:14px; font-weight:900; color:#1a1f35; letter-spacing:.05em; }
        .academy-sub  { font-size:9px; color:#3a3000; font-weight:700; letter-spacing:.1em; }
        .card-body { padding:16px; display:flex; gap:14px; align-items:flex-start; }
        .left-col { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .photo { width:70px; height:80px; background:rgba(255,255,255,0.1); border-radius:8px; border:2px solid #c9a227; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.4); font-size:28px; flex-shrink:0; }
        .qr-box { background:#fff; border-radius:6px; padding:4px; border:2px solid #c9a227; }
        .qr-box img { display:block; width:70px; height:70px; }
        .info { flex:1; }
        .student-name { font-size:15px; font-weight:900; color:#fff; margin-bottom:8px; }
        .field { margin-bottom:5px; }
        .field-label { font-size:8px; color:#c9a227; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
        .field-value { font-size:11px; color:#e0e0e0; font-weight:600; }
        .card-footer { background:rgba(0,0,0,0.3); padding:8px 16px; display:flex; justify-content:space-between; align-items:center; }
        .id-number { font-size:10px; color:#c9a227; font-weight:700; font-family:monospace; }
        .valid { font-size:9px; color:rgba(255,255,255,0.5); }
        .id-label { background:#c9a227; color:#1a1f35; font-size:9px; font-weight:900; padding:3px 10px; border-radius:4px; text-transform:uppercase; letter-spacing:.1em; }
        .scan-hint { font-size:8px; color:rgba(255,255,255,0.4); text-align:center; margin-top:2px; }
      </style></head>
      <body>
        <div class="card">
          <div class="card-header">
            <img src="${window.location.origin}/logo.png" alt="logo" />
            <div>
              <div class="academy-name">NISHCHAY ACADEMY</div>
              <div class="academy-sub">Student Identity Card</div>
            </div>
          </div>
          <div class="card-body">
            <div class="left-col">
              <div class="photo">👤</div>
              ${qrDataUrl ? `
              <div class="qr-box"><img src="${qrDataUrl}" /></div>
              <div class="scan-hint">Scan for attendance</div>` : ""}
            </div>
            <div class="info">
              <div class="student-name">${selected.name}</div>
              <div class="field"><div class="field-label">Batch / Course</div><div class="field-value">${selected.batch_name || "—"}</div></div>
              <div class="field"><div class="field-label">Branch</div><div class="field-value">${selected.branch_name || "—"}</div></div>
              <div class="field"><div class="field-label">Phone</div><div class="field-value">${selected.phone || "—"}</div></div>
              <div class="field"><div class="field-label">Admission Date</div><div class="field-value">${selected.admission_date ? new Date(selected.admission_date).toLocaleDateString("en-IN") : "—"}</div></div>
            </div>
          </div>
          <div class="card-footer">
            <div>
              <div class="id-number">ID: NA-${String(selected.id).padStart(5, "0")}</div>
              <div class="valid">Valid for Academic Year 2025-26</div>
            </div>
            <div class="id-label">Student</div>
          </div>
        </div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Student ID Cards</div>
          <div className="page-sub">Generate and print student ID cards with QR attendance</div>
        </div>
      </div>

      <div className="filters-bar">
        <input className="search-input" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {user.role === "super_admin" && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All Batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid-2">
        {/* Student List */}
        <div className="card">
          <div className="card-title">Select Student ({filtered.length})</div>
          {filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No students found</div></div>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {filtered.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
                    background: selected?.id === s.id ? "rgba(79,142,247,.15)" : "var(--bg3)",
                    border: `1px solid ${selected?.id === s.id ? "var(--accent)" : "transparent"}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="text-muted text-sm">{s.batch_name || "No batch"} · {s.branch_name}</div>
                  </div>
                  <div className="text-muted text-sm mono">NA-{String(s.id).padStart(5, "0")}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ID Card Preview */}
        <div className="card">
          <div className="card-title">ID Card Preview</div>
          {!selected ? (
            <div className="empty-state">
              <div className="empty-icon">🪪</div>
              <div className="empty-text">Select a student</div>
              <div className="empty-sub">Click any student to preview their ID card</div>
            </div>
          ) : (
            <div>
              {/* Card Preview */}
              <div ref={printRef} style={{
                width: 340, background: "linear-gradient(135deg, #1a1f35 0%, #2d3561 100%)",
                borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                margin: "0 auto 20px"
              }}>
                {/* Header */}
                <div style={{ background: "linear-gradient(90deg, #c9a227, #f0d060, #c9a227)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={logo} alt="logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#1a1f35", letterSpacing: ".05em" }}>NISHCHAY ACADEMY</div>
                    <div style={{ fontSize: 9, color: "#3a3000", fontWeight: 700, letterSpacing: ".1em" }}>Student Identity Card</div>
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* Left col: photo + QR */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 70, height: 80, background: "rgba(255,255,255,0.1)", borderRadius: 8, border: "2px solid #c9a227", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>👤</div>
                    {loadingQr && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Generating QR…</div>}
                    {qrDataUrl && (
                      <div>
                        <div style={{ background: "#fff", borderRadius: 6, padding: 4, border: "2px solid #c9a227" }}>
                          <img src={qrDataUrl} alt="QR" style={{ width: 70, height: 70, display: "block" }} />
                        </div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 2 }}>Scan for attendance</div>
                      </div>
                    )}
                  </div>
                  {/* Right col: info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{selected.name}</div>
                    {[
                      ["Batch / Course", selected.batch_name || "—"],
                      ["Branch", selected.branch_name || "—"],
                      ["Phone", selected.phone || "—"],
                      ["Admission", selected.admission_date ? new Date(selected.admission_date).toLocaleDateString("en-IN") : "—"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ marginBottom: 5 }}>
                        <div style={{ fontSize: 8, color: "#c9a227", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
                        <div style={{ fontSize: 11, color: "#e0e0e0", fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Footer */}
                <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#c9a227", fontWeight: 700, fontFamily: "monospace" }}>ID: NA-{String(selected.id).padStart(5, "0")}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Valid for Academic Year 2025-26</div>
                  </div>
                  <div style={{ background: "#c9a227", color: "#1a1f35", fontSize: 9, fontWeight: 900, padding: "3px 10px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".1em" }}>Student</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                <button className="btn btn-primary" onClick={printCard} disabled={loadingQr}>
                  🖨 Print ID Card
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
