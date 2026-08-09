const crypto = require('crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const { hashPassword } = require('../../utils/password');
const { msFromDuration } = require('../../utils/time');
const emailService = require('../email/email.service');

// LEFT JOIN, not JOIN — SuperAdmin has no school_id, and must still be able to log in.
// school_status and subscription_status travel along so login/refresh can
// reject a suspended school or one whose billing has lapsed without a second query.
async function findUserByEmail(email) {
  const [rows] = await db.query(
    `SELECT u.id, u.school_id, u.role, u.name, u.email, u.password_hash, u.status,
       s.name AS school_name, s.status AS school_status, s.is_demo AS is_demo, sub.status AS subscription_status
     FROM users u
     LEFT JOIN schools s ON s.id = u.school_id
     LEFT JOIN subscriptions sub ON sub.school_id = s.id
     WHERE u.email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.school_id, u.role, u.name, u.email, u.status,
       s.name AS school_name, s.status AS school_status, s.is_demo AS is_demo, sub.status AS subscription_status
     FROM users u
     LEFT JOIN schools s ON s.id = u.school_id
     LEFT JOIN subscriptions sub ON sub.school_id = s.id
     WHERE u.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function touchLastLogin(userId) {
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
}

// Refresh tokens are hashed before storage — same principle as password
// hashing: a DB leak shouldn't hand out tokens usable to impersonate users.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function storeRefreshToken(userId, rawToken) {
  const expiresAt = new Date(Date.now() + msFromDuration(env.jwt.refreshExpiresIn));
  await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    hashToken(rawToken),
    expiresAt,
  ]);
}

async function findValidRefreshToken(rawToken) {
  const [rows] = await db.query(
    'SELECT id, user_id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1',
    [hashToken(rawToken)]
  );
  return rows[0] || null;
}

async function revokeRefreshToken(rawToken) {
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [hashToken(rawToken)]);
}

function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const suffix = crypto.randomBytes(3).toString('hex'); // avoids collisions between schools with similar names
  return `${base}-${suffix}`;
}

// Self-service signup: creates a new School + its first SCHOOL_ADMIN user +
// a trialing subscription, all in one transaction so a failure partway
// through never leaves an orphaned school or userless tenant behind.
async function registerSchoolWithAdmin({ schoolName, adminName, adminEmail, adminPassword, planId }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);
    if (existing.length > 0) {
      const err = new Error('Email is already registered');
      err.status = 409;
      throw err;
    }

    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const [plans] = await conn.query(
        'SELECT id FROM subscription_plans WHERE is_active = TRUE ORDER BY price_cents ASC LIMIT 1'
      );
      if (plans.length === 0) {
        const err = new Error('No subscription plan is configured yet — ask the SuperAdmin to create one');
        err.status = 500;
        throw err;
      }
      resolvedPlanId = plans[0].id;
    }

    const [schoolResult] = await conn.query(
      'INSERT INTO schools (name, slug, email, status) VALUES (?, ?, ?, ?) RETURNING id',
      [schoolName, slugify(schoolName), adminEmail, 'active']
    );
    const schoolId = schoolResult[0].id;

    const passwordHash = await hashPassword(adminPassword);
    const [userResult] = await conn.query(
      'INSERT INTO users (school_id, role, name, email, password_hash, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [schoolId, 'SCHOOL_ADMIN', adminName, adminEmail, passwordHash, 'active']
    );
    const userId = userResult[0].id;

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial
    await conn.query(
      `INSERT INTO subscriptions (school_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
       VALUES (?, ?, 'trialing', ?, NOW(), ?)`,
      [schoolId, resolvedPlanId, trialEndsAt, trialEndsAt]
    );

    await conn.commit();

    // Best-effort, outside the transaction — a flaky email provider must
    // never turn a successful signup into a failed one.
    emailService.sendWelcomeEmail(adminEmail, adminName, schoolName).catch((err) => {
      console.error('Failed to send welcome email:', err.message);
    });

    return {
      id: userId,
      school_id: schoolId,
      role: 'SCHOOL_ADMIN',
      name: adminName,
      email: adminEmail,
      school_name: schoolName,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  touchLastLogin,
  storeRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  registerSchoolWithAdmin,
};
