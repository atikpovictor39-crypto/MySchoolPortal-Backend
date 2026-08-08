const express = require('express');
const router = express.Router();
const controller = require('./class.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope);

// Staff-only — see students/student.routes.js for why Parents are excluded.
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.list);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getById);
router.post('/', requireRole('SCHOOL_ADMIN'), controller.create);
router.put('/:id', requireRole('SCHOOL_ADMIN'), controller.update);

module.exports = router;
