const crypto = require('crypto');
const db = require('../../config/db');
const { hashPassword } = require('../../utils/password');

const SCHOOL_STATUSES = ['active', 'suspended', 'archived'];

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

async function getSchoolById(id) {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.slug, s.email, s.status, s.created_at,
       sub.status AS subscription_status, sub.plan_id, p.name AS plan_name
     FROM schools s
     LEFT JOIN subscriptions sub ON sub.school_id = s.id
     LEFT JOIN subscription_plans p ON p.id = sub.plan_id
     WHERE s.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listSchools() {
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.slug, s.email, s.status, s.created_at,
       sub.status AS subscription_status, sub.plan_id, p.name AS plan_name
     FROM schools s
     LEFT JOIN subscriptions sub ON sub.school_id = s.id
     LEFT JOIN subscription_plans p ON p.id = sub.plan_id
     ORDER BY s.created_at DESC`
  );
  return rows;
}

// Suspending blocks that school's users at login/refresh (see auth.controller)
// without touching their accounts individually — reactivating just flips it
// back, no data is affected either way.
async function updateSchoolStatus(schoolId, status) {
  if (!SCHOOL_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${SCHOOL_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const [result] = await db.query('UPDATE schools SET status = ? WHERE id = ?', [status, schoolId]);
  if (result.affectedRows === 0) {
    const err = new Error('School not found');
    err.status = 404;
    throw err;
  }
  return getSchoolById(schoolId);
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
        'SELECT id FROM subscription_plans WHERE is_active = TRUE ORDER BY price_cents ASC LIMIT 1'
      );
      if (plans.length === 0) {
        const err = new Error('No subscription plan is configured yet');
        err.status = 500;
        throw err;
      }
      resolvedPlanId = plans[0].id;
    }

    const [schoolResult] = await conn.query(
      'INSERT INTO schools (name, slug, email, status) VALUES (?, ?, ?, ?) RETURNING id',
      [name, slugify(name), adminEmail, 'active']
    );
    schoolId = schoolResult[0].id;

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

// Full profile a SchoolAdmin can view/edit about their own school — wider
// than getSchoolById (which is the SuperAdmin listing shape) since this
// also exposes phone/address/logo for the School Details admin page.
async function getSchoolProfile(schoolId) {
  const [rows] = await db.query(
    `SELECT id, name, slug, email, phone, address, logo_url, headmaster_signature,
       show_grades_on_report_card, status, created_at
     FROM schools WHERE id = ? LIMIT 1`,
    [schoolId]
  );
  return rows[0] || null;
}

async function updateSchoolProfile(
  schoolId,
  { name, email, phone, address, logoUrl, headmasterSignature, showGradesOnReportCard }
) {
  await db.query(
    `UPDATE schools SET
       name = COALESCE(?, name),
       email = COALESCE(?, email),
       phone = ?,
       address = ?,
       logo_url = ?,
       headmaster_signature = ?,
       show_grades_on_report_card = COALESCE(?, show_grades_on_report_card)
     WHERE id = ?`,
    [
      name || null,
      email || null,
      phone || null,
      address || null,
      logoUrl || null,
      headmasterSignature || null,
      showGradesOnReportCard === undefined ? null : showGradesOnReportCard,
      schoolId,
    ]
  );
  return getSchoolProfile(schoolId);
}

// Manual fee-payment channels (Mobile Money + bank account) that a school
// shows parents so they know where to send money. No payment gateway yet —
// this is purely informational, the SchoolAdmin still records payments by
// hand once they see the money land via /fees/invoices/:id/payments.
async function getPaymentDetails(schoolId) {
  const [rows] = await db.query(
    `SELECT momo_provider, momo_number, momo_account_name,
            bank_name, bank_account_number, bank_account_name
     FROM schools WHERE id = ? LIMIT 1`,
    [schoolId]
  );
  return rows[0] || null;
}

async function updatePaymentDetails(schoolId, details) {
  await db.query(
    `UPDATE schools SET
       momo_provider = ?, momo_number = ?, momo_account_name = ?,
       bank_name = ?, bank_account_number = ?, bank_account_name = ?
     WHERE id = ?`,
    [
      details.momoProvider || null,
      details.momoNumber || null,
      details.momoAccountName || null,
      details.bankName || null,
      details.bankAccountNumber || null,
      details.bankAccountName || null,
      schoolId,
    ]
  );
  return getPaymentDetails(schoolId);
}

module.exports = {
  SCHOOL_STATUSES,
  listSchools,
  getSchoolById,
  createSchool,
  updateSchoolStatus,
  getSchoolProfile,
  updateSchoolProfile,
  getPaymentDetails,
  updatePaymentDetails,
};
