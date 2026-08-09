const express = require('express');
const router = express.Router();
const controller = require('./announcement.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, blockDemoWrites);

// Staff-only — Parents get their own filtered view via /api/v1/parent/announcements.
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.list);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getById);
router.post('/', requireRole('SCHOOL_ADMIN'), controller.create);
router.put('/:id', requireRole('SCHOOL_ADMIN'), controller.update);
router.delete('/:id', requireRole('SCHOOL_ADMIN'), controller.remove);

module.exports = router;
