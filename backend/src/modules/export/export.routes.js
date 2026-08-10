const express = require('express');
const router = express.Router();
const controller = require('./export.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requireRole = require('../../middleware/role.middleware');

// SCHOOL_ADMIN only — this is a whole-school data dump (fee amounts,
// attendance history, every student's records), not something a teacher
// needs day to day. GET-only so blockDemoWrites never actually triggers
// here, kept for consistency with every other tenant-scoped router.
router.use(requireAuth, tenantScope, requirePasswordChange, blockDemoWrites, requireRole('SCHOOL_ADMIN'));

router.get('/:type', controller.download);

module.exports = router;
