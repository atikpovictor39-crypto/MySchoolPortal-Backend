const express = require('express');
const router = express.Router();
const controller = require('./result.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDuringMaintenance, blockDemoWrites);

// Staff-only for viewing too — a results sheet or a specific student's
// report card is personal academic data. Parents use /api/v1/parent/*,
// which reuses getReportCard internally but only after an ownership check.
router.get('/exams', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.listExams);
router.post('/exams', requireRole('SCHOOL_ADMIN'), controller.createExam);
router.get('/exams/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getExam);
// Field-level split (name/term/dates vs. vacation date + teacher's own
// name/signature/date) is enforced in the controller, same pattern as
// saveReportCardNotes' headmasterRemarks restriction below.
router.put('/exams/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.updateExam);
router.post('/exams/:id/subjects', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.addExamSubjects);

router.get('/exam-subjects/:examSubjectId', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getResultsSheet);
router.post('/exam-subjects/:examSubjectId', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.saveResults);

router.get('/exams/:examId/report-card/:studentId', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getReportCard);
// TEACHER and SCHOOL_ADMIN can both save every note field, including
// headmaster's remarks — small schools often have the same person filling
// in the whole report card, so this isn't split at the field level.
router.put(
  '/exams/:examId/report-card/:studentId/notes',
  requireRole('SCHOOL_ADMIN', 'TEACHER'),
  controller.saveReportCardNotes
);
router.get('/exams/:examId/class-report', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getClassReport);

module.exports = router;
