// ── Self-Service Onboarding Route ─────────────────────────────────────────────
// POST /api/onboarding/signup
// Creates: academy record + default branch + super_admin user + 7-day trial
// ──────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const db      = require("../db");
const { Resend } = require("resend");

const DEFAULT_FEATURES = {
  attendance: true, tests: true, expenses: true, admissions: true,
  notifications: true, id_cards: true, qr_scanner: true, reports: true
};

// Derive a URL-safe slug from academy name
function makeSlug(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 40);
}

// Send welcome email (non-blocking, best-effort)
async function sendWelcomeEmail({ ownerName, email, academyName, trialEndsAt }) {
  if (!process.env.RESEND_API_KEY || !email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const trialDate = new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:Arial,sans-serif;">
<div style="max-width:540px;margin:30px auto;background:#0d1117;border-radius:14px;overflow:hidden;border:1px solid #1e2535;">
  <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px;text-align:center;">
    <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:.04em;">EXPONENT</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">Academy OS</div>
  </div>
  <div style="padding:32px;">
    <h2 style="font-size:20px;font-weight:800;color:#eef1fb;margin:0 0 12px;">Welcome, ${ownerName}! 🎉</h2>
    <p style="font-size:15px;color:#8892b5;line-height:1.7;margin:0 0 20px;">
      Your academy <strong style="color:#eef1fb;">${academyName}</strong> is live and ready to use.
      You're on a <strong style="color:#6366f1;">7-day free trial</strong> — no credit card needed.
    </p>
    <div style="background:#131720;border-radius:10px;padding:16px 20px;margin-bottom:24px;border:1px solid #1e2535;">
      <div style="font-size:12px;color:#454f72;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Trial ends on</div>
      <div style="font-size:18px;font-weight:800;color:#6366f1;">${trialDate}</div>
    </div>
    <p style="font-size:14px;color:#8892b5;line-height:1.7;margin:0 0 24px;">
      Start by adding students, setting up batches, and configuring your fee structure.
      Need help? Just reply to this email — we're here.
    </p>
    <div style="text-align:center;padding-top:20px;border-top:1px solid #1e2535;">
      <div style="font-size:12px;color:#454f72;">Exponent Platform · Made with ❤️ in India</div>
    </div>
  </div>
</div>
</body></html>`;
  try {
    await resend.emails.send({
      from: "Exponent Platform <onboarding@resend.dev>",
      to: email,
      subject: `Your academy "${academyName}" is ready — Exponent`,
      html,
    });
  } catch (err) {
    console.error("Welcome email error:", err.message);
  }
}

// POST /api/onboarding/signup
router.post("/signup", async (req, res) => {
  const { owner_name, email, phone, academy_name, password } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!owner_name || !email || !phone || !academy_name || !password)
    return res.status(400).json({ error: "All fields are required." });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  const client = await db.connect?.() ?? null; // use pool directly if connect unavailable
  const useTransaction = !!client;

  try {
    if (useTransaction) await client.query("BEGIN");

    const run = (q, p) => useTransaction ? client.query(q, p) : db.query(q, p);

    // ── Check duplicate email ────────────────────────────────────────────────
    const { rows: existing } = await run(
      "SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      if (useTransaction) await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }

    // ── Generate unique slug ─────────────────────────────────────────────────
    let baseSlug = makeSlug(academy_name);
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const { rows: slugCheck } = await run("SELECT id FROM academies WHERE slug=$1", [slug]);
      if (!slugCheck.length) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    // ── Create academy ───────────────────────────────────────────────────────
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { rows: acadRows } = await run(`
      INSERT INTO academies (
        name, slug, phone, email,
        plan, is_active, trial_ends_at,
        max_students, max_branches, features
      ) VALUES ($1,$2,$3,$4,'trial',true,$5,100,2,$6)
      RETURNING id, name, slug
    `, [
      academy_name.trim(),
      slug,
      phone.trim(),
      email.toLowerCase().trim(),
      trialEndsAt,
      JSON.stringify(DEFAULT_FEATURES)
    ]);
    const academy = acadRows[0];

    // ── Create default branch ────────────────────────────────────────────────
    const { rows: branchRows } = await run(`
      INSERT INTO branches (name, academy_id)
      VALUES ($1, $2)
      RETURNING id
    `, [`${academy_name.trim()} – Main Branch`, academy.id]);
    const branch = branchRows[0];

    // ── Create super_admin user ──────────────────────────────────────────────
    const hash = await bcrypt.hash(password, 10);
    const { rows: userRows } = await run(`
      INSERT INTO users (name, email, password, role, academy_id, branch_id)
      VALUES ($1,$2,$3,'super_admin',$4,$5)
      RETURNING id, name, email, role, academy_id
    `, [
      owner_name.trim(),
      email.toLowerCase().trim(),
      hash,
      academy.id,
      branch.id
    ]);
    const user = userRows[0];

    if (useTransaction) await client.query("COMMIT");

    // ── Send welcome email (async, non-blocking) ─────────────────────────────
    sendWelcomeEmail({
      ownerName: owner_name.trim(),
      email: email.toLowerCase().trim(),
      academyName: academy_name.trim(),
      trialEndsAt,
    });

    res.status(201).json({
      message: "Academy created successfully!",
      academy: { id: academy.id, name: academy.name, slug: academy.slug },
      user:    { id: user.id, name: user.name, email: user.email, role: user.role },
      trial_ends_at: trialEndsAt,
    });
  } catch (err) {
    if (useTransaction) {
      try { await client.query("ROLLBACK"); } catch (_) {}
    }
    console.error("Onboarding signup error:", err.message);
    res.status(500).json({ error: "Failed to create academy. Please try again." });
  } finally {
    if (useTransaction && client.release) client.release();
  }
});

// POST /api/onboarding/lead  — Quick Setup lead capture (stores enquiry)
router.post("/lead", async (req, res) => {
  const { name, phone, academy_name } = req.body;
  if (!phone || !name || !academy_name)
    return res.status(400).json({ error: "name, phone and academy_name are required." });

  try {
    // Store as an inactive academy placeholder so it appears in admin panel
    const slug = makeSlug(academy_name) + "-lead-" + Date.now();
    await db.query(`
      INSERT INTO academies (name, slug, phone, plan, is_active, features)
      VALUES ($1,$2,$3,'lead',false,$4)
      ON CONFLICT DO NOTHING
    `, [
      `[LEAD] ${academy_name.trim()}`,
      slug,
      phone.trim(),
      JSON.stringify(DEFAULT_FEATURES)
    ]);

    res.json({ message: "Lead captured. We'll contact you within 24 hours!" });
  } catch (err) {
    console.error("Lead capture error:", err.message);
    // Non-critical — still return success to user
    res.json({ message: "Thank you! We'll contact you within 24 hours." });
  }
});

module.exports = router;
