const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const schoolService = require('./school.service');
const auditService = require('../audit/audit.service');

exports.listSchools = asyncHandler(async (req, res) => {
  const schools = await schoolService.listSchools();
  return ok(res, schools);
});

exports.createSchool = asyncHandler(async (req, res) => {
  const { name, adminName, adminEmail, adminPassword, planId } = req.body;
  if (!name || !adminName || !adminEmail || !adminPassword) {
    return fail(res, 'name, adminName, adminEmail and adminPassword are required', 400);
  }

  const school = await schoolService.createSchool({
    name,
    adminName,
    adminEmail: adminEmail.toLowerCase().trim(),
    adminPassword,
    planId,
  });

  // Logged against the new school's own id (not NULL) — it's the one
  // school-scoped event that happens before the school has any admin of
  // its own around to see it, so it only ever shows up on the SuperAdmin's
  // cross-school Activity Log, same place as a SuperAdmin login.
  await auditService.record({
    schoolId: school.id,
    userId: req.user.id,
    action: 'school.created',
    description: `Onboarded school "${name}"`,
  });

  return ok(res, school, 201);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return fail(res, 'status is required', 400);
  }
  const school = await schoolService.updateSchoolStatus(req.params.id, status);

  await auditService.record({
    schoolId: school.id,
    userId: req.user.id,
    action: 'school.status_changed',
    description: `Set "${school.name}" status to ${status}`,
  });

  return ok(res, school);
});

exports.getMyProfile = asyncHandler(async (req, res) => {
  const profile = await schoolService.getSchoolProfile(req.schoolId);
  return ok(res, profile);
});

const PROFILE_MAX_LENGTHS = { name: 150, email: 150, phone: 30, address: 255, logoUrl: 500 };

exports.updateMyProfile = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of Object.keys(PROFILE_MAX_LENGTHS)) {
    const value = req.body[field];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== 'string' || value.length > PROFILE_MAX_LENGTHS[field])) {
      return fail(res, `${field} must be a string of at most ${PROFILE_MAX_LENGTHS[field]} characters`, 400);
    }
    updates[field] = typeof value === 'string' ? value.trim() : value;
  }
  if (updates.name === '') {
    return fail(res, 'name cannot be empty', 400);
  }

  const updated = await schoolService.updateSchoolProfile(req.schoolId, updates);

  await auditService.record({
    schoolId: req.schoolId,
    userId: req.user.id,
    action: 'school.profile_updated',
    description: 'Updated school details',
  });

  return ok(res, updated);
});

const MAX_LENGTHS = {
  momoProvider: 30,
  momoNumber: 20,
  momoAccountName: 150,
  bankName: 150,
  bankAccountNumber: 50,
  bankAccountName: 150,
};

exports.getPaymentDetails = asyncHandler(async (req, res) => {
  const details = await schoolService.getPaymentDetails(req.schoolId);
  return ok(res, details);
});

exports.updatePaymentDetails = asyncHandler(async (req, res) => {
  const details = {};
  for (const field of Object.keys(MAX_LENGTHS)) {
    const value = req.body[field];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || value.length > MAX_LENGTHS[field]) {
      return fail(res, `${field} must be a string of at most ${MAX_LENGTHS[field]} characters`, 400);
    }
    details[field] = value.trim();
  }

  const updated = await schoolService.updatePaymentDetails(req.schoolId, details);

  await auditService.record({
    schoolId: req.schoolId,
    userId: req.user.id,
    action: 'school.payment_details_updated',
    description: 'Updated Mobile Money / bank payment details',
  });

  return ok(res, updated);
});
