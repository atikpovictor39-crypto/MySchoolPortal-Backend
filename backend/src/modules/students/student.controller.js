const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const studentService = require('./student.service');
const auditService = require('../audit/audit.service');

exports.list = asyncHandler(async (req, res) => {
  const { classId, search, page, pageSize } = req.query;
  const result = await studentService.listStudents(req.schoolId, { classId, search, page, pageSize });
  return ok(res, result);
});

exports.getById = asyncHandler(async (req, res) => {
  const student = await studentService.getStudentById(req.schoolId, req.params.id);
  if (!student) return fail(res, 'Student not found', 404);
  return ok(res, student);
});

// SCHOOL_ADMIN can always manage guardians; a TEACHER only for students in
// a class they're the assigned class_teacher of. Returns false (and has
// already written the 403) if the caller isn't allowed to proceed.
async function assertCanManageGuardians(req, res) {
  if (req.user.role === 'SCHOOL_ADMIN') return true;
  const isClassTeacher = await studentService.isClassTeacherOfStudent(req.schoolId, req.params.id, req.user.id);
  if (!isClassTeacher) {
    fail(res, 'You can only manage guardians for students in your own class', 403);
    return false;
  }
  return true;
}

exports.listGuardians = asyncHandler(async (req, res) => {
  if (!(await assertCanManageGuardians(req, res))) return;
  const guardians = await studentService.listGuardians(req.schoolId, req.params.id);
  return ok(res, guardians);
});

exports.addGuardian = asyncHandler(async (req, res) => {
  if (!(await assertCanManageGuardians(req, res))) return;

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

  const student = await studentService.getStudentById(req.schoolId, req.params.id);
  await auditService.record({
    schoolId: req.schoolId,
    userId: req.user.id,
    action: 'guardian.added',
    description: `Linked guardian ${name} to student ${student.first_name} ${student.last_name}`,
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

  await auditService.record({
    schoolId: req.schoolId,
    userId: req.user.id,
    action: 'student.created',
    description: `Added student ${firstName} ${lastName}`,
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

  await auditService.record({
    schoolId: req.schoolId,
    userId: req.user.id,
    action: 'student.updated',
    description: `Updated student ${student.first_name} ${student.last_name}`,
  });

  return ok(res, student);
});
