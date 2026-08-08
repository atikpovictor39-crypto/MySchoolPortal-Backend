const express = require('express');
const router = express.Router();
const controller = require('./parent.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requireRole('PARENT'));

router.get('/children', controller.listChildren);
router.get('/children/:studentId/attendance', controller.getChildAttendance);
router.get('/children/:studentId/exams', controller.getChildExams);
router.get('/children/:studentId/report-card/:examId', controller.getChildReportCard);
router.get('/children/:studentId/fees', controller.getChildFees);
router.post('/children/:studentId/fees/:invoiceId/claims', controller.submitPaymentClaim);
router.get('/children/:studentId/homework', controller.getChildHomework);
router.get('/children/:studentId/timetable', controller.getChildTimetable);
router.get('/children/:studentId/overview', controller.getChildOverview);
router.get('/announcements', controller.listAnnouncements);
router.get('/payment-details', controller.getPaymentDetails);

module.exports = router;
