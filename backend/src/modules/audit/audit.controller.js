const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const auditService = require('./audit.service');

exports.list = asyncHandler(async (req, res) => {
  const logs = await auditService.listAuditLogs(req.schoolId);
  return ok(res, logs);
});

// SuperAdmin, cross-school. Optional ?school_id= to narrow to one school.
exports.listPlatform = asyncHandler(async (req, res) => {
  const schoolId = req.query.school_id ? Number(req.query.school_id) : undefined;
  const logs = await auditService.listAllAuditLogs({ schoolId });
  return ok(res, logs);
});
