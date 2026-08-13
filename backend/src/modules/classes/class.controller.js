const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const classService = require('./class.service');

exports.list = asyncHandler(async (req, res) => {
  const { academicYearId, classTeacherId, withStats } = req.query;
  const classes = withStats
    ? await classService.listClassesWithStats(req.schoolId, { academicYearId, classTeacherId })
    : await classService.listClasses(req.schoolId, { academicYearId });
  return ok(res, classes);
});

exports.getById = asyncHandler(async (req, res) => {
  const klass = await classService.getClassById(req.schoolId, req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);
  return ok(res, klass);
});

exports.create = asyncHandler(async (req, res) => {
  const { academicYearId, name, section, classTeacherId } = req.body;
  if (!academicYearId || !name) {
    return fail(res, 'academicYearId and name are required', 400);
  }

  const klass = await classService.createClass(req.schoolId, { academicYearId, name, section, classTeacherId });
  return ok(res, klass, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { academicYearId, name, section, classTeacherId } = req.body;

  const klass = await classService.updateClass(req.schoolId, req.params.id, {
    academicYearId,
    name,
    section,
    classTeacherId,
  });
  if (!klass) return fail(res, 'Class not found', 404);
  return ok(res, klass);
});

exports.remove = asyncHandler(async (req, res) => {
  const deleted = await classService.deleteClass(req.schoolId, req.params.id);
  if (!deleted) return fail(res, 'Class not found', 404);
  return ok(res, null);
});

// ---- Class subjects ----

exports.listSubjects = asyncHandler(async (req, res) => {
  const subjects = await classService.listClassSubjects(req.schoolId, req.params.id);
  return ok(res, subjects);
});

exports.addSubject = asyncHandler(async (req, res) => {
  const { subjectId, teacherId, periodsPerWeek } = req.body;
  if (!subjectId) return fail(res, 'subjectId is required', 400);

  const classSubject = await classService.addClassSubject(req.schoolId, req.params.id, {
    subjectId,
    teacherId,
    periodsPerWeek,
  });
  return ok(res, classSubject, 201);
});

exports.updateSubject = asyncHandler(async (req, res) => {
  const { teacherId, periodsPerWeek } = req.body;
  const classSubject = await classService.updateClassSubject(req.schoolId, req.params.subjectAssignmentId, {
    teacherId,
    periodsPerWeek,
  });
  if (!classSubject) return fail(res, 'Class subject not found', 404);
  return ok(res, classSubject);
});

exports.removeSubject = asyncHandler(async (req, res) => {
  const deleted = await classService.removeClassSubject(req.schoolId, req.params.subjectAssignmentId);
  if (!deleted) return fail(res, 'Class subject not found', 404);
  return ok(res, null);
});

exports.bulkAssignSubjects = asyncHandler(async (req, res) => {
  const { classIds, subjects } = req.body;
  if (!Array.isArray(subjects) || subjects.some((s) => !s.subjectId)) {
    return fail(res, 'subjects must be a non-empty array of { subjectId, periodsPerWeek }', 400);
  }

  const result = await classService.bulkAssignSubjects(req.schoolId, classIds, subjects);
  return ok(res, result, 201);
});

// ---- Promote students ----

exports.promote = asyncHandler(async (req, res) => {
  const { studentIds, targetClassId, targetNewClass } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return fail(res, 'studentIds must be a non-empty array', 400);
  }
  if (!targetClassId && !targetNewClass) {
    return fail(res, 'Provide either targetClassId or targetNewClass', 400);
  }

  const result = await classService.promoteStudents(req.schoolId, {
    sourceClassId: req.params.id,
    studentIds,
    targetClassId,
    targetNewClass,
  });
  return ok(res, result);
});
