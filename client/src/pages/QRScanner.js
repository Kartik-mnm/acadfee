import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import jsQR from "jsqr";

export default function QRScanner() {
  const { user } = useAuth();
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const animRef     = useRef(null);
  const lastScanRef = useRef("");   // prevent double-scan same QR
  const lastTimeRef = useRef(0);

  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState(null);   // last scan result
  const [error, setError]         = useState("");
  const [todayLogs, setTodayLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadTodayLogs = () => {
    setLoadingLogs(true);
    API.get("/qrscan/today")
      .then((r) => setTodayLogs(r.data))
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => {
    loadTodayLogs();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      scanLoop();
    } catch (e) {
      setError("Camera access denied. Please allow camera permission and try again.");
    }
  };

  const stopCamera = () => {
    if (animRef.current)  cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setScanning(false);
  };

  const scanLoop = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) {
          const now = Date.now();
          // Debounce: don't re-scan same QR within 4 seconds
          if (code.data !== lastScanRef.current || now - lastTimeRef.current > 4000) {
            lastScanRef.current = code.data;
            lastTimeRef.current = now;
            processScan(code.data);
          }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const processScan = async (token) => {
    try {
      const { data } = await API.post("/qrscan/scan", { token });
      setResult({ ...data, status: "success" });
      loadTodayLogs();
      // Auto-clear result after 5s
      setTimeout(() => setResult(null), 5000);
    } catch (e) {
      const msg = e.response?.data?.error || "Scan failed";
      setResult({ status: "error", message: msg });
      setTimeout(() => setResult(null), 4000);
    }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📷 QR Attendance Scanner</div>
          <div className="page-sub">Scan student ID card QR codes to mark attendance</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>

        {/* ── Scanner Panel ── */}
        <div className="card">
          <div className="card-title">Camera Scanner</div>

          {/* Video feed */}
          <div style={{
            position: "relative", background: "#000", borderRadius: 10, overflow: "hidden",
            aspectRatio: "4/3", marginBottom: 14
          }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: scanning ? "block" : "none" }} muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {!scanning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", gap: 10 }}>
                <div style={{ fontSize: 48 }}>📷</div>
                <div style={{ fontSize: 14 }}>Camera is off</div>
              </div>
            )}

            {/* Scan overlay */}
            {scanning && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{
                  width: 200, height: 200, border: "3px solid #4f8ef7",
                  borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)"
                }} />
              </div>
            )}
          </div>

          {/* Result Banner */}
          {result && (
            <div style={{
              padding: "14px 16px", borderRadius: 10, marginBottom: 14,
              background: result.status === "success"
                ? result.scan_type === "entry" ? "rgba(34,211,165,0.15)" : "rgba(79,142,247,0.15)"
                : "rgba(247,95,95,0.15)",
              border: `1px solid ${result.status === "success"
                ? result.scan_type === "entry" ? "#22d3a5" : "#4f8ef7"
                : "#f75f5f"}`,
            }}>
              {result.status === "success" ? (
                <>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>
                    {result.scan_type === "entry" ? "✅ Entry Marked" : "🚪 Exit Marked"}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{result.student_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                    {result.batch} · {result.branch}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Time: <strong>{fmt(result.time)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>⚠️ Scan Failed</div>
                  <div style={{ fontSize: 13, color: "var(--red)" }}>{result.message}</div>
                </>
              )}
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(247,95,95,0.1)", border: "1px solid var(--red)", borderRadius: 8, color: "var(--red)", fontSize: 13, marginBottom: 14 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {!scanning ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={startCamera}>
                📷 Start Scanner
              </button>
            ) : (
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopCamera}>
                ⏹ Stop Scanner
              </button>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
            <strong>How it works:</strong><br />
            • 1st scan = Entry ✅<br />
            • 2nd scan = Exit 🚪<br />
            • Attendance auto-updates after exit scan
          </div>
        </div>

        {/* ── Today's Log ── */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              Today's Scan Log ({new Date().toLocaleDateString("en-IN")})
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadTodayLogs}>↻ Refresh</button>
          </div>

          {loadingLogs ? (
            <div className="loading">Loading…</div>
          ) : todayLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-text">No scans yet today</div>
              <div className="empty-sub">Start scanning to see logs here</div>
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {todayLogs.map((log) => (
                <div key={log.id} style={{
                  padding: "10px 12px", borderRadius: 8, marginBottom: 6,
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{log.student_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>{log.batch_name} · {log.branch_name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11 }}>
                      <span style={{ color: "var(--green)" }}>▶ {fmt(log.entry_time)}</span>
                      {log.exit_time && <span style={{ color: "var(--accent)", marginLeft: 8 }}>■ {fmt(log.exit_time)}</span>}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {log.exit_time
                        ? <span className="badge badge-green">Complete</span>
                        : <span className="badge badge-yellow">Entry only</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {todayLogs.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <div style={{ flex: 1, background: "rgba(34,211,165,0.1)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>Complete</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)" }}>
                  {todayLogs.filter((l) => l.exit_time).length}
                </div>
              </div>
              <div style={{ flex: 1, background: "rgba(247,200,79,0.1)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>Entry Only</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--yellow)" }}>
                  {todayLogs.filter((l) => !l.exit_time).length}
                </div>
              </div>
              <div style={{ flex: 1, background: "rgba(79,142,247,0.1)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>Total</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>
                  {todayLogs.length}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
