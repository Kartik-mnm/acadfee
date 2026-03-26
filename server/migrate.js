// ── Auto Migration Runner ─────────────────────────────────────────────────────
// Single source of truth for ALL schema migrations.
// Uses IF NOT EXISTS everywhere — completely safe to run multiple times.
// Uses its own Pool with a long timeout so cold-start DB connections don't fail.
// ─────────────────────────────────────────────────────────────────────────────
const { Pool } = require("pg");

async function runMigration() {
  console.log("[migrate] Starting migration...");

  // Dedicated pool just for migration — longer timeout than the main pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // always use SSL on Render
    max: 1,
    connectionTimeoutMillis: 30000,     // 30s — enough for cold DB start
    idleTimeoutMillis: 10000,
    statement_timeout: 30000,
  });

  const run = (sql) => pool.query(sql);

  try {
    // ── 1. academies table (create if missing entirely) ──────────────────────
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
    ];
    for (const sql of academyColumns) await run(sql);
    console.log("[migrate] ✓ academies columns ready");

    // ── 3. users: add academy_id ─────────────────────────────────────────────
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    console.log("[migrate] ✓ users.academy_id ready");

    // ── 4. branches: add academy_id ──────────────────────────────────────────
    await run(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    console.log("[migrate] ✓ branches.academy_id ready");

    // ── 5. refresh_tokens table (for auth) ───────────────────────────────────
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

    // ── 6. students: extra columns ───────────────────────────────────────────
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_device_limit INT DEFAULT 2`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT false`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_password TEXT`);
    await run(`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no VARCHAR(30)`);
    console.log("[migrate] ✓ students extra columns ready");

    // ── 7. batches: start/end date columns ───────────────────────────────────
    await run(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_date DATE`);
    await run(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_date DATE`);
    console.log("[migrate] ✓ batches date columns ready");

    // ── 8. admission_enquiries: photo_url ────────────────────────────────────
    await run(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url TEXT`).catch(() => {
      // Table may not exist on all installs — skip silently
    });

    // ── 9. Indexes ────────────────────────────────────────────────────────────
    await run(`CREATE INDEX IF NOT EXISTS idx_users_academy_id    ON users(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_branches_academy_id ON branches(academy_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_academies_slug      ON academies(slug)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_academies_plan      ON academies(plan)`);
    console.log("[migrate] ✓ indexes ready");

    console.log("[migrate] ✅ All migrations complete — database is up to date.");
  } catch (err) {
    // Log but DON'T crash the server
    console.error("[migrate] ❌ Migration error:", err.message);
    console.error("[migrate]    The server will still start. Fix the error and redeploy.");
  } finally {
    await pool.end();
  }
}

module.exports = runMigration;
