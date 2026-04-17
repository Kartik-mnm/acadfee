import axios from "axios";

const API_BASE        = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "https://api.exponentgrow.in/api";
const API_REFRESH_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/auth/refresh` : "https://api.exponentgrow.in/api/auth/refresh";

const API = axios.create({ baseURL: API_BASE });

// ── Request interceptor — attach token ───────────────────────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Routes that should NEVER trigger auto-refresh / forceLogout ──────────────
// A 401 on login means "wrong password" — not an expired session.
// We must let these errors pass straight through to the calling component.
const AUTH_ROUTES = [
  "/auth/login",
  "/auth/student-login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/refresh",
];
const isAuthRoute = (url = "") => AUTH_ROUTES.some((r) => url.includes(r));

// ── Response interceptor — silent token refresh for expired sessions ─────────
let isRefreshing = false;
let pendingQueue = [];

function processQueue(error, token = null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  pendingQueue = [];
}

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // ── IMPORTANT: never intercept auth routes ────────────────────────────────
    // Wrong password on /auth/login returns 401. If we intercept that,
    // we'd try to refresh a non-existent session and end up calling
    // forceLogout() → window.location.href = "/" → looks like a crash.
    // Just reject straight away so Login.js catch block can show the error.
    if (isAuthRoute(original?.url)) {
      return Promise.reject(err);
    }

    // Only attempt session refresh on 401 for non-auth routes
    if (
      err.response?.status === 401 &&
      !original._retried
    ) {
      original._retried = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            return API(original);
          })
          .catch((e) => Promise.reject(e));
      }

      isRefreshing = true;

      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        // No session at all — force logout only for protected routes
        forceLogout();
        return Promise.reject(err);
      }

      try {
        const { data } = await axios.post(API_REFRESH_URL, { refreshToken });
        localStorage.setItem("token", data.token);
        localStorage.setItem("refreshToken", data.refreshToken);
        processQueue(null, data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return API(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        forceLogout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

function forceLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("fcm_token");
  window.location.href = "/";
}

export default API;
