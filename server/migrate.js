const db = require("./db");
const bcrypt = require("bcryptjs");

async function runMigration() {
  // safe() swallows "already exists" / "duplicate" errors so every statement
  // is idempotent — safe to run on both fresh and existing databases.
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
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1 — CREATE BASE TABLES (IF NOT EXISTS)
    // These run first so ALTER TABLE statements below never hit missing tables.
    // Safe to run on existing databases — IF NOT EXISTS is always idempotent.
    // ═══════════════════════════════════════════════════════════════════════

    // ── academies ───────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS academies (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      slug             TEXT UNIQUE,
      logo_url         TEXT,
      favicon_url      TEXT,
      tagline          TEXT,
      primary_color    TEXT DEFAULT '2563EB',
      accent_color     TEXT DEFAULT '38BDF8',
      address          TEXT,
      phone            TEXT,
      phone2           TEXT,
      email            TEXT,
      website          TEXT,
      city             TEXT,
      state            TEXT,
      pincode          TEXT,
      roll_prefix      TEXT DEFAULT '',
      features         JSONB DEFAULT '{}',
      plan             TEXT DEFAULT 'trial',
      is_active        BOOLEAN DEFAULT true,
      trial_ends_at    TIMESTAMPTZ,
      max_students     INT DEFAULT 100,
      max_branches     INT DEFAULT 2,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )`, "create academies");

    // ── branches ────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS branches (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      address     TEXT,
      phone       VARCHAR(20),
      roll_prefix TEXT DEFAULT '',
      academy_id  INT REFERENCES academies(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create branches");

    // ── users ───────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      branch_id   INT REFERENCES branches(id) ON DELETE SET NULL,
      academy_id  INT REFERENCES academies(id) ON DELETE CASCADE,
      name        VARCHAR(120) NOT NULL,
      email       VARCHAR(120) UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        VARCHAR(20) CHECK (role IN ('super_admin','branch_manager')) NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create users");

    // ── batches ─────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS batches (
      id             SERIAL PRIMARY KEY,
      branch_id      INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      name           VARCHAR(120) NOT NULL,
      subjects       TEXT,
      fee_monthly    NUMERIC(10,2) DEFAULT 0,
      fee_quarterly  NUMERIC(10,2) DEFAULT 0,
      fee_yearly     NUMERIC(10,2) DEFAULT 0,
      fee_course     NUMERIC(10,2) DEFAULT 0,
      start_date     DATE,
      end_date       DATE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )`, "create batches");

    // ── students ────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS students (
      id                SERIAL PRIMARY KEY,
      branch_id         INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      batch_id          INT REFERENCES batches(id) ON DELETE SET NULL,
      academy_id        INT REFERENCES academies(id) ON DELETE CASCADE,
      name              VARCHAR(120) NOT NULL,
      phone             VARCHAR(20),
      parent_phone      VARCHAR(20),
      email             VARCHAR(120),
      address           TEXT,
      dob               DATE,
      gender            VARCHAR(10),
      roll_no           TEXT,
      parent_name       TEXT,
      photo_url         TEXT,
      login_enabled     BOOLEAN DEFAULT false,
      login_password    TEXT,
      login_device_limit INT DEFAULT 2,
      fcm_token         TEXT,
      parent_fcm_token  TEXT,
      admission_date    DATE DEFAULT CURRENT_DATE,
      fee_type          VARCHAR(20) DEFAULT 'monthly',
      admission_fee     NUMERIC(10,2) DEFAULT 0,
      discount          NUMERIC(5,2) DEFAULT 0,
      discount_reason   TEXT,
      due_day           INT DEFAULT 10,
      status            VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )`, "create students");

    // ── fee_records ─────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS fee_records (
      id            SERIAL PRIMARY KEY,
      student_id    INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      branch_id     INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      amount_due    NUMERIC(10,2) NOT NULL,
      amount_paid   NUMERIC(10,2) DEFAULT 0,
      due_date      DATE NOT NULL,
      period_label  VARCHAR(50),
      status        VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue')),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`, "create fee_records");

    // ── payments ────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS payments (
      id              SERIAL PRIMARY KEY,
      fee_record_id   INT NOT NULL REFERENCES fee_records(id) ON DELETE CASCADE,
      student_id      INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      branch_id       INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      merchant_id     INT REFERENCES academies(id) ON DELETE CASCADE,
      amount          NUMERIC(10,2) NOT NULL,
      payment_mode    VARCHAR(20) CHECK (payment_mode IN ('cash','upi','bank_transfer','cheque')) NOT NULL,
      transaction_ref VARCHAR(100),
      paid_on         DATE DEFAULT CURRENT_DATE,
      collected_by    INT REFERENCES users(id) ON DELETE SET NULL,
      notes           TEXT,
      receipt_no      VARCHAR(30) UNIQUE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )`, "create payments");

    // ── expenses ────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS expenses (
      id          SERIAL PRIMARY KEY,
      branch_id   INT REFERENCES branches(id) ON DELETE CASCADE,
      academy_id  INT REFERENCES academies(id) ON DELETE SET NULL,
      title       TEXT,
      category    TEXT,
      amount      NUMERIC(10,2) NOT NULL,
      paid_on     DATE DEFAULT CURRENT_DATE,
      paid_to     TEXT,
      description TEXT,
      notes       TEXT,
      created_by  INT REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create expenses");

    // ── attendance ──────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS attendance (
      id          SERIAL PRIMARY KEY,
      student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      branch_id   INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      batch_id    INT REFERENCES batches(id) ON DELETE SET NULL,
      date        DATE NOT NULL,
      status      VARCHAR(10) DEFAULT 'present' CHECK (status IN ('present','absent','late')),
      note        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_id, date)
    )`, "create attendance");

    // ── tests ───────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS tests (
      id          SERIAL PRIMARY KEY,
      branch_id   INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      batch_id    INT REFERENCES batches(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      subject     TEXT,
      test_date   DATE,
      max_marks   NUMERIC(6,2) DEFAULT 100,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create tests");

    await safe(`CREATE TABLE IF NOT EXISTS test_scores (
      id          SERIAL PRIMARY KEY,
      test_id     INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      marks       NUMERIC(6,2),
      grade       TEXT,
      remarks     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(test_id, student_id)
    )`, "create test_scores");

    // ── admission_enquiries ─────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS admission_enquiries (
      id           SERIAL PRIMARY KEY,
      branch_id    INT REFERENCES branches(id) ON DELETE CASCADE,
      academy_id   INT REFERENCES academies(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      phone        TEXT,
      parent_phone TEXT,
      email        TEXT,
      address      TEXT,
      dob          DATE,
      gender       TEXT,
      batch_id     INT REFERENCES batches(id) ON DELETE SET NULL,
      status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','enrolled','rejected','follow_up')),
      notes        TEXT,
      photo_url    TEXT,
      follow_up_date DATE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`, "create admission_enquiries");

    // ── refresh_tokens ──────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          SERIAL PRIMARY KEY,
      token       TEXT UNIQUE NOT NULL,
      payload     JSONB,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create refresh_tokens");

    // ── password_reset_tokens ───────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create password_reset_tokens");

    // ── platform_admins ─────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS platform_admins (
      id            SERIAL PRIMARY KEY,
      name          TEXT,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      logo_url      TEXT,
      favicon_url   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_admins");

    // ── platform_audit_log ──────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS platform_audit_log (
      id          SERIAL PRIMARY KEY,
      admin_name  TEXT,
      action      TEXT,
      target      TEXT,
      details     JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_audit_log");

    // ── platform_revenue ────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS platform_revenue (
      id           SERIAL PRIMARY KEY,
      academy_id   INT REFERENCES academies(id) ON DELETE SET NULL,
      academy_name VARCHAR(200),
      amount       NUMERIC(10,2) NOT NULL,
      plan         VARCHAR(30),
      note         TEXT,
      paid_on      DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_revenue");

    // ── qr_scans ────────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS qr_scans (
      id          SERIAL PRIMARY KEY,
      student_id  INT REFERENCES students(id) ON DELETE CASCADE,
      branch_id   INT REFERENCES branches(id) ON DELETE CASCADE,
      scan_date   DATE NOT NULL,
      entry_time  TIMESTAMPTZ,
      exit_time   TIMESTAMPTZ,
      scanned_by  INT REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create qr_scans");

    // ── working_days ────────────────────────────────────────────────────────
    await safe(`CREATE TABLE IF NOT EXISTS working_days (
      id          SERIAL PRIMARY KEY,
      branch_id   INT REFERENCES branches(id) ON DELETE CASCADE,
      date        DATE NOT NULL,
      is_working  BOOLEAN DEFAULT true,
      note        TEXT,
      UNIQUE(branch_id, date)
    )`, "create working_days");

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2 — ADD MISSING COLUMNS TO EXISTING TABLES (idempotent ALTERs)
    // Safe to run even if columns already exist (ADD COLUMN IF NOT EXISTS).
    // ═══════════════════════════════════════════════════════════════════════

    // academies — extra columns added over time
    for (const col of [
      "logo_url TEXT", "favicon_url TEXT", "tagline TEXT",
      "primary_color TEXT DEFAULT '2563EB'", "accent_color TEXT DEFAULT '38BDF8'",
      "address TEXT", "phone2 TEXT", "website TEXT", "city TEXT", "state TEXT", "pincode TEXT",
      "max_students INT DEFAULT 100", "max_branches INT DEFAULT 2",
      "updated_at TIMESTAMPTZ DEFAULT NOW()", "roll_prefix TEXT DEFAULT ''",
    ]) {
      await safe(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS ${col}`, `academies.${col.split(" ")[0]}`);
    }

    // users
    await safe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "users.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id)`, "idx_users_academy");

    // branches
    await safe(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "branches.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_branches_academy ON branches(academy_id)`, "idx_branches_academy");
    await safe(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS roll_prefix TEXT DEFAULT ''`, "branches.roll_prefix");

    // students
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

    // batches
    for (const col of [
      "start_date DATE", "end_date DATE",
      "fee_quarterly NUMERIC", "fee_yearly NUMERIC", "fee_course NUMERIC",
    ]) {
      await safe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ${col}`, `batches.${col.split(" ")[0]}`);
    }

    // expenses
    for (const col of [
      "title TEXT", "notes TEXT", "description TEXT", "paid_to TEXT",
      "academy_id INT REFERENCES academies(id) ON DELETE SET NULL",
    ]) {
      await safe(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ${col}`, `expenses.${col.split(" ")[0]}`);
    }
    await safe(
      `UPDATE expenses e SET academy_id = br.academy_id FROM branches br WHERE br.id = e.branch_id AND e.academy_id IS NULL`,
      "backfill expenses.academy_id"
    );

    // payments
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`, "payments.notes");
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_ref TEXT`, "payments.transaction_ref");
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES academies(id) ON DELETE CASCADE`, "payments.merchant_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_id)`, "idx_payments_merchant");

    // admission_enquiries
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url TEXT`, "admission.photo_url");
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "admission.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`, "idx_admission_academy");

    // platform_admins
    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS favicon_url TEXT`, "platform_admins.favicon_url");
    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS logo_url TEXT`, "platform_admins.logo_url");

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3 — SEED DEFAULT DATA
    // ═══════════════════════════════════════════════════════════════════════

    // Default platform admin (password: Exponent@2025)
    const hash = await bcrypt.hash("Exponent@2025", 10);
    await safe(
      `INSERT INTO platform_admins (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      "upsert platform_admin",
      ["Kartik", "kartik@exponent.app", hash]
    );

    console.log("✅ Migration complete");
  } catch (err) {
    console.error("[migrate] Fatal migration error (server will still start):", err.message);
  }
}

module.exports = runMigration;
