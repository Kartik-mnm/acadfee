import { createContext, useContext, useState } from "react";
import API from "../api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });

  const login = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  // #36 — On logout, clear this device's FCM token from the server
  // so this device no longer receives notifications for this student.
  const logout = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const fcmToken   = localStorage.getItem("fcm_token");

      if (storedUser?.role === "student" && fcmToken) {
        // Tell the server to un-register this device's FCM token
        await API.post("/auth/student-logout", {
          student_id: storedUser.id,
          token:      fcmToken,
          type:       "student",
        }).catch(() => {}); // non-blocking — don't block logout on failure
      }
    } catch (_) {}

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("fcm_token"); // clear stored FCM token for this device
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
