const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const timetableService = require('./timetable.service');

function validDayOfWeek(day) {
  return Number.isInteger(day) && day >= 1 && day <= 7;
}

exports.list = asyncHandler(async (req, res) => {
  const { classId, dayOfWeek } = req.query;
  const slots = await timetableService.listTimetable(req.schoolId, {
    classId,
    dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
  });
  return ok(res, slots);
});

exports.listForTeacher = asyncHandler(async (req, res) => {
  const slots = await timetableService.listTeacherTimetable(req.schoolId, req.params.teacherId);
  return ok(res, slots);
});

exports.create = asyncHandler(async (req, res) => {
  const { classId, dayOfWeek, startTime, endTime, subjectId, teacherId } = req.body;
  if (!classId || !dayOfWeek || !startTime || !endTime || !subjectId) {
    return fail(res, 'classId, dayOfWeek, startTime, endTime and subjectId are required', 400);
  }
  if (!validDayOfWeek(dayOfWeek)) {
    return fail(res, 'dayOfWeek must be an integer between 1 (Monday) and 7 (Sunday)', 400);
  }

  const slot = await timetableService.createSlot(req.schoolId, {
    classId,
    dayOfWeek,
    startTime,
    endTime,
    subjectId,
    teacherId,
  });
  return ok(res, slot, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { classId, dayOfWeek, startTime, endTime, subjectId, teacherId } = req.body;
  if (dayOfWeek !== undefined && !validDayOfWeek(dayOfWeek)) {
    return fail(res, 'dayOfWeek must be an integer between 1 (Monday) and 7 (Sunday)', 400);
  }

  const slot = await timetableService.updateSlot(req.schoolId, req.params.id, {
    classId,
    dayOfWeek,
    startTime,
    endTime,
    subjectId,
    teacherId,
  });
  if (!slot) return fail(res, 'Timetable slot not found', 404);
  return ok(res, slot);
});

exports.remove = asyncHandler(async (req, res) => {
  const deleted = await timetableService.deleteSlot(req.schoolId, req.params.id);
  if (!deleted) return fail(res, 'Timetable slot not found', 404);
  return ok(res, null);
});
