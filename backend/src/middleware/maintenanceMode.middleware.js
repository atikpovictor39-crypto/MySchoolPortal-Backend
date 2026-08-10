const platformService = require('../modules/platform/platform.service');

// Checked on every tenant-scoped route (same wiring point as
// requirePasswordChange/blockDemoWrites) — SUPERADMIN always passes through
// so they can turn maintenance mode back off; everyone else gets a 503
// while it's on. Auth routes (login/refresh) are deliberately never gated
// here, otherwise a SuperAdmin could lock themselves out of the only way
// to disable it.
module.exports = async function blockDuringMaintenance(req, res, next) {
  if (req.user?.role === 'SUPERADMIN') return next();

  const settings = await platformService.getSettings();
  if (settings?.maintenance_mode) {
    return res.status(503).json({
      success: false,
      message: settings.maintenance_message || 'The system is temporarily down for maintenance. Please check back soon.',
      code: 'MAINTENANCE_MODE',
    });
  }
  return next();
};
