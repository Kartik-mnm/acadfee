export default function PrivacyPolicy() {
  const updated = "2 April 2026";

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
    ul: { paddingLeft: 22, marginBottom: 14 },
    li: { marginBottom: 6 },
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

      <h1 style={s.h1}>Privacy Policy</h1>
      <div style={s.updated}>Last updated: {updated}</div>

      <p style={s.p}>
        Exponent Platform (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is an academy management software operated by
        Kartik Ninawe, Nagpur, Maharashtra, India. This Privacy Policy explains how we collect,
        use, store, and protect information when you use our platform at{" "}
        <a href="https://app.exponentgrow.in" style={s.a}>app.exponentgrow.in</a> and the
        associated API at <a href="https://api.exponentgrow.in" style={s.a}>api.exponentgrow.in</a>.
      </p>

      <h2 style={s.h2}>1. Information we collect</h2>
      <p style={s.p}>We collect the following categories of information:</p>
      <ul style={s.ul}>
        <li style={s.li}><strong>Academy administrators:</strong> name, email address, password (hashed), academy name, branch details.</li>
        <li style={s.li}><strong>Students:</strong> name, phone number, email address, batch/branch enrollment, attendance records, fee and payment history, test scores, parent name, and optional profile photo.</li>
        <li style={s.li}><strong>Device tokens:</strong> Firebase Cloud Messaging (FCM) tokens for push notification delivery to students and parents.</li>
        <li style={s.li}><strong>Usage data:</strong> server logs including IP addresses, timestamps, and API endpoint access &mdash; retained for up to 30 days.</li>
      </ul>

      <h2 style={s.h2}>2. How we use your information</h2>
      <ul style={s.ul}>
        <li style={s.li}>To provide and operate the academy management platform.</li>
        <li style={s.li}>To send attendance and fee-due push notifications to students and parents.</li>
        <li style={s.li}>To generate fee records, payment receipts, and academic performance reports.</li>
        <li style={s.li}>To authenticate users and maintain session security.</li>
        <li style={s.li}>To send password reset emails via Resend.</li>
        <li style={s.li}>To improve the platform through aggregated, anonymised usage analysis.</li>
      </ul>
      <p style={s.p}>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes.</p>

      <h2 style={s.h2}>3. Data storage and security</h2>
      <p style={s.p}>
        All data is stored in a PostgreSQL database. Connections are encrypted via TLS.
        Passwords are hashed using bcrypt and are never stored in plain text.
        Authentication tokens expire after 12 hours (access) and 30 days (refresh).
      </p>
      <p style={s.p}>
        We follow industry-standard security practices; however, no system is completely secure.
        We recommend academy administrators use strong passwords and keep their login credentials confidential.
      </p>

      <h2 style={s.h2}>4. Data retention</h2>
      <p style={s.p}>
        Student and fee records are retained for the lifetime of the academy account. If an
        academy account is deleted, all associated data is permanently removed within 30 days.
        Server access logs are retained for 30 days then deleted automatically.
      </p>

      <h2 style={s.h2}>5. Third-party services</h2>
      <p style={s.p}>We use the following third-party services to operate the platform:</p>
      <ul style={s.ul}>
        <li style={s.li}><strong>Render</strong> &mdash; application hosting (render.com)</li>
        <li style={s.li}><strong>Neon / Supabase</strong> &mdash; PostgreSQL database hosting</li>
        <li style={s.li}><strong>Firebase / Google</strong> &mdash; push notification delivery (FCM)</li>
        <li style={s.li}><strong>Resend</strong> &mdash; transactional email delivery</li>
        <li style={s.li}><strong>Cloudinary</strong> &mdash; student photo and logo storage (if enabled)</li>
      </ul>
      <p style={s.p}>
        Each of these services has its own privacy policy. We only share the minimum data necessary
        for each service to function.
      </p>

      <h2 style={s.h2}>6. Cookies and local storage</h2>
      <p style={s.p}>
        We use browser <code>localStorage</code> to store authentication tokens and user
        preferences (such as theme). We do not use advertising cookies or third-party tracking pixels.
      </p>

      <h2 style={s.h2}>7. Children&rsquo;s privacy</h2>
      <p style={s.p}>
        Our platform is used by educational institutions to manage student records, which may
        include minors. Academy administrators are responsible for obtaining appropriate consent
        from parents or guardians before entering student data into the platform, in accordance
        with applicable law.
      </p>

      <h2 style={s.h2}>8. Your rights</h2>
      <p style={s.p}>You have the right to:</p>
      <ul style={s.ul}>
        <li style={s.li}>Request access to or correction of your personal data.</li>
        <li style={s.li}>Request deletion of your account and associated data.</li>
        <li style={s.li}>Opt out of push notifications at any time via your device settings.</li>
      </ul>
      <p style={s.p}>To exercise these rights, contact us using the details below.</p>

      <h2 style={s.h2}>9. Changes to this policy</h2>
      <p style={s.p}>
        We may update this policy from time to time. We will notify academy administrators of
        significant changes via email or an in-app banner. Continued use of the platform after
        changes constitutes acceptance.
      </p>

      <div style={s.divider} />

      <div style={s.contact}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>10. Contact us</div>
        <p style={{ ...s.p, marginBottom: 6 }}>For privacy-related questions or data requests:</p>
        <div style={{ fontSize: 14, lineHeight: 2 }}>
          <div><strong>Kartik Ninawe</strong></div>
          <div>Nagpur, Maharashtra, India</div>
          <div>
            Email:{" "}
            <a href="mailto:kartik@exponentgrow.in" style={s.a}>kartik@exponentgrow.in</a>
          </div>
          <div>
            Phone / WhatsApp:{" "}
            <a href="tel:+918956419453" style={s.a}>+91 89564 19453</a>
          </div>
          <div>
            Website:{" "}
            <a href="https://exponentgrow.in" style={s.a}>exponentgrow.in</a>
          </div>
        </div>
      </div>

      <div style={s.footer}>
        &copy; {new Date().getFullYear()} Exponent Platform &nbsp;&middot;&nbsp;
        <a href="/" style={{ ...s.a, color: "#94a3b8" }}>Back to app</a>
        &nbsp;&middot;&nbsp;
        <a href="https://wa.me/918956419453" style={{ ...s.a, color: "#94a3b8" }}>WhatsApp support</a>
      </div>
    </div>
  );
}
