const express = require('express');
const router = express.Router();
const controller = require('./subscription.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

// SuperAdmin manages plans across all tenants; SchoolAdmin can only view their own.
router.get('/plans', requireAuth, requireRole('SUPERADMIN'), controller.listPlans);
router.post('/plans', requireAuth, requireRole('SUPERADMIN'), controller.createPlan);
router.put('/plans/:id', requireAuth, requireRole('SUPERADMIN'), controller.updatePlan);

router.get('/mine', requireAuth, tenantScope, requireRole('SCHOOL_ADMIN'), controller.getMine);

module.exports = router;
