const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const attendanceService = require('./attendance.service');

// GET /attendance?class_id=&date=
exports.getSheet = asyncHandler(async (req, res) => {
  const { class_id: classId, date } = req.query;
  if (!classId || !date) {
    return fail(res, 'class_id and date query params are required', 400);
  }
  if (!(await attendanceService.classBelongsToSchool(req.schoolId, classId))) {
    return fail(res, 'class_id does not belong to this school', 400);
  }

  const students = await attendanceService.getAttendanceSheet(req.schoolId, classId, date);
  return ok(res, { classId: Number(classId), date, students });
});

// GET /attendance/summary?date= — defaults to today, used by the admin dashboard.
exports.getSummary = asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const summary = await attendanceService.getAttendanceSummary(req.schoolId, date);
  return ok(res, summary);
});

// POST /attendance/mark  { classId, date, records: [{ studentId, status }] }
exports.mark = asyncHandler(async (req, res) => {
  const { classId, date, records } = req.body;

  if (!classId || !date || !Array.isArray(records) || records.length === 0) {
    return fail(res, 'classId, date and a non-empty records array are required', 400);
  }
  for (const record of records) {
    if (!record.studentId || !attendanceService.ALLOWED_STATUSES.includes(record.status)) {
      return fail(
        res,
        `each record needs a studentId and a status of: ${attendanceService.ALLOWED_STATUSES.join(', ')}`,
        400
      );
    }
  }
  if (!(await attendanceService.classBelongsToSchool(req.schoolId, classId))) {
    return fail(res, 'classId does not belong to this school', 400);
  }

  const students = await attendanceService.markAttendance(req.schoolId, classId, date, req.user.id, records);
  return ok(res, { classId: Number(classId), date, students });
});
