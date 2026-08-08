const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const schoolService = require('./school.service');

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
  return ok(res, school, 201);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return fail(res, 'status is required', 400);
  }
  const school = await schoolService.updateSchoolStatus(req.params.id, status);
  return ok(res, school);
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
  return ok(res, updated);
});
