// ── Auto Migration Runner ─────────────────────────────────────────────────────
// Single source of truth for ALL schema migrations.
// Uses IF NOT EXISTS everywhere — completely safe to run multiple times.
// Uses its own Pool with a long timeout so cold-start DB connections don't fail.
// ─────────────────────────────────────────────────────────────────────────────
const { Pool } = require("pg");
const bcrypt   = require("bcryptjs");

async function runMigration() {
  console.log("[migrate] Starting migration...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
    statement_timeout: 30000,
  });

  const run = (sql, params) => pool.query(sql, params);

  try {
    // ── 1. academies table ───────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS academies (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(200) NOT NULL,
        slug          VARCHAR(80)  UNIQUE NOT NULL,
        email         TEXT,
        phone         TEXT,
        plan          VARCHAR(30)  DEFAULT 'basic',
        is_active     BOOLEAN      DEFAULT true,
        trial_ends_at TIMESTAMPTZ,
        features      JSONB        DEFAULT '{}'::jsonb,
        max_students  INT          DEFAULT 200,
        max_branches  INT          DEFAULT 3,
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    console.log("[migrate] ✓ academies table ready");

    // ── 2. Add columns to academies ──────────────────────────────────────────
    const academyColumns = [
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS email         TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS phone         TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS plan          VARCHAR(30)  DEFAULT 'basic'`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS is_active     BOOLEAN      DEFAULT true`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS features      JSONB        DEFAULT '{}'::jsonb`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_students  INT          DEFAULT 200`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_branches  INT          DEFAULT 3`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ  DEFAULT NOW()`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ  DEFAULT NOW()`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS logo_url      TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS favicon_url   TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS tagline       TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS city          VARCHAR(100)`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS state         VARCHAR(100)`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS pincode       VARCHAR(20)`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS website       TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS address       TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '2563EB'`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS accent_color  VARCHAR(20) DEFAULT '38BDF8'`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS phone2        VARCHAR(30)`,
    ];
    for (const sql of academyColumns) await run(sql);
    console.log("[migrate] ✓ academies columns ready");

    // ── 3. users: add academy_id ─────────────────────────────────────────────
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    console.log("[migrate] ✓ users.academy_id ready");

    // ── 4. branches: add academy_id ──────────────────────────────────────────
    await run(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    console.log("[migrate] ✓ branches.academy_id ready");

    // ── 5. refresh_tokens table ───────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        token      TEXT NOT NULL UNIQUE,
        payload    JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`);
    console.log("[migrate] ✓ refresh_tokens table ready");

    // ── 6. students: extra columns ────────────────────────────────────────────
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_device_limit INT DEFAULT 2`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT false`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_password TEXT`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no VARCHAR(30)`);
    console.log("[migrate] ✓ students extra columns ready");

    // ── 7. batches: start/end date columns ────────────────────────────────────
    await run(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_date DATE`);
    await run(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_date DATE`);
    console.log("[migrate] ✓ batches date columns ready");

    // ── 8. admission_enquiries: photo_url ─────────────────────────────────────
    await run(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url TEXT`).catch(() => {});

    // ── 9. platform_admins table ─────────────────────────────────────────────
    // This is the table used by the Exponent Platform control panel login.
    await run(`
      CREATE TABLE IF NOT EXISTS platform_admins (
        id              SERIAL PRIMARY KEY,
        name            VARCHAR(120) NOT NULL,
        email           VARCHAR(120) UNIQUE NOT NULL,
        password_hash   TEXT NOT NULL,
        is_active       BOOLEAN DEFAULT true,
        last_login_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("[migrate] ✓ platform_admins table ready");

    // ── 10. Seed default platform admin (only if none exist) ─────────────────
    // Default credentials: kartik@exponent.app / Admin@1234
    // Change your password immediately after first login via Settings page.
    const { rows: existingAdmins } = await run(`SELECT id FROM platform_admins LIMIT 1`);
    if (existingAdmins.length === 0) {
      const defaultHash = await bcrypt.hash("Admin@1234", 10);
      await run(
        `INSERT INTO platform_admins (name, email, password_hash) VALUES ($1, $2, $3)`,
        ["Kartik Ninawe", "kartik@exponent.app", defaultHash]
      );
      console.log("[migrate] ✓ Default platform admin seeded → kartik@exponent.app / Admin@1234");
      console.log("[migrate]   ⚠️  CHANGE YOUR PASSWORD after first login!");
    } else {
      console.log("[migrate] ✓ platform_admins already has users — skipping seed");
    }

    // ── 11. Indexes ───────────────────────────────────────────────────────────
    await run(`CREATE INDEX IF NOT EXISTS idx_users_academy_id       ON users(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_branches_academy_id    ON branches(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_academies_slug         ON academies(slug)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_academies_plan         ON academies(plan)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_platform_admins_email  ON platform_admins(email)`);
    console.log("[migrate] ✓ indexes ready");

    console.log("[migrate] ✅ All migrations complete — database is up to date.");
  } catch (err) {
    console.error("[migrate] ❌ Migration error:", err.message);
    console.error("[migrate]    The server will still start. Fix the error and redeploy.");
  } finally {
    await pool.end();
  }
}

module.exports = runMigration;
