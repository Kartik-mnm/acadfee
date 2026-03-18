import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import jsQR from "jsqr";

function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 1.0; master.connect(ctx.destination);
    const beep = (freq, start, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master); osc.type = "square";
      osc.frequency.setValueAtTime(freq, start); gain.gain.setValueAtTime(0.8, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start+dur); osc.start(start); osc.stop(start+dur);
    };
    if (success) { beep(600,ctx.currentTime,0.12); beep(900,ctx.currentTime+0.15,0.20); }
    else { beep(300,ctx.currentTime,0.30); }
  } catch(e){}
}

function vibrate(success=true) {
  try { if(!navigator.vibrate) return; if(success) navigator.vibrate([100,50,100]); else navigator.vibrate([500]); } catch(e){}
}

const fmtIST = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true}) : "—";

export default function QRScanner() {
  const { user } = useAuth();
  const videoRef=useRef(null),canvasRef=useRef(null),streamRef=useRef(null);
  const intervalRef=useRef(null),lastScanRef=useRef(""),lastTimeRef=useRef(0),processingRef=useRef(false);
  const [scanning,setScanning]=useState(false),[result,setResult]=useState(null),[error,setError]=useState("");
  const [todayLogs,setTodayLogs]=useState([]),[loadingLogs,setLoadingLogs]=useState(false);

  const loadTodayLogs = () => { setLoadingLogs(true); API.get("/qrscan/today").then((r)=>setTodayLogs(r.data)).finally(()=>setLoadingLogs(false)); };
  useEffect(() => { loadTodayLogs(); return () => stopCamera(); }, []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{facingMode:"environment",width:{ideal:640},height:{ideal:480}} });
      streamRef.current=stream; videoRef.current.srcObject=stream;
      await videoRef.current.play(); setScanning(true);
      intervalRef.current = setInterval(scanFrame,66);
    } catch(e) { setError("Camera access denied. Please allow camera permission and try again."); }
  };

  const stopCamera = () => {
    if(intervalRef.current) clearInterval(intervalRef.current);
    if(streamRef.current) streamRef.current.getTracks().forEach((t)=>t.stop());
    setScanning(false);
  };

  const scanFrame = () => {
    const video=videoRef.current, canvas=canvasRef.current;
    if(!video||!canvas||video.readyState!==video.HAVE_ENOUGH_DATA||processingRef.current) return;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const code=jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
    if(code) {
      const now=Date.now();
      if(code.data===lastScanRef.current&&now-lastTimeRef.current<4000) return;
      lastScanRef.current=code.data; lastTimeRef.current=now;
      processScan(code.data);
    }
  };

  const processScan = async (token) => {
    processingRef.current=true;
    try {
      const { data } = await API.post("/qrscan/scan",{token});
      playBeep(true); vibrate(true);
      setResult({...data,status:"success"});
      loadTodayLogs();
      setTimeout(()=>setResult(null),6000);
    } catch(e) {
      playBeep(false); vibrate(false);
      setResult({status:"error",message:e.response?.data?.error||"Scan failed"});
      setTimeout(()=>setResult(null),4000);
    } finally { processingRef.current=false; }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">📷 QR Attendance Scanner</div><div className="page-sub">Scan student ID card QR codes to mark attendance</div></div>
      </div>
      <div className="grid-2" style={{ alignItems:"start" }}>
        <div className="card">
          <div className="card-title">Camera Scanner</div>
          <div style={{ position:"relative",background:"#000",borderRadius:10,overflow:"hidden",aspectRatio:"4/3",marginBottom:14 }}>
            <video ref={videoRef} style={{ width:"100%",height:"100%",objectFit:"cover",display:scanning?"block":"none" }} muted playsInline />
            <canvas ref={canvasRef} style={{ display:"none" }} />
            {!scanning&&<div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.5)",gap:10 }}><div style={{ fontSize:48 }}>📷</div><div style={{ fontSize:14 }}>Camera is off</div></div>}
            {scanning&&<div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}><div style={{ width:200,height:200,border:"3px solid #4f8ef7",borderRadius:12,boxShadow:"0 0 0 9999px rgba(0,0,0,0.45)",animation:"pulse 1.5s ease-in-out infinite" }}/></div>}
          </div>

          {result&&(
            <div style={{ padding:"14px 16px",borderRadius:10,marginBottom:14,
              background:result.status==="success"?result.scan_type==="entry"?"rgba(34,211,165,0.15)":"rgba(79,142,247,0.15)":"rgba(247,95,95,0.15)",
              border:`1px solid ${result.status==="success"?result.scan_type==="entry"?"#22d3a5":"#4f8ef7":"#f75f5f"}` }}>
              {result.status==="success"?(
                <>
                  <div style={{ fontSize:20,marginBottom:6 }}>{result.scan_type==="entry"?"✅ Entry Marked":"🚪 Exit Marked"}</div>
                  <div style={{ fontWeight:700,fontSize:16 }}>{result.student_name}</div>
                  <div style={{ fontSize:12,color:"var(--text2)",marginTop:2 }}>{result.batch} · {result.branch}</div>
                  <div style={{ fontSize:12,marginTop:4 }}>Time (IST): <strong>{result.time_ist||fmtIST(result.time)}</strong></div>
                  {result.is_working_day===false&&(
                    <div style={{ marginTop:8,padding:"6px 10px",background:"rgba(247,195,0,0.15)",border:"1px solid var(--yellow)",borderRadius:6,fontSize:12,color:"var(--yellow)" }}>
                      ⚠️ <strong>Holiday ({result.holiday_note})</strong> — scan recorded but attendance NOT counted today.
                    </div>
                  )}
                </>
              ):(
                <><div style={{ fontSize:18,marginBottom:4 }}>⚠️ Scan Failed</div><div style={{ fontSize:13,color:"var(--red)" }}>{result.message}</div></>
              )}
            </div>
          )}

          {error&&<div style={{ padding:"10px 14px",background:"rgba(247,95,95,0.1)",border:"1px solid var(--red)",borderRadius:8,color:"var(--red)",fontSize:13,marginBottom:14 }}>⚠️ {error}</div>}
          <div style={{ display:"flex",gap:10 }}>
            {!scanning?<button className="btn btn-primary" style={{ flex:1 }} onClick={startCamera}>📷 Start Scanner</button>:<button className="btn btn-danger" style={{ flex:1 }} onClick={stopCamera}>⏹ Stop Scanner</button>}
          </div>
          <div style={{ marginTop:12,fontSize:12,color:"var(--text2)",lineHeight:1.8 }}>
            <strong>How it works:</strong><br/>
            • 1st scan = Entry ✅ + beep + vibration 📳<br/>
            • 2nd scan = Exit 🚪 + beep + vibration 📳<br/>
            • Attendance counted on working days only<br/>
            • Times shown in IST (Indian Standard Time)
          </div>
        </div>

        <div className="card">
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div className="card-title" style={{ marginBottom:0 }}>Today's Scan Log ({new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})})</div>
            <button className="btn btn-secondary btn-sm" onClick={loadTodayLogs}>↻ Refresh</button>
          </div>
          {loadingLogs?<div className="loading">Loading…</div>:todayLogs.length===0?(
            <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">No scans yet today</div></div>
          ):(
            <div style={{ maxHeight:480,overflowY:"auto" }}>
              {todayLogs.map((log)=>(
                <div key={log.id} style={{ padding:"10px 12px",borderRadius:8,marginBottom:6,background:"var(--bg3)",border:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div><div style={{ fontWeight:600,fontSize:13 }}>{log.student_name}</div><div style={{ fontSize:11,color:"var(--text2)" }}>{log.batch_name} · {log.branch_name}</div></div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11 }}><span style={{ color:"var(--green)" }}>▶ {fmtIST(log.entry_time)}</span>{log.exit_time&&<span style={{ color:"var(--accent)",marginLeft:8 }}>■ {fmtIST(log.exit_time)}</span>}</div>
                    <div style={{ marginTop:4 }}>{log.exit_time?<span className="badge badge-green">Complete</span>:<span className="badge badge-yellow">Entry only</span>}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {todayLogs.length>0&&(
            <div style={{ marginTop:12,display:"flex",gap:10 }}>
              {[{label:"Complete",val:todayLogs.filter((l)=>l.exit_time).length,color:"var(--green)"},{label:"Entry Only",val:todayLogs.filter((l)=>!l.exit_time).length,color:"var(--yellow)"},{label:"Total",val:todayLogs.length,color:"var(--accent)"}].map((s)=>(
                <div key={s.label} style={{ flex:1,background:"var(--bg3)",borderRadius:8,padding:10,textAlign:"center" }}><div style={{ fontSize:11,color:"var(--text2)" }}>{s.label}</div><div style={{ fontSize:20,fontWeight:800,color:s.color }}>{s.val}</div></div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;border-color:#4f8ef7}50%{opacity:0.5;border-color:#22d3a5}}`}</style>
    </div>
  );
}
