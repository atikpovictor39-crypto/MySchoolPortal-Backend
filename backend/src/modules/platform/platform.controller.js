const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const backupService = require('./backup.service');
const platformService = require('./platform.service');

exports.downloadBackup = asyncHandler(async (req, res) => {
  const backup = await backupService.generateBackup();
  const filename = `myschoolportal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(JSON.stringify(backup, null, 2));
});

// Public — the frontend needs to know whether to show the maintenance
// page before anyone has logged in at all.
exports.getStatus = asyncHandler(async (req, res) => {
  const settings = await platformService.getSettings();
  return ok(res, {
    maintenanceMode: settings.maintenance_mode,
    message: settings.maintenance_message,
  });
});

exports.updateMaintenance = asyncHandler(async (req, res) => {
  const { enabled, message } = req.body;
  if (typeof enabled !== 'boolean') {
    return fail(res, 'enabled must be true or false', 400);
  }
  const settings = await platformService.setMaintenanceMode(enabled, message);
  return ok(res, {
    maintenanceMode: settings.maintenance_mode,
    message: settings.maintenance_message,
  });
});
