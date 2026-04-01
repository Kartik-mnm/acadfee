const db = require("./db");
const bcrypt = require("bcryptjs");

async function runMigration() {
  try {
    // academies
    await db.query(`CREATE TABLE IF NOT EXISTS academies (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE,
      logo_url TEXT, favicon_url TEXT, tagline TEXT,
      primary_color TEXT DEFAULT '2563EB', accent_color TEXT DEFAULT '38BDF8',
      address TEXT, phone TEXT, phone2 TEXT, email TEXT, website TEXT, city TEXT, state TEXT,
      features JSONB DEFAULT '{}', plan TEXT DEFAULT 'trial', is_active BOOLEAN DEFAULT true,
      trial_ends_at TIMESTAMPTZ, max_students INT DEFAULT 100, max_branches INT DEFAULT 2,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS logo_url TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS favicon_url TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS tagline TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '2563EB'`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '38BDF8'`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS address TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS phone2 TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS website TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS city TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS state TEXT`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_students INT DEFAULT 100`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_branches INT DEFAULT 2`);
    await db.query(`ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

    // users
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id)`);

    // branches
    await db.query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_branches_academy ON branches(academy_id)`);

    // students
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no TEXT`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT false`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_password TEXT`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS login_device_limit INT DEFAULT 2`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS fcm_token TEXT`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_fcm_token TEXT`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'monthly'`);
    await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS due_day INT DEFAULT 10`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_students_academy ON students(academy_id)`);

    // batches
    await db.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_date DATE`);
    await db.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_date DATE`);
    await db.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS fee_quarterly NUMERIC`);
    await db.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS fee_yearly NUMERIC`);
    await db.query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS fee_course NUMERIC`);

    // refresh_tokens
    await db.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL,
      payload JSONB, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // password_reset_tokens
    await db.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY, user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // platform_admins
    await db.query(`CREATE TABLE IF NOT EXISTS platform_admins (
      id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const hash = await bcrypt.hash("Exponent@2025", 10);
    await db.query(
      `INSERT INTO platform_admins (name, email, password_hash)
       VALUES ('Kartik', 'kartik@exponent.app', $1)
       ON CONFLICT (email) DO UPDATE SET password_hash=$1`,
      [hash]
    );

    // expenses — add title and notes columns if they don't exist (new schema)
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title TEXT`);
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT`);
    // Backfill title from description for existing rows
    await db.query(`UPDATE expenses SET title = description WHERE title IS NULL AND description IS NOT NULL`);
    await db.query(`UPDATE expenses SET notes = paid_to WHERE notes IS NULL AND paid_to IS NOT NULL`);

    // admission_enquiries
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    await db.query(`ALTER TABLE admission_enquiries ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_admission_enquiries_academy ON admission_enquiries(academy_id)`);

    console.log("\u2705 Migration complete");
  } catch (err) {
    console.error("Migration error:", err.message);
  }
}

module.exports = runMigration;
