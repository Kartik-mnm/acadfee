// ── Auto Migration Runner ─────────────────────────────────────────────────────
const { Pool } = require("pg");

async function runMigration() {
  console.log("[migrate] Starting migration...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1, connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 10000, statement_timeout: 30000,
  });
  const run = (sql) => pool.query(sql);
  try {
    await run(`CREATE TABLE IF NOT EXISTS academies (
      id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, slug VARCHAR(80) UNIQUE NOT NULL,
      email TEXT, phone TEXT, plan VARCHAR(30) DEFAULT 'basic', is_active BOOLEAN DEFAULT true,
      trial_ends_at TIMESTAMPTZ, features JSONB DEFAULT '{}'::jsonb,
      max_students INT DEFAULT 200, max_branches INT DEFAULT 3,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const acadCols = [
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS email TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS phone TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS plan VARCHAR(30) DEFAULT 'basic'`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_students INT DEFAULT 200`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_branches INT DEFAULT 3`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS favicon_url TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS tagline TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS website TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS state TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS city TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS address TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '2563EB'`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '38BDF8'`,
    ];
    for (const sql of acadCols) await run(sql);
    console.log("[migrate] ✓ academies ready");

    // academy_id columns on dependent tables
    await run(`ALTER TABLE users    ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    await run(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    console.log("[migrate] ✓ academy_id columns ready");

    // branches — add optional contact columns
    await run(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS address TEXT`);
    await run(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone   TEXT`);
    await run(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS email   TEXT`);
    console.log("[migrate] ✓ branches columns ready");

    // students — add all optional columns
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no       VARCHAR(30)`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS due_day       INT DEFAULT 1`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url     TEXT`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_enabled  BOOLEAN DEFAULT false`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_password TEXT`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_device_limit INT DEFAULT 2`);
    console.log("[migrate] ✓ students columns ready");

    // admission_enquiries
    await run(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url  TEXT`).catch(() => {});
    await run(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`).catch(() => {});

    // refresh_tokens
    await run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`);
    console.log("[migrate] ✓ refresh_tokens ready");

    // password_reset_tokens
    await run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token)`);
    console.log("[migrate] ✓ password_reset_tokens ready");

    // batches
    await run(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_date DATE`);
    await run(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_date   DATE`);

    // platform_audit_log
    await run(`CREATE TABLE IF NOT EXISTS platform_audit_log (
      id SERIAL PRIMARY KEY, admin_name VARCHAR(120),
      action VARCHAR(80) NOT NULL, target VARCHAR(200),
      details JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON platform_audit_log(created_at DESC)`);

    // platform_revenue
    await run(`CREATE TABLE IF NOT EXISTS platform_revenue (
      id           SERIAL PRIMARY KEY,
      academy_id   INT REFERENCES academies(id) ON DELETE SET NULL,
      academy_name VARCHAR(200),
      amount       NUMERIC(10,2) NOT NULL,
      plan         VARCHAR(30),
      note         TEXT,
      paid_on      DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`);
    console.log("[migrate] ✓ platform tables ready");

    // Indexes
    await run(`CREATE INDEX IF NOT EXISTS idx_users_academy_id    ON users(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_branches_academy_id ON branches(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_students_academy_id ON students(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_academies_slug      ON academies(slug)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_academies_plan      ON academies(plan)`);
    console.log("[migrate] ✓ indexes ready");

    console.log("[migrate] ✅ All migrations complete.");
  } catch (err) {
    console.error("[migrate] ❌ Error:", err.message);
  } finally {
    await pool.end();
  }
}

module.exports = runMigration;
