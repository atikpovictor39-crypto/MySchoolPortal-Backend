const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const subjectService = require('./subject.service');

exports.list = asyncHandler(async (req, res) => {
  const subjects = await subjectService.listSubjects(req.schoolId);
  return ok(res, subjects);
});

exports.getById = asyncHandler(async (req, res) => {
  const subject = await subjectService.getSubjectById(req.schoolId, req.params.id);
  if (!subject) return fail(res, 'Subject not found', 404);
  return ok(res, subject);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, code } = req.body;
  if (!name) return fail(res, 'name is required', 400);

  const subject = await subjectService.createSubject(req.schoolId, { name, code });
  return ok(res, subject, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { name, code } = req.body;
  const subject = await subjectService.updateSubject(req.schoolId, req.params.id, { name, code });
  if (!subject) return fail(res, 'Subject not found', 404);
  return ok(res, subject);
});
