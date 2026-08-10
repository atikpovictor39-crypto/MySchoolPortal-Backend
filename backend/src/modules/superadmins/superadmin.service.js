const db = require('../../config/db');
const { hashPassword } = require('../../utils/password');

async function listSuperAdmins() {
  const [rows] = await db.query(
    "SELECT id, name, email, status, created_at FROM users WHERE role = 'SUPERADMIN' ORDER BY created_at"
  );
  return rows;
}

// must_change_password = TRUE, same as every other admin-created account
// (teachers, guardians) — the temp password is only known long enough to
// hand it off, then it has to be replaced before the account is usable.
async function createSuperAdmin({ name, email, password }) {
  const [existing] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    const err = new Error('Email is already registered');
    err.status = 409;
    throw err;
  }
  if (!password || password.length < 8) {
    const err = new Error('password must be at least 8 characters');
    err.status = 400;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const [result] = await db.query(
    `INSERT INTO users (school_id, role, name, email, password_hash, status, must_change_password)
     VALUES (NULL, 'SUPERADMIN', ?, ?, ?, 'active', TRUE) RETURNING id, name, email, status, created_at`,
    [name, email, passwordHash]
  );
  return result[0];
}

async function updateSuperAdminStatus(id, status) {
  const [result] = await db.query(
    "UPDATE users SET status = ? WHERE id = ? AND role = 'SUPERADMIN' RETURNING id, name, email, status, created_at",
    [status, id]
  );
  return result[0] || null;
}

module.exports = { listSuperAdmins, createSuperAdmin, updateSuperAdminStatus };
