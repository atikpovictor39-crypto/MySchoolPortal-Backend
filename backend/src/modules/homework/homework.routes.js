const express = require('express');
const router = express.Router();
const controller = require('./homework.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDuringMaintenance, blockDemoWrites);

// Staff-only — Parents get their own child's-class view via /api/v1/parent/*.
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.list);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getById);
router.post('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.create);
router.put('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.update);
router.delete('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.remove);

module.exports = router;
