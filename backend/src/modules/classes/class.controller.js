const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const classService = require('./class.service');

exports.list = asyncHandler(async (req, res) => {
  const { academicYearId } = req.query;
  const classes = await classService.listClasses(req.schoolId, { academicYearId });
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
