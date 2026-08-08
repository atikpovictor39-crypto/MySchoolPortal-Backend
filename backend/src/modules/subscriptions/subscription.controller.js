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
