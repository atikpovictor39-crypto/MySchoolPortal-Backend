const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const superadminService = require('./superadmin.service');

exports.list = asyncHandler(async (req, res) => {
  const admins = await superadminService.listSuperAdmins();
  return ok(res, admins);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return fail(res, 'name, email and password are required', 400);
  }

  const admin = await superadminService.createSuperAdmin({
    name,
    email: email.toLowerCase().trim(),
    password,
  });
  return ok(res, admin, 201);
});

const STATUSES = ['active', 'suspended'];

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${STATUSES.join(', ')}`, 400);
  }
  if (Number(req.params.id) === req.user.id) {
    return fail(res, 'You cannot change your own account status', 400);
  }

  const admin = await superadminService.updateSuperAdminStatus(req.params.id, status);
  if (!admin) return fail(res, 'Account not found', 404);
  return ok(res, admin);
});
