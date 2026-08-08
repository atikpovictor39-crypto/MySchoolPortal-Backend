const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const parentService = require('./parent.service');
const resultService = require('../results/result.service');
const announcementService = require('../announcements/announcement.service');
const homeworkService = require('../homework/homework.service');
const timetableService = require('../timetable/timetable.service');

exports.listChildren = asyncHandler(async (req, res) => {
  const children = await parentService.listChildren(req.schoolId, req.user.id);
  return ok(res, children);
});

exports.listAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listForParent(req.schoolId, req.user.id);
  return ok(res, announcements);
});

// Every handler below touches one specific student — always re-verify
// ownership from the DB per request rather than trusting the URL, since a
// parent could otherwise just change the studentId and read anyone's child.
async function assertOwnChild(req, res) {
  const owns = await parentService.isOwnChild(req.schoolId, req.user.id, req.params.studentId);
  if (!owns) {
    fail(res, 'Not your child', 403);
    return false;
  }
  return true;
}

exports.getChildAttendance = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const { from, to } = req.query;
  const attendance = await parentService.getChildAttendance(req.schoolId, req.params.studentId, { from, to });
  return ok(res, attendance);
});

exports.getChildExams = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const exams = await parentService.getChildExams(req.schoolId, req.params.studentId);
  return ok(res, exams);
});

exports.getChildReportCard = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const reportCard = await resultService.getReportCard(req.schoolId, req.params.examId, req.params.studentId);
  return ok(res, reportCard);
});

exports.getChildFees = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const fees = await parentService.getChildFees(req.schoolId, req.params.studentId);
  return ok(res, fees);
});

exports.getChildHomework = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const classId = await parentService.getChildClassId(req.schoolId, req.params.studentId);
  const homework = await homeworkService.listForClass(req.schoolId, classId);
  return ok(res, homework);
});

exports.getChildTimetable = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const classId = await parentService.getChildClassId(req.schoolId, req.params.studentId);
  const timetable = await timetableService.listTimetable(req.schoolId, { classId });
  return ok(res, timetable);
});

// Powers the Overview dashboard: attendance rate, fee balance, and — if any
// exam exists for the child's class — that exam's class average and position.
exports.getChildOverview = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const studentId = req.params.studentId;

  const [stats, exams] = await Promise.all([
    parentService.getChildOverviewStats(req.schoolId, studentId),
    parentService.getChildExams(req.schoolId, studentId),
  ]);

  let examSummary = { latestExam: null, classAverage: null, position: null, classSize: null };
  if (exams.length > 0) {
    const latestExam = exams[0];
    const summary = await resultService.getExamSummaryForStudent(req.schoolId, latestExam.id, studentId);
    examSummary = { latestExam, ...summary };
  }

  return ok(res, { ...stats, ...examSummary });
});
