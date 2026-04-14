import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/AcademyContext";
import API from "../api";
import QRCode from "qrcode";

const fetchAllStudents = (query = "") =>
  API.get(`/students?limit=1000${query}`).then((r) => {
    const res = r.data;
    return Array.isArray(res) ? res : (res.data || []);
  });

export default function IDCards() {
  const { user }    = useAuth();
  const { academy } = useAcademy();

  const academyName  = academy?.name  || "Academy";
  const primaryColor = academy?.primary_color
    ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`)
    : "#0a1628";
  const accentColor  = academy?.accent_color
    ? (academy.accent_color.startsWith("#") ? academy.accent_color : `#${academy.accent_color}`)
    : "#1565c0";

  const [students,     setStudents]     = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [batches,      setBatches]      = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBatch,  setFilterBatch]  = useState("");
  const [search,       setSearch]       = useState("");
  
  // Bulk selection
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [printLayout,  setPrintLayout]  = useState("vertical"); // 'vertical' or 'horizontal'
  
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [backfilling,  setBackfilling]  = useState(false);
  const [backfillMsg,  setBackfillMsg]  = useState("");

  const loadStudents = () => fetchAllStudents().then(setStudents);

  useEffect(() => {
    loadStudents();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, []);

  const backfillRollNumbers = async () => {
    if (!window.confirm("Assign sequential roll numbers to all students that don't have one yet?")) return;
    setBackfilling(true);
    try {
      const { data } = await API.post("/students/backfill-roll-numbers");
      setBackfillMsg(`✅ ${data.message}`);
      loadStudents();
    } catch (e) {
      setBackfillMsg("⚠️ " + (e.response?.data?.error || "Failed"));
    } finally {
      setBackfilling(false); setTimeout(() => setBackfillMsg(""), 5000);
    }
  };

  const filtered = students.filter((s) => {
    if (filterBranch && s.branch_id != filterBranch) return false;
    if (filterBatch  && s.batch_id  != filterBatch)  return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !(s.roll_no || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isBatchEnded = (s) => {
    const b = batches.find((bt) => bt.id === s.batch_id);
    if (!b || !b.end_date) return false;
    return new Date(b.end_date) < new Date();
  };

  const getRollDisplay = (s) => s?.roll_no || `NA-${String(s?.id || 0).padStart(5, "0")}`;
  const missingCount = students.filter((s) => !s.roll_no).length;

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(s => s.id)));
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const printCards = async () => {
    const targetStudents = students.filter(s => selectedIds.has(s.id));
    if (targetStudents.length === 0) return;
    
    setLoadingPrint(true);
    try {
      const { data: tokens } = await API.post("/qrscan/tokens/bulk", { student_ids: Array.from(selectedIds) });
      
      let htmlCards = "";
      
      for (const s of targetStudents) {
        let qrDataUrl = "";
        if (tokens[s.id]) {
          qrDataUrl = await QRCode.toDataURL(tokens[s.id], {
            width: 200, margin: 1, errorCorrectionLevel: "L", color: { dark: "#0a1628", light: "#ffffff" }
          });
        }
        
        const ended = isBatchEnded(s);
        const topBg = ended ? "#888" : primaryColor;
        const botBg = ended ? "linear-gradient(135deg,#888,#aaa)" : `linear-gradient(135deg,${primaryColor},${accentColor})`;
        
        if (printLayout === "vertical") {
            htmlCards += `
              <div class="card vertical-card">
                ${ended ? '<div class="inactive-stamp">INACTIVE</div>' : ""}
                <div class="card-top">
                  <div class="academy-name">${academyName.toUpperCase()}</div>
                  <div class="academy-sub">STUDENT IDENTITY CARD</div>
                  <svg class="wave" viewBox="0 0 216 30" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,20 C40,35 80,5 108,20 C136,35 176,5 216,20 L216,30 L0,30 Z" fill="white"/></svg>
                </div>
                <div class="photo-wrap"><div class="photo-circle">${s.photo_url ? `<img src="${s.photo_url}" />` : "👤"}</div></div>
                <div class="card-body">
                  <div class="student-name">${s.name}</div>
                  <div class="student-role">${s.batch_name || "Student"}</div>
                  <div class="divider" style="background:linear-gradient(90deg,transparent,${primaryColor},transparent)"></div>
                  <div class="info-row"><span class="info-label">Roll No</span><span class="info-value">${getRollDisplay(s)}</span></div>
                  <div class="info-row"><span class="info-label">Branch</span><span class="info-value">${s.branch_name || "—"}</span></div>
                  <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${s.phone || "—"}</span></div>
                </div>
                <div class="qr-section">
                  ${qrDataUrl ? `<img class="qr-img" src="${qrDataUrl}" />` : '<div class="qr-placeholder"></div>'}
                  <div class="qr-label">SCAN FOR ATTENDANCE</div>
                </div>
                <div class="card-bottom" style="background:${botBg}">
                  <div class="student-badge">${ended ? "Inactive" : "Student"}</div>
                </div>
              </div>
            `;
        } else {
            // Horizontal layout
            htmlCards += `
              <div class="card horizontal-card">
                ${ended ? '<div class="inactive-stamp">INACTIVE</div>' : ""}
                <div class="hz-left" style="background:${topBg}">
                   <div class="photo-circle hz-photo">${s.photo_url ? `<img src="${s.photo_url}" />` : "👤"}</div>
                   <div class="academy-name hz-acad" style="writing-mode: vertical-rl; transform: rotate(180deg); margin-top:2mm; font-size: 6pt;">${academyName.toUpperCase()}</div>
                </div>
                <div class="hz-center">
                  <div class="student-name" style="text-align:left; font-size:12pt;">${s.name}</div>
                  <div class="student-role" style="text-align:left; font-size:7pt; color:${accentColor}">${s.batch_name || "Student"}</div>
                  <div class="divider" style="background:linear-gradient(90deg,transparent,${primaryColor},transparent); margin: 3mm 0;"></div>
                  <div class="info-row"><span class="info-label">Roll No</span><span class="info-value">${getRollDisplay(s)}</span></div>
                  <div class="info-row"><span class="info-label">Branch</span><span class="info-value">${s.branch_name || "—"}</span></div>
                  <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${s.phone || "—"}</span></div>
                </div>
                <div class="hz-right">
                  <div class="qr-section" style="background:transparent; border:none; padding:0;">
                    ${qrDataUrl ? `<img class="qr-img hz-qr" src="${qrDataUrl}" />` : '<div class="qr-placeholder hz-qr"></div>'}
                    <div class="qr-label">ATTENDANCE</div>
                  </div>
                </div>
              </div>
            `;
        }
      }
      
      const w = window.open("", "_blank");
      w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Bulk ID Cards</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', Arial, sans-serif; background:#e8e8e8; padding: 10mm; }
    @media print { 
      body { background:white; padding: 0; }
      @page { size: A4; margin: 5mm; }
    }
    .grid { display: grid; gap: 4mm; justify-content: center; }
    .grid-vertical { grid-template-columns: repeat(auto-fill, 54mm); }
    .grid-horizontal { grid-template-columns: repeat(auto-fill, 85mm); }
    
    .card { background:white; overflow:hidden; position:relative; box-shadow:0 0 0 0.5px #e2e8f0; page-break-inside: avoid; }
    .vertical-card { width:54mm; height:85mm; border-radius:3mm; display:flex; flex-direction:column; }
    .horizontal-card { width:85mm; height:54mm; border-radius:3mm; display:flex; flex-direction:row; align-items: stretch; }
    
    .inactive-stamp { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:14pt; font-weight:900; color:rgba(200,0,0,0.25); border:3px solid rgba(200,0,0,0.2); padding:2mm 4mm; border-radius:2mm; white-space:nowrap; pointer-events:none; z-index:20; }
    
    /* V-Card Styles */
    .card-top { height:26mm; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .wave { position:absolute; bottom:-0.5px; left:0; right:0; height:8mm; }
    .academy-name { color:white; font-size:7pt; font-weight:900; letter-spacing:0.5px; text-align:center; z-index:2; }
    .academy-sub  { color:rgba(255,255,255,0.6); font-size:5pt; letter-spacing:0.8px; text-align:center; z-index:2; margin-top:1mm; }
    .photo-wrap   { display:flex; justify-content:center; margin-top:-8mm; position:relative; z-index:10; }
    .photo-circle { border-radius:50%; background:#e8edf5; border:2px solid white; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .photo-circle img { width:100%; height:100%; object-fit:cover; }
    .vertical-card .photo-circle { width:18mm; height:18mm; font-size:16pt; }
    .card-body    { padding:0 4mm; text-align:center; flex-grow:1; display:flex; flex-direction:column; justify-content:center; }
    .student-name { font-size:10pt; font-weight:900; color:#0a1628; line-height:1.2; text-transform:uppercase; }
    .student-role { font-size:6pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-top: 1mm; }
    .divider      { height:0.5mm; margin:1.5mm 4mm; }
    .info-row     { display:flex; justify-content:space-between; padding:0.5mm 0; font-size:5pt; }
    .info-label   { color:#888; font-weight:600; text-transform:uppercase; }
    .info-value   { color:#0a1628; font-weight:700; text-align:right; max-width:28mm; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .qr-section   { display:flex; flex-direction:column; align-items:center; padding:1.5mm 0; background:#f8faff; border-top:0.5px solid #e2e8f0; }
    .qr-img       { width:18mm; height:18mm; border:0.5px solid #ddd; border-radius:1px; background:white; mix-blend-mode: multiply; }
    .qr-placeholder{ width:18mm; height:18mm; background:#eee; border-radius:1px; }
    .qr-label     { font-size:4pt; color:#888; margin-top:1mm; letter-spacing:0.5px; font-weight: 700; }
    .card-bottom  { padding:2mm; display:flex; justify-content:center; align-items:center; }
    .student-badge{ background:rgba(255,255,255,0.2); color:white; font-size:4.5pt; font-weight:800; padding:1mm 2.5mm; border-radius:1.5mm; text-transform:uppercase; letter-spacing:0.5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    
    /* H-Card Styles */
    .hz-left { width: 22mm; display:flex; flex-direction:column; align-items:center; padding-top: 5mm; }
    .hz-photo { width: 14mm; height: 14mm; font-size:12pt; }
    .hz-center { flex-grow:1; padding: 4mm 5mm; display:flex; flex-direction:column; justify-content:center; }
    .hz-right { width: 22mm; background:#f8faff; border-left:0.5px solid #e2e8f0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 3mm; }
    .hz-qr { width:16mm; height:16mm; }
  </style>
</head>
<body>
  <div class="grid grid-${printLayout}">
    ${htmlCards}
  </div>
</body>
</html>`);
      w.document.close();
      setTimeout(() => w.print(), 1000);
    } catch (e) {
      alert("Print generation failed. Make sure server is connected.");
    } finally {
      setLoadingPrint(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Bulk ID Cards</div>
          <div className="page-sub">Generate, format, and batch print student ID cards</div>
        </div>
        
        {user.role === "super_admin" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {missingCount > 0 && (
              <span style={{ fontSize: 12, color: "var(--yellow)", background: "rgba(245,158,11,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)" }}>
                ⚠ {missingCount} students missing roll no
              </span>
            )}
            <button className="btn btn-secondary" onClick={backfillRollNumbers} disabled={backfilling}>
              {backfilling ? "⏳ Syncing…" : "🔄 Sync Roll Numbers"}
            </button>
          </div>
        )}
      </div>

      {backfillMsg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 8, fontSize: 13 }}>
          {backfillMsg}
        </div>
      )}

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
        {/* Bulk Selection List */}
        <div className="card">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Select Students ({selectedIds.size}/{filtered.length})</span>
            <button className="btn btn-secondary btn-sm" onClick={toggleSelectAll}>
              {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          
          <div style={{ maxHeight: 600, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            {filtered.length === 0 ? <div className="empty-state"><div className="empty-text">No students</div></div> : (
              <table style={{ margin: 0 }}>
                <tbody>
                  {filtered.map(s => {
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <tr key={s.id} onClick={() => toggleSelect(s.id)} style={{ cursor: "pointer", background: isSelected ? "var(--bg3)" : "none" }}>
                        <td style={{ width: 40, textAlign: "center" }}>
                          <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div className="text-muted text-sm">{s.batch_name || "No batch"}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                           <div className="text-muted text-sm mono">{getRollDisplay(s)}</div>
                           {isBatchEnded(s) && <div style={{ fontSize: 10, color: "var(--red)" }}>Inactive</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Print Configuration settings */}
        <div className="card" style={{ height: "fit-content" }}>
          <div className="card-title">Printer Configuration</div>
          
          <div className="form-group full" style={{ marginBottom: 20 }}>
            <label>Card Orientation Layout</label>
            <div style={{ display: "flex", gap: 12 }}>
               <div 
                 onClick={() => setPrintLayout("vertical")}
                 style={{ flex: 1, border: `2px solid ${printLayout === "vertical" ? "var(--accent)" : "transparent"}`, background: "var(--bg3)", borderRadius: 8, padding: 16, cursor: "pointer", textAlign: "center", position: "relative" }}
               >
                 {printLayout === "vertical" && <div style={{ position: "absolute", top: 8, right: 8, color: "var(--accent)", fontSize: 18 }}>✓</div>}
                 <div style={{ width: 30, height: 45, border: "2px solid var(--text3)", margin: "0 auto 10px", borderRadius: 4 }}></div>
                 <div style={{ fontWeight: 600, fontSize: 14 }}>Vertical (CR80)</div>
                 <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>54mm × 85mm standard</div>
               </div>
               <div 
                 onClick={() => setPrintLayout("horizontal")}
                 style={{ flex: 1, border: `2px solid ${printLayout === "horizontal" ? "var(--accent)" : "transparent"}`, background: "var(--bg3)", borderRadius: 8, padding: 16, cursor: "pointer", textAlign: "center", position: "relative" }}
               >
                 {printLayout === "horizontal" && <div style={{ position: "absolute", top: 8, right: 8, color: "var(--accent)", fontSize: 18 }}>✓</div>}
                 <div style={{ width: 45, height: 30, border: "2px solid var(--text3)", margin: "8px auto 17px", borderRadius: 4 }}></div>
                 <div style={{ fontWeight: 600, fontSize: 14 }}>Horizontal</div>
                 <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>85mm × 54mm minimal</div>
               </div>
            </div>
          </div>

          <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text1)", marginBottom: 8 }}>Print Setup Instructions</div>
             <ul style={{ fontSize: 12, color: "var(--text2)", margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
               <li>Select students using the checkboxes on the left.</li>
               <li>Click Print below to generate A4 print sheets via your browser.</li>
               <li>When the print dialog opens, ensure <b>Paper Size is A4</b>.</li>
               <li>Set <b>Scale to Default (100%)</b> and <b>Margins to Default</b>.</li>
               <li>Ensure <b>Background Graphics</b> are turned ON.</li>
             </ul>
          </div>
          
          <button className="btn btn-primary" onClick={printCards} disabled={loadingPrint || selectedIds.size === 0} style={{ width: "100%", padding: 16, fontSize: 15, justifyContent: "center" }}>
            {loadingPrint ? `⏳ Generating ${selectedIds.size} Cards...` : `🖨 Bulk Print ${selectedIds.size} Cards Now`}
          </button>
        </div>
      </div>
    </div>
  );
}
