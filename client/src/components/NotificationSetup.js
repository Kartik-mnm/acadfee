import { useState, useEffect } from "react";
import { requestNotificationPermission, onForegroundMessage } from "../firebase";
import API from "../api";

export default function NotificationSetup({ studentId, type = "student" }) {
  const [status, setStatus]   = useState("idle");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!("Notification" in window)) { setStatus("unsupported"); return; }
    if (Notification.permission === "granted") { setStatus("granted"); registerToken(); }
    // eslint-disable-next-line
  }, [studentId]);

  useEffect(() => {
    if (status !== "granted") return;
    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification;
      setMessage({ title, body });
      setTimeout(() => setMessage(null), 6000);
    });
    return () => unsub && unsub();
  }, [status]);

  const registerToken = async () => {
    try {
      const token = await requestNotificationPermission();
      if (!token || !studentId) return;

      // #36 — Store FCM token in localStorage so logout can clear it per-device
      localStorage.setItem("fcm_token", token);

      await API.post("/qrscan/register-token", { student_id: studentId, token, type });
      setStatus("granted");
    } catch (e) {
      console.error("Token registration error:", e);
    }
  };

  const handleEnable = async () => {
    setStatus("requesting");
    await registerToken();
    if (Notification.permission === "denied") setStatus("denied");
  };

  return (
    <>
      {message && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: "var(--bg2)", border: "1px solid var(--green)",
          borderRadius: 12, padding: "14px 18px", maxWidth: 320,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "slideIn 0.3s ease"
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{message.title}</div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>{message.body}</div>
        </div>
      )}

      {status === "idle" && studentId && (
        <div style={{
          background: "rgba(79,142,247,0.1)", border: "1px solid var(--accent)",
          borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>🔔 Enable Attendance Notifications</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
              Get notified when {type === "parent" ? "your child's" : "your"} attendance is marked
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleEnable}>Enable</button>
        </div>
      )}

      {status === "requesting" && (
        <div style={{ background: "rgba(79,142,247,0.1)", border: "1px solid var(--accent)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
          ⏳ Setting up notifications…
        </div>
      )}

      {status === "denied" && (
        <div style={{ background: "rgba(247,95,95,0.1)", border: "1px solid var(--red)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--red)" }}>
          ⚠️ Notifications blocked. Please enable in browser settings.
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
