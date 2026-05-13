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
  const [cardWidth,    setCardWidth]    = useState(54);
  const [cardHeight,   setCardHeight]   = useState(85);
  const [previewHtml,  setPreviewHtml]  = useState(null);
  
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [backfilling,  setBackfilling]  = useState(false);
  const [backfillMsg,  setBackfillMsg]  = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [total,        setTotal]        = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const loadStudents = (p = 1) => {
    const q = new URLSearchParams({ page: p, limit: LIMIT });
    if (filterBranch) q.set("branch_id", filterBranch);
    if (filterBatch) q.set("batch_id", filterBatch);
    if (search) q.set("search", search);
    
    API.get(`/students?${q}`).then((r) => {
      if (r.data.data) {
        setStudents(r.data.data);
        setPage(r.data.page);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
      } else {
        setStudents(r.data);
        setTotal(r.data.length);
      }
    });
  };

  useEffect(() => {
    loadStudents(1);
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, [filterBranch, filterBatch, search]);

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

  const filtered = students;

  const isBatchEnded = (s) => {
    const b = batches.find((bt) => bt.id === s.batch_id);
    if (!b || !b.end_date) return false;
    return new Date(b.end_date) < new Date();
  };

  const getRollDisplay = (s) => s?.roll_no || `NA-${String(s?.id || 0).padStart(5, "0")}`;
  const missingCount = students.filter((s) => !s.roll_no).length;

  const toggleSelectAll = () => {
    // BUG FIX: this only selects the current page of students, not ALL students.
    // Renamed button to "Select Page" to avoid misleading users.
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(s => s.id)));
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const generateDocument = async (targetStudents) => {
    const { data: tokens } = await API.post("/qrscan/tokens/bulk", { student_ids: targetStudents.map(s => s.id) });
      
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
            <div class="card printer-card" style="width: ${cardWidth}mm; height: ${cardHeight}mm;">
              ${ended ? '<div class="inactive-stamp">INACTIVE</div>' : ""}
              <div class="card-top" style="background:${topBg}">
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
            <div class="card printer-card hz-wrap" style="width: ${cardWidth}mm; height: ${cardHeight}mm;">
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
    
    return `<!DOCTYPE html>
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
    .grid { display: grid; gap: 4mm; justify-content: center; grid-template-columns: repeat(auto-fill, ${cardWidth}mm); }
    
    .card { background:white; overflow:hidden; position:relative; box-shadow:0 0 0 0.5px #e2e8f0; page-break-inside: avoid; border-radius: 3mm; display:flex; margin-bottom: 2mm; }
    .printer-card { width: ${cardWidth}mm; height: ${cardHeight}mm; flex-direction:column; }
    .printer-card.hz-wrap { flex-direction:row; align-items: stretch; }
    
    .inactive-stamp { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:14pt; font-weight:900; color:rgba(200,0,0,0.25); border:3px solid rgba(200,0,0,0.2); padding:2mm 4mm; border-radius:2mm; white-space:nowrap; pointer-events:none; z-index:20; }
    
    /* V-Card Styles */
    .card-top { height:26mm; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .wave { position:absolute; bottom:-0.5px; left:0; right:0; height:8mm; }
    .academy-name { color:white; font-size:7pt; font-weight:900; letter-spacing:0.5px; text-align:center; z-index:2; padding:0 2mm;}
    .academy-sub  { color:rgba(255,255,255,0.6); font-size:5pt; letter-spacing:0.8px; text-align:center; z-index:2; margin-top:1mm; }
    .photo-wrap   { display:flex; justify-content:center; margin-top:-8mm; position:relative; z-index:10; }
    .photo-circle { border-radius:50%; background:#e8edf5; border:2px solid white; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .photo-circle img { width:100%; height:100%; object-fit:cover; }
    .printer-card:not(.hz-wrap) .photo-circle { width:18mm; height:18mm; font-size:16pt; }
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
  <div class="grid">
    ${htmlCards}
  </div>
</body>
</html>`;
  };

  const printCards = async () => {
    const targetStudents = students.filter(s => selectedIds.has(s.id));
    if (targetStudents.length === 0) return;
    setLoadingPrint(true);
    try {
      const htmlDoc = await generateDocument(targetStudents);
      // BUG FIX: window.open() returns null when blocked by a popup blocker.
      // Previously this caused: "Cannot read properties of null (reading 'document')"
      const w = window.open("", "_blank");
      if (!w) {
        alert("Popup blocked! Please allow popups for this site in your browser settings, then try again.");
        return;
      }
      w.document.write(htmlDoc);
      w.document.close();
      setTimeout(() => w.print(), 1000);
    } catch (e) {
      alert("Print generation failed. Make sure server is connected.");
    } finally {
      setLoadingPrint(false);
    }
  };

  const previewSingleCard = async (e, s) => {
    e.stopPropagation();
    setLoadingPrint(true);
    try {
      const htmlDoc = await generateDocument([s]);
      setPreviewHtml(htmlDoc);
    } catch (err) {
      alert("Preview generation failed.");
    } finally {
      setLoadingPrint(false);
    }
  };

  if (isMobile) {
    return (
      <div style={{ backgroundColor: 'var(--bg1)', minHeight: '100vh', color: 'var(--text1)', paddingBottom: 100, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* HEADER */}
        <div style={{ padding: '24px 20px 10px 20px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: 'var(--text1)' }}>Bulk ID Cards</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Generate and batch print cards</p>
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* SEARCH & FILTERS */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.05em', marginBottom: 8, textTransform: 'uppercase' }}>Search Students</label>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg2)', borderRadius: 12, padding: '12px 16px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c8b9d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 12 }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                placeholder="Name or roll no..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text1)', fontSize: 14, width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {user.role === "super_admin" && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Branch</label>
                <div style={{ position: 'relative' }}>
                  <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg2)', color: 'var(--text1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', appearance: 'none', fontSize: 13, outline: 'none' }}>
                    <option value="">All Branches</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c8b9d" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Batch</label>
              <div style={{ position: 'relative' }}>
                <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg2)', color: 'var(--text1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', appearance: 'none', fontSize: 13, outline: 'none' }}>
                  <option value="">All Batches</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c8b9d" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>

          {/* STUDENT SELECTION SECTION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
             <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Select Students ({selectedIds.size}/{filtered.length})</h2>
             <button 
               onClick={toggleSelectAll}
               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
             >
               {selectedIds.size === filtered.length ? "Deselect Page" : "Select Page"}
             </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {filtered.length === 0 ? (
               <div style={{ textAlign: 'center', color: '#7c8b9d', padding: '40px 0' }}>No students match your search.</div>
            ) : filtered.slice(0, showAllMobile ? filtered.length : 5).map(s => {
              const isSelected = selectedIds.has(s.id);
              return (
                <div 
                  key={s.id} 
                  onClick={() => toggleSelect(s.id)}
                  style={{ 
                    backgroundColor: 'var(--bg2)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                    border: isSelected ? '1px solid rgb(141, 156, 255)' : '1px solid transparent', cursor: 'pointer', position: 'relative'
                  }}
                >
                  <div style={{ 
                    width: 20, height: 20, borderRadius: 6, border: isSelected ? 'none' : '2px solid #3d4f6e', 
                    backgroundColor: isSelected ? 'rgb(141, 156, 255)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f1423" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#7c8b9d', marginTop: 2 }}>{s.batch_name || "No batch"}</div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                       <div style={{ fontSize: 12, fontWeight: 700, color: 'rgb(141, 156, 255)', fontFamily: 'monospace' }}>{getRollDisplay(s)}</div>
                       {isBatchEnded(s) && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800 }}>INACTIVE</div>}
                    </div>
                    <button 
                      onClick={(e) => previewSingleCard(e, s)}
                      style={{ 
                        width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            
            {!showAllMobile && filtered.length > 5 && (
              <button 
                onClick={() => setShowAllMobile(true)}
                style={{ 
                  width: '100%', padding: '14px', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', 
                  border: '1px dashed rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}
              >
                Show All {filtered.length} Students
              </button>
            )}
          </div>

          {/* PRINTER CONFIG SECTION */}
          <div style={{ backgroundColor: 'var(--bg2)', borderRadius: 24, padding: '24px', marginBottom: 24 }}>
             <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Printer Setup</h2>
             
             <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase' }}>Card Orientation</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                   <div 
                     onClick={() => { setPrintLayout("vertical"); setCardWidth(54); setCardHeight(85); }}
                     style={{ 
                       padding: '16px', borderRadius: 16, border: `2px solid ${printLayout === "vertical" ? 'rgb(141, 156, 255)' : 'transparent'}`,
                       backgroundColor: printLayout === "vertical" ? 'rgba(141, 156, 255, 0.1)' : 'rgba(255,255,255,0.03)', textAlign: 'center'
                     }}
                   >
                     <div style={{ width: 24, height: 36, border: '1.5px solid currentColor', margin: '0 auto 8px', borderRadius: 2, color: printLayout === "vertical" ? 'rgb(141, 156, 255)' : '#7c8b9d' }}></div>
                     <div style={{ fontSize: 13, fontWeight: 700, color: printLayout === "vertical" ? 'rgb(141, 156, 255)' : '#fff' }}>Vertical</div>
                   </div>
                   <div 
                     onClick={() => { setPrintLayout("horizontal"); setCardWidth(85); setCardHeight(54); }}
                     style={{ 
                       padding: '16px', borderRadius: 16, border: `2px solid ${printLayout === "horizontal" ? 'rgb(141, 156, 255)' : 'transparent'}`,
                       backgroundColor: printLayout === "horizontal" ? 'rgba(141, 156, 255, 0.1)' : 'rgba(255,255,255,0.03)', textAlign: 'center'
                     }}
                   >
                     <div style={{ width: 36, height: 24, border: '1.5px solid currentColor', margin: '6px auto 14px', borderRadius: 2, color: printLayout === "horizontal" ? 'rgb(141, 156, 255)' : '#7c8b9d' }}></div>
                     <div style={{ fontSize: 13, fontWeight: 700, color: printLayout === "horizontal" ? 'rgb(141, 156, 255)' : '#fff' }}>Horizontal</div>
                   </div>
                </div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                   <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Width (mm)</label>
                   <input 
                     type="number" value={cardWidth} onChange={(e) => setCardWidth(e.target.value)} 
                     style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px', color: '#fff', outline: 'none' }} 
                   />
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7c8b9d', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Height (mm)</label>
                   <input 
                     type="number" value={cardHeight} onChange={(e) => setCardHeight(e.target.value)} 
                     style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px', color: '#fff', outline: 'none' }} 
                   />
                </div>
             </div>

             <button 
               onClick={printCards}
               disabled={loadingPrint || selectedIds.size === 0}
               style={{ 
                 width: '100%', padding: '18px', borderRadius: 16, backgroundColor: 'rgb(141, 156, 255)', color: '#0f1423', 
                 border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
               }}
             >
               {loadingPrint ? "⏳ Generating..." : `🖨 Bulk Print ${selectedIds.size} Cards`}
             </button>
          </div>
        </div>

        {/* PREVIEW MODAL */}
        {previewHtml && (
          <div 
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }} 
            onClick={() => setPreviewHtml(null)}
          >
            <div 
              style={{ background: "#1b2234", padding: 24, borderRadius: 24, width: "100%", maxWidth: 450, position: 'relative' }} 
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>Card Preview</h3>
                <button 
                  onClick={() => setPreviewHtml(null)} 
                  style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: '50%', width: 32, height: 32, color: "#fff", cursor: "pointer" }}
                >&times;</button>
              </div>
              <iframe 
                 title="Card Preview"
                 srcDoc={previewHtml} 
                 style={{ width: "100%", height: 380, border: "none", borderRadius: 12, background: "#fff" }} 
              />
              <button 
                onClick={() => setPreviewHtml(null)}
                style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', fontWeight: 600 }}
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
              {selectedIds.size === filtered.length ? "Deselect Page" : "Select Page"}
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
                        <td style={{ width: 44, textAlign: "center" }}>
                           <button 
                             onClick={(e) => previewSingleCard(e, s)} 
                             className="btn btn-secondary btn-sm" 
                             style={{ padding: "4px 8px", background: "white" }} 
                             title="Preview Card"
                           >
                              👁️
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20, flexWrap:"wrap", gap:10, padding:"0 10px" }}>
              <div style={{ fontSize:13, color:"var(--text3)" }}>Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT,total)} of <strong>{total}</strong></div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => loadStudents(page-1)} disabled={page===1}>← Prev</button>
                <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{page}</span>
                  <span style={{ fontSize:13, color:"var(--text3)" }}>/ {totalPages}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => loadStudents(page+1)} disabled={page===totalPages}>Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Print Configuration settings */}
        <div className="card" style={{ height: "fit-content" }}>
          <div className="card-title">Printer Configuration</div>
          
          <div className="form-group full" style={{ marginBottom: 20 }}>
            <label>Card Orientation Layout</label>
            <div style={{ display: "flex", gap: 12 }}>
               <div 
                 onClick={() => { setPrintLayout("vertical"); setCardWidth(54); setCardHeight(85); }}
                 style={{ flex: 1, border: `2px solid ${printLayout === "vertical" ? "var(--accent)" : "transparent"}`, background: "var(--bg3)", borderRadius: 8, padding: 16, cursor: "pointer", textAlign: "center", position: "relative" }}
               >
                 {printLayout === "vertical" && <div style={{ position: "absolute", top: 8, right: 8, color: "var(--accent)", fontSize: 18 }}>✓</div>}
                 <div style={{ width: 30, height: 45, border: "2px solid var(--text3)", margin: "0 auto 10px", borderRadius: 4 }}></div>
                 <div style={{ fontWeight: 600, fontSize: 14 }}>Vertical</div>
               </div>
               <div 
                 onClick={() => { setPrintLayout("horizontal"); setCardWidth(85); setCardHeight(54); }}
                 style={{ flex: 1, border: `2px solid ${printLayout === "horizontal" ? "var(--accent)" : "transparent"}`, background: "var(--bg3)", borderRadius: 8, padding: 16, cursor: "pointer", textAlign: "center", position: "relative" }}
               >
                 {printLayout === "horizontal" && <div style={{ position: "absolute", top: 8, right: 8, color: "var(--accent)", fontSize: 18 }}>✓</div>}
                 <div style={{ width: 45, height: 30, border: "2px solid var(--text3)", margin: "8px auto 17px", borderRadius: 4 }}></div>
                 <div style={{ fontWeight: 600, fontSize: 14 }}>Horizontal</div>
               </div>
            </div>
          </div>
          
          <div className="form-group full" style={{ marginBottom: 20 }}>
            <label>Custom Dimensions (mm)</label>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>Width (mm)</span>
                <input type="number" value={cardWidth} onChange={(e) => setCardWidth(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>Height (mm)</span>
                <input type="number" value={cardHeight} onChange={(e) => setCardHeight(e.target.value)} style={{ width: "100%" }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>Standard is 54mm × 85mm. Adjust to match your PVC/Lanyard sizes.</div>
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
      
      {/* Dynamic Overlay Preview Modal */}
      {previewHtml && (
        <div 
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(2px)" }} 
          onClick={() => setPreviewHtml(null)}
        >
          <div 
            style={{ background: "white", padding: 24, borderRadius: 16, width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>ID Card Preview</h3>
              <button 
                onClick={() => setPreviewHtml(null)} 
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text2)" }}
              >&times;</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>This is how the card will look when exported. Click Bulk Print to arrange these on an A4 sheet.</p>
            <iframe 
               title="Card Preview"
               srcDoc={previewHtml} 
               style={{ width: "100%", height: 420, border: "2px dashed #e2e8f0", borderRadius: 12, background: "#f8faff" }} 
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setPreviewHtml(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
