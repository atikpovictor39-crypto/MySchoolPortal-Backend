const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const resultService = require('./result.service');

// ---- Exams ----

exports.listExams = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  const exams = await resultService.listExams(req.schoolId, { classId });
  return ok(res, exams);
});

exports.getExam = asyncHandler(async (req, res) => {
  const exam = await resultService.getExamById(req.schoolId, req.params.id);
  if (!exam) return fail(res, 'Exam not found', 404);
  return ok(res, exam);
});

exports.createExam = asyncHandler(async (req, res) => {
  const { academicYearId, classId, name, term } = req.body;
  if (!academicYearId || !classId || !name) {
    return fail(res, 'academicYearId, classId and name are required', 400);
  }

  const exam = await resultService.createExam(req.schoolId, { academicYearId, classId, name, term });
  return ok(res, exam, 201);
});

exports.addExamSubjects = asyncHandler(async (req, res) => {
  const { subjects } = req.body;
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return fail(res, 'subjects must be a non-empty array of { subjectId, maxMarks, passingMarks }', 400);
  }
  for (const subject of subjects) {
    if (!subject.subjectId) return fail(res, 'each subject entry needs a subjectId', 400);
  }

  const exam = await resultService.addExamSubjects(req.schoolId, req.params.id, subjects);
  return ok(res, exam, 201);
});

// ---- Results entry ----

exports.getResultsSheet = asyncHandler(async (req, res) => {
  const sheet = await resultService.getResultsSheet(req.schoolId, req.params.examSubjectId);
  return ok(res, sheet);
});

exports.saveResults = asyncHandler(async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return fail(res, 'records must be a non-empty array of { studentId, marksObtained, remarks }', 400);
  }
  for (const record of records) {
    if (!record.studentId || typeof record.marksObtained !== 'number') {
      return fail(res, 'each record needs a studentId and a numeric marksObtained', 400);
    }
  }

  const sheet = await resultService.saveResults(req.schoolId, req.params.examSubjectId, req.user.id, records);
  return ok(res, sheet);
});

// ---- Report cards & class ranking ----

exports.getReportCard = asyncHandler(async (req, res) => {
  const reportCard = await resultService.getReportCard(req.schoolId, req.params.examId, req.params.studentId);
  return ok(res, reportCard);
});

exports.getClassReport = asyncHandler(async (req, res) => {
  const ranking = await resultService.getClassReport(req.schoolId, req.params.examId);
  return ok(res, ranking);
});
