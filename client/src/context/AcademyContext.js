import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AcademyCtx = createContext(null);

// Always use the custom domain — never the old Render URL
const API_BASE = "https://api.exponentgrow.in";

function applyTheme(primary_color, accent_color) {
  if (!primary_color) return;
  const root = document.documentElement;
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
  document.title = name && name.trim() ? name.trim() : "Exponent App";
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

export function AcademyProvider({ children }) {
  const [academy, setAcademy] = useState(null);
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
      host.includes("exponentgrow.in"); // also treat our custom domain as hosting domain

    let slugFromHost = null;
    if (!isHostingDomain) {
      const parts = host.split(".");
      if (parts.length >= 3 && !["www","app","platform"].includes(parts[0])) {
        slugFromHost = parts[0];
      }
    }

    const storedSlug = localStorage.getItem("academy_slug");

    const fetchBySlug = (slug) =>
      axios.get(`${API_BASE}/api/academy/config?slug=${slug}`).then(r => r.data);

    const fetchById = (id) =>
      axios.get(`${API_BASE}/api/academy/config-by-id?id=${id}`).then(r => r.data);

    const applyAndStore = (data) => {
      setAcademy(data);
      applyTheme(data.primary_color, data.accent_color);
      applyTitle(data.name);
      applyFavicon(data.favicon_url || null);
      if (data.slug) localStorage.setItem("academy_slug", data.slug);
    };

    const onError = () => {
      applyTitle("Exponent App");
      applyFavicon(null);
      setAcademy({
        id: null, name: "My Academy", slug: null,
        logo_url: null, favicon_url: null, tagline: "",
        primary_color: "2563EB", accent_color: "38BDF8",
        city: "", phone: "", email: "", address: "",
        features: {
          attendance: true, tests: true, expenses: true,
          admissions: true, notifications: true,
          id_cards: true, qr_scanner: true, reports: true,
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

  return (
    <AcademyCtx.Provider value={{ academy, loading }}>
      {children}
    </AcademyCtx.Provider>
  );
}

export const useAcademy = () => useContext(AcademyCtx);
