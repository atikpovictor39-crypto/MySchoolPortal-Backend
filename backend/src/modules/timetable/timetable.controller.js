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
  const { classId, dayOfWeek, startTime, endTime, slotType, subjectId, teacherId } = req.body;
  const type = slotType || 'subject';

  if (!timetableService.SLOT_TYPES.includes(type)) {
    return fail(res, `slotType must be one of: ${timetableService.SLOT_TYPES.join(', ')}`, 400);
  }
  if (!classId || !dayOfWeek || !startTime || !endTime) {
    return fail(res, 'classId, dayOfWeek, startTime and endTime are required', 400);
  }
  // subjectId only matters for an actual teaching period — assembly/break
  // aren't tied to a subject at all.
  if (type === 'subject' && !subjectId) {
    return fail(res, 'subjectId is required for a subject period', 400);
  }
  if (!validDayOfWeek(dayOfWeek)) {
    return fail(res, 'dayOfWeek must be an integer between 1 (Monday) and 7 (Sunday)', 400);
  }

  const slot = await timetableService.createSlot(req.schoolId, {
    classId,
    dayOfWeek,
    startTime,
    endTime,
    slotType: type,
    subjectId,
    teacherId,
  });
  return ok(res, slot, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { classId, dayOfWeek, startTime, endTime, slotType, subjectId, teacherId } = req.body;
  if (slotType !== undefined && !timetableService.SLOT_TYPES.includes(slotType)) {
    return fail(res, `slotType must be one of: ${timetableService.SLOT_TYPES.join(', ')}`, 400);
  }
  if (dayOfWeek !== undefined && !validDayOfWeek(dayOfWeek)) {
    return fail(res, 'dayOfWeek must be an integer between 1 (Monday) and 7 (Sunday)', 400);
  }

  const slot = await timetableService.updateSlot(req.schoolId, req.params.id, {
    classId,
    dayOfWeek,
    startTime,
    endTime,
    slotType,
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

// ---- Substitute teachers ----

exports.listSubstitutions = asyncHandler(async (req, res) => {
  const { date, classId } = req.query;
  if (!date) return fail(res, 'date query param is required', 400);

  const substitutions = await timetableService.listSubstitutions(req.schoolId, { date, classId });
  return ok(res, substitutions);
});

exports.createSubstitution = asyncHandler(async (req, res) => {
  const { timetableSlotId, date, substituteTeacherId, reason } = req.body;
  if (!timetableSlotId || !date || !substituteTeacherId) {
    return fail(res, 'timetableSlotId, date and substituteTeacherId are required', 400);
  }

  const substitution = await timetableService.createSubstitution(req.schoolId, req.user.id, {
    timetableSlotId,
    date,
    substituteTeacherId,
    reason,
  });
  return ok(res, substitution, 201);
});

exports.removeSubstitution = asyncHandler(async (req, res) => {
  const deleted = await timetableService.deleteSubstitution(req.schoolId, req.params.id);
  if (!deleted) return fail(res, 'Substitution not found', 404);
  return ok(res, null);
});

// ---- Auto-generate ----

exports.generate = asyncHandler(async (req, res) => {
  const { classId, days, dayStartTime, periodLengthMinutes, periodsPerDay, breaks, assembly } = req.body;
  if (!classId || !dayStartTime || !periodLengthMinutes || !periodsPerDay) {
    return fail(res, 'classId, dayStartTime, periodLengthMinutes and periodsPerDay are required', 400);
  }
  if (days && (!Array.isArray(days) || days.some((d) => !validDayOfWeek(d)))) {
    return fail(res, 'days must be an array of integers between 1 (Monday) and 7 (Sunday)', 400);
  }

  const result = await timetableService.generateTimetable(req.schoolId, {
    classId,
    days,
    dayStartTime,
    periodLengthMinutes,
    periodsPerDay,
    breaks,
    assembly,
  });
  return ok(res, result);
});
