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
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1 — CREATE BASE TABLES
    // ═══════════════════════════════════════════════════════════════════════

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

    await safe(`CREATE TABLE IF NOT EXISTS branches (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      address     TEXT,
      phone       VARCHAR(20),
      roll_prefix TEXT DEFAULT '',
      academy_id  INT REFERENCES academies(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create branches");

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

    await safe(`CREATE TABLE IF NOT EXISTS students (
      id                 SERIAL PRIMARY KEY,
      branch_id          INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      batch_id           INT REFERENCES batches(id) ON DELETE SET NULL,
      academy_id         INT REFERENCES academies(id) ON DELETE CASCADE,
      name               VARCHAR(120) NOT NULL,
      phone              VARCHAR(20),
      parent_phone       VARCHAR(20),
      email              VARCHAR(120),
      address            TEXT,
      dob                DATE,
      gender             VARCHAR(10),
      roll_no            TEXT,
      parent_name        TEXT,
      photo_url          TEXT,
      login_enabled      BOOLEAN DEFAULT false,
      login_password     TEXT,
      login_device_limit INT DEFAULT 2,
      fcm_token          TEXT,
      parent_fcm_token   TEXT,
      admission_date     DATE DEFAULT CURRENT_DATE,
      fee_type           VARCHAR(20) DEFAULT 'monthly',
      admission_fee      NUMERIC(10,2) DEFAULT 0,
      discount           NUMERIC(5,2) DEFAULT 0,
      discount_reason    TEXT,
      due_day            INT DEFAULT 10,
      status             VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','inactive')),
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )`, "create students");

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

    await safe(`CREATE TABLE IF NOT EXISTS expenses (
      id           SERIAL PRIMARY KEY,
      branch_id    INT REFERENCES branches(id) ON DELETE CASCADE,
      academy_id   INT REFERENCES academies(id) ON DELETE SET NULL,
      title        TEXT,
      category     TEXT,
      amount       NUMERIC(10,2) NOT NULL,
      expense_date DATE DEFAULT CURRENT_DATE,
      paid_to      TEXT,
      description  TEXT,
      notes        TEXT,
      created_by   INT REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`, "create expenses");

    // ── attendance — monthly summary format ──────────────────────────────
    // Check if old daily format exists (has 'status' column) and recreate
    try {
      const { rows: hasStat } = await db.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name='attendance' AND column_name='status'
      `);
      if (hasStat.length > 0) {
        await db.query(`DROP TABLE attendance CASCADE`);
        console.log("[migrate] Dropped old daily attendance table");
      }
    } catch (e) {
      console.warn("[migrate] Attendance check:", e.message);
    }
    await safe(`CREATE TABLE IF NOT EXISTS attendance (
      id          SERIAL PRIMARY KEY,
      student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      branch_id   INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      month       INT NOT NULL,
      year        INT NOT NULL,
      total_days  INT DEFAULT 0,
      present     INT DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_id, month, year)
    )`, "create attendance");

    // ── tests — columns MUST match what tests.js route uses ─────────────
    // Route uses: name, total_marks, test_date, branch_id, batch_id, subject
    await safe(`CREATE TABLE IF NOT EXISTS tests (
      id          SERIAL PRIMARY KEY,
      branch_id   INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      batch_id    INT REFERENCES batches(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      subject     TEXT,
      total_marks NUMERIC(6,2) DEFAULT 100,
      test_date   DATE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create tests");

    // FIX: if tests table was created with wrong column names (title/max_marks),
    // add the correct aliases so existing data still works
    await safe(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS name TEXT`, "tests.name");
    await safe(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS total_marks NUMERIC(6,2) DEFAULT 100`, "tests.total_marks");
    // Backfill name from title if title column exists
    await safe(`UPDATE tests SET name = title WHERE name IS NULL AND title IS NOT NULL`, "tests backfill name");
    await safe(`UPDATE tests SET total_marks = max_marks WHERE total_marks IS NULL AND max_marks IS NOT NULL`, "tests backfill total_marks");

    // ── test_results — the route uses this name (not test_scores) ────────
    await safe(`CREATE TABLE IF NOT EXISTS test_results (
      id          SERIAL PRIMARY KEY,
      test_id     INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      marks       NUMERIC(6,2),
      grade       TEXT,
      remarks     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(test_id, student_id)
    )`, "create test_results");

    // FIX: if test_scores exists instead of test_results, rename it
    try {
      const { rows: hasScores } = await db.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_name='test_scores'
      `);
      const { rows: hasResults } = await db.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_name='test_results'
      `);
      if (hasScores.length > 0 && hasResults.length === 0) {
        await db.query(`ALTER TABLE test_scores RENAME TO test_results`);
        console.log("[migrate] Renamed test_scores → test_results");
      }
    } catch (e) {
      console.warn("[migrate] test_results rename:", e.message);
    }

    await safe(`CREATE TABLE IF NOT EXISTS admission_enquiries (
      id             SERIAL PRIMARY KEY,
      branch_id      INT REFERENCES branches(id) ON DELETE CASCADE,
      academy_id     INT REFERENCES academies(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      phone          TEXT,
      parent_phone   TEXT,
      email          TEXT,
      address        TEXT,
      dob            DATE,
      gender         TEXT,
      batch_id       INT REFERENCES batches(id) ON DELETE SET NULL,
      extra          JSONB DEFAULT '{}',
      status         TEXT DEFAULT 'pending',
      notes          TEXT,
      photo_url      TEXT,
      student_id     INT REFERENCES students(id) ON DELETE SET NULL,
      follow_up_date DATE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )`, "create admission_enquiries");

    await safe(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          SERIAL PRIMARY KEY,
      token       TEXT UNIQUE NOT NULL,
      payload     JSONB,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create refresh_tokens");

    await safe(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create password_reset_tokens");

    await safe(`CREATE TABLE IF NOT EXISTS platform_admins (
      id            SERIAL PRIMARY KEY,
      name          TEXT,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      logo_url      TEXT,
      favicon_url   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_admins");

    await safe(`CREATE TABLE IF NOT EXISTS platform_audit_log (
      id          SERIAL PRIMARY KEY,
      admin_name  TEXT,
      action      TEXT,
      target      TEXT,
      details     JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`, "create platform_audit_log");
    
    await safe(`CREATE TABLE IF NOT EXISTS platform_settings (
      key   TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )`, "create platform_settings");
    
    await safe(
      `INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      "seed platform_settings",
      ["allow_viewer_access", JSON.stringify(true)]
    );

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

    await safe(`CREATE TABLE IF NOT EXISTS working_days (
      id          SERIAL PRIMARY KEY,
      branch_id   INT REFERENCES branches(id) ON DELETE CASCADE,
      date        DATE NOT NULL,
      is_working  BOOLEAN DEFAULT true,
      note        TEXT,
      marked_by   INT REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(branch_id, date)
    )`, "create working_days");
    await safe(`CREATE INDEX IF NOT EXISTS idx_working_days_branch_date ON working_days(branch_id, date)`, "idx_working_days");

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2 — ADD MISSING COLUMNS TO EXISTING TABLES
    // ═══════════════════════════════════════════════════════════════════════

    for (const col of [
      "logo_url TEXT", "favicon_url TEXT", "tagline TEXT",
      "primary_color TEXT DEFAULT '2563EB'", "accent_color TEXT DEFAULT '38BDF8'",
      "address TEXT", "phone2 TEXT", "website TEXT", "city TEXT", "state TEXT", "pincode TEXT",
      "max_students INT DEFAULT 100", "max_branches INT DEFAULT 2",
      "updated_at TIMESTAMPTZ DEFAULT NOW()", "roll_prefix TEXT DEFAULT ''",
    ]) {
      await safe(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS ${col}`, `academies.${col.split(" ")[0]}`);
    }

    await safe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "users.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id)`, "idx_users_academy");

    await safe(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "branches.academy_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_branches_academy ON branches(academy_id)`, "idx_branches_academy");
    await safe(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS roll_prefix TEXT DEFAULT ''`, "branches.roll_prefix");

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

    for (const col of ["start_date DATE", "end_date DATE", "fee_quarterly NUMERIC", "fee_yearly NUMERIC", "fee_course NUMERIC"]) {
      await safe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS ${col}`, `batches.${col.split(" ")[0]}`);
    }

    // expenses — handle both paid_on and expense_date column names
    for (const col of ["title TEXT", "notes TEXT", "description TEXT", "paid_to TEXT", "academy_id INT REFERENCES academies(id) ON DELETE SET NULL"]) {
      await safe(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ${col}`, `expenses.${col.split(" ")[0]}`);
    }
    // Add expense_date if missing (some DBs have paid_on instead)
    await safe(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE`, "expenses.expense_date");
    await safe(`UPDATE expenses SET expense_date = CURRENT_DATE WHERE expense_date IS NULL`, "expenses backfill expense_date");
    await safe(`UPDATE expenses e SET academy_id = br.academy_id FROM branches br WHERE br.id = e.branch_id AND e.academy_id IS NULL`, "backfill expenses.academy_id");

    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT`, "payments.notes");
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_ref TEXT`, "payments.transaction_ref");
    await safe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES academies(id) ON DELETE CASCADE`, "payments.merchant_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_id)`, "idx_payments_merchant");

    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url TEXT`, "admission.photo_url");
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`, "admission.academy_id");
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'`, "admission.extra");
    await safe(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS student_id INT REFERENCES students(id) ON DELETE SET NULL`, "admission.student_id");
    await safe(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`, "idx_admission_academy");

    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS favicon_url TEXT`, "platform_admins.favicon_url");
    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS logo_url TEXT`, "platform_admins.logo_url");

    await safe(`ALTER TABLE working_days ADD COLUMN IF NOT EXISTS marked_by INT REFERENCES users(id) ON DELETE SET NULL`, "working_days.marked_by");
    await safe(`ALTER TABLE working_days ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`, "working_days.created_at");

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3 — BACKFILLS & CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    // Backfill academy_id from branches where missing
    await safe(`UPDATE branches b SET academy_id = (SELECT id FROM academies LIMIT 1) WHERE academy_id IS NULL`, "backfill branches.academy_id");
    await safe(`UPDATE users u SET academy_id = b.academy_id FROM branches b WHERE b.id = u.branch_id AND u.academy_id IS NULL`, "backfill users.academy_id");
    await safe(`UPDATE students s SET academy_id = b.academy_id FROM branches b WHERE b.id = s.branch_id AND s.academy_id IS NULL`, "backfill students.academy_id");
    await safe(`UPDATE expenses e SET academy_id = b.academy_id FROM branches b WHERE b.id = e.branch_id AND e.academy_id IS NULL`, "backfill expenses.academy_id");
    await safe(`UPDATE admission_enquiries a SET academy_id = b.academy_id FROM branches b WHERE b.id = a.branch_id AND a.academy_id IS NULL`, "backfill admission.academy_id");

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4 — SEED DEFAULT DATA
    // ═══════════════════════════════════════════════════════════════════════
    const hash = await bcrypt.hash("Exponent@2025", 10);
    await safe(
      `INSERT INTO platform_admins (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
      "upsert platform_admin",
      ["Kartik", "kartik@exponent.app", hash]
    );

    // ── Platform roles & co-founder account ──────────────────────────────
    await safe(`ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'platform_owner'`, "platform_admins.role");
    
    const coFounderHash = await bcrypt.hash("Password123", 10);
    await safe(
      `INSERT INTO platform_admins (name, email, password_hash, role) VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO UPDATE SET role = 'viewer', password_hash = EXCLUDED.password_hash`,
      "upsert co-founder",
      ["Co-Founder", "cofounder@exponent.app", coFounderHash, "viewer"]
    );

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5 — PERFORMANCE INDEXES
    // ═══════════════════════════════════════════════════════════════════════
    // students
    await safe(`CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id)`, "idx_students_batch");
    await safe(`CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch_id)`, "idx_students_branch");
    
    // fee_records
    await safe(`CREATE INDEX IF NOT EXISTS idx_fee_records_student ON fee_records(student_id)`, "idx_fee_records_student");
    await safe(`CREATE INDEX IF NOT EXISTS idx_fee_records_branch ON fee_records(branch_id)`, "idx_fee_records_branch");
    await safe(`CREATE INDEX IF NOT EXISTS idx_fee_records_status ON fee_records(status)`, "idx_fee_records_status");
    
    // payments
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_fee_record ON payments(fee_record_id)`, "idx_payments_fee_record");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)`, "idx_payments_student");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id)`, "idx_payments_branch");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_id)`, "idx_payments_merchant");
    await safe(`CREATE INDEX IF NOT EXISTS idx_payments_paid_on ON payments(paid_on)`, "idx_payments_paid_on");

    // attendance & scans
    await safe(`CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)`, "idx_attendance_student");
    await safe(`CREATE INDEX IF NOT EXISTS idx_qr_scans_student ON qr_scans(student_id)`, "idx_qr_scans_student");
    await safe(`CREATE INDEX IF NOT EXISTS idx_qr_scans_date ON qr_scans(scan_date)`, "idx_qr_scans_date");

    // tests
    await safe(`CREATE INDEX IF NOT EXISTS idx_test_results_student ON test_results(student_id)`, "idx_test_results_student");
    await safe(`CREATE INDEX IF NOT EXISTS idx_test_results_test ON test_results(test_id)`, "idx_test_results_test");

    // expenses
    await safe(`CREATE INDEX IF NOT EXISTS idx_expenses_academy ON expenses(academy_id)`, "idx_expenses_academy");
    await safe(`CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id)`, "idx_expenses_branch");

    // enquiries
    await safe(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`, "idx_admission_academy");

    console.log("✅ Migration complete");
  } catch (err) {
    console.error("[migrate] Fatal migration error (server will still start):", err.message);
  }
}

module.exports = runMigration;
