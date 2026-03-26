-- ── Onboarding Migration ─────────────────────────────────────────────────────
-- Run this once to add columns needed for self-service onboarding
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- Add academy_id to users table (multi-tenant support)
ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE;

-- Add email, phone, plan, is_active, trial_ends_at, features to academies
ALTER TABLE academies ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS plan       VARCHAR(30) DEFAULT 'basic';
ALTER TABLE academies ADD COLUMN IF NOT EXISTS is_active  BOOLEAN DEFAULT true;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS features   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_students INT DEFAULT 200;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS max_branches INT DEFAULT 3;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add academy_id to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS academy_id INT REFERENCES academies(id) ON DELETE CASCADE;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_academy_id    ON users(academy_id);
CREATE INDEX IF NOT EXISTS idx_branches_academy_id ON branches(academy_id);
CREATE INDEX IF NOT EXISTS idx_academies_slug      ON academies(slug);
CREATE INDEX IF NOT EXISTS idx_academies_plan      ON academies(plan);
