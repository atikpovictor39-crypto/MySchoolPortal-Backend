const db = require('../../config/db');

const BILLING_CYCLES = ['monthly', 'yearly'];

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

module.exports = {
  BILLING_CYCLES,
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  getMySubscription,
};
