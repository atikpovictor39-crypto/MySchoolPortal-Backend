const express = require('express');
const router = express.Router();
const controller = require('./ticket.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDuringMaintenance, blockDemoWrites, requireRole('SCHOOL_ADMIN'));

router.get('/', controller.listMine);
router.post('/', controller.create);
router.get('/:id', controller.getMine);
router.post('/:id/replies', controller.replyAsSchool);

module.exports = router;
