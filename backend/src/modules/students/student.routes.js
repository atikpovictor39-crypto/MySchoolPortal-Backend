const express = require('express');
const router = express.Router();
const controller = require('./student.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDemoWrites);

// Every query in student.service.js filters by req.schoolId — a Teacher or
// SchoolAdmin from School A can never read or write School B's students,
// even by guessing IDs, since the WHERE clause always includes school_id.
//
// Staff-only: a Parent seeing every family's children here (not just their
// own) would be a privacy leak. Parents get their own child's data via the
// ownership-checked /api/v1/parent/* routes instead.
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.list);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getById);
router.post('/', requireRole('SCHOOL_ADMIN'), controller.create);
router.put('/:id', requireRole('SCHOOL_ADMIN'), controller.update);

// Guardian info (parent name/email) is sensitive contact data — admin-only.
router.get('/:id/guardians', requireRole('SCHOOL_ADMIN'), controller.listGuardians);
router.post('/:id/guardians', requireRole('SCHOOL_ADMIN'), controller.addGuardian);

module.exports = router;
