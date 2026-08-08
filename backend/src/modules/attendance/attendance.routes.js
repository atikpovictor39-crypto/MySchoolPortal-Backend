const express = require('express');
const router = express.Router();
const controller = require('./attendance.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope);

// Staff-only — a class attendance sheet exposes every student in the class,
// not just one family's child. Parents use /api/v1/parent/* instead.
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getSheet); // GET /attendance?class_id=&date=
router.post('/mark', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.mark);
router.get('/summary', requireRole('SCHOOL_ADMIN'), controller.getSummary);

module.exports = router;
