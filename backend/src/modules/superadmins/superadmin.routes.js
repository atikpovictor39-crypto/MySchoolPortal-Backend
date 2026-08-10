const express = require('express');
const router = express.Router();
const controller = require('./superadmin.controller');
const requireAuth = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');
const requireScope = require('../../middleware/requireScope.middleware');

// No tenantScope — a SuperAdmin has no school_id, same reasoning as
// school.routes.js's SuperAdmin-only section.
// requireScope() with no arguments = full-scope only: a support/billing/
// developer sub-admin must not be able to create or manage other SuperAdmin
// accounts, including elevating themselves.
router.use(requireAuth, requireRole('SUPERADMIN'), requireScope());

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);

module.exports = router;
