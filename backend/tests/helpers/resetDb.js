const db = require('../../src/config/db');

// Every tenant/user table except subscription_plans, which stays seeded so
// registerSchool() always has a plan to attach the trial subscription to.
const TABLES_TO_TRUNCATE = [
  'billing_events',
  'subscriptions',
  'refresh_tokens',
  'password_reset_tokens',
  'push_subscriptions',
  'teacher_clock_ins',
  'leave_requests',
  'homework',
  'announcements',
  'attendance',
  'results',
  'exam_subjects',
  'exams',
  'fee_payments',
  'fee_invoices',
  'fee_structures',
  'student_guardians',
  'students',
  'timetable_slots',
  'class_subjects',
  'teachers',
  'subjects',
  'classes',
  'academic_years',
  'users',
  'schools',
];

// Gives every test file a clean slate with auto-increment reset to 1, so
// assertions about specific IDs stay predictable and readable.
async function resetDatabase() {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES_TO_TRUNCATE) {
    await db.query(`TRUNCATE TABLE ${table}`);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

module.exports = { resetDatabase };
