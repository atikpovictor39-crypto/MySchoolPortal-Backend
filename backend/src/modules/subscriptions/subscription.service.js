const crypto = require('crypto');
const db = require('../../config/db');
const emailService = require('../email/email.service');
const notificationService = require('../notifications/notification.service');
const moolreClient = require('../moolre/moolre.client');
const env = require('../../config/env');

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

// School-facing: only what a school is actually allowed to pay for. Kept
// separate from listPlans (SuperAdmin-only, sees inactive plans too) rather
// than reusing that endpoint with a role check, since a SCHOOL_ADMIN
// browsing plans to subscribe to has no business seeing retired ones.
async function listActivePlans() {
  const [rows] = await db.query(
    "SELECT id, name, price_cents, billing_cycle, max_students, features FROM subscription_plans WHERE is_active = TRUE ORDER BY price_cents ASC"
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
      await notificationService.create(row.school_id, {
        type: 'billing',
        title: 'Subscription renews soon',
        message: `Your billing period ends on ${new Date(row.current_period_end).toISOString().slice(0, 10)}.`,
      });
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
      await notificationService.create(row.school_id, {
        type: 'billing',
        title: 'Payment is now overdue',
        message: 'Your subscription period ended without payment. You have 7 days before the account is locked.',
      });
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
      await notificationService.create(row.school_id, {
        type: 'billing',
        title: 'Account locked — payment overdue',
        message: 'Sign-in is disabled until payment is made. Contact your platform administrator to restore access.',
      });
      results.markedExpired++;
    } catch (err) {
      results.errors.push(`expired for school ${row.school_id}: ${err.message}`);
    }
  }

  return results;
}

// ---- MoolRe checkout (a school paying its own subscription) ----

// One school could plausibly click "Pay now" twice in a row before the
// first checkout resolves — Date.now() alone isn't guaranteed unique
// millisecond-to-millisecond, hence the random suffix.
function generateExternalRef(schoolId) {
  return `sub-${schoolId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function getSchoolAdminContact(schoolId) {
  const [rows] = await db.query(
    "SELECT name, email FROM users WHERE school_id = ? AND role = 'SCHOOL_ADMIN' LIMIT 1",
    [schoolId]
  );
  return rows[0] || null;
}

async function getSubscriptionIdForSchool(schoolId) {
  const [rows] = await db.query(
    'SELECT id FROM subscriptions WHERE school_id = ? ORDER BY created_at DESC LIMIT 1',
    [schoolId]
  );
  return rows[0]?.id || null;
}

function periodLengthMs(billingCycle) {
  return billingCycle === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
}

// Starts a checkout: creates the pending payment row, then asks MoolRe for
// a hosted checkout link (card + Mobile Money) to redirect the school
// admin's browser to.
async function startCheckout(schoolId, planId) {
  if (!moolreClient.isConfigured) {
    const err = new Error('Online payment is not configured yet — contact your platform administrator');
    err.status = 503;
    throw err;
  }

  const plan = await getPlanById(planId);
  if (!plan || !plan.is_active) {
    const err = new Error('Plan not found or is not currently available');
    err.status = 404;
    throw err;
  }

  const admin = await getSchoolAdminContact(schoolId);
  if (!admin) {
    const err = new Error('No admin account found for this school');
    err.status = 500;
    throw err;
  }

  const externalRef = generateExternalRef(schoolId);
  const callbackUrl = `${env.backendUrl}/api/v1/subscriptions/webhook/moolre`;
  const redirectUrl = `${env.frontendUrl}/admin/subscription?ref=${externalRef}`;

  const { authorizationUrl, reference } = await moolreClient.generatePaymentLink({
    amountCents: plan.price_cents,
    email: admin.email,
    externalRef,
    callbackUrl,
    redirectUrl,
    metadata: { schoolId, planId },
  });

  await db.query(
    `INSERT INTO subscription_payments (school_id, plan_id, external_ref, amount_cents, authorization_url, moolre_reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [schoolId, planId, externalRef, plan.price_cents, authorizationUrl, reference || null]
  );

  return { authorizationUrl, externalRef };
}

async function getPaymentByRef(schoolId, externalRef) {
  const [rows] = await db.query(
    `SELECT id, school_id, plan_id, external_ref, amount_cents, status, created_at
     FROM subscription_payments WHERE external_ref = ? AND school_id = ? LIMIT 1`,
    [externalRef, schoolId]
  );
  return rows[0] || null;
}

// The one place that actually activates a subscription off a successful
// payment — called from both the webhook (fire-and-forget-ish, triggered by
// MoolRe) and the status-check endpoint (triggered by the school's own
// browser polling after returning from checkout), so it has to be safe to
// run twice for the same payment: the WHERE status = 'pending' guard makes
// the update a no-op the second time instead of extending the period twice.
async function confirmPayment(paymentId) {
  const conn = await db.getConnection();
  let schoolId, subscriptionId, periodEnd;
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT school_id, plan_id, amount_cents, status FROM subscription_payments WHERE id = ? LIMIT 1',
      [paymentId]
    );
    const payment = rows[0];
    if (!payment || payment.status !== 'pending') {
      await conn.rollback();
      return false; // already handled (or doesn't exist) — nothing to do
    }
    schoolId = payment.school_id;

    const plan = await getPlanById(payment.plan_id);
    periodEnd = new Date(Date.now() + periodLengthMs(plan?.billing_cycle));

    subscriptionId = await getSubscriptionIdForSchool(schoolId);
    if (subscriptionId) {
      await conn.query(
        `UPDATE subscriptions
         SET status = 'active', plan_id = ?, current_period_start = NOW(), current_period_end = ?,
             reminder_sent_at = NULL, payment_provider = 'moolre'
         WHERE id = ?`,
        [payment.plan_id, periodEnd, subscriptionId]
      );
    } else {
      const [result] = await conn.query(
        `INSERT INTO subscriptions (school_id, plan_id, status, current_period_start, current_period_end, payment_provider)
         VALUES (?, ?, 'active', NOW(), ?, 'moolre') RETURNING id`,
        [schoolId, payment.plan_id, periodEnd]
      );
      subscriptionId = result[0].id;
    }

    await conn.query('UPDATE subscription_payments SET status = ? WHERE id = ?', ['success', paymentId]);

    await conn.query(
      `INSERT INTO billing_events (school_id, subscription_id, event_type, payload)
       VALUES (?, ?, 'moolre.payment_confirmed', ?)`,
      [schoolId, subscriptionId, JSON.stringify({ paymentId, amountCents: payment.amount_cents })]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const admin = await getSchoolAdminContact(schoolId);
  if (admin) {
    const [schoolRows] = await db.query('SELECT name FROM schools WHERE id = ? LIMIT 1', [schoolId]);
    const schoolName = schoolRows[0]?.name || 'your school';
    const periodEndDate = periodEnd.toISOString().slice(0, 10);
    await emailService.sendPaymentConfirmedEmail(admin.email, admin.name, schoolName, periodEndDate).catch((err) => {
      console.error('Failed to send payment confirmation email:', err.message);
    });
    await notificationService.create(schoolId, {
      type: 'billing',
      title: 'Payment received',
      message: `Your subscription is active through ${periodEndDate}.`,
    });
  }

  return true;
}

// Re-checks a specific payment against MoolRe's status API (never trusts a
// webhook body directly — see moolre.client.js) and activates the
// subscription if it just succeeded. Idempotent: if it's already resolved
// (success/failed), this is just a read.
async function refreshPaymentStatus(paymentId, externalRef) {
  const { succeeded } = await moolreClient.checkPaymentStatus(externalRef);
  if (succeeded) {
    await confirmPayment(paymentId);
  }
  const [rows] = await db.query('SELECT status FROM subscription_payments WHERE id = ? LIMIT 1', [paymentId]);
  return rows[0]?.status || 'pending';
}

// Called by the school's own browser after being redirected back from
// MoolRe's checkout page — the webhook may or may not have landed yet by
// then, so this actively re-checks rather than just reading a possibly-stale row.
async function checkCheckoutStatus(schoolId, externalRef) {
  const payment = await getPaymentByRef(schoolId, externalRef);
  if (!payment) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }
  if (payment.status !== 'pending') {
    return payment.status;
  }
  return refreshPaymentStatus(payment.id, externalRef);
}

// Called by MoolRe's webhook. Deliberately tolerant of a missing/garbled
// externalref (still responds 200 so MoolRe doesn't treat it as a delivery
// failure and keep retrying) — if we can't identify the payment, there's
// nothing to act on, and the school's own status-poll after redirect is the
// reliable path anyway.
async function handleWebhook(externalRef) {
  if (!externalRef) return;
  const [rows] = await db.query(
    'SELECT id, status FROM subscription_payments WHERE external_ref = ? LIMIT 1',
    [externalRef]
  );
  const payment = rows[0];
  if (!payment || payment.status !== 'pending') return;
  await refreshPaymentStatus(payment.id, externalRef);
}

module.exports = {
  BILLING_CYCLES,
  REMINDER_DAYS_BEFORE,
  GRACE_PERIOD_DAYS,
  listPlans,
  listActivePlans,
  getPlanById,
  createPlan,
  updatePlan,
  getMySubscription,
  renewSubscription,
  processSubscriptionLifecycle,
  startCheckout,
  checkCheckoutStatus,
  handleWebhook,
};
