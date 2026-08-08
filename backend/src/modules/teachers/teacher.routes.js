const express = require('express');
const router = express.Router();
const controller = require('./teacher.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope);

router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.list);
router.post('/', requireRole('SCHOOL_ADMIN'), controller.create);

router.post('/clock-in', requireRole('TEACHER'), controller.clockIn);
router.post('/clock-out', requireRole('TEACHER'), controller.clockOut);
router.get('/clock-status', requireRole('TEACHER'), controller.getMyStatus);
router.get('/clock-ins', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.listClockIns);

router.post('/leave-requests', requireRole('TEACHER'), controller.createLeaveRequest);
router.get('/leave-requests', requireRole('SCHOOL_ADMIN', 'TEACHER'), controller.listLeaveRequests);
router.put('/leave-requests/:id/approve', requireRole('SCHOOL_ADMIN'), controller.approveLeaveRequest);
router.put('/leave-requests/:id/reject', requireRole('SCHOOL_ADMIN'), controller.rejectLeaveRequest);

module.exports = router;
