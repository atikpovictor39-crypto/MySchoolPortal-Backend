const db = require('../../config/db');

const TYPES = ['payment_claim', 'leave_request', 'billing'];

// Callers `await` this directly, same as audit.service.js's record() —
// errors are swallowed internally so the parent action (a claim submitted,
// a subscription lapsing) always succeeds regardless of whether the
// "let the admin know" side-effect does.
async function create(schoolId, { type, title, message }) {
  try {
    await db.query('INSERT INTO notifications (school_id, type, title, message) VALUES (?, ?, ?, ?)', [
      schoolId,
      type,
      title,
      message || null,
    ]);
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

async function list(schoolId, { limit = 50 } = {}) {
  const [rows] = await db.query(
    'SELECT id, type, title, message, is_read, created_at FROM notifications WHERE school_id = ? ORDER BY created_at DESC LIMIT ?',
    [schoolId, limit]
  );
  return rows;
}

async function countUnread(schoolId) {
  const [rows] = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE school_id = ? AND is_read = FALSE',
    [schoolId]
  );
  return Number(rows[0].count);
}

async function markRead(schoolId, id) {
  const [result] = await db.query('UPDATE notifications SET is_read = TRUE WHERE school_id = ? AND id = ?', [
    schoolId,
    id,
  ]);
  return result.affectedRows > 0;
}

async function markAllRead(schoolId) {
  await db.query('UPDATE notifications SET is_read = TRUE WHERE school_id = ? AND is_read = FALSE', [schoolId]);
}

module.exports = { TYPES, create, list, countUnread, markRead, markAllRead };
