import axios from "axios";

const API = axios.create({
  baseURL: "https://acadfee.onrender.com/api",
});

// ── Request interceptor ──────────────────────────────────────────────────────
// Attach the current access token to every request automatically.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
// When any request comes back with 401 (token expired):
//   1. Silently call POST /auth/refresh with the stored refreshToken
//   2. Save the new access token
//   3. Retry the original request — the user notices nothing
//   4. Only if the refresh itself fails do we log the user out
let isRefreshing = false;               // prevents multiple simultaneous refresh calls
let pendingQueue = [];                  // queues failed requests while refresh is in-flight

function processQueue(error, token = null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  pendingQueue = [];
}

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only attempt refresh on 401, and never retry the refresh call itself
    if (
      err.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retried = true;

      if (isRefreshing) {
        // Another refresh is already in flight — queue this request
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
        // No refresh token stored — must log in again
        forceLogout();
        return Promise.reject(err);
      }

      try {
        const { data } = await axios.post(
          "https://acadfee.onrender.com/api/auth/refresh",
          { refreshToken }
        );

        // Save the rotated tokens
        localStorage.setItem("token", data.token);
        localStorage.setItem("refreshToken", data.refreshToken);

        // Unblock queued requests with the new token
        processQueue(null, data.token);

        // Retry the original request
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
