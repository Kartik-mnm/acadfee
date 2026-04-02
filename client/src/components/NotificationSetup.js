import { useState, useEffect, useRef } from "react";
import { requestNotificationPermission, onForegroundMessage } from "../firebase";
import API from "../api";

/**
 * NotificationSetup — handles FCM token registration and foreground messages.
 *
 * FIX (Issue 1 — notifications not working):
 * - Previously only called registerToken() if permission was already "granted" on mount.
 *   If the user had never granted permission, it would show the "Enable" button but
 *   never auto-register after clicking — the token could go stale.
 * - Now: on every mount, if permission is already granted we always re-register the
 *   token. FCM tokens can rotate silently; re-registering on each login is the only
 *   reliable way to ensure the server always has a fresh token.
 * - Added a ref guard so we don't double-register on re-renders.
 * - Token is saved to localStorage so logout can clear it server-side.
 */
export default function NotificationSetup({ studentId, type = "student" }) {
  const [status,  setStatus]  = useState("idle");
  const [message, setMessage] = useState(null);
  const registered = useRef(false);

  useEffect(() => {
    if (!studentId) return;
    if (!("Notification" in window)) { setStatus("unsupported"); return; }

    if (Notification.permission === "granted") {
      // Always re-register on mount — FCM tokens rotate and the server may have
      // an outdated one, causing silent notification failures.
      setStatus("granted");
      if (!registered.current) {
        registered.current = true;
        registerToken();
      }
    } else if (Notification.permission === "denied") {
      setStatus("denied");
    }
    // else: permission is "default" — show the Enable button (status stays "idle")
    // eslint-disable-next-line
  }, [studentId]);

  // Listen for foreground (in-app) push messages
  useEffect(() => {
    if (status !== "granted") return;
    const unsub = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || "Notification";
      const body  = payload.notification?.body  || payload.data?.body  || "";
      setMessage({ title, body });
      setTimeout(() => setMessage(null), 6000);
    });
    return () => unsub && unsub();
  }, [status]);

  const registerToken = async () => {
    try {
      const token = await requestNotificationPermission();
      if (!token || !studentId) return;

      // Persist token so the logout handler can send a DELETE to the server
      localStorage.setItem("fcm_token", token);

      await API.post("/qrscan/register-token", { student_id: studentId, token, type });
      setStatus("granted");
      console.log("[FCM] Token registered for student", studentId);
    } catch (e) {
      console.error("[FCM] Token registration error:", e);
    }
  };

  const handleEnable = async () => {
    setStatus("requesting");
    registered.current = true;
    await registerToken();
    if (Notification.permission === "denied") setStatus("denied");
  };

  return (
    <>
      {/* In-app notification toast */}
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

      {/* Show enable button only if permission not yet decided */}
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
          ⚠️ Notifications blocked. Please enable in browser/app settings.
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
