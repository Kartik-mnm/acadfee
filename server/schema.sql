-- ─────────────────────────────────────────────
--  ACADEMY FEE MANAGEMENT – Database Schema
-- ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  address   TEXT,
  phone     VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Super Admin + Branch Managers)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  branch_id   INT REFERENCES branches(id) ON DELETE SET NULL,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(120) UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        VARCHAR(20) CHECK (role IN ('super_admin','branch_manager')) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Batches / Courses
CREATE TABLE IF NOT EXISTS batches (
  id          SERIAL PRIMARY KEY,
  branch_id   INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  subjects    TEXT,
  fee_monthly NUMERIC(10,2) DEFAULT 0,
  fee_quarterly NUMERIC(10,2) DEFAULT 0,
  fee_yearly  NUMERIC(10,2) DEFAULT 0,
  fee_course  NUMERIC(10,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  branch_id     INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  batch_id      INT REFERENCES batches(id) ON DELETE SET NULL,
  name          VARCHAR(120) NOT NULL,
  phone         VARCHAR(20),
  parent_phone  VARCHAR(20),
  email         VARCHAR(120),
  address       TEXT,
  dob           DATE,
  gender        VARCHAR(10),
  admission_date DATE DEFAULT CURRENT_DATE,
  fee_type      VARCHAR(20) CHECK (fee_type IN ('monthly','quarterly','yearly','course')) DEFAULT 'monthly',
  admission_fee NUMERIC(10,2) DEFAULT 0,
  discount      NUMERIC(5,2) DEFAULT 0,   -- percentage
  discount_reason TEXT,
  status        VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Records (expected dues)
CREATE TABLE IF NOT EXISTS fee_records (
  id            SERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  branch_id     INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount_due    NUMERIC(10,2) NOT NULL,
  amount_paid   NUMERIC(10,2) DEFAULT 0,
  due_date      DATE NOT NULL,
  period_label  VARCHAR(50),   -- e.g. "June 2025" or "Q2 2025"
  status        VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  fee_record_id  INT NOT NULL REFERENCES fee_records(id) ON DELETE CASCADE,
  student_id     INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  branch_id      INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL,
  payment_mode   VARCHAR(20) CHECK (payment_mode IN ('cash','upi','bank_transfer','cheque')) NOT NULL,
  transaction_ref VARCHAR(100),
  paid_on        DATE DEFAULT CURRENT_DATE,
  collected_by   INT REFERENCES users(id) ON DELETE SET NULL,
  notes          TEXT,
  receipt_no     VARCHAR(30) UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Seed default branches & super admin ───────────────────────────
INSERT INTO branches (name, address, phone) VALUES
  ('Branch A – Main',   'Main Road, City', '9000000001'),
  ('Branch B – North',  'North Zone, City','9000000002'),
  ('Branch C – South',  'South Zone, City','9000000003')
ON CONFLICT DO NOTHING;

-- Default super admin  password: Admin@1234  (bcrypt hash)
INSERT INTO users (branch_id, name, email, password, role) VALUES
  (NULL, 'Super Admin', 'admin@academy.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi',
   'super_admin')
ON CONFLICT DO NOTHING;
