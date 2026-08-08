const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const studentService = require('./student.service');

exports.list = asyncHandler(async (req, res) => {
  const { classId, page, pageSize } = req.query;
  const result = await studentService.listStudents(req.schoolId, { classId, page, pageSize });
  return ok(res, result);
});

exports.getById = asyncHandler(async (req, res) => {
  const student = await studentService.getStudentById(req.schoolId, req.params.id);
  if (!student) return fail(res, 'Student not found', 404);
  return ok(res, student);
});

exports.listGuardians = asyncHandler(async (req, res) => {
  const guardians = await studentService.listGuardians(req.schoolId, req.params.id);
  return ok(res, guardians);
});

exports.addGuardian = asyncHandler(async (req, res) => {
  const { name, email, password, relationship, isPrimary } = req.body;
  if (!name || !email) {
    return fail(res, 'name and email are required', 400);
  }

  const guardians = await studentService.addGuardian(req.schoolId, req.params.id, {
    name,
    email: email.toLowerCase().trim(),
    password,
    relationship,
    isPrimary,
  });
  return ok(res, guardians, 201);
});

exports.create = asyncHandler(async (req, res) => {
  const { classId, admissionNo, firstName, lastName, dateOfBirth, gender, enrolledAt } = req.body;

  if (!classId || !admissionNo || !firstName || !lastName) {
    return fail(res, 'classId, admissionNo, firstName and lastName are required', 400);
  }
  if (gender && !studentService.ALLOWED_GENDERS.includes(gender)) {
    return fail(res, `gender must be one of: ${studentService.ALLOWED_GENDERS.join(', ')}`, 400);
  }

  const student = await studentService.createStudent(req.schoolId, {
    classId,
    admissionNo,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    enrolledAt,
  });
  return ok(res, student, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { classId, admissionNo, firstName, lastName, dateOfBirth, gender, status, enrolledAt } = req.body;

  if (gender && !studentService.ALLOWED_GENDERS.includes(gender)) {
    return fail(res, `gender must be one of: ${studentService.ALLOWED_GENDERS.join(', ')}`, 400);
  }
  if (status && !studentService.ALLOWED_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${studentService.ALLOWED_STATUSES.join(', ')}`, 400);
  }

  const student = await studentService.updateStudent(req.schoolId, req.params.id, {
    classId,
    admissionNo,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    status,
    enrolledAt,
  });
  if (!student) return fail(res, 'Student not found', 404);
  return ok(res, student);
});
