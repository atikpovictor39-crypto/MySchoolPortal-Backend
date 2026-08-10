const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const subscriptionService = require('./subscription.service');

function validatePlanFields({ priceCents, billingCycle, maxStudents }) {
  if (priceCents !== undefined && (!Number.isInteger(priceCents) || priceCents < 0)) {
    return 'priceCents must be a non-negative integer (cents, not a decimal amount)';
  }
  if (billingCycle && !subscriptionService.BILLING_CYCLES.includes(billingCycle)) {
    return `billingCycle must be one of: ${subscriptionService.BILLING_CYCLES.join(', ')}`;
  }
  if (maxStudents !== undefined && maxStudents !== null && (!Number.isInteger(maxStudents) || maxStudents <= 0)) {
    return 'maxStudents must be a positive integer, or null for unlimited';
  }
  return null;
}

exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await subscriptionService.listPlans();
  return ok(res, plans);
});

// GET /subscriptions/plans/active — school-facing list of what's actually
// available to pay for (see subscription.service.js's listActivePlans).
exports.listActivePlans = asyncHandler(async (req, res) => {
  const plans = await subscriptionService.listActivePlans();
  return ok(res, plans);
});

exports.createPlan = asyncHandler(async (req, res) => {
  const { name, priceCents, billingCycle, maxStudents, features, isActive } = req.body;
  if (!name || priceCents === undefined || priceCents === null) {
    return fail(res, 'name and priceCents are required', 400);
  }
  const validationError = validatePlanFields({ priceCents, billingCycle, maxStudents });
  if (validationError) {
    return fail(res, validationError, 400);
  }

  const plan = await subscriptionService.createPlan({ name, priceCents, billingCycle, maxStudents, features, isActive });
  return ok(res, plan, 201);
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const { name, priceCents, billingCycle, maxStudents, features, isActive } = req.body;
  const validationError = validatePlanFields({ priceCents, billingCycle, maxStudents });
  if (validationError) {
    return fail(res, validationError, 400);
  }

  const plan = await subscriptionService.updatePlan(req.params.id, {
    name,
    priceCents,
    billingCycle,
    maxStudents,
    features,
    isActive,
  });
  return ok(res, plan);
});

exports.getMine = asyncHandler(async (req, res) => {
  const subscription = await subscriptionService.getMySubscription(req.schoolId);
  return ok(res, subscription);
});

// SuperAdmin action once they've confirmed a school actually paid (same
// manual-confirm idea as fee payment claims, just for platform billing).
exports.renew = asyncHandler(async (req, res) => {
  const months = req.body.months ? Number(req.body.months) : 1;
  if (!Number.isInteger(months) || months <= 0) {
    return fail(res, 'months must be a positive integer', 400);
  }
  const subscription = await subscriptionService.renewSubscription(req.params.schoolId, months);
  return ok(res, subscription);
});

// GET /internal/cron/subscriptions — invoked once a day by Vercel Cron (see
// vercel.json). Auth is a shared secret header instead of a user JWT since
// there's no logged-in user behind a cron trigger.
exports.runLifecycleCron = asyncHandler(async (req, res) => {
  const results = await subscriptionService.processSubscriptionLifecycle();
  return ok(res, results);
});

// POST /subscriptions/checkout — a SCHOOL_ADMIN paying for their own
// subscription via MoolRe. Returns a hosted checkout URL to redirect the
// browser to (card + Mobile Money) rather than handling card/MoMo details
// ourselves.
exports.checkout = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return fail(res, 'planId is required', 400);
  }
  const result = await subscriptionService.startCheckout(req.schoolId, planId);
  return ok(res, result, 201);
});

// GET /subscriptions/checkout/:externalRef — polled by the frontend after
// MoolRe redirects the browser back, in case the webhook hasn't landed yet.
exports.checkoutStatus = asyncHandler(async (req, res) => {
  const status = await subscriptionService.checkCheckoutStatus(req.schoolId, req.params.externalRef);
  return ok(res, { status });
});

// POST /subscriptions/webhook/moolre — public, called directly by MoolRe's
// servers (no user session, no CORS-relevant Origin to check). The payload
// itself is never trusted for the actual outcome — see
// subscription.service.js's handleWebhook / moolre.client.js's comments —
// this is only ever a trigger to re-verify with MoolRe using our own
// credentials. Acks 200 even when the externalref can't be identified (a
// malformed/unexpected payload shouldn't make MoolRe treat delivery as
// failed and keep retrying); a genuine server error still bubbles up as 500.
exports.moolreWebhook = asyncHandler(async (req, res) => {
  const externalRef = req.body?.data?.externalref || req.body?.externalref || req.query?.externalref;
  await subscriptionService.handleWebhook(externalRef);
  return res.status(200).json({ received: true });
});
