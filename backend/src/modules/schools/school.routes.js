const express = require('express');
const router = express.Router();
const controller = require('./school.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

// SuperAdmin-only: create a new school + its first SchoolAdmin login (onboarding)
router.post('/', requireAuth, requireRole('SUPERADMIN'), controller.createSchool);
router.get('/', requireAuth, requireRole('SUPERADMIN'), controller.listSchools);
router.patch('/:id/status', requireAuth, requireRole('SUPERADMIN'), controller.updateStatus);

// SchoolAdmin self-service: the Mobile Money/bank details parents pay fees into.
router.get(
  '/me/payment-details',
  requireAuth,
  tenantScope,
  requireRole('SCHOOL_ADMIN'),
  controller.getPaymentDetails
);
router.put(
  '/me/payment-details',
  requireAuth,
  tenantScope,
  requireRole('SCHOOL_ADMIN'),
  controller.updatePaymentDetails
);

module.exports = router;
