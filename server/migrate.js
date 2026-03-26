// ── Auto Migration Runner ─────────────────────────────────────────────────────
// Runs onboarding migration safely on every startup.
// Uses IF NOT EXISTS everywhere — completely safe to run multiple times.
// ──────────────────────────────────────────────────────────────────────────────
const db = require("./db");

async function runMigration() {
  console.log("[migrate] Starting onboarding migration...");
  try {
    // ── 1. academies table (create if missing entirely) ──────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS academies (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(200) NOT NULL,
        slug         VARCHAR(80)  UNIQUE NOT NULL,
        email        TEXT,
        phone        TEXT,
        plan         VARCHAR(30)  DEFAULT 'basic',
        is_active    BOOLEAN      DEFAULT true,
        trial_ends_at TIMESTAMPTZ,
        features     JSONB        DEFAULT '{}'::jsonb,
        max_students INT          DEFAULT 200,
        max_branches INT          DEFAULT 3,
        created_at   TIMESTAMPTZ  DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    console.log("[migrate] ✓ academies table ready");

    // ── 2. Add new columns to academies (safe, IF NOT EXISTS) ────────────────
    const academyColumns = [
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS email        TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS phone        TEXT`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS plan         VARCHAR(30)  DEFAULT 'basic'`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS is_active    BOOLEAN      DEFAULT true`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS features     JSONB        DEFAULT '{}'::jsonb`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_students INT          DEFAULT 200`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_branches INT          DEFAULT 3`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ  DEFAULT NOW()`,
      `ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ  DEFAULT NOW()`,
    ];
    for (const sql of academyColumns) {
      await db.query(sql);
    }
    console.log("[migrate] ✓ academies columns ready");

    // ── 3. Add academy_id to users ───────────────────────────────────────────
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE;
    `);
    console.log("[migrate] ✓ users.academy_id ready");

    // ── 4. Add academy_id to branches ────────────────────────────────────────
    await db.query(`
      ALTER TABLE branches
        ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE;
    `);
    console.log("[migrate] ✓ branches.academy_id ready");

    // ── 5. Indexes ────────────────────────────────────────────────────────────
    await db.query(`CREATE INDEX IF NOT EXISTS idx_users_academy_id    ON users(academy_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_branches_academy_id ON branches(academy_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_academies_slug      ON academies(slug)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_academies_plan      ON academies(plan)`);
    console.log("[migrate] ✓ indexes ready");

    console.log("[migrate] ✅ Migration complete — all tables and columns are up to date.");
  } catch (err) {
    // Log but DON'T crash the server — migration errors should not take down the app
    console.error("[migrate] ❌ Migration error:", err.message);
    console.error("[migrate]    The server will still start. Fix the error and redeploy.");
  }
}

module.exports = runMigration;
