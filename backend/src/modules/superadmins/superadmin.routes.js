const express = require('express');
const router = express.Router();
const controller = require('./superadmin.controller');
const requireAuth = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');

// No tenantScope — a SuperAdmin has no school_id, same reasoning as
// school.routes.js's SuperAdmin-only section.
router.use(requireAuth, requireRole('SUPERADMIN'));

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);

module.exports = router;
