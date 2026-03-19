import { createContext, useContext, useState } from "react";
import API from "../api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });

  // Called after a successful login — stores both tokens + user info
  const login = (token, userData, refreshToken) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      const storedUser    = JSON.parse(localStorage.getItem("user"));
      const fcmToken      = localStorage.getItem("fcm_token");
      const refreshToken  = localStorage.getItem("refreshToken");

      if (storedUser?.role === "student" && fcmToken) {
        // Tell the server to un-register this device's FCM token
        await API.post("/auth/student-logout", {
          student_id:   storedUser.id,
          token:        fcmToken,
          type:         "student",
          refreshToken, // also invalidates the refresh token server-side
        }).catch(() => {});
      } else if (refreshToken) {
        // For admin/manager: just invalidate the refresh token
        await API.post("/auth/logout", { refreshToken }).catch(() => {});
      }
    } catch (_) {}

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("fcm_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
