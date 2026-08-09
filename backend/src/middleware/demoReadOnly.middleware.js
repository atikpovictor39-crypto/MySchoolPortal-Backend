const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// The public demo account (schools.is_demo = TRUE) lets anyone log in and
// click around, so every write has to be blocked or strangers would be
// editing each other's "demo" data. req.user.is_demo comes straight from
// the JWT payload (see jwt.js) — no extra DB round-trip needed.
module.exports = function blockDemoWrites(req, res, next) {
  if (MUTATING_METHODS.has(req.method) && req.user?.is_demo) {
    return res.status(403).json({
      success: false,
      message: 'This is a read-only demo account — changes are disabled. Sign up for your own school to try this.',
    });
  }
  return next();
};
