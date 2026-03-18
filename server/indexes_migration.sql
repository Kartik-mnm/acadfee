-- ─────────────────────────────────────────────────────────────────
--  Feature #7 — Performance Indexes Migration
--  Run this once on your PostgreSQL database.
--  All indexes use IF NOT EXISTS so it's safe to re-run.
-- ─────────────────────────────────────────────────────────────────

-- STUDENTS table
CREATE INDEX IF NOT EXISTS idx_students_branch_id      ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_batch_id       ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_status         ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_email          ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_name           ON students(name);
CREATE INDEX IF NOT EXISTS idx_students_phone          ON students(phone);

-- FEE_RECORDS table
CREATE INDEX IF NOT EXISTS idx_fee_records_student_id  ON fee_records(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_branch_id   ON fee_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_status      ON fee_records(status);
CREATE INDEX IF NOT EXISTS idx_fee_records_due_date    ON fee_records(due_date);

-- PAYMENTS table
CREATE INDEX IF NOT EXISTS idx_payments_student_id     ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id      ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_fee_record_id  ON payments(fee_record_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_on        ON payments(paid_on);

-- ATTENDANCE table
CREATE INDEX IF NOT EXISTS idx_attendance_student_id   ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_id    ON attendance(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_month_year   ON attendance(month, year);

-- QR_SCANS table
CREATE INDEX IF NOT EXISTS idx_qr_scans_student_id     ON qr_scans(student_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_branch_id      ON qr_scans(branch_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scan_date      ON qr_scans(scan_date);

-- TESTS / TEST_RESULTS tables
CREATE INDEX IF NOT EXISTS idx_tests_branch_id         ON tests(branch_id);
CREATE INDEX IF NOT EXISTS idx_tests_batch_id          ON tests(batch_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id    ON test_results(test_id);

-- EXPENSES table
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id      ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date           ON expenses(date);

-- BATCHES table
CREATE INDEX IF NOT EXISTS idx_batches_branch_id       ON batches(branch_id);

-- USERS table
CREATE INDEX IF NOT EXISTS idx_users_email             ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_branch_id         ON users(branch_id);
