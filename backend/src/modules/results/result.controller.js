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
  const { academicYearId, classId, name, term, termStartDate, termEndDate, reopeningDate } = req.body;
  if (!academicYearId || !classId || !name) {
    return fail(res, 'academicYearId, classId and name are required', 400);
  }

  const exam = await resultService.createExam(req.schoolId, {
    academicYearId,
    classId,
    name,
    term,
    termStartDate,
    termEndDate,
    reopeningDate,
  });
  return ok(res, exam, 201);
});

// Term dates (vacation/re-opening) are usually only confirmed near the end
// of term, so this is edited after the exam already exists.
exports.updateExam = asyncHandler(async (req, res) => {
  const { name, term, termStartDate, termEndDate, reopeningDate } = req.body;
  const exam = await resultService.updateExam(req.schoolId, req.params.id, {
    name,
    term,
    termStartDate,
    termEndDate,
    reopeningDate,
  });
  if (!exam) return fail(res, 'Exam not found', 404);
  return ok(res, exam);
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

// Free-text additions to a report card (interest, academic strength, class
// teacher's and headmaster's remarks, promoted-to) — not a score, so it
// lives outside exam_subjects/results entirely. See report_card_notes.
exports.saveReportCardNotes = asyncHandler(async (req, res) => {
  const { interest, academicStrength, classTeacherRemarks, headmasterRemarks, promotedTo } = req.body;
  const notes = await resultService.upsertReportCardNotes(req.schoolId, req.params.examId, req.params.studentId, {
    interest,
    academicStrength,
    classTeacherRemarks,
    // Headmaster's remarks is the one field a TEACHER isn't allowed to set —
    // passing undefined here leaves whatever value is already saved intact
    // (see upsertReportCardNotes' merge-with-existing behavior) rather than
    // silently blanking it out on a teacher's save.
    headmasterRemarks: req.user.role === 'SCHOOL_ADMIN' ? headmasterRemarks : undefined,
    promotedTo,
  });
  return ok(res, notes);
});
