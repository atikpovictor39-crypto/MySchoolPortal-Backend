const express = require('express');
const router = express.Router();
const controller = require('./subscription.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const requireScope = require('../../middleware/requireScope.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');

// Public — called directly by MoolRe's servers, no user session involved.
// Mounted before the auth-gated routes below so it never runs through them.
router.post('/webhook/moolre', controller.moolreWebhook);

// SuperAdmin manages plans across all tenants; SchoolAdmin can only view their own.
router.get('/plans', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.listPlans);
router.post('/plans', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.createPlan);
router.put('/plans/:id', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.updatePlan);

router.get('/mine', requireAuth, tenantScope, requireRole('SCHOOL_ADMIN'), controller.getMine);
router.get('/plans/active', requireAuth, tenantScope, requireRole('SCHOOL_ADMIN'), controller.listActivePlans);

// A school paying its own subscription via MoolRe.
router.post(
  '/checkout',
  requireAuth,
  tenantScope,
  requirePasswordChange,
  blockDuringMaintenance,
  blockDemoWrites,
  requireRole('SCHOOL_ADMIN'),
  controller.checkout
);
router.get(
  '/checkout/:externalRef',
  requireAuth,
  tenantScope,
  requirePasswordChange,
  requireRole('SCHOOL_ADMIN'),
  controller.checkoutStatus
);

// SuperAdmin confirms a school paid and renews their period — not tenant-
// scoped, since SuperAdmin acts across every school, not just their own.
router.post('/:schoolId/renew', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.renew);

module.exports = router;
