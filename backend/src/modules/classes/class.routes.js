const express = require('express');
const router = express.Router();
const controller = require('./class.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDuringMaintenance, blockDemoWrites);

// Staff-only — see students/student.routes.js for why Parents are excluded.
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.list);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getById);
router.post('/', requireRole('SCHOOL_ADMIN'), controller.create);
router.put('/:id', requireRole('SCHOOL_ADMIN'), controller.update);
router.delete('/:id', requireRole('SCHOOL_ADMIN'), controller.remove);

router.get('/:id/subjects', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.listSubjects);
router.post('/:id/subjects', requireRole('SCHOOL_ADMIN'), controller.addSubject);
router.put('/:id/subjects/:subjectAssignmentId', requireRole('SCHOOL_ADMIN'), controller.updateSubject);
router.delete('/:id/subjects/:subjectAssignmentId', requireRole('SCHOOL_ADMIN'), controller.removeSubject);

module.exports = router;
