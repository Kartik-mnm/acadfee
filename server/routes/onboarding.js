// ── Self-Service Onboarding Route ────────────────────────────────────────────────────────
const express   = require("express");
const router    = express.Router();
const bcrypt    = require("bcryptjs");
const db        = require("../db");
const { Resend } = require("resend");

const DEFAULT_FEATURES = {
  attendance: true, tests: true, expenses: true, admissions: true,
  notifications: true, id_cards: true, qr_scanner: true, reports: true
};

function makeSlug(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 40);
}

// ── Welcome email ───────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ ownerName, email, academyName, trialEndsAt }) {
  if (!process.env.RESEND_API_KEY || !email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const trialDate = new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:Arial,sans-serif;">
<div style="max-width:540px;margin:30px auto;background:#0d1117;border-radius:14px;overflow:hidden;border:1px solid #1e2535;">
  <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px;text-align:center;">
    <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:.04em;">EXPONENT</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">Academy OS</div>
  </div>
  <div style="padding:32px;">
    <h2 style="font-size:20px;font-weight:800;color:#eef1fb;margin:0 0 12px;">Welcome, ${ownerName}! 🎉</h2>
    <p style="font-size:15px;color:#8892b5;line-height:1.7;margin:0 0 20px;">
      Your academy <strong style="color:#eef1fb;">${academyName}</strong> is live and ready.
      You're on a <strong style="color:#6366f1;">7-day free trial</strong> — no credit card needed.
    </p>
    <div style="background:#131720;border-radius:10px;padding:16px 20px;margin-bottom:24px;border:1px solid #1e2535;">
      <div style="font-size:12px;color:#454f72;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Trial ends on</div>
      <div style="font-size:18px;font-weight:800;color:#6366f1;">${trialDate}</div>
    </div>
    <p style="font-size:14px;color:#8892b5;line-height:1.7;margin:0 0 24px;">
      Start by adding students, setting up batches, and configuring your fee structure.
      Need help? Just reply to this email.
    </p>
    <div style="text-align:center;padding-top:20px;border-top:1px solid #1e2535;">
      <div style="font-size:12px;color:#454f72;">Exponent Platform · Made with ❤️ in India</div>
    </div>
  </div>
</div></body></html>`;
  try {
    await resend.emails.send({
      from: "Exponent Platform <onboarding@resend.dev>",
      to: email,
      subject: `Your academy "${academyName}" is ready — Exponent`,
      html,
    });
    console.log("[onboarding] Welcome email sent to", email);
  } catch (err) {
    console.error("Welcome email error:", err.message);
  }
}

// ── WhatsApp notification to platform owner ───────────────────────────────────────
// Uses CallMeBot API (free, no account needed — just needs one-time WhatsApp opt-in)
async function sendWhatsAppAlert({ ownerName, academyName, phone, email }) {
  const waPhone  = process.env.OWNER_WHATSAPP_NUMBER; // e.g. "919876543210"
  const apiKey   = process.env.CALLMEBOT_API_KEY;     // from callmebot.com
  if (!waPhone || !apiKey) return;
  const message = encodeURIComponent(
    `🎉 New Academy Signup!\n\nAcademy: ${academyName}\nOwner: ${ownerName}\nPhone: ${phone}\nEmail: ${email}\n\nLogin to your platform panel to view.`
  );
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${waPhone}&text=${message}&apikey=${apiKey}`);
    console.log("[onboarding] WhatsApp alert sent");
  } catch (err) {
    console.error("WhatsApp alert error:", err.message);
  }
}

// POST /api/onboarding/signup
router.post("/signup", async (req, res) => {
  const { owner_name, email, phone, academy_name, password } = req.body;

  if (!owner_name || !email || !phone || !academy_name || !password)
    return res.status(400).json({ error: "All fields are required." });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Check duplicate email
    const { rows: existing } = await client.query(
      "SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }

    // Generate unique slug
    let slug = makeSlug(academy_name), suffix = 1;
    while (true) {
      const { rows } = await client.query("SELECT id FROM academies WHERE slug=$1", [slug]);
      if (!rows.length) break;
      slug = `${makeSlug(academy_name)}-${suffix++}`;
    }

    // Create academy
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { rows: acadRows } = await client.query(`
      INSERT INTO academies (name, slug, phone, email, plan, is_active, trial_ends_at, max_students, max_branches, features)
      VALUES ($1,$2,$3,$4,'trial',true,$5,100,2,$6)
      RETURNING id, name, slug
    `, [academy_name.trim(), slug, phone.trim(), email.toLowerCase().trim(), trialEndsAt, JSON.stringify(DEFAULT_FEATURES)]);
    const academy = acadRows[0];

    // Create default branch
    const { rows: branchRows } = await client.query(
      `INSERT INTO branches (name, academy_id) VALUES ($1,$2) RETURNING id`,
      [`${academy_name.trim()} – Main Branch`, academy.id]
    );

    // Create super_admin user
    const hash = await bcrypt.hash(password, 10);
    const { rows: userRows } = await client.query(`
      INSERT INTO users (name, email, password, role, academy_id, branch_id)
      VALUES ($1,$2,$3,'super_admin',$4,$5)
      RETURNING id, name, email, role, academy_id
    `, [owner_name.trim(), email.toLowerCase().trim(), hash, academy.id, branchRows[0].id]);

    await client.query("COMMIT");

    // Non-blocking notifications
    sendWelcomeEmail({ ownerName: owner_name.trim(), email: email.toLowerCase().trim(), academyName: academy_name.trim(), trialEndsAt });
    sendWhatsAppAlert({ ownerName: owner_name.trim(), academyName: academy_name.trim(), phone: phone.trim(), email: email.toLowerCase().trim() });

    res.status(201).json({
      message: "Academy created successfully!",
      academy: { id: academy.id, name: academy.name, slug: academy.slug },
      user:    { id: userRows[0].id, name: userRows[0].name, email: userRows[0].email, role: userRows[0].role },
      trial_ends_at: trialEndsAt,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("Onboarding signup error:", err.message);
    res.status(500).json({ error: "Failed to create academy. Please try again." });
  } finally {
    client.release();
  }
});

// POST /api/onboarding/lead
router.post("/lead", async (req, res) => {
  const { name, phone, academy_name } = req.body;
  if (!phone || !name || !academy_name)
    return res.status(400).json({ error: "name, phone and academy_name are required." });
  try {
    const slug = makeSlug(academy_name) + "-lead-" + Date.now();
    await db.query(`
      INSERT INTO academies (name, slug, phone, plan, is_active, features)
      VALUES ($1,$2,$3,'lead',false,$4) ON CONFLICT DO NOTHING
    `, [`[LEAD] ${academy_name.trim()}`, slug, phone.trim(), JSON.stringify(DEFAULT_FEATURES)]);
    // Also notify platform owner on WhatsApp for leads
    sendWhatsAppAlert({ ownerName: name.trim(), academyName: `[LEAD] ${academy_name.trim()}`, phone: phone.trim(), email: "" });
    res.json({ message: "Lead captured. We'll contact you within 24 hours!" });
  } catch (err) {
    console.error("Lead capture error:", err.message);
    res.json({ message: "Thank you! We'll contact you within 24 hours." });
  }
});

module.exports = router;
