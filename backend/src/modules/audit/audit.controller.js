const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const auditService = require('./audit.service');

exports.list = asyncHandler(async (req, res) => {
  const logs = await auditService.listAuditLogs(req.schoolId);
  return ok(res, logs);
});
