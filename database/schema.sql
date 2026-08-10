-- ============================================================================
-- Multi-Tenant School Management SaaS — PostgreSQL Schema
-- Tenancy model: shared database, shared tables, row-level isolation via
-- school_id on every tenant-owned table. See README notes at bottom.
--
-- Migrated from MySQL. Notable dialect changes from the original:
--   - AUTO_INCREMENT            -> GENERATED ALWAYS AS IDENTITY
--   - ENUM('a','b')             -> VARCHAR + CHECK (col IN (...))
--   - TINYINT(1)                -> BOOLEAN
--   - DATETIME                  -> TIMESTAMP
--   - ON UPDATE CURRENT_TIMESTAMP -> BEFORE UPDATE trigger (see bottom)
--   - inline INDEX/UNIQUE KEY   -> separate CREATE INDEX / CONSTRAINT ... UNIQUE
-- ============================================================================

-- Reusable trigger function for every updated_at column that used to rely on
-- MySQL's "ON UPDATE CURRENT_TIMESTAMP" — Postgres has no column-level
-- equivalent, so a BEFORE UPDATE trigger does the same job per table.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PLATFORM LEVEL (no school_id — these are cross-tenant / global)
-- ============================================================================

-- Tenants themselves
CREATE TABLE schools (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  slug          VARCHAR(150) NOT NULL UNIQUE,        -- used in subdomain/URL, e.g. greenwood.yourapp.com
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(30),
  address       VARCHAR(255),
  momo_provider       VARCHAR(30),
  momo_number         VARCHAR(20),
  momo_account_name   VARCHAR(150),
  bank_name           VARCHAR(150),
  bank_account_number VARCHAR(50),
  bank_account_name   VARCHAR(150),
  logo_url      VARCHAR(500),
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE, -- public read-only demo tenant, see demoReadOnly.middleware.js
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Plans SuperAdmin defines (Free/Basic/Pro etc.) — global, not per-school
CREATE TABLE subscription_plans (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  price_cents     INT NOT NULL,
  billing_cycle   VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  max_students    INT,                                -- NULL = unlimited
  features        JSONB,                               -- {"attendance": true, "results": true, ...}
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One active/inactive subscription record per school
CREATE TABLE subscriptions (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id           BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id             BIGINT NOT NULL REFERENCES subscription_plans(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','cancelled','expired')),
  trial_ends_at       TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end  TIMESTAMP,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  payment_provider    VARCHAR(50),                   -- 'stripe', 'paystack', 'flutterwave' ...
  payment_customer_ref VARCHAR(150),                 -- provider's customer id
  payment_sub_ref      VARCHAR(150),                 -- provider's subscription id
  reminder_sent_at    TIMESTAMP NULL,                -- set once the "renews soon" email goes out, so the daily cron doesn't resend it every day before expiry
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sub_school ON subscriptions(school_id);
CREATE INDEX idx_sub_status ON subscriptions(status);
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Optional but recommended: raw log of billing events (webhooks) for audit/debug
CREATE TABLE billing_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  event_type    VARCHAR(100) NOT NULL,               -- 'invoice.paid', 'subscription.cancelled' ...
  payload       JSONB,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_billing_school ON billing_events(school_id);

-- ============================================================================
-- 2. USERS & AUTH (school_id NULLABLE — NULL only for SUPERADMIN)
-- ============================================================================

CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NULL REFERENCES schools(id) ON DELETE CASCADE, -- NULL = platform SuperAdmin
  role          VARCHAR(20) NOT NULL CHECK (role IN ('SUPERADMIN','SCHOOL_ADMIN','TEACHER','PARENT','STUDENT')),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,         -- global unique -> simple login (no school picker needed)
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  status        VARCHAR(20) NOT NULL DEFAULT 'invited' CHECK (status IN ('active','invited','suspended')),
  email_verified_at TIMESTAMP NULL, -- NULL = not yet verified; set by POST /auth/verify-email
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE for accounts an admin set a temp password for (teachers, guardians) until they change it
  superadmin_scope VARCHAR(20) NULL CHECK (superadmin_scope IN ('full','support','billing','developer')), -- only meaningful when role='SUPERADMIN'; NULL/'full' = unrestricted
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_school_role ON users(school_id, role);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh tokens (JWT access tokens stay stateless/short-lived; refresh tokens are stored so they can be revoked)
CREATE TABLE refresh_tokens (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  revoked_at    TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    TIMESTAMP NOT NULL,
  used_at       TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6-digit codes emailed on signup. Only the most recently issued row per
-- user is ever valid (see verifyEmailCode) — requesting a resend naturally
-- supersedes whatever code came before it, no explicit cleanup needed.
CREATE TABLE email_verification_codes (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash     VARCHAR(255) NOT NULL,
  attempts      INT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMP NOT NULL,
  used_at       TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_evc_user ON email_verification_codes(user_id);

-- ============================================================================
-- 3. ACADEMIC STRUCTURE (all tenant-scoped -> school_id NOT NULL)
-- ============================================================================

CREATE TABLE academic_years (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          VARCHAR(50) NOT NULL,                -- '2025/2026'
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_current    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_ay_school ON academic_years(school_id);

CREATE TABLE classes (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name          VARCHAR(50) NOT NULL,                -- 'Grade 5'
  section       VARCHAR(20),                          -- 'A'
  class_teacher_id BIGINT NULL                        -- FK -> teachers.id, added after teachers table exists
);
CREATE INDEX idx_classes_school ON classes(school_id);

CREATE TABLE subjects (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  code          VARCHAR(20)
);
CREATE INDEX idx_subjects_school ON subjects(school_id);

CREATE TABLE teachers (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- 1:1 with users (role=TEACHER)
  employee_no   VARCHAR(50),
  hire_date     DATE
);
CREATE INDEX idx_teachers_school ON teachers(school_id);

ALTER TABLE classes
  ADD CONSTRAINT fk_classes_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- Which teacher teaches which subject in which class
CREATE TABLE class_subjects (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id    BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id    BIGINT NULL REFERENCES teachers(id) ON DELETE SET NULL,
  CONSTRAINT uq_class_subject UNIQUE (class_id, subject_id)
);
CREATE INDEX idx_cs_school ON class_subjects(school_id);

-- Weekly schedule: which subject/teacher a class has, on which day/time.
CREATE TABLE timetable_slots (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL,                   -- 1=Monday ... 7=Sunday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  subject_id    BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id    BIGINT NULL REFERENCES teachers(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_class_day_start UNIQUE (class_id, day_of_week, start_time)
);
CREATE INDEX idx_tt_school ON timetable_slots(school_id);
CREATE INDEX idx_tt_class_day ON timetable_slots(class_id, day_of_week);
CREATE INDEX idx_tt_teacher ON timetable_slots(teacher_id);

-- ============================================================================
-- 4. STUDENTS & PARENTS
-- ============================================================================

CREATE TABLE students (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       BIGINT NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- nullable: young students may not need login
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  admission_no  VARCHAR(50) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender        VARCHAR(10) CHECK (gender IN ('male','female','other')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','graduated','transferred','withdrawn')),
  enrolled_at   DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_student_admission UNIQUE (school_id, admission_no)
);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A student can have multiple guardians, a parent can have multiple children -> join table
CREATE TABLE student_guardians (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- FK -> users (role=PARENT)
  relationship  VARCHAR(50),                           -- 'Father', 'Mother', 'Guardian'
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_student_parent UNIQUE (student_id, parent_user_id)
);
CREATE INDEX idx_sg_school ON student_guardians(school_id);
CREATE INDEX idx_sg_parent ON student_guardians(parent_user_id);

-- ============================================================================
-- 5. FEE MANAGEMENT
-- ============================================================================

-- Template a school defines, e.g. "Term 1 Tuition - Grade 5"
CREATE TABLE fee_structures (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id      BIGINT NULL REFERENCES classes(id) ON DELETE CASCADE, -- NULL = applies to every class
  name          VARCHAR(150) NOT NULL,
  amount_cents  BIGINT NOT NULL,
  due_date      DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fs_school ON fee_structures(school_id);

-- One invoice per student per fee_structure (generated when structure is applied)
CREATE TABLE fee_invoices (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id BIGINT NOT NULL REFERENCES fee_structures(id) ON DELETE RESTRICT,
  amount_due_cents  BIGINT NOT NULL,
  amount_paid_cents BIGINT NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overdue','waived')),
  due_date      DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fi_school ON fee_invoices(school_id);
CREATE INDEX idx_fi_student ON fee_invoices(student_id);
CREATE INDEX idx_fi_status ON fee_invoices(status);

-- Actual payment records (an invoice can be paid in installments -> many payments per invoice)
CREATE TABLE fee_payments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_id    BIGINT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount_cents  BIGINT NOT NULL,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank_transfer','card','mobile_money','other')),
  payment_ref   VARCHAR(150),
  paid_at       TIMESTAMP NOT NULL,
  recorded_by   BIGINT NOT NULL REFERENCES users(id), -- who recorded it, e.g. SchoolAdmin
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fp_school ON fee_payments(school_id);
CREATE INDEX idx_fp_invoice ON fee_payments(invoice_id);

-- Parent-submitted "I paid this" claims for a fee invoice, awaiting admin
-- confirmation against their real MoMo/bank statement. No payment gateway --
-- this just tells the admin who to expect money from and for what.
CREATE TABLE fee_payment_claims (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_id      BIGINT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents    BIGINT NOT NULL,
  payment_method  VARCHAR(20) NOT NULL CHECK (payment_method IN ('mobile_money','bank_transfer')),
  paid_at         DATE NOT NULL,
  reference       VARCHAR(150),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  reviewed_by     BIGINT NULL REFERENCES users(id),
  reviewed_at     TIMESTAMP NULL,
  review_note     VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_claims_school_status ON fee_payment_claims(school_id, status);
CREATE INDEX idx_claims_invoice ON fee_payment_claims(invoice_id);

-- ============================================================================
-- 6. RESULTS / GRADES
-- ============================================================================

CREATE TABLE exams (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,                -- 'Term 1 Exam'
  term          VARCHAR(50),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_exams_school ON exams(school_id);

-- Per-subject config for an exam (max marks, pass mark)
CREATE TABLE exam_subjects (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id       BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id    BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  max_marks     DECIMAL(6,2) NOT NULL DEFAULT 100,
  passing_marks DECIMAL(6,2) NOT NULL DEFAULT 40,
  CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)
);
CREATE INDEX idx_es_school ON exam_subjects(school_id);

-- The actual score a student got for one exam_subject
CREATE TABLE results (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_subject_id BIGINT NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marks_obtained DECIMAL(6,2) NOT NULL,
  grade         VARCHAR(5),                            -- 'A', 'B+' (computed on save)
  remarks       VARCHAR(255),
  entered_by    BIGINT NOT NULL REFERENCES users(id),  -- Teacher
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_result UNIQUE (exam_subject_id, student_id)
);
CREATE INDEX idx_results_school ON results(school_id);
CREATE INDEX idx_results_student ON results(student_id);
CREATE TRIGGER trg_results_updated_at BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. ATTENDANCE
-- ============================================================================

CREATE TABLE attendance (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  status        VARCHAR(10) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_by     BIGINT NOT NULL REFERENCES users(id), -- Teacher
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_attendance_day UNIQUE (student_id, date)
);
CREATE INDEX idx_attendance_school ON attendance(school_id);
CREATE INDEX idx_attendance_class_date ON attendance(class_id, date);

-- ============================================================================
-- 8. ANNOUNCEMENTS
-- ============================================================================

CREATE TABLE announcements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NULL REFERENCES schools(id) ON DELETE CASCADE, -- NULL = platform-wide, posted by a SuperAdmin, shown to every school
  title         VARCHAR(200) NOT NULL,
  content       TEXT NOT NULL,
  target_role   VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all','teachers','parents','students')),
  class_id      BIGINT NULL REFERENCES classes(id) ON DELETE CASCADE, -- NULL = whole school, else one class
  created_by    BIGINT NOT NULL REFERENCES users(id),
  published_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_announcements_school ON announcements(school_id);
CREATE INDEX idx_announcements_school_target ON announcements(school_id, target_role);

-- ============================================================================
-- 9. PUSH NOTIFICATIONS (Web Push — replaces SMS as the "notify parents" channel)
-- ============================================================================

-- One row per browser/device a user has opted into notifications on.
CREATE TABLE push_subscriptions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      VARCHAR(500) NOT NULL,
  p256dh        VARCHAR(255) NOT NULL,
  auth          VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_user_endpoint UNIQUE (user_id, endpoint)
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);

-- ============================================================================
-- 10. TEACHER CLOCK-IN
-- ============================================================================

-- One row per shift: clock_out_at NULL means the teacher is currently clocked in.
CREATE TABLE teacher_clock_ins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  clock_in_at   TIMESTAMP NOT NULL,
  clock_out_at  TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_clock_school ON teacher_clock_ins(school_id);
CREATE INDEX idx_clock_teacher ON teacher_clock_ins(teacher_id);

-- ============================================================================
-- 11. HOMEWORK
-- ============================================================================

-- Per class+subject. No submission/grading workflow yet (would need file
-- upload infra) — this is "post it, parents see it."
CREATE TABLE homework (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id      BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id    BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  due_date      DATE NOT NULL,
  created_by    BIGINT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_hw_school ON homework(school_id);
CREATE INDEX idx_hw_class_due ON homework(class_id, due_date);

-- ============================================================================
-- 12. STAFF LEAVE REQUESTS
-- ============================================================================

CREATE TABLE leave_requests (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        VARCHAR(500),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by   BIGINT NULL REFERENCES users(id),
  reviewed_at   TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_leave_school ON leave_requests(school_id);
CREATE INDEX idx_leave_teacher ON leave_requests(teacher_id);
CREATE INDEX idx_leave_status ON leave_requests(school_id, status);

-- ============================================================================
-- 13. ADMIN: AUDIT LOG & NOTIFICATIONS
-- ============================================================================

-- A curated trail of admin/staff actions worth reviewing later — not every
-- read/write in the app, just the ones an admin would plausibly want to
-- look back on (who added this student, who approved that leave request).
CREATE TABLE audit_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id       BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  user_name     VARCHAR(150), -- denormalized so the log still reads fine if the user is later deleted
  action        VARCHAR(100) NOT NULL,   -- e.g. 'student.created'
  description   VARCHAR(255) NOT NULL,   -- human-readable, e.g. 'Added student Kojo Mensah'
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_school_created ON audit_logs(school_id, created_at DESC);

-- Things the SchoolAdmin should know about: a parent's payment claim, a
-- teacher's leave request, a billing lifecycle event. School-wide read
-- state (not per-user) — this app is built around one admin per school.
CREATE TABLE notifications (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,    -- 'payment_claim' | 'leave_request' | 'billing'
  title         VARCHAR(200) NOT NULL,
  message       VARCHAR(500),
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notif_school_created ON notifications(school_id, created_at DESC);
CREATE INDEX idx_notif_school_unread ON notifications(school_id, is_read);

-- ============================================================================
-- 14. PLATFORM-LEVEL OPERATIONS (SuperAdmin only, not tied to one school)
-- ============================================================================

-- Single-row settings table (id is always 1) — simplest way to store a
-- handful of platform-wide toggles without inventing a generic key/value store.
CREATE TABLE platform_settings (
  id                   BIGINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode     BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message  VARCHAR(500),
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- A school raises an issue; a SuperAdmin (or scoped support sub-admin, see
-- users.superadmin_scope below) sees and responds to it.
CREATE TABLE support_tickets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id     BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by    BIGINT NOT NULL REFERENCES users(id),
  subject       VARCHAR(200) NOT NULL,
  message       TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority      VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tickets_school ON support_tickets(school_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE support_ticket_replies (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id     BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id     BIGINT NOT NULL REFERENCES users(id),
  message       TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ticket_replies_ticket ON support_ticket_replies(ticket_id);
