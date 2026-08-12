const express = require('express');
const router = express.Router();
const controller = require('./school.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const requireScope = require('../../middleware/requireScope.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');

// SuperAdmin-only: create a new school + its first SchoolAdmin login (onboarding).
// Onboarding/suspension is treated as developer-or-billing territory — the
// support scope doesn't get to create or suspend schools. Listing is
// read-only and support also needs it (e.g. to pick a school when targeting
// a platform announcement), so it additionally allows 'support'.
router.post('/', requireAuth, requireRole('SUPERADMIN'), requireScope('developer', 'billing'), controller.createSchool);
router.get(
  '/',
  requireAuth,
  requireRole('SUPERADMIN'),
  requireScope('developer', 'billing', 'support'),
  controller.listSchools
);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('SUPERADMIN'),
  requireScope('developer', 'billing'),
  controller.updateStatus
);

// SchoolAdmin self-service: the school's own profile (name/contact/logo).
// GET also allows TEACHER — nothing sensitive in it (payment details are
// their own separate SCHOOL_ADMIN-only endpoint below), and teachers need
// it too for the report card letterhead.
router.get(
  '/me',
  requireAuth,
  tenantScope,
  blockDuringMaintenance,
  requireRole('SCHOOL_ADMIN', 'TEACHER'),
  controller.getMyProfile
);
router.put(
  '/me',
  requireAuth,
  tenantScope,
  blockDuringMaintenance,
  blockDemoWrites,
  requireRole('SCHOOL_ADMIN'),
  controller.updateMyProfile
);

// SchoolAdmin self-service: the Mobile Money/bank details parents pay fees into.
router.get(
  '/me/payment-details',
  requireAuth,
  tenantScope,
  blockDuringMaintenance,
  requireRole('SCHOOL_ADMIN'),
  controller.getPaymentDetails
);
router.put(
  '/me/payment-details',
  requireAuth,
  tenantScope,
  blockDuringMaintenance,
  blockDemoWrites,
  requireRole('SCHOOL_ADMIN'),
  controller.updatePaymentDetails
);

module.exports = router;
