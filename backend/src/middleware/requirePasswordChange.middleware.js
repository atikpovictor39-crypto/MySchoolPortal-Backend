// Blocks every tenant-scoped route for an account an admin set a temp
// password for (teachers, guardians) until they change it — enforced
// server-side, not just hidden in the UI, so the forced-change screen on
// the frontend can't be bypassed by calling the API directly. The
// POST /auth/change-password route itself lives outside this chain (see
// auth.routes.js), so it stays reachable exactly when this would block.
module.exports = function blockIfMustChangePassword(req, res, next) {
  if (req.user?.must_change_password) {
    return res.status(403).json({
      success: false,
      message: 'You must change your password before continuing.',
      code: 'MUST_CHANGE_PASSWORD',
    });
  }
  return next();
};
