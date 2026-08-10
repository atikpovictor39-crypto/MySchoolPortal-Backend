const express = require('express');
const router = express.Router();
const controller = require('./audit.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDemoWrites);

router.get('/', requireRole('SCHOOL_ADMIN'), controller.list);

module.exports = router;
