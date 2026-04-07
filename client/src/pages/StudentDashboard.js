import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";
import QRCode from "qrcode";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// ─────────────────────────────────────────────────────────────────────────────
// FCM Token Registration
//
// HOW IT WORKS:
// 1. Student opens portal → "Enable Notifications" banner appears
// 2. Student taps → browser asks permission → we get FCM token → save to DB
// 3. When admin scans QR → backend reads fcm_token from DB → Firebase sends push
// 4. Service worker (firebase-messaging-sw.js) shows the notification
//
// REQUIREMENTS:
// - REACT_APP_VAPID_KEY must be set in Render (client static site env vars)
//   Get it: Firebase Console → Project Settings → Cloud Messaging
//           → Web Push certificates → Key pair (the long string starting with B)
// - Firebase Admin env vars must be set in Render (server):
//   FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
// ─────────────────────────────────────────────────────────────────────────────
async function requestAndSaveFCMToken(studentId) {
  const errors = [];

  try {
    // Step 1: Check browser support
    if (!("Notification" in window)) {
      errors.push("Browser does not support notifications");
      return { ok: false, errors };
    }
    if (!("serviceWorker" in navigator)) {
      errors.push("Browser does not support service workers");
      return { ok: false, errors };
    }
    if (!window.firebase) {
      errors.push("Firebase SDK not loaded (check index.html)");
      return { ok: false, errors };
    }

    // Step 2: Get VAPID key — REQUIRED for web push
    const vapidKey = process.env.REACT_APP_VAPID_KEY;
    if (!vapidKey) {
      errors.push("REACT_APP_VAPID_KEY not set in Render environment variables. " +
        "Get it from: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Key pair");
      console.error("[FCM] " + errors[errors.length - 1]);
      return { ok: false, errors };
    }

    // Step 3: Register service worker
    let swReg;
    try {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      // Wait for SW to be ready — critical! getToken fails if SW not ready yet
      await navigator.serviceWorker.ready;
    } catch (e) {
      errors.push("Service worker registration failed: " + e.message);
      return { ok: false, errors };
    }

    // Step 4: Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      errors.push("Permission " + permission);
      return { ok: false, errors, permission };
    }

    // Step 5: Get FCM token — requires VAPID key and ready SW
    let token;
    try {
      const messaging = window.firebase.messaging();
      token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: swReg });
    } catch (e) {
      errors.push("getToken failed: " + e.message);
      console.error("[FCM] getToken error:", e);
      return { ok: false, errors };
    }

    if (!token) {
      errors.push("getToken returned empty — VAPID key may be wrong");
      return { ok: false, errors };
    }

    // Step 6: Save token to DB
    await API.post(`/students/${studentId}/fcm-token`, { token, type: "student" });
    localStorage.setItem("fcm_token", token);
    console.log("[FCM] ✅ Token registered and saved:", token.substring(0, 20) + "...");
    return { ok: true, token };

  } catch (e) {
    errors.push("Unexpected error: " + e.message);
    console.error("[FCM] Unexpected error:", e);
    return { ok: false, errors };
  }
}

// ── Notification prompt banner ─────────────────────────────────────────────
function NotificationPrompt({ studentId, onDismiss }) {
  const [requesting, setRequesting] = useState(false);
  const [result,     setResult]     = useState(null); // null | "success" | "denied" | "error"
  const [errorMsg,   setErrorMsg]   = useState("");

  const enable = async () => {
    setRequesting(true);
    setErrorMsg("");
    const res = await requestAndSaveFCMToken(studentId);
    setRequesting(false);

    if (res.ok) {
      setResult("success");
      setTimeout(onDismiss, 2500);
    } else if (res.permission === "denied") {
      setResult("denied");
    } else {
      // Show the real error so it can be debugged
      setResult("error");
      setErrorMsg(res.errors?.join(" | ") || "Unknown error");
    }
  };

  if (result === "success") return (
    <div style={{ marginBottom:16, background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
      <span style={{ fontSize:24 }}>✅</span>
      <div style={{ fontWeight:700, fontSize:14, color:"var(--text1)" }}>Notifications enabled! You'll get alerts for attendance &amp; payments.</div>
    </div>
  );

  if (result === "denied") return (
    <div style={{ marginBottom:16, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
      <span style={{ fontSize:24 }}>⚠️</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:13, color:"var(--text1)", marginBottom:2 }}>Notifications blocked</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>To enable: tap the lock/bell icon in browser address bar → Allow notifications → Reload.</div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onDismiss}>OK</button>
    </div>
  );

  if (result === "error") return (
    <div style={{ marginBottom:16, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:12, padding:"14px 18px" }}>
      <div style={{ fontWeight:700, fontSize:13, color:"var(--red)", marginBottom:4 }}>⚠️ Notification setup failed</div>
      <div style={{ fontSize:11, color:"var(--text3)", marginBottom:8, wordBreak:"break-word" }}>{errorMsg}</div>
      <button className="btn btn-secondary btn-sm" onClick={onDismiss}>Dismiss</button>
    </div>
  );

  return (
    <div style={{ marginBottom:16, background:"linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.08))", border:"1px solid rgba(99,102,241,0.3)", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
      <span style={{ fontSize:24 }}>🔔</span>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ fontWeight:700, fontSize:14, color:"var(--text1)", marginBottom:3 }}>Enable Attendance Notifications</div>
        <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>Get notified when your attendance is marked or a payment is recorded.</div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button className="btn btn-primary btn-sm" onClick={enable} disabled={requesting} style={{ whiteSpace:"nowrap" }}>
          {requesting ? "Enabling..." : "🔔 Enable"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onDismiss}>Not now</button>
      </div>
    </div>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [tab,             setTab]             = useState("overview");
  const [fees,            setFees]            = useState([]);
  const [payments,        setPayments]        = useState([]);
  const [attendance,      setAttendance]      = useState([]);
  const [tests,           setTests]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [qrDataUrl,       setQrDataUrl]       = useState("");
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [feesRes, paymentsRes, attRes, testsRes] = await Promise.allSettled([
          API.get("/fees"),
          API.get(`/payments?student_id=${user.id}`),
          API.get(`/attendance?student_id=${user.id}`),
          API.get(`/tests/student/${user.id}`),
        ]);
        if (feesRes.status     === "fulfilled") setFees(feesRes.value.data);
        if (paymentsRes.status === "fulfilled") setPayments(paymentsRes.value.data);
        if (attRes.status      === "fulfilled") setAttendance(attRes.value.data);
        if (testsRes.status    === "fulfilled") setTests(testsRes.value.data);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();

    API.get(`/qrscan/token/${user.id}`)
      .then(async (r) => {
        const url = await QRCode.toDataURL(r.data.token, {
          width:220, margin:1, errorCorrectionLevel:"L",
          color:{ dark:"#0a1628", light:"#ffffff" },
        });
        setQrDataUrl(url);
      })
      .catch(() => {});

    // Show notification prompt: only if not dismissed AND no token saved
    const dismissed   = localStorage.getItem("notif_dismissed");
    const hasFcmToken = localStorage.getItem("fcm_token");
    const supported   = ("Notification" in window) && Notification.permission !== "denied";
    if (!dismissed && !hasFcmToken && supported) {
      setTimeout(() => setShowNotifPrompt(true), 1200);
    }
  }, [user.id]);

  const dismissNotifPrompt = () => {
    localStorage.setItem("notif_dismissed", "1");
    setShowNotifPrompt(false);
  };

  const totalFees   = fees.reduce((s, f) => s + parseFloat(f.amount_due  || 0), 0);
  const totalPaid   = fees.reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
  const balance     = totalFees - totalPaid;
  const pendingFees = fees.filter((f) => f.status !== "paid");

  const totalPresentDays = attendance.reduce((s, a) => s + parseInt(a.present   || 0), 0);
  const totalWorkingDays = attendance.reduce((s, a) => s + parseInt(a.total_days || 0), 0);
  const attendancePct = totalWorkingDays > 0
    ? Math.round((totalPresentDays / totalWorkingDays) * 100) : null;

  const testScores = tests.filter((t) => t.marks != null || t.score != null);
  const avgScore   = testScores.length > 0
    ? (testScores.reduce((s, t) => s + parseFloat(t.marks || t.score || 0), 0) / testScores.length).toFixed(1)
    : null;

  const statusBadge = (s) => {
    const map = { paid:["var(--green)","Paid"], partial:["var(--yellow)","Partial"], overdue:["var(--red)","Overdue"], pending:["var(--text3)","Pending"] };
    const [c, l] = map[s] || ["var(--text3)", s];
    return <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:`${c}18`, color:c, fontWeight:700 }}>{l}</span>;
  };

  const pctColor = (p) => p >= 75 ? "var(--green)" : p >= 50 ? "var(--yellow)" : "var(--red)";

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
      <div style={{ textAlign:"center", color:"var(--text2)" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🎓</div>
        <div>Loading your dashboard...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text1)" }}>

      <div style={{ background:"linear-gradient(135deg,#1a237e,#0d47a1,#006064)", padding:"20px 20px 40px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)" }}>{user.branch_name && `– ${user.branch_name}`}</div>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:8, padding:"6px 14px", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Logout</button>
        </div>
        <div style={{ color:"rgba(255,255,255,0.9)", fontSize:24, fontWeight:800 }}>Welcome, {user.name}! 👋</div>
        <div style={{ color:"rgba(255,255,255,0.6)", fontSize:13, marginTop:4 }}>{user.batch_name || "No batch"} · {user.branch_name || ""}</div>
      </div>

      <div style={{ padding:"0 16px", marginTop:-24 }}>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
          {[
            { icon:"📋", label:"Total Fees",  val:fmt(totalFees), color:"var(--text1)" },
            { icon:"✅", label:"Total Paid",  val:fmt(totalPaid), color:"var(--green)" },
            { icon:"💰", label:"Balance Due", val:fmt(balance),   color:balance>0?"var(--red)":"var(--green)" },
            { icon:"📅", label:"Attendance",  val:attendancePct!=null?`${attendancePct}%`:"—", color:attendancePct!=null?pctColor(attendancePct):"var(--text3)" },
            { icon:"📊", label:"Avg Score",   val:avgScore!=null?`${avgScore}`:"—", color:"var(--accent)" },
          ].map((c) => (
            <div key={c.label} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
              <div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:17, fontWeight:800, color:c.color }}>{c.val}</div>
            </div>
          ))}
        </div>

        {showNotifPrompt && <NotificationPrompt studentId={user.id} onDismiss={dismissNotifPrompt} />}

        <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
          {[
            { id:"overview",   label:"🏠 Overview"  },
            { id:"idcard",     label:"🪪 ID Card"    },
            { id:"fees",       label:"💳 Fees"       },
            { id:"payments",   label:"💸 Payments"   },
            { id:"attendance", label:"✅ Attendance" },
            { id:"tests",      label:"📊 Tests"      },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"7px 14px", borderRadius:20, fontSize:12, fontWeight:600, border:"1px solid var(--border)", cursor:"pointer", whiteSpace:"nowrap", background:tab===t.id?"var(--accent)":"var(--bg2)", color:tab===t.id?"#fff":"var(--text2)" }}>{t.label}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div style={{ display:"grid", gap:14 }}>
            <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--yellow)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>⚠ Pending Fees</div>
              {pendingFees.length === 0
                ? <div style={{ color:"var(--green)", fontWeight:700 }}>✅ All fees paid!</div>
                : pendingFees.map((f) => (
                    <div key={f.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{f.period_label || "Fee"}</div>
                        <div style={{ fontSize:11, color:"var(--text3)" }}>Due: {f.due_date ? new Date(f.due_date).toLocaleDateString("en-IN") : "—"}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontWeight:800, color:"var(--red)", fontSize:14 }}>{fmt(f.amount_due - f.amount_paid)}</div>
                        {statusBadge(f.status)}
                      </div>
                    </div>
                  ))
              }
            </div>

            <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--green)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>💸 Recent Payments</div>
              {payments.length === 0
                ? <div style={{ color:"var(--text3)", fontSize:13 }}>No payments yet</div>
                : payments.slice(0,5).map((p) => (
                    <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{p.period_label || "Payment"}</div>
                        <div style={{ fontSize:11, color:"var(--text3)" }}>{new Date(p.paid_on).toLocaleDateString("en-IN")} · {p.payment_mode?.toUpperCase()}</div>
                      </div>
                      <div style={{ fontWeight:800, color:"var(--green)", fontSize:14 }}>{fmt(p.amount)}</div>
                    </div>
                  ))
              }
            </div>

            <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--cyan)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>📅 Attendance Summary</div>
              {attendance.length === 0
                ? <div style={{ color:"var(--text3)", fontSize:13 }}>No records yet</div>
                : (
                  <>
                    <div style={{ marginBottom:12, fontSize:13 }}>
                      <span style={{ fontWeight:700, color:"var(--green)" }}>{totalPresentDays}</span>
                      <span style={{ color:"var(--text3)" }}> / {totalWorkingDays} days present</span>
                      {attendancePct != null && <span style={{ marginLeft:8, fontWeight:700, color:pctColor(attendancePct) }}>({attendancePct}%)</span>}
                    </div>
                    {attendance.slice(0,6).map((a) => (
                      <div key={`${a.month}-${a.year}`} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{MONTHS[(a.month||1)-1]} {a.year}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:12, color:"var(--text3)" }}>{a.present}/{a.total_days} days</span>
                          <span style={{ fontSize:12, fontWeight:700, color:pctColor(parseFloat(a.percentage||0)) }}>{Math.round(a.percentage||0)}%</span>
                        </div>
                      </div>
                    ))}
                  </>
                )
              }
            </div>

            <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>📊 Recent Tests</div>
              {tests.length === 0
                ? <div style={{ color:"var(--text3)", fontSize:13 }}>No tests yet</div>
                : tests.slice(0,5).map((t) => (
                    <div key={t.id} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{t.test_name || t.name}</div>
                        <div style={{ fontSize:11, color:"var(--text3)" }}>{t.test_date ? new Date(t.test_date).toLocaleDateString("en-IN") : "—"}</div>
                      </div>
                      <div style={{ fontWeight:800, color:"var(--accent)", fontSize:14 }}>{t.marks!=null?`${t.marks}/${t.total_marks}`:"—"}</div>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

        {tab === "idcard" && (
          <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:20, textAlign:"center" }}>
            <div style={{ marginBottom:12, fontSize:14, fontWeight:700, color:"var(--text1)" }}>Your Attendance QR Code</div>
            {qrDataUrl
              ? <img src={qrDataUrl} alt="QR" style={{ width:200, height:200, border:"1px solid var(--border)", borderRadius:8, padding:8, background:"white" }} />
              : <div style={{ width:200, height:200, background:"var(--bg3)", borderRadius:8, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text3)" }}>Loading...</div>
            }
            <div style={{ marginTop:10, fontSize:12, color:"var(--text3)" }}>Show this at entry for attendance</div>
            <div style={{ marginTop:16, fontSize:22, fontWeight:900, color:"var(--accent)", fontFamily:"monospace" }}>
              {user.roll_no || `ID-${String(user.id).padStart(5,"0")}`}
            </div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>Roll Number</div>
            <div style={{ marginTop:12, padding:"8px 14px", background:"var(--bg3)", borderRadius:8, fontSize:12, color:"var(--text2)" }}>
              {user.name} · {user.batch_name || "No batch"}
            </div>
          </div>
        )}

        {tab === "fees" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {fees.length === 0
              ? <div style={{ textAlign:"center", color:"var(--text3)", padding:32 }}>No fee records</div>
              : fees.map((f) => (
                  <div key={f.id} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{f.period_label || "Fee"}</div>
                        <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>Due: {f.due_date ? new Date(f.due_date).toLocaleDateString("en-IN") : "—"}</div>
                      </div>
                      {statusBadge(f.status)}
                    </div>
                    <div style={{ display:"flex", gap:20, marginTop:10, fontSize:12 }}>
                      <div><div style={{ color:"var(--text3)" }}>Total</div><div style={{ fontWeight:700 }}>{fmt(f.amount_due)}</div></div>
                      <div><div style={{ color:"var(--text3)" }}>Paid</div><div style={{ fontWeight:700, color:"var(--green)" }}>{fmt(f.amount_paid)}</div></div>
                      <div><div style={{ color:"var(--text3)" }}>Balance</div><div style={{ fontWeight:700, color:f.amount_due-f.amount_paid>0?"var(--red)":"var(--green)" }}>{fmt(f.amount_due-f.amount_paid)}</div></div>
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        {tab === "payments" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {payments.length === 0
              ? <div style={{ textAlign:"center", color:"var(--text3)", padding:32 }}>No payments yet</div>
              : payments.map((p) => (
                  <div key={p.id} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{fmt(p.amount)}</div>
                        <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>{p.period_label || "—"}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, color:"var(--text3)" }}>{new Date(p.paid_on).toLocaleDateString("en-IN")}</div>
                        <div style={{ fontSize:11, color:"var(--accent)", fontWeight:600 }}>{p.payment_mode?.toUpperCase()}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"var(--text3)", marginTop:6, fontFamily:"monospace" }}>{p.receipt_no}</div>
                  </div>
                ))
            }
          </div>
        )}

        {tab === "attendance" && (
          <div>
            <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:14, marginBottom:14 }}>
              <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                {[
                  { l:"Total Present", v:totalPresentDays, c:"var(--green)" },
                  { l:"Working Days",  v:totalWorkingDays, c:"var(--text1)" },
                  { l:"Absent Days",   v:Math.max(0, totalWorkingDays - totalPresentDays), c:"var(--red)" },
                  { l:"Overall %",     v:attendancePct!=null?`${attendancePct}%`:"—", c:attendancePct!=null?pctColor(attendancePct):"var(--text3)" },
                ].map(x => (
                  <div key={x.l} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:x.c }}>{x.v}</div>
                    <div style={{ fontSize:10, color:"var(--text3)" }}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
            {attendance.length === 0
              ? <div style={{ textAlign:"center", color:"var(--text3)", padding:32 }}>No attendance records yet</div>
              : attendance.map((a) => {
                  const pct = parseFloat(a.percentage || 0);
                  return (
                    <div key={`${a.month}-${a.year}`} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{MONTHS[(a.month||1)-1]} {a.year}</div>
                        <span style={{ fontSize:13, fontWeight:800, color:pctColor(pct) }}>{Math.round(pct)}%</span>
                      </div>
                      <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--text3)", marginBottom:8 }}>
                        <span>✅ Present: <strong style={{ color:"var(--green)" }}>{a.present}</strong></span>
                        <span>📅 Total: <strong>{a.total_days}</strong></span>
                        <span>❌ Absent: <strong style={{ color:"var(--red)" }}>{Math.max(0,(a.total_days||0)-(a.present||0))}</strong></span>
                      </div>
                      <div style={{ background:"var(--bg3)", borderRadius:4, height:6 }}>
                        <div style={{ width:`${Math.min(100,pct)}%`, height:"100%", borderRadius:4, background:pctColor(pct), transition:"width 0.5s" }} />
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {tab === "tests" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {tests.length === 0
              ? <div style={{ textAlign:"center", color:"var(--text3)", padding:32 }}>No tests yet</div>
              : tests.map((t, i) => (
                  <div key={t.id || i} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{t.test_name || t.name}</div>
                        <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>{t.subject || "—"} · {t.test_date ? new Date(t.test_date).toLocaleDateString("en-IN") : ""}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        {t.marks != null
                          ? <div style={{ fontWeight:800, fontSize:18, color:"var(--accent)" }}>{t.marks}<span style={{ fontSize:12, color:"var(--text3)" }}>/{t.total_marks}</span></div>
                          : <div style={{ fontSize:12, color:"var(--text3)" }}>Not graded</div>
                        }
                        {t.percentage != null && <div style={{ fontSize:11, color:"var(--text3)" }}>{t.percentage}%</div>}
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
        )}

        <div style={{ height:40 }} />
      </div>
    </div>
  );
}
