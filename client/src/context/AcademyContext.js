import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AcademyCtx = createContext(null);

function resolveSlug() {
  const host = window.location.hostname;

  // Never treat hosting platform domains as academy subdomains
  // onrender.com, netlify.app, localhost are infrastructure — not academy URLs
  const isHostingDomain =
    host.includes("onrender.com") ||
    host.includes("netlify.app") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (!isHostingDomain) {
    // Real custom domain e.g. "nishchay.exponent.app"
    const parts = host.split(".");
    if (
      parts.length >= 3 &&
      parts[0] !== "www" &&
      parts[0] !== "app" &&
      parts[0] !== "platform"
    ) {
      return parts[0]; // e.g. "nishchay"
    }
  }

  // Fall back to localStorage (set by slug switcher in console)
  const stored = localStorage.getItem("academy_slug");
  if (stored) return stored;

  // Final fallback
  return "nishchay";
}

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

export function AcademyProvider({ children }) {
  const [academy, setAcademy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = resolveSlug();
    console.log("[Academy] Loading slug:", slug);

    axios
      .get(`https://acadfee.onrender.com/api/academy/config?slug=${slug}`)
      .then(({ data }) => {
        setAcademy(data);
        applyTheme(data.primary_color, data.accent_color);
        localStorage.setItem("academy_slug", slug);
      })
      .catch(() => {
        // Fallback — Nishchay defaults so the app still works
        setAcademy({
          id: 1, name: "Nishchay Academy", slug: "nishchay",
          logo_url: null, tagline: "",
          primary_color: "2563EB", accent_color: "38BDF8",
          city: "Nagpur", phone: "", email: "", address: "",
          features: {
            attendance: true, tests: true, expenses: true,
            admissions: true, notifications: true,
            id_cards: true, qr_scanner: true, reports: true,
          },
          plan: "pro", is_active: true,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AcademyCtx.Provider value={{ academy, loading }}>
      {children}
    </AcademyCtx.Provider>
  );
}

export const useAcademy = () => useContext(AcademyCtx);
