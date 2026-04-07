export default function TermsOfService() {
  const updated = "April 2026";

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
    updated: { fontSize: 13, color: "#64748b", marginBottom: 40 },
    h2: { fontSize: 18, fontWeight: 700, marginTop: 36, marginBottom: 10, color: "#0f172a" },
    p: { marginBottom: 14 },
    divider: { borderTop: "1px solid #e2e8f0", margin: "40px 0" },
    contact: {
      background: "#f8fafc", border: "1px solid #e2e8f0",
      borderRadius: 12, padding: "20px 24px",
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

      <h1 style={s.h1}>Terms of Service</h1>
      <div style={s.updated}>Last updated: {updated}</div>

      <p style={s.p}>
        Welcome to Exponent Platform. By accessing or using our application, you agree to comply with and be bound by the following terms and conditions.
      </p>

      <h2 style={s.h2}>1. Acceptance of Terms</h2>
      <p style={s.p}>
        By using Exponent Platform, you agree to these Terms of Service. If you do not agree to these terms, you must not use our services.
      </p>

      <h2 style={s.h2}>2. Description of Service</h2>
      <p style={s.p}>
        Exponent Platform provides academy management software allowing administrators to manage students, attendance, performance, and fees.
      </p>

      <h2 style={s.h2}>3. User Responsibilities</h2>
      <p style={s.p}>
        You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to use the platform only for lawful purposes.
      </p>

      <h2 style={s.h2}>4. Termination</h2>
      <p style={s.p}>
        We reserve the right to suspend or terminate your access to the platform at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the platform.
      </p>

      <h2 style={s.h2}>5. Modifications to Terms</h2>
      <p style={s.p}>
        We may update these terms from time to time. Continued use of the platform after any such changes shall constitute your consent to such changes.
      </p>

      <div style={s.divider} />

      <div style={s.contact}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Contact Us</div>
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
