const db = require('../../config/db');
const emailService = require('../email/email.service');

const BILLING_CYCLES = ['monthly', 'yearly'];

// How the monthly billing cycle plays out once a period ends without payment:
// reminder email 3 days before -> period ends, marked past_due + overdue
// email -> after a 7-day grace period still unpaid, marked expired + final
// email, and auth.controller.js blocks login for that school from then on.
const REMINDER_DAYS_BEFORE = 3;
const GRACE_PERIOD_DAYS = 7;

async function getPlanById(id) {
  const [rows] = await db.query(
    'SELECT id, name, price_cents, billing_cycle, max_students, features, is_active, created_at FROM subscription_plans WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

// Returns every plan (active and inactive) — SuperAdmin needs to see both to
// manage them; the school-creation dropdown filters to active ones itself.
async function listPlans() {
  const [rows] = await db.query(
    'SELECT id, name, price_cents, billing_cycle, max_students, features, is_active, created_at FROM subscription_plans ORDER BY price_cents ASC'
  );
  return rows;
}

async function createPlan({ name, priceCents, billingCycle, maxStudents, features, isActive }) {
  const [result] = await db.query(
    `INSERT INTO subscription_plans (name, price_cents, billing_cycle, max_students, features, is_active)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      name,
      priceCents,
      billingCycle || 'monthly',
      maxStudents ?? null,
      JSON.stringify(features || {}),
      isActive !== false,
    ]
  );
  return getPlanById(result[0].id);
}

// Every field is optional here — omitted ones keep their current value, so a
// SuperAdmin flipping just is_active doesn't need to resend the whole plan.
async function updatePlan(id, { name, priceCents, billingCycle, maxStudents, features, isActive }) {
  const existing = await getPlanById(id);
  if (!existing) {
    const err = new Error('Plan not found');
    err.status = 404;
    throw err;
  }

  await db.query(
    `UPDATE subscription_plans SET name = ?, price_cents = ?, billing_cycle = ?, max_students = ?, features = ?, is_active = ? WHERE id = ?`,
    [
      name ?? existing.name,
      priceCents ?? existing.price_cents,
      billingCycle ?? existing.billing_cycle,
      maxStudents !== undefined ? maxStudents : existing.max_students,
      features ? JSON.stringify(features) : JSON.stringify(existing.features || {}),
      isActive !== undefined ? Boolean(isActive) : existing.is_active,
      id,
    ]
  );
  return getPlanById(id);
}

async function getMySubscription(schoolId) {
  const [rows] = await db.query(
    `SELECT sub.status, sub.trial_ends_at, sub.current_period_start, sub.current_period_end,
       p.id AS plan_id, p.name AS plan_name, p.price_cents, p.billing_cycle, p.max_students
     FROM subscriptions sub
     JOIN subscription_plans p ON p.id = sub.plan_id
     WHERE sub.school_id = ?
     ORDER BY sub.created_at DESC LIMIT 1`,
    [schoolId]
  );
  return rows[0] || null;
}

// SuperAdmin action once they've confirmed payment landed (same manual-
// confirm pattern as fee payment claims, just for the platform's own
// billing instead of a school's student fees) — resets the period to a
// fresh window from now and clears the reminder flag for the new cycle.
async function renewSubscription(schoolId, months = 1) {
  const [rows] = await db.query(
    'SELECT id FROM subscriptions WHERE school_id = ? ORDER BY created_at DESC LIMIT 1',
    [schoolId]
  );
  const subscription = rows[0];
  if (!subscription) {
    const err = new Error('No subscription found for this school');
    err.status = 404;
    throw err;
  }

  const periodEnd = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
  await db.query(
    `UPDATE subscriptions
     SET status = 'active', current_period_start = NOW(), current_period_end = ?, reminder_sent_at = NULL
     WHERE id = ?`,
    [periodEnd, subscription.id]
  );
  return getMySubscription(schoolId);
}

// The daily cron's actual work: three independent passes (reminder / mark
// past_due / mark expired), each targeting a disjoint set of rows so a
// school is only ever touched by one of them per run.
async function processSubscriptionLifecycle() {
  const results = { remindersSent: 0, markedPastDue: 0, markedExpired: 0, errors: [] };

  const [dueForReminder] = await db.query(
    `SELECT sub.id, sub.school_id, sub.current_period_end, s.name AS school_name,
       u.email AS admin_email, u.name AS admin_name
     FROM subscriptions sub
     JOIN schools s ON s.id = sub.school_id
     JOIN users u ON u.school_id = s.id AND u.role = 'SCHOOL_ADMIN'
     WHERE sub.status IN ('trialing', 'active')
       AND sub.reminder_sent_at IS NULL
       AND sub.current_period_end > NOW()
       AND sub.current_period_end <= NOW() + INTERVAL '${REMINDER_DAYS_BEFORE} days'`
  );
  for (const row of dueForReminder) {
    try {
      await emailService.sendReminderEmail(
        row.admin_email,
        row.admin_name,
        row.school_name,
        new Date(row.current_period_end).toISOString().slice(0, 10)
      );
      await db.query('UPDATE subscriptions SET reminder_sent_at = NOW() WHERE id = ?', [row.id]);
      results.remindersSent++;
    } catch (err) {
      results.errors.push(`reminder for school ${row.school_id}: ${err.message}`);
    }
  }

  const [dueForPastDue] = await db.query(
    `SELECT sub.id, sub.school_id, s.name AS school_name, u.email AS admin_email, u.name AS admin_name
     FROM subscriptions sub
     JOIN schools s ON s.id = sub.school_id
     JOIN users u ON u.school_id = s.id AND u.role = 'SCHOOL_ADMIN'
     WHERE sub.status IN ('trialing', 'active') AND sub.current_period_end <= NOW()`
  );
  for (const row of dueForPastDue) {
    try {
      await db.query("UPDATE subscriptions SET status = 'past_due' WHERE id = ?", [row.id]);
      await emailService.sendOverdueEmail(row.admin_email, row.admin_name, row.school_name);
      results.markedPastDue++;
    } catch (err) {
      results.errors.push(`past_due for school ${row.school_id}: ${err.message}`);
    }
  }

  const [dueForExpired] = await db.query(
    `SELECT sub.id, sub.school_id, s.name AS school_name, u.email AS admin_email, u.name AS admin_name
     FROM subscriptions sub
     JOIN schools s ON s.id = sub.school_id
     JOIN users u ON u.school_id = s.id AND u.role = 'SCHOOL_ADMIN'
     WHERE sub.status = 'past_due'
       AND sub.current_period_end <= NOW() - INTERVAL '${GRACE_PERIOD_DAYS} days'`
  );
  for (const row of dueForExpired) {
    try {
      await db.query("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [row.id]);
      await emailService.sendExpiredEmail(row.admin_email, row.admin_name, row.school_name);
      results.markedExpired++;
    } catch (err) {
      results.errors.push(`expired for school ${row.school_id}: ${err.message}`);
    }
  }

  return results;
}

module.exports = {
  BILLING_CYCLES,
  REMINDER_DAYS_BEFORE,
  GRACE_PERIOD_DAYS,
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  getMySubscription,
  renewSubscription,
  processSubscriptionLifecycle,
};
