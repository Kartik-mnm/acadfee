export default function Contact() {
  const s = {
    wrap: {
      maxWidth: 760,
      margin: "0 auto",
      padding: "48px 24px 80px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#1a1a2e",
      lineHeight: 1.75,
      fontSize: 15,
      background: "#fff",
      minHeight: "100vh",
    },
    logo: {
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 40,
    },
    logoMark: {
      width: 36, height: 36, borderRadius: 8,
      background: "#1d4ed8", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 18,
    },
    logoText: { fontWeight: 700, fontSize: 18, color: "#1a1a2e" },
    h1: { fontSize: 30, fontWeight: 800, marginBottom: 6, color: "#0f172a" },
    p: { marginBottom: 14 },
    contact: {
      background: "#f8fafc", border: "1px solid #e2e8f0",
      borderRadius: 12, padding: "20px 24px", marginTop: 40,
    },
    footer: { marginTop: 48, fontSize: 12, color: "#94a3b8", textAlign: "center" },
    a: { color: "#1d4ed8", textDecoration: "none" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.logo}>
        <div style={s.logoMark}>E</div>
        <span style={s.logoText}>Exponent Platform</span>
      </div>

      <h1 style={s.h1}>Contact Us</h1>

      <p style={s.p}>
        We are here to help! If you have any questions, feedback, or need support with the platform, please contact us using the information below. We aim to respond to all inquiries as soon as possible.
      </p>

      <div style={s.contact}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Contact details</div>
        <div style={{ fontSize: 14, lineHeight: 2 }}>
          <div><strong>Kartik Ninawe</strong></div>
          <div>Nagpur, Maharashtra, India</div>
          <div>
            Email:{" "}
            <a href="mailto:aspirantth@gmail.com" style={s.a}>aspirantth@gmail.com</a>
          </div>
          <div>
            Phone:{" "}
            <a href="tel:+918956419453" style={s.a}>+91 89564 19453</a>
          </div>
        </div>
      </div>

      <div style={s.footer}>
        &copy; {new Date().getFullYear()} Exponent Platform &nbsp;&middot;&nbsp;
        <a href="/" style={{ ...s.a, color: "#94a3b8" }}>Back to app</a>
      </div>
    </div>
  );
}
