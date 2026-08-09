const express = require('express');
const router = express.Router();
const controller = require('./result.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, blockDemoWrites);

// Staff-only for viewing too — a results sheet or a specific student's
// report card is personal academic data. Parents use /api/v1/parent/*,
// which reuses getReportCard internally but only after an ownership check.
router.get('/exams', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.listExams);
router.post('/exams', requireRole('SCHOOL_ADMIN'), controller.createExam);
router.get('/exams/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getExam);
router.post('/exams/:id/subjects', requireRole('SCHOOL_ADMIN'), controller.addExamSubjects);

router.get('/exam-subjects/:examSubjectId', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getResultsSheet);
router.post('/exam-subjects/:examSubjectId', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.saveResults);

router.get('/exams/:examId/report-card/:studentId', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getReportCard);
router.get('/exams/:examId/class-report', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.getClassReport);

module.exports = router;
