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
  const academyPhone = academy?.phone  || "";
  const academyPhone2= academy?.phone2 || "";
  const academyEmail = academy?.email  || "";
  const primaryColor = academy?.primary_color
    ? (academy.primary_color.startsWith("#") ? academy.primary_color : `#${academy.primary_color}`)
    : "#0a1628";
  const accentColor  = academy?.accent_color
    ? (academy.accent_color.startsWith("#") ? academy.accent_color : `#${academy.accent_color}`)
    : "#1565c0";
  const contactLine  = [academyPhone, academyPhone2].filter(Boolean).join(" / ");

  const [students,     setStudents]     = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [batches,      setBatches]      = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBatch,  setFilterBatch]  = useState("");
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState(null);
  const [qrDataUrl,    setQrDataUrl]    = useState("");
  const [loadingQr,    setLoadingQr]    = useState(false);
  const [backfilling,  setBackfilling]  = useState(false);
  const [backfillMsg,  setBackfillMsg]  = useState("");

  const loadStudents = () => fetchAllStudents().then(setStudents);

  useEffect(() => {
    loadStudents();
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, []);

  useEffect(() => {
    if (!selected) { setQrDataUrl(""); return; }
    setLoadingQr(true);
    API.get(`/qrscan/token/${selected.id}`)
      .then(async (r) => {
        const url = await QRCode.toDataURL(r.data.token, {
          width: 200, margin: 1, errorCorrectionLevel: "L",
          color: { dark: "#0a1628", light: "#ffffff" }
        });
        setQrDataUrl(url);
      })
      .catch(() => setQrDataUrl(""))
      .finally(() => setLoadingQr(false));
  }, [selected]);

  const backfillRollNumbers = async () => {
    if (!window.confirm("Assign sequential roll numbers to all students that don't have one yet? (Students who already have roll numbers will not be changed.)")) return;
    setBackfilling(true);
    try {
      const { data } = await API.post("/students/backfill-roll-numbers");
      setBackfillMsg(`✅ ${data.message}`);
      loadStudents();
      // Refresh selected student if they were updated
      if (selected) {
        const updated = await fetchAllStudents();
        const fresh = updated.find(s => s.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e) {
      setBackfillMsg("⚠️ " + (e.response?.data?.error || "Failed to assign roll numbers"));
    } finally {
      setBackfilling(false);
      setTimeout(() => setBackfillMsg(""), 5000);
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
  const studentId    = selected ? getRollDisplay(selected) : "";
  const missingCount = students.filter((s) => !s.roll_no).length;

  const printCard = () => {
    const ended = isBatchEnded(selected);
    const topBg = ended ? "#888" : primaryColor;
    const botBg = ended
      ? "linear-gradient(135deg,#888,#aaa)"
      : `linear-gradient(135deg,${primaryColor},${accentColor})`;

    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>ID Card - ${selected.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', Arial, sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#e8e8e8; }
    @media print { body { background:white; } .card { box-shadow:none !important; } }
    .card { width:54mm; background:white; border-radius:6mm; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.2); }
    .card-top { background:${topBg}; height:28mm; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; padding-top:4mm; }
    .wave { position:absolute; bottom:-1px; left:0; right:0; }
    .academy-name { color:white; font-size:7pt; font-weight:900; letter-spacing:0.5px; text-align:center; z-index:2; }
    .academy-sub  { color:rgba(255,255,255,0.6); font-size:5pt; letter-spacing:0.8px; text-align:center; z-index:2; margin-top:1mm; }
    .photo-wrap   { display:flex; justify-content:center; margin-top:-8mm; position:relative; z-index:10; }
    .photo-circle { width:18mm; height:18mm; border-radius:50%; background:#e8edf5; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; font-size:22pt; overflow:hidden; }
    .card-body    { padding:3mm 4mm; text-align:center; }
    .student-name { font-size:10pt; font-weight:900; color:#0a1628; line-height:1.2; margin-top:2mm; text-transform:uppercase; }
    .student-role { font-size:6.5pt; color:${accentColor}; font-weight:700; margin-top:1mm; text-transform:uppercase; letter-spacing:0.5px; }
    .divider      { height:0.5mm; background:linear-gradient(90deg,transparent,${primaryColor},transparent); margin:2mm 4mm; }
    .info-row     { display:flex; justify-content:space-between; padding:0.8mm 0; font-size:5.5pt; }
    .info-label   { color:#888; font-weight:600; }
    .info-value   { color:#0a1628; font-weight:700; text-align:right; max-width:28mm; }
    .qr-section   { display:flex; flex-direction:column; align-items:center; padding:2mm 0 3mm; background:#f8faff; border-top:0.5mm solid #e0e8f5; }
    .qr-img       { width:22mm; height:22mm; border:1px solid #ddd; border-radius:1.5mm; padding:1mm; background:white; }
    .qr-label     { font-size:4.5pt; color:#888; margin-top:1mm; letter-spacing:0.5px; }
    .card-bottom  { background:${botBg}; padding:2mm 4mm; display:flex; justify-content:center; align-items:center; }
    .student-badge{ background:rgba(255,255,255,0.15); color:white; font-size:4.5pt; font-weight:800; padding:0.8mm 2mm; border-radius:1mm; text-transform:uppercase; letter-spacing:0.5px; }
    ${ended ? ".inactive-stamp{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:14pt;font-weight:900;color:rgba(200,0,0,0.25);border:3px solid rgba(200,0,0,0.2);padding:2mm 4mm;border-radius:2mm;white-space:nowrap;pointer-events:none;z-index:20;}" : ""}
  </style>
</head>
<body>
  <div class="card">
    ${ended ? '<div class="inactive-stamp">INACTIVE</div>' : ""}
    <div class="card-top">
      <div class="academy-name">${academyName.toUpperCase()}</div>
      <div class="academy-sub">STUDENT IDENTITY CARD</div>
      <svg class="wave" viewBox="0 0 216 30" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="height:12mm;">
        <path d="M0,20 C40,35 80,5 108,20 C136,35 176,5 216,20 L216,30 L0,30 Z" fill="white"/>
      </svg>
    </div>
    <div class="photo-wrap">
      <div class="photo-circle">
        ${selected.photo_url ? `<img src="${selected.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "👤"}
      </div>
    </div>
    <div class="card-body">
      <div class="student-name">${selected.name}</div>
      <div class="student-role">${selected.batch_name || "Student"}</div>
      <div class="divider"></div>
      <div class="info-row"><span class="info-label">Roll No</span><span class="info-value">${studentId}</span></div>
      <div class="info-row"><span class="info-label">Branch</span><span class="info-value">${selected.branch_name || "—"}</span></div>
      <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${selected.phone || "—"}</span></div>
      <div class="info-row"><span class="info-label">Admitted</span><span class="info-value">${selected.admission_date ? new Date(selected.admission_date).toLocaleDateString("en-IN") : "—"}</span></div>
    </div>
    <div class="qr-section">
      ${qrDataUrl ? `<img class="qr-img" src="${qrDataUrl}" alt="QR" />` : '<div style="width:22mm;height:22mm;background:#eee;border-radius:1.5mm;"></div>'}
      <div class="qr-label">SCAN FOR ATTENDANCE</div>
    </div>
    <div class="card-bottom">
      <div class="student-badge">${ended ? "Inactive" : "Student"}</div>
    </div>
  </div>
</body>
</html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Student ID Cards</div>
          <div className="page-sub">Generate and print ID cards with QR attendance</div>
        </div>
        {/* Always show sync button — not just when missing */}
        {user.role === "super_admin" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {missingCount > 0 && (
              <span style={{ fontSize: 12, color: "var(--yellow)", background: "rgba(245,158,11,0.1)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)" }}>
                ⚠ {missingCount} students missing roll no.
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={backfillRollNumbers}
              disabled={backfilling}
              title="Assign sequential roll numbers to students that don't have one yet"
            >
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
        <input
          className="search-input"
          placeholder="Search student or roll no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        {/* Student list */}
        <div className="card">
          <div className="card-title">Select Student ({filtered.length})</div>
          {filtered.length === 0
            ? <div className="empty-state"><div className="empty-text">No students found</div></div>
            : (
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelected(s)}
                    style={{
                      padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
                      background: selected?.id === s.id ? "rgba(59,130,246,0.12)" : "var(--bg3)",
                      border: `1px solid ${selected?.id === s.id ? "rgba(59,130,246,0.3)" : "transparent"}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      opacity: isBatchEnded(s) ? 0.5 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div className="text-muted text-sm">{s.batch_name || "No batch"} · {s.branch_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="text-muted text-sm mono" style={{ color: s.roll_no ? "var(--accent)" : "var(--red)" }}>
                        {getRollDisplay(s)}
                      </div>
                      {!s.roll_no && <div style={{ fontSize: 9, color: "var(--red)" }}>no roll no.</div>}
                      {isBatchEnded(s) && <div style={{ fontSize: 10, color: "var(--red)" }}>Batch ended</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {isBatchEnded(selected) && (
                <div style={{ background: "var(--red-dim)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "var(--red)", width: "100%", textAlign: "center" }}>
                  ⚠️ Batch ended — ID card is INACTIVE
                </div>
              )}
              {/* Preview card */}
              <div style={{ width: 220, background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", fontFamily: "Inter, sans-serif", position: "relative" }}>
                {isBatchEnded(selected) && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-30deg)", fontSize: 18, fontWeight: 900, color: "rgba(200,0,0,0.2)", border: "3px solid rgba(200,0,0,0.15)", padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap", zIndex: 20, pointerEvents: "none" }}>INACTIVE</div>
                )}
                <div style={{ background: isBatchEnded(selected) ? "#888" : primaryColor, paddingTop: 16, position: "relative", textAlign: "center" }}>
                  <div style={{ color: "white", fontSize: 11, fontWeight: 900 }}>{academyName.toUpperCase()}</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, marginTop: 2, marginBottom: 10 }}>STUDENT IDENTITY CARD</div>
                  <svg viewBox="0 0 220 30" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }}>
                    <path d="M0,20 C40,35 80,5 110,20 C140,35 180,5 220,20 L220,30 L0,30 Z" fill="white"/>
                  </svg>
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: -22, position: "relative", zIndex: 10 }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#e8edf5", border: "3px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden" }}>
                    {selected.photo_url ? <img src={selected.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                  </div>
                </div>
                <div style={{ padding: "8px 14px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0a1628", textTransform: "uppercase" }}>{selected.name}</div>
                  <div style={{ fontSize: 9, color: accentColor, fontWeight: 700, marginTop: 3, textTransform: "uppercase" }}>{selected.batch_name || "Student"}</div>
                  <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${primaryColor},transparent)`, margin: "6px 10px" }} />
                  {[["Roll No", studentId], ["Branch", selected.branch_name || "—"], ["Phone", selected.phone || "—"], ["Admitted", selected.admission_date ? new Date(selected.admission_date).toLocaleDateString("en-IN") : "—"]].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 8 }}>
                      <span style={{ color: "#888", fontWeight: 600 }}>{l}</span>
                      <span style={{ color: "#0a1628", fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#f8faff", borderTop: "1px solid #e0e8f5", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {loadingQr
                    ? <div style={{ width: 80, height: 80, background: "#eee", borderRadius: 4 }} />
                    : qrDataUrl
                      ? <img src={qrDataUrl} alt="QR" style={{ width: 80, height: 80, border: "1px solid #ddd", borderRadius: 4, padding: 2, background: "white" }} />
                      : null
                  }
                  <div style={{ fontSize: 7, color: "#888", marginTop: 4 }}>SCAN FOR ATTENDANCE</div>
                </div>
                <div style={{ background: isBatchEnded(selected) ? "linear-gradient(135deg,#888,#aaa)" : `linear-gradient(135deg,${primaryColor},${accentColor})`, padding: "6px 12px", display: "flex", justifyContent: "center" }}>
                  <div style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: 7, fontWeight: 800, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                    {isBatchEnded(selected) ? "Inactive" : "Student"}
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={printCard} disabled={loadingQr}>
                🖨 Print ID Card
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
