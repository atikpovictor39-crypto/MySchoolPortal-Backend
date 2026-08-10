const db = require('../../config/db');

// Supabase already takes automated backups of the whole database — this is
// a supplementary, on-demand export for a SuperAdmin's own peace of mind /
// portability, not a replacement for that. Excludes password_hash and
// refresh/reset token tables outright; everything else is included as-is.
const TABLES = [
  'schools',
  'subscriptions',
  'academic_years',
  'classes',
  'subjects',
  'teachers',
  'students',
  'student_guardians',
  'fee_structures',
  'fee_invoices',
  'fee_payments',
  'fee_payment_claims',
  'exams',
  'exam_subjects',
  'results',
  'attendance',
  'announcements',
  'homework',
  'timetable_slots',
  'leave_requests',
  'audit_logs',
];

async function generateBackup() {
  const backup = {
    generated_at: new Date().toISOString(),
    tables: {},
  };

  const [users] = await db.query(
    "SELECT id, school_id, role, name, email, phone, status, created_at FROM users WHERE role != 'SUPERADMIN'"
  );
  backup.tables.users = users;

  for (const table of TABLES) {
    const [rows] = await db.query(`SELECT * FROM ${table}`);
    backup.tables[table] = rows;
  }

  return backup;
}

module.exports = { generateBackup };
