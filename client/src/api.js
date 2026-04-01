import axios from "axios";

// ── Primary API URL — uses custom domain, falls back to Render URL ──────────
const API_BASE = "https://api.exponentgrow.in/api";
const API_REFRESH_URL = "https://api.exponentgrow.in/api/auth/refresh";

const API = axios.create({
  baseURL: API_BASE,
});

// ── Request interceptor ──────────────────────────────────────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — silent token refresh ──────────────────────────────
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

    if (
      err.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes("/auth/refresh")
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
