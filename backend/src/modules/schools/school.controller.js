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
