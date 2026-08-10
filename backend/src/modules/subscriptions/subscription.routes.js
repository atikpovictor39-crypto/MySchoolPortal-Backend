const express = require('express');
const router = express.Router();
const controller = require('./subscription.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');
const requireScope = require('../../middleware/requireScope.middleware');

// SuperAdmin manages plans across all tenants; SchoolAdmin can only view their own.
router.get('/plans', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.listPlans);
router.post('/plans', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.createPlan);
router.put('/plans/:id', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.updatePlan);

router.get('/mine', requireAuth, tenantScope, requireRole('SCHOOL_ADMIN'), controller.getMine);

// SuperAdmin confirms a school paid and renews their period — not tenant-
// scoped, since SuperAdmin acts across every school, not just their own.
router.post('/:schoolId/renew', requireAuth, requireRole('SUPERADMIN'), requireScope('billing'), controller.renew);

module.exports = router;
