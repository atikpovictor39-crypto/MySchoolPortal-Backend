const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const attendanceService = require('./attendance.service');
const { toCsv } = require('../../utils/csv');

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

function parseReportQuery(query) {
  const { classId, fromDate, toDate } = query;
  if (!classId || !fromDate || !toDate) {
    return { error: 'classId, fromDate and toDate query params are required' };
  }
  return { classId, fromDate, toDate };
}

// GET /attendance/report?classId=&fromDate=&toDate= — per-student totals
// over a date range, for the "View Reports" mode of the Attendance page.
exports.getReport = asyncHandler(async (req, res) => {
  const { error, classId, fromDate, toDate } = parseReportQuery(req.query);
  if (error) return fail(res, error, 400);
  if (!(await attendanceService.classBelongsToSchool(req.schoolId, classId))) {
    return fail(res, 'classId does not belong to this school', 400);
  }

  const report = await attendanceService.getAttendanceReport(req.schoolId, classId, fromDate, toDate);
  return ok(res, report);
});

// GET /attendance/report/export?classId=&fromDate=&toDate= — same data as
// getReport, as a downloadable CSV (opens directly in Excel).
exports.exportReport = asyncHandler(async (req, res) => {
  const { error, classId, fromDate, toDate } = parseReportQuery(req.query);
  if (error) return fail(res, error, 400);
  if (!(await attendanceService.classBelongsToSchool(req.schoolId, classId))) {
    return fail(res, 'classId does not belong to this school', 400);
  }

  const report = await attendanceService.getAttendanceReport(req.schoolId, classId, fromDate, toDate);
  const csv = toCsv(report, [
    { label: 'Admission No', value: (r) => r.admission_no },
    { label: 'First Name', value: (r) => r.first_name },
    { label: 'Last Name', value: (r) => r.last_name },
    { label: 'Present', value: (r) => r.present_count },
    { label: 'Absent', value: (r) => r.absent_count },
    { label: 'Late', value: (r) => r.late_count },
    { label: 'Excused', value: (r) => r.excused_count },
    { label: 'Total Marked', value: (r) => r.total_marked },
    { label: 'Attendance Rate (%)', value: (r) => r.rate ?? '' },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${fromDate}-to-${toDate}.csv"`);
  return res.send(csv);
});
