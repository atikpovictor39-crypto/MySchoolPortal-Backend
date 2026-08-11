const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const academicYearService = require('./academicYear.service');

exports.list = asyncHandler(async (req, res) => {
  const years = await academicYearService.listAcademicYears(req.schoolId);
  return ok(res, years);
});

exports.getById = asyncHandler(async (req, res) => {
  const year = await academicYearService.getAcademicYearById(req.schoolId, req.params.id);
  if (!year) return fail(res, 'Academic year not found', 404);
  return ok(res, year);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, startDate, endDate, isCurrent } = req.body;
  if (!name || !startDate || !endDate) {
    return fail(res, 'name, startDate and endDate are required', 400);
  }
  if (new Date(startDate) >= new Date(endDate)) {
    return fail(res, 'startDate must be before endDate', 400);
  }

  const year = await academicYearService.createAcademicYear(req.schoolId, { name, startDate, endDate, isCurrent });
  return ok(res, year, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { name, startDate, endDate, isCurrent } = req.body;
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return fail(res, 'startDate must be before endDate', 400);
  }

  const year = await academicYearService.updateAcademicYear(req.schoolId, req.params.id, {
    name,
    startDate,
    endDate,
    isCurrent,
  });
  if (!year) return fail(res, 'Academic year not found', 404);
  return ok(res, year);
});

exports.remove = asyncHandler(async (req, res) => {
  const deleted = await academicYearService.deleteAcademicYear(req.schoolId, req.params.id);
  if (!deleted) return fail(res, 'Academic year not found', 404);
  return ok(res, null);
});
