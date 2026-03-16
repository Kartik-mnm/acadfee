import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import QRCode from "qrcode";

// Generate SVG QR code string directly (pure SVG, perfect print quality)
async function generateSvgQR(text) {
  // Use qrcode library to get the modules (dot matrix)
  const QRCodeLib = await import("qrcode");
  const dataUrl = await QRCodeLib.default.toDataURL(text, {
    width: 200, margin: 1,
    errorCorrectionLevel: "L", // L = lowest = simplest = easiest to scan
    color: { dark: "#0a1628", light: "#ffffff" }
  });
  return dataUrl;
}

export default function IDCards() {
  const { user } = useAuth();
  const [students, setStudents]         = useState([]);
  const [branches, setBranches]         = useState([]);
  const [batches, setBatches]           = useState([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBatch, setFilterBatch]   = useState("");
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState(null);
  const [qrDataUrl, setQrDataUrl]       = useState("");
  const [qrToken, setQrToken]           = useState("");
  const [loadingQr, setLoadingQr]       = useState(false);

  useEffect(() => {
    API.get("/students").then((r) => setStudents(r.data));
    API.get("/batches").then((r) => setBatches(r.data));
    if (user.role === "super_admin") API.get("/branches").then((r) => setBranches(r.data));
  }, []);

  useEffect(() => {
    if (!selected) { setQrDataUrl(""); setQrToken(""); return; }
    setLoadingQr(true);
    API.get(`/qrscan/token/${selected.id}`)
      .then(async (r) => {
        setQrToken(r.data.token);
        // Simple QR: error correction L = least complex = fastest to scan
        const url = await QRCode.toDataURL(r.data.token, {
          width: 160,
          margin: 1,
          errorCorrectionLevel: "L",
          color: { dark: "#0a1628", light: "#ffffff" }
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

  const studentId = selected ? `NA-${String(selected.id).padStart(5, "0")}` : "";

  const printCard = () => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>ID Card - ${selected.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; background: #e8e8e8;
    }
    @media print {
      body { background: white; }
      .card { box-shadow: none !important; }
    }
    .card {
      width: 54mm; min-height: 86mm;
      background: white;
      border-radius: 6mm;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.2);
      position: relative;
    }
    /* Top wave header */
    .card-top {
      background: #0a1628;
      height: 28mm;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-top: 4mm;
    }
    .wave {
      position: absolute;
      bottom: -1px; left: 0; right: 0;
    }
    .blue-accent {
      position: absolute;
      bottom: 0; left: 0; right: 0;
    }
    .academy-name {
      color: white;
      font-size: 7pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-align: center;
      z-index: 2;
    }
    .academy-sub {
      color: rgba(255,255,255,0.6);
      font-size: 5pt;
      letter-spacing: 0.8px;
      text-align: center;
      z-index: 2;
      margin-top: 1mm;
    }
    /* Photo circle */
    .photo-wrap {
      display: flex;
      justify-content: center;
      margin-top: -8mm;
      position: relative;
      z-index: 10;
    }
    .photo-circle {
      width: 18mm; height: 18mm;
      border-radius: 50%;
      background: #e8edf5;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 22pt;
      overflow: hidden;
    }
    /* Info section */
    .card-body {
      padding: 3mm 4mm 3mm;
      text-align: center;
    }
    .student-name {
      font-size: 10pt;
      font-weight: 900;
      color: #0a1628;
      line-height: 1.2;
      margin-top: 2mm;
      text-transform: uppercase;
    }
    .student-role {
      font-size: 6.5pt;
      color: #1565c0;
      font-weight: 700;
      margin-top: 1mm;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .divider {
      height: 0.5mm;
      background: linear-gradient(90deg, transparent, #1565c0, transparent);
      margin: 2mm 4mm;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.8mm 0;
      font-size: 5.5pt;
    }
    .info-label { color: #888; font-weight: 600; }
    .info-value { color: #0a1628; font-weight: 700; text-align: right; max-width: 28mm; }
    .student-id {
      font-size: 8pt;
      font-weight: 800;
      color: #0a1628;
      letter-spacing: 1px;
      margin: 2mm 0 1mm;
      font-family: monospace;
    }
    /* QR section */
    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2mm 0 3mm;
      background: #f8faff;
      border-top: 0.5mm solid #e0e8f5;
    }
    .qr-img {
      width: 16mm; height: 16mm;
      border: 1px solid #ddd;
      border-radius: 1.5mm;
      padding: 1mm;
      background: white;
    }
    .qr-label {
      font-size: 4.5pt;
      color: #888;
      margin-top: 1mm;
      letter-spacing: 0.5px;
    }
    /* Bottom blue bar */
    .card-bottom {
      background: linear-gradient(135deg, #0a1628, #1565c0);
      padding: 2mm 4mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .valid-text { font-size: 4.5pt; color: rgba(255,255,255,0.6); }
    .student-badge {
      background: rgba(255,255,255,0.15);
      color: white;
      font-size: 4.5pt;
      font-weight: 800;
      padding: 0.8mm 2mm;
      border-radius: 1mm;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="card">
    <!-- Top Header -->
    <div class="card-top">
      <div class="academy-name">NISHCHAY ACADEMY</div>
      <div class="academy-sub">STUDENT IDENTITY CARD</div>
      <!-- Wave SVG -->
      <svg class="wave" viewBox="0 0 216 30" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="height:12mm;">
        <path d="M0,20 C40,35 80,5 108,20 C136,35 176,5 216,20 L216,30 L0,30 Z" fill="white"/>
        <path d="M0,24 C40,38 80,10 108,24 C136,38 176,10 216,24 L216,30 L0,30 Z" fill="#e8f0fe" opacity="0.5"/>
      </svg>
    </div>

    <!-- Photo -->
    <div class="photo-wrap">
      <div class="photo-circle">👤</div>
    </div>

    <!-- Body -->
    <div class="card-body">
      <div class="student-name">${selected.name}</div>
      <div class="student-role">${selected.batch_name || "Student"}</div>
      <div class="divider"></div>
      <div class="info-row">
        <span class="info-label">Branch</span>
        <span class="info-value">${selected.branch_name || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Phone</span>
        <span class="info-value">${selected.phone || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Admitted</span>
        <span class="info-value">${selected.admission_date ? new Date(selected.admission_date).toLocaleDateString("en-IN") : "—"}</span>
      </div>
      <div class="student-id">${studentId}</div>
    </div>

    <!-- QR Code -->
    <div class="qr-section">
      ${qrDataUrl ? `<img class="qr-img" src="${qrDataUrl}" alt="QR" />` : '<div style="width:16mm;height:16mm;background:#eee;border-radius:1.5mm;"></div>'}
      <div class="qr-label">SCAN FOR ATTENDANCE</div>
    </div>

    <!-- Bottom Bar -->
    <div class="card-bottom">
      <div class="valid-text">Valid: 2025–26</div>
      <div class="student-badge">Student</div>
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>

              {/* ── Card Preview (matches print exactly) ── */}
              <div style={{
                width: 220, background: "white", borderRadius: 16,
                overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                fontFamily: "'Inter', Arial, sans-serif"
              }}>
                {/* Top Header */}
                <div style={{ background: "#0a1628", paddingTop: 16, paddingBottom: 0, position: "relative", textAlign: "center" }}>
                  <div style={{ color: "white", fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}>NISHCHAY ACADEMY</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 8, letterSpacing: 1, marginTop: 2, marginBottom: 10 }}>STUDENT IDENTITY CARD</div>
                  {/* Wave */}
                  <svg viewBox="0 0 220 30" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }}>
                    <path d="M0,20 C40,35 80,5 110,20 C140,35 180,5 220,20 L220,30 L0,30 Z" fill="white"/>
                    <path d="M0,24 C40,38 80,10 110,24 C140,38 180,10 220,24 L220,30 L0,30 Z" fill="#e8f0fe" opacity="0.5"/>
                  </svg>
                </div>

                {/* Photo Circle */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: -22, position: "relative", zIndex: 10 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%",
                    background: "#e8edf5", border: "3px solid white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28
                  }}>👤</div>
                </div>

                {/* Body */}
                <div style={{ padding: "8px 14px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0a1628", textTransform: "uppercase", lineHeight: 1.2, marginTop: 4 }}>
                    {selected.name}
                  </div>
                  <div style={{ fontSize: 9, color: "#1565c0", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {selected.batch_name || "Student"}
                  </div>
                  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #1565c0, transparent)", margin: "6px 10px" }} />
                  {[
                    ["Branch", selected.branch_name || "—"],
                    ["Phone", selected.phone || "—"],
                    ["Admitted", selected.admission_date ? new Date(selected.admission_date).toLocaleDateString("en-IN") : "—"],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 8 }}>
                      <span style={{ color: "#888", fontWeight: 600 }}>{l}</span>
                      <span style={{ color: "#0a1628", fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0a1628", letterSpacing: 1, margin: "6px 0 4px", fontFamily: "monospace" }}>
                    {studentId}
                  </div>
                </div>

                {/* QR Section */}
                <div style={{ background: "#f8faff", borderTop: "1px solid #e0e8f5", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {loadingQr ? (
                    <div style={{ width: 56, height: 56, background: "#eee", borderRadius: 4 }} />
                  ) : qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR" style={{ width: 56, height: 56, border: "1px solid #ddd", borderRadius: 4, padding: 2, background: "white" }} />
                  ) : null}
                  <div style={{ fontSize: 7, color: "#888", marginTop: 4, letterSpacing: 0.5 }}>SCAN FOR ATTENDANCE</div>
                </div>

                {/* Bottom Bar */}
                <div style={{ background: "linear-gradient(135deg, #0a1628, #1565c0)", padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.6)" }}>Valid: 2025–26</div>
                  <div style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: 7, fontWeight: 800, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Student</div>
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
