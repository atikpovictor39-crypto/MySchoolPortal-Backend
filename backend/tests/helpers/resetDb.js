const db = require('../../src/config/db');

// Every tenant/user table except subscription_plans, which stays seeded so
// registerSchool() always has a plan to attach the trial subscription to.
const TABLES_TO_TRUNCATE = [
  'billing_events',
  'subscription_payments',
  'subscriptions',
  'refresh_tokens',
  'password_reset_tokens',
  'push_subscriptions',
  'teacher_clock_ins',
  'leave_requests',
  'homework',
  'announcements',
  'attendance',
  'report_card_notes',
  'results',
  'exam_subjects',
  'exams',
  'fee_payment_claims',
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
// assertions about specific IDs stay predictable and readable. CASCADE lets
// Postgres truncate all of these in one go regardless of FK dependency
// order; RESTART IDENTITY is the equivalent of resetting AUTO_INCREMENT.
async function resetDatabase() {
  await db.query(`TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} RESTART IDENTITY CASCADE`);
}

module.exports = { resetDatabase };
