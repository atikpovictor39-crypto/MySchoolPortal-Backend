// One-off migration: add the per-exam class-teacher signature columns that
// schema.sql gained (commit "feat: continue SAAS work") to an already-live
// database. Without them, every exams query fails with:
//   column "teacher_name" does not exist
//
// Run with:  node src/scripts/add-exam-teacher-columns.js            (local .env)
//            NODE_ENV=production node src/scripts/add-exam-teacher-columns.js
//                                                                      (Supabase)
// Idempotent — ADD COLUMN IF NOT EXISTS makes re-runs harmless.
const db = require('../config/db');

async function main() {
  await db.query(`
    ALTER TABLE exams
      ADD COLUMN IF NOT EXISTS teacher_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS teacher_signature VARCHAR(255),
      ADD COLUMN IF NOT EXISTS teacher_signed_date DATE
  `);

  const [cols] = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'exams' AND column_name IN ('teacher_name', 'teacher_signature', 'teacher_signed_date')
     ORDER BY column_name`
  );
  console.log('exams teacher columns now present:', cols.map((c) => c.column_name).join(', '));

  if (cols.length !== 3) {
    throw new Error(`Expected 3 columns after migration, found ${cols.length}`);
  }
  console.log('Migration OK');
}

main()
  .then(() => db.end())
  .catch(async (err) => {
    console.error('Migration failed:', err.message);
    await db.end();
    process.exit(1);
  });
