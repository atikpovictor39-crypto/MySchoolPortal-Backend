-- ============================================================================
-- Multi-Tenant School Management SaaS — MySQL Schema (MVP)
-- Tenancy model: shared database, shared tables, row-level isolation via
-- school_id on every tenant-owned table. See README notes at bottom.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- ============================================================================
-- 1. PLATFORM LEVEL (no school_id — these are cross-tenant / global)
-- ============================================================================

-- Tenants themselves
CREATE TABLE schools (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  slug          VARCHAR(150) NOT NULL UNIQUE,        -- used in subdomain/URL, e.g. greenwood.yourapp.com
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(30),
  address       VARCHAR(255),
  logo_url      VARCHAR(500),
  status        ENUM('active','suspended','archived') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Plans SuperAdmin defines (Free/Basic/Pro etc.) — global, not per-school
CREATE TABLE subscription_plans (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  price_cents     INT UNSIGNED NOT NULL,
  billing_cycle   ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  max_students    INT UNSIGNED,                      -- NULL = unlimited
  features        JSON,                               -- {"attendance": true, "results": true, ...}
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- One active/inactive subscription record per school
CREATE TABLE subscriptions (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id           BIGINT UNSIGNED NOT NULL,
  plan_id             BIGINT UNSIGNED NOT NULL,
  status              ENUM('trialing','active','past_due','cancelled','expired') NOT NULL DEFAULT 'trialing',
  trial_ends_at       DATETIME,
  current_period_start DATETIME,
  current_period_end  DATETIME,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  payment_provider    VARCHAR(50),                   -- 'stripe', 'paystack', 'flutterwave' ...
  payment_customer_ref VARCHAR(150),                 -- provider's customer id
  payment_sub_ref      VARCHAR(150),                 -- provider's subscription id
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  INDEX idx_sub_school (school_id),
  INDEX idx_sub_status (status)
) ENGINE=InnoDB;

-- Optional but recommended: raw log of billing events (webhooks) for audit/debug
CREATE TABLE billing_events (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED,
  event_type    VARCHAR(100) NOT NULL,               -- 'invoice.paid', 'subscription.cancelled' ...
  payload       JSON,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  INDEX idx_billing_school (school_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 2. USERS & AUTH (school_id NULLABLE — NULL only for SUPERADMIN)
-- ============================================================================

CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NULL,                -- NULL = platform SuperAdmin
  role          ENUM('SUPERADMIN','SCHOOL_ADMIN','TEACHER','PARENT','STUDENT') NOT NULL,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,         -- global unique -> simple login (no school picker needed)
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  status        ENUM('active','invited','suspended') NOT NULL DEFAULT 'invited',
  last_login_at DATETIME,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  INDEX idx_users_school (school_id),
  INDEX idx_users_school_role (school_id, role)
) ENGINE=InnoDB;

-- Refresh tokens (JWT access tokens stay stateless/short-lived; refresh tokens are stored so they can be revoked)
CREATE TABLE refresh_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    DATETIME NOT NULL,
  revoked_at    DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    DATETIME NOT NULL,
  used_at       DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 3. ACADEMIC STRUCTURE (all tenant-scoped -> school_id NOT NULL)
-- ============================================================================

CREATE TABLE academic_years (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(50) NOT NULL,                -- '2025/2026'
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_current    TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  INDEX idx_ay_school (school_id)
) ENGINE=InnoDB;

CREATE TABLE classes (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(50) NOT NULL,                -- 'Grade 5'
  section       VARCHAR(20),                          -- 'A'
  class_teacher_id BIGINT UNSIGNED NULL,              -- FK -> teachers.id, set after teachers table exists
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  INDEX idx_classes_school (school_id)
) ENGINE=InnoDB;

CREATE TABLE subjects (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  code          VARCHAR(20),
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  INDEX idx_subjects_school (school_id)
) ENGINE=InnoDB;

CREATE TABLE teachers (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL UNIQUE,      -- 1:1 with users (role=TEACHER)
  employee_no   VARCHAR(50),
  hire_date     DATE,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_teachers_school (school_id)
) ENGINE=InnoDB;

ALTER TABLE classes
  ADD CONSTRAINT fk_classes_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- Which teacher teaches which subject in which class
CREATE TABLE class_subjects (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  subject_id    BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NULL,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE KEY uq_class_subject (class_id, subject_id),
  INDEX idx_cs_school (school_id)
) ENGINE=InnoDB;

-- Weekly schedule: which subject/teacher a class has, on which day/time.
CREATE TABLE timetable_slots (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  day_of_week   TINYINT UNSIGNED NOT NULL,           -- 1=Monday ... 7=Sunday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  subject_id    BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE KEY uq_class_day_start (class_id, day_of_week, start_time),
  INDEX idx_tt_school (school_id),
  INDEX idx_tt_class_day (class_id, day_of_week),
  INDEX idx_tt_teacher (teacher_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 4. STUDENTS & PARENTS
-- ============================================================================

CREATE TABLE students (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NULL UNIQUE,          -- nullable: young students may not need login
  class_id      BIGINT UNSIGNED NOT NULL,
  admission_no  VARCHAR(50) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender        ENUM('male','female','other'),
  status        ENUM('active','graduated','transferred','withdrawn') NOT NULL DEFAULT 'active',
  enrolled_at   DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_student_admission (school_id, admission_no),
  INDEX idx_students_school (school_id),
  INDEX idx_students_class (class_id)
) ENGINE=InnoDB;

-- A student can have multiple guardians, a parent can have multiple children -> join table
CREATE TABLE student_guardians (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,            -- FK -> users (role=PARENT)
  relationship  VARCHAR(50),                           -- 'Father', 'Mother', 'Guardian'
  is_primary    TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_student_parent (student_id, parent_user_id),
  INDEX idx_sg_school (school_id),
  INDEX idx_sg_parent (parent_user_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 5. FEE MANAGEMENT
-- ============================================================================

-- Template a school defines, e.g. "Term 1 Tuition - Grade 5"
CREATE TABLE fee_structures (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NULL,                 -- NULL = applies to every class
  name          VARCHAR(150) NOT NULL,
  amount_cents  BIGINT UNSIGNED NOT NULL,
  due_date      DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  INDEX idx_fs_school (school_id)
) ENGINE=InnoDB;

-- One invoice per student per fee_structure (generated when structure is applied)
CREATE TABLE fee_invoices (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  fee_structure_id BIGINT UNSIGNED NOT NULL,
  amount_due_cents  BIGINT UNSIGNED NOT NULL,
  amount_paid_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status        ENUM('unpaid','partial','paid','overdue','waived') NOT NULL DEFAULT 'unpaid',
  due_date      DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE RESTRICT,
  INDEX idx_fi_school (school_id),
  INDEX idx_fi_student (student_id),
  INDEX idx_fi_status (status)
) ENGINE=InnoDB;

-- Actual payment records (an invoice can be paid in installments -> many payments per invoice)
CREATE TABLE fee_payments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  invoice_id    BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  amount_cents  BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('cash','bank_transfer','card','mobile_money','other') NOT NULL DEFAULT 'cash',
  payment_ref   VARCHAR(150),
  paid_at       DATETIME NOT NULL,
  recorded_by   BIGINT UNSIGNED NOT NULL,             -- FK -> users.id (who recorded it, e.g. SchoolAdmin)
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES fee_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  INDEX idx_fp_school (school_id),
  INDEX idx_fp_invoice (invoice_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 6. RESULTS / GRADES
-- ============================================================================

CREATE TABLE exams (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150) NOT NULL,                -- 'Term 1 Exam'
  term          VARCHAR(50),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  INDEX idx_exams_school (school_id)
) ENGINE=InnoDB;

-- Per-subject config for an exam (max marks, pass mark)
CREATE TABLE exam_subjects (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  exam_id       BIGINT UNSIGNED NOT NULL,
  subject_id    BIGINT UNSIGNED NOT NULL,
  max_marks     DECIMAL(6,2) NOT NULL DEFAULT 100,
  passing_marks DECIMAL(6,2) NOT NULL DEFAULT 40,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_exam_subject (exam_id, subject_id),
  INDEX idx_es_school (school_id)
) ENGINE=InnoDB;

-- The actual score a student got for one exam_subject
CREATE TABLE results (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  exam_subject_id BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  marks_obtained DECIMAL(6,2) NOT NULL,
  grade         VARCHAR(5),                            -- 'A', 'B+' (computed on save)
  remarks       VARCHAR(255),
  entered_by    BIGINT UNSIGNED NOT NULL,               -- FK -> users.id (Teacher)
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (entered_by) REFERENCES users(id),
  UNIQUE KEY uq_result (exam_subject_id, student_id),
  INDEX idx_results_school (school_id),
  INDEX idx_results_student (student_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 7. ATTENDANCE
-- ============================================================================

CREATE TABLE attendance (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  date          DATE NOT NULL,
  status        ENUM('present','absent','late','excused') NOT NULL,
  marked_by     BIGINT UNSIGNED NOT NULL,               -- FK -> users.id (Teacher)
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id),
  UNIQUE KEY uq_attendance_day (student_id, date),
  INDEX idx_attendance_school (school_id),
  INDEX idx_attendance_class_date (class_id, date)
) ENGINE=InnoDB;

-- ============================================================================
-- 8. ANNOUNCEMENTS
-- ============================================================================

CREATE TABLE announcements (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  title         VARCHAR(200) NOT NULL,
  content       TEXT NOT NULL,
  target_role   ENUM('all','teachers','parents','students') NOT NULL DEFAULT 'all',
  class_id      BIGINT UNSIGNED NULL,                   -- NULL = whole school, else one class
  created_by    BIGINT UNSIGNED NOT NULL,
  published_at  DATETIME,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_announcements_school (school_id),
  INDEX idx_announcements_school_target (school_id, target_role)
) ENGINE=InnoDB;

-- ============================================================================
-- 9. PUSH NOTIFICATIONS (Web Push — replaces SMS as the "notify parents" channel)
-- ============================================================================

-- One row per browser/device a user has opted into notifications on.
CREATE TABLE push_subscriptions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  endpoint      VARCHAR(500) NOT NULL,
  p256dh        VARCHAR(255) NOT NULL,
  auth          VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_endpoint (user_id, endpoint(255)),
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 10. TEACHER CLOCK-IN
-- ============================================================================

-- One row per shift: clock_out_at NULL means the teacher is currently clocked in.
CREATE TABLE teacher_clock_ins (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NOT NULL,
  clock_in_at   DATETIME NOT NULL,
  clock_out_at  DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  INDEX idx_clock_school (school_id),
  INDEX idx_clock_teacher (teacher_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 11. HOMEWORK
-- ============================================================================

-- Per class+subject. No submission/grading workflow yet (would need file
-- upload infra) — this is "post it, parents see it."
CREATE TABLE homework (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  class_id      BIGINT UNSIGNED NOT NULL,
  subject_id    BIGINT UNSIGNED NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  due_date      DATE NOT NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_hw_school (school_id),
  INDEX idx_hw_class_due (class_id, due_date)
) ENGINE=InnoDB;

-- ============================================================================
-- 12. STAFF LEAVE REQUESTS
-- ============================================================================

CREATE TABLE leave_requests (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id     BIGINT UNSIGNED NOT NULL,
  teacher_id    BIGINT UNSIGNED NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        VARCHAR(500),
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by   BIGINT UNSIGNED NULL,
  reviewed_at   DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_leave_school (school_id),
  INDEX idx_leave_teacher (teacher_id),
  INDEX idx_leave_status (school_id, status)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
