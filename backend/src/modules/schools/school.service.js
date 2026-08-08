const crypto = require('crypto');
const db = require('../../config/db');
const { hashPassword } = require('../../utils/password');

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

async function getSchoolById(id) {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.slug, s.email, s.status, s.created_at,
       sub.status AS subscription_status, sub.plan_id
     FROM schools s
     LEFT JOIN subscriptions sub ON sub.school_id = s.id
     WHERE s.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listSchools() {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.slug, s.email, s.status, s.created_at,
       sub.status AS subscription_status, sub.plan_id
     FROM schools s
     LEFT JOIN subscriptions sub ON sub.school_id = s.id
     ORDER BY s.created_at DESC`
  );
  return rows;
}

// SuperAdmin-led onboarding for an already-vetted customer — same shape as
// auth.service.registerSchoolWithAdmin, but the subscription starts 'active'
// rather than 'trialing' since a human (not a self-serve signup) created it.
async function createSchool({ name, adminName, adminEmail, adminPassword, planId }) {
  const conn = await db.getConnection();
  let schoolId;
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]);
    if (existing.length > 0) {
      const err = new Error('Email is already registered');
      err.status = 409;
      throw err;
    }
    if (!adminPassword || adminPassword.length < 8) {
      const err = new Error('adminPassword must be at least 8 characters');
      err.status = 400;
      throw err;
    }

    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const [plans] = await conn.query(
        'SELECT id FROM subscription_plans WHERE is_active = 1 ORDER BY price_cents ASC LIMIT 1'
      );
      if (plans.length === 0) {
        const err = new Error('No subscription plan is configured yet');
        err.status = 500;
        throw err;
      }
      resolvedPlanId = plans[0].id;
    }

    const [schoolResult] = await conn.query(
      'INSERT INTO schools (name, slug, email, status) VALUES (?, ?, ?, ?)',
      [name, slugify(name), adminEmail, 'active']
    );
    schoolId = schoolResult.insertId;

    const passwordHash = await hashPassword(adminPassword);
    await conn.query(
      'INSERT INTO users (school_id, role, name, email, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
      [schoolId, 'SCHOOL_ADMIN', adminName, adminEmail, passwordHash, 'active']
    );

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await conn.query(
      `INSERT INTO subscriptions (school_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, ?, 'active', NOW(), ?)`,
      [schoolId, resolvedPlanId, periodEnd]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getSchoolById(schoolId);
}

module.exports = { listSchools, getSchoolById, createSchool };
