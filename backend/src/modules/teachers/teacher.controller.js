const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const teacherService = require('./teacher.service');

exports.list = asyncHandler(async (req, res) => {
  const teachers = await teacherService.listTeachers(req.schoolId);
  return ok(res, teachers);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, employeeNo } = req.body;
  if (!name || !email || !password) {
    return fail(res, 'name, email and password are required', 400);
  }

  const teacher = await teacherService.createTeacher(req.schoolId, {
    name,
    email: email.toLowerCase().trim(),
    password,
    employeeNo,
  });
  return ok(res, teacher, 201);
});

exports.clockIn = asyncHandler(async (req, res) => {
  const record = await teacherService.clockIn(req.schoolId, req.user.id);
  return ok(res, record, 201);
});

exports.clockOut = asyncHandler(async (req, res) => {
  const record = await teacherService.clockOut(req.schoolId, req.user.id);
  return ok(res, record);
});

exports.getMyStatus = asyncHandler(async (req, res) => {
  const status = await teacherService.getMyStatus(req.schoolId, req.user.id);
  return ok(res, status);
});

// A Teacher can only ever see their own clock-in history — even if they
// pass a different teacherId, it's overridden below, same ownership
// pattern as the Parent Portal's assertOwnChild check.
exports.listClockIns = asyncHandler(async (req, res) => {
  let { teacherId, date } = req.query;
  if (req.user.role === 'TEACHER') {
    teacherId = await teacherService.getTeacherIdForUser(req.schoolId, req.user.id);
  }

  const records = await teacherService.listClockIns(req.schoolId, { teacherId, date });
  return ok(res, records);
});

exports.createLeaveRequest = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate) {
    return fail(res, 'startDate and endDate are required', 400);
  }

  const request = await teacherService.createLeaveRequest(req.schoolId, req.user.id, { startDate, endDate, reason });
  return ok(res, request, 201);
});

// Same ownership override as listClockIns — a Teacher only ever sees their own requests.
exports.listLeaveRequests = asyncHandler(async (req, res) => {
  let { teacherId, status } = req.query;
  if (req.user.role === 'TEACHER') {
    teacherId = await teacherService.getTeacherIdForUser(req.schoolId, req.user.id);
  }

  const requests = await teacherService.listLeaveRequests(req.schoolId, { teacherId, status });
  return ok(res, requests);
});

exports.approveLeaveRequest = asyncHandler(async (req, res) => {
  const request = await teacherService.reviewLeaveRequest(req.schoolId, req.params.id, req.user.id, 'approved');
  if (!request) return fail(res, 'Leave request not found', 404);
  return ok(res, request);
});

exports.rejectLeaveRequest = asyncHandler(async (req, res) => {
  const request = await teacherService.reviewLeaveRequest(req.schoolId, req.params.id, req.user.id, 'rejected');
  if (!request) return fail(res, 'Leave request not found', 404);
  return ok(res, request);
});
