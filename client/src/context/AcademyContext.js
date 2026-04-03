import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AcademyCtx = createContext(null);

const API_BASE = "https://api.exponentgrow.in";

// ── localStorage cache keys ──────────────────────────────────────────────────
// We cache branding so new tabs / refreshes show the right logo instantly,
// even before React finishes fetching from the server.
const CACHE_SLUG    = "academy_slug";
const CACHE_LOGO    = "academy_logo_url";
const CACHE_FAVICON = "academy_favicon_url";
const CACHE_NAME    = "academy_name";
const CACHE_PRIMARY = "academy_primary_color";
const CACHE_ACCENT  = "academy_accent_color";

function applyTheme(primary_color, accent_color) {
  if (!primary_color) return;
  const root    = document.documentElement;
  const primary = primary_color.startsWith("#") ? primary_color : `#${primary_color}`;
  const accent  = accent_color
    ? (accent_color.startsWith("#") ? accent_color : `#${accent_color}`)
    : primary;
  root.style.setProperty("--blue-600",   primary);
  root.style.setProperty("--blue-500",   primary);
  root.style.setProperty("--blue-400",   accent);
  root.style.setProperty("--accent",     primary);
  root.style.setProperty("--accent-dim", accent);
}

function applyTitle(name) {
  document.title = name?.trim() || "Exponent App";
}

function applyFavicon(faviconUrl) {
  const existing = document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon']");
  existing.forEach(el => el.parentNode.removeChild(el));
  if (!faviconUrl) return;
  const link = document.createElement("link");
  link.rel  = "icon";
  link.type = faviconUrl.endsWith(".ico") ? "image/x-icon" : "image/png";
  link.href = faviconUrl + "?v=" + Date.now();
  document.head.appendChild(link);
}

// Apply branding from cache immediately (called at module load time so it's
// instant — before React even mounts, so no flicker on refresh/new tab)
function applyCachedBranding() {
  const name    = localStorage.getItem(CACHE_NAME);
  const favicon = localStorage.getItem(CACHE_FAVICON);
  const primary = localStorage.getItem(CACHE_PRIMARY);
  const accent  = localStorage.getItem(CACHE_ACCENT);
  if (name)    applyTitle(name);
  if (favicon) applyFavicon(favicon);
  if (primary) applyTheme(primary, accent);
}
applyCachedBranding(); // ← runs immediately when this module is imported

function saveBrandingCache(data) {
  if (data.slug)          localStorage.setItem(CACHE_SLUG,    data.slug);
  if (data.name)          localStorage.setItem(CACHE_NAME,    data.name);
  if (data.logo_url)      localStorage.setItem(CACHE_LOGO,    data.logo_url);
  if (data.favicon_url)   localStorage.setItem(CACHE_FAVICON, data.favicon_url);
  if (data.primary_color) localStorage.setItem(CACHE_PRIMARY, data.primary_color);
  if (data.accent_color)  localStorage.setItem(CACHE_ACCENT,  data.accent_color);
  // Clear favicon cache if explicitly set to null/empty
  if (!data.favicon_url)  localStorage.removeItem(CACHE_FAVICON);
  if (!data.logo_url)     localStorage.removeItem(CACHE_LOGO);
}

export function AcademyProvider({ children }) {
  const [academy, setAcademy] = useState(() => {
    // Seed state from cache so UI renders correctly immediately
    const name    = localStorage.getItem(CACHE_NAME);
    const logo    = localStorage.getItem(CACHE_LOGO);
    const favicon = localStorage.getItem(CACHE_FAVICON);
    const primary = localStorage.getItem(CACHE_PRIMARY);
    const accent  = localStorage.getItem(CACHE_ACCENT);
    if (!name) return null;
    return {
      name, logo_url: logo, favicon_url: favicon,
      primary_color: primary, accent_color: accent,
      features: {
        attendance: true, tests: true, expenses: true, admissions: true,
        notifications: true, id_cards: true, qr_scanner: true, reports: true,
      },
      plan: "trial", is_active: true,
    };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let storedUser = null;
    try { storedUser = JSON.parse(localStorage.getItem("user")); } catch {}
    const academyId = storedUser?.academy_id;

    const host = window.location.hostname;
    const isHostingDomain =
      host.includes("onrender.com") ||
      host.includes("netlify.app") ||
      host.includes("vercel.app") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.includes("exponentgrow.in");

    let slugFromHost = null;
    if (!isHostingDomain) {
      const parts = host.split(".");
      if (parts.length >= 3 && !["www","app","platform"].includes(parts[0])) {
        slugFromHost = parts[0];
      }
    }

    const storedSlug = localStorage.getItem(CACHE_SLUG);

    const fetchBySlug = (slug) =>
      axios.get(`${API_BASE}/api/academy/config?slug=${slug}`).then(r => r.data);

    const fetchById = (id) =>
      axios.get(`${API_BASE}/api/academy/config-by-id?id=${id}`).then(r => r.data);

    const applyAndStore = (data) => {
      setAcademy(data);
      applyTheme(data.primary_color, data.accent_color);
      applyTitle(data.name);
      applyFavicon(data.favicon_url || null);
      saveBrandingCache(data); // ← cache for future visits / new tabs
    };

    const onError = () => {
      // Apply cached branding so the UI isn't completely blank on error
      const cachedName    = localStorage.getItem(CACHE_NAME);
      const cachedFavicon = localStorage.getItem(CACHE_FAVICON);
      const cachedPrimary = localStorage.getItem(CACHE_PRIMARY);
      const cachedAccent  = localStorage.getItem(CACHE_ACCENT);
      const cachedLogo    = localStorage.getItem(CACHE_LOGO);

      if (cachedFavicon) applyFavicon(cachedFavicon);
      if (cachedPrimary) applyTheme(cachedPrimary, cachedAccent);
      if (cachedName)    applyTitle(cachedName);

      setAcademy({
        id: null,
        name:          cachedName     || "My Academy",
        logo_url:      cachedLogo     || null,
        favicon_url:   cachedFavicon  || null,
        primary_color: cachedPrimary  || "2563EB",
        accent_color:  cachedAccent   || "38BDF8",
        slug: null, tagline: "", city: "", phone: "", email: "", address: "",
        features: {
          attendance: true, tests: true, expenses: true, admissions: true,
          notifications: true, id_cards: true, qr_scanner: true, reports: true,
        },
        plan: "trial", is_active: true,
      });
    };

    const run = async () => {
      try {
        if (academyId) {
          applyAndStore(await fetchById(academyId));
        } else if (slugFromHost) {
          applyAndStore(await fetchBySlug(slugFromHost));
        } else if (storedSlug) {
          applyAndStore(await fetchBySlug(storedSlug));
        } else {
          onError();
        }
      } catch {
        onError();
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // Also expose a refresh function so Settings page can force re-apply after saving
  const refreshAcademy = async () => {
    let storedUser = null;
    try { storedUser = JSON.parse(localStorage.getItem("user")); } catch {}
    const academyId = storedUser?.academy_id;
    if (!academyId) return;
    try {
      const data = await axios.get(`${API_BASE}/api/academy/config-by-id?id=${academyId}`).then(r => r.data);
      setAcademy(data);
      applyTheme(data.primary_color, data.accent_color);
      applyTitle(data.name);
      applyFavicon(data.favicon_url || null);
      saveBrandingCache(data);
    } catch {}
  };

  return (
    <AcademyCtx.Provider value={{ academy, loading, refreshAcademy }}>
      {children}
    </AcademyCtx.Provider>
  );
}

export const useAcademy = () => useContext(AcademyCtx);
