const db = require("./db");
const bcrypt = require("bcryptjs");

async function runMigration() {
  async function safe(sql, label, params) {
    try {
      await db.query(sql, params);
    } catch (e) {
      if (!e.message?.includes("already exists") && !e.message?.includes("duplicate")) {
        console.warn(`[migrate] ${label || ""}: ${e.message}`);
      }
    }
  }

  try {
    // ── Core tables ────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS academies (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE,
      logo_url TEXT, favicon_url TEXT, tagline TEXT,
      primary_color TEXT DEFAULT '2563EB', accent_color TEXT DEFAULT '38BDF8',
      address TEXT, phone TEXT, phone2 TEXT, email TEXT, website TEXT, city TEXT, state TEXT,
      pincode TEXT, features JSONB DEFAULT '{}', plan TEXT DEFAULT 'trial',
      is_active BOOLEAN DEFAULT true, trial_ends_at TIMESTAMPTZ,
      max_students INT DEFAULT 100, max_branches INT DEFAULT 2,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create academies");

    for (const col of [
      "logo_url TEXT", "favicon_url TEXT", "tagline TEXT",
      "primary_color TEXT DEFAULT '2563EB'", "accent_color TEXT DEFAULT '38BDF8'",
      "address TEXT", "phone2 TEXT", "website TEXT", "city TEXT", "state TEXT", "pincode TEXT",
      "max_students INT DEFAULT 100", "max_branches INT DEFAULT 2",
      "updated_at TIMESTAMPTZ DEFAULT NOW()", "roll_prefix TEXT DEFAULT ''",
    ]) {
      await safe(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS ${col}`, `academies.${col.split(" ")[0]}`);
    }

    // ── Users ───────────────────────────────────────────────────────────────────
    await safe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "users.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id)`, "idx_users_academy");

    // ── Branches ────────────────────────────────────────────────────────────────
    await safe(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "branches.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_branches_academy ON branches(academy_id)`, "idx_branches_academy");
    await safe(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS roll_prefix TEXT DEFAULT ''`, "branches.roll_prefix");

    // ── Students ────────────────────────────────────────────────────────────────
    await safe(`ALTER TABLE students ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "students.academy_id");
    for (const col of [
      "photo_url TEXT", "roll_no TEXT", "parent_name TEXT",
      "login_enabled BOOLEAN DEFAULT false", "login_password TEXT",
      "login_device_limit INT DEFAULT 2", "fcm_token TEXT", "parent_fcm_token TEXT",
      "discount NUMERIC DEFAULT 0", "fee_type TEXT DEFAULT 'monthly'", "due_day INT DEFAULT 10",
      "discount_reason TEXT", "address TEXT", "dob DATE", "gender TEXT", "admission_fee NUMERIC DEFAULT 0",
    ]) {
      await safe(`ALTER TABLE students ADD COLUMN IF NOT EXISTS ${col}`, `students.${col.split(" ")[0]}`);
    }
    await safe(`CREATE INDEX IF NOT EXISTS idx_students_academy ON students(academy_id)`, "idx_students_academy");

    // ── Batches ──────────────────────────────────────────────────────────────────
    for (const col of [
      "start_date DATE", "end_date DATE",
      "fee_quarterly NUMERIC", "fee_yearly NUMERIC", "fee_course NUMERIC",
    ]) {
      await safe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ${col}`, `batches.${col.split(" ")[0]}`);
    }

    // ── Auth tables ─────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL,
      payload JSONB, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create refresh_tokens");

    await safe(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY, user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create password_reset_tokens");

    // ── Platform admins ─────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS platform_admins (
      id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_admins");
    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS favicon_url TEXT`, "platform_admins.favicon_url");
    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS logo_url TEXT`, "platform_admins.logo_url");

    // FIX: use parameterized query — bcrypt hashes contain $ which breaks interpolated SQL
    const hash = await bcrypt.hash("Exponent@2025", 10);
    await safe(
      `INSERT INTO platform_admins (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      "upsert platform_admin",
      ["Kartik", "kartik@exponent.app", hash]
    );

    // ── Expenses ─────────────────────────────────────────────────────────────────
    for (const col of [
      "title TEXT", "notes TEXT", "description TEXT", "paid_to TEXT",
      "academy_id INT REFERENCES academies(id) ON DELETE SET NULL",
    ]) {
      await safe(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ${col}`, `expenses.${col.split(" ")[0]}`);
    }
    await safe(`UPDATE expenses e SET academy_id = br.academy_id FROM branches br WHERE br.id = e.branch_id AND e.academy_id IS NULL`, "backfill expenses.academy_id");

    // ── Payments — ensure notes column exists (some old DBs only have note) ─────
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`, "payments.notes");
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_ref TEXT`, "payments.transaction_ref");
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES academies(id) ON DELETE CASCADE`, "payments.merchant_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_id)`, "idx_payments_merchant");

    // ── Admission enquiries ───────────────────────────────────────────────────────
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url TEXT`, "admission.photo_url");
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "admission.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`, "idx_admission_academy");

    // ── Platform audit + revenue ─────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS platform_audit_log (
      id SERIAL PRIMARY KEY, admin_name TEXT, action TEXT, target TEXT,
      details JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_audit_log");

    await safe(`CREATE TABLE IF NOT EXISTS platform_revenue (
      id SERIAL PRIMARY KEY,
      academy_id INT REFERENCES academies(id) ON DELETE SET NULL,
      academy_name VARCHAR(200), amount NUMERIC(10,2) NOT NULL,
      plan VARCHAR(30), note TEXT, paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_revenue");

    // ── QR scans ─────────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS qr_scans (
      id SERIAL PRIMARY KEY, student_id INT REFERENCES students(id) ON DELETE CASCADE,
      branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
      scan_date DATE NOT NULL, entry_time TIMESTAMPTZ, exit_time TIMESTAMPTZ,
      scanned_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`, "create qr_scans");

    // ── Working days ─────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS working_days (
      id SERIAL PRIMARY KEY, branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
      date DATE NOT NULL, is_working BOOLEAN DEFAULT true, note TEXT,
      UNIQUE(branch_id, date)
    )`, "create working_days");

    console.log("\u2705 Migration complete");
  } catch (err) {
    console.error("[migrate] Fatal migration error (server will still start):", err.message);
  }
}

module.exports = runMigration;
