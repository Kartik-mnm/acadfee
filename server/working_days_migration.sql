-- #53 — Working Days table migration
-- Run this once on your PostgreSQL database

CREATE TABLE IF NOT EXISTS working_days (
  id          SERIAL PRIMARY KEY,
  branch_id   INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  is_working  BOOLEAN DEFAULT true,
  note        VARCHAR(200),
  marked_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, date)
);

CREATE INDEX IF NOT EXISTS idx_working_days_branch_date ON working_days(branch_id, date);
