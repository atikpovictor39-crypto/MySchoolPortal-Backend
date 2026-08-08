const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const homeworkService = require('./homework.service');

exports.list = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.query;
  const homework = await homeworkService.listHomework(req.schoolId, { classId, subjectId });
  return ok(res, homework);
});

exports.getById = asyncHandler(async (req, res) => {
  const homework = await homeworkService.getHomeworkById(req.schoolId, req.params.id);
  if (!homework) return fail(res, 'Homework not found', 404);
  return ok(res, homework);
});

exports.create = asyncHandler(async (req, res) => {
  const { classId, subjectId, title, description, dueDate } = req.body;
  if (!classId || !subjectId || !title || !dueDate) {
    return fail(res, 'classId, subjectId, title and dueDate are required', 400);
  }

  const homework = await homeworkService.createHomework(req.schoolId, req.user.id, {
    classId,
    subjectId,
    title,
    description,
    dueDate,
  });
  return ok(res, homework, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { classId, subjectId, title, description, dueDate } = req.body;
  const homework = await homeworkService.updateHomework(req.schoolId, req.params.id, {
    classId,
    subjectId,
    title,
    description,
    dueDate,
  });
  if (!homework) return fail(res, 'Homework not found', 404);
  return ok(res, homework);
});

exports.remove = asyncHandler(async (req, res) => {
  const deleted = await homeworkService.deleteHomework(req.schoolId, req.params.id);
  if (!deleted) return fail(res, 'Homework not found', 404);
  return ok(res, null);
});
