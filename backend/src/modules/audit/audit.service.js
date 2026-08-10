const db = require('../../config/db');

// Callers `await` this directly (never fire-and-forget) — on Vercel a
// serverless function's execution can be frozen the instant the HTTP
// response is sent, so an un-awaited promise here could simply never
// finish. Errors are swallowed internally instead (same principle as
// email.service.js's sendEmail) so a logging failure never fails the
// action it's describing.
//
// user_name is denormalized here (not left to a JOIN at read time) so it
// reflects the name at the moment of the action, and the log still reads
// fine if that user is later removed (user_id -> ON DELETE SET NULL).
async function record({ schoolId, userId, action, description }) {
  try {
    let userName = null;
    if (userId) {
      const [rows] = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId]);
      userName = rows[0]?.name || null;
    }
    await db.query(
      'INSERT INTO audit_logs (school_id, user_id, user_name, action, description) VALUES (?, ?, ?, ?, ?)',
      [schoolId, userId || null, userName, action, description]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

async function listAuditLogs(schoolId, { limit = 100 } = {}) {
  const [rows] = await db.query(
    'SELECT id, user_name, action, description, created_at FROM audit_logs WHERE school_id = ? ORDER BY created_at DESC LIMIT ?',
    [schoolId, limit]
  );
  return rows;
}

// SuperAdmin-only, cross-school view — same table, no school_id filter
// unless one is explicitly requested to narrow down to a single school.
async function listAllAuditLogs({ limit = 200, schoolId } = {}) {
  if (schoolId) {
    const [rows] = await db.query(
      `SELECT a.id, a.school_id, s.name AS school_name, a.user_name, a.action, a.description, a.created_at
       FROM audit_logs a JOIN schools s ON s.id = a.school_id
       WHERE a.school_id = ? ORDER BY a.created_at DESC LIMIT ?`,
      [schoolId, limit]
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT a.id, a.school_id, s.name AS school_name, a.user_name, a.action, a.description, a.created_at
     FROM audit_logs a JOIN schools s ON s.id = a.school_id
     ORDER BY a.created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { record, listAuditLogs, listAllAuditLogs };
