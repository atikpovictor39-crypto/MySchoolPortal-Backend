// Must run after requireAuth. Derives req.schoolId from the JWT so every
// controller/query in a tenant-scoped route can filter by it — this is the
// single choke point that enforces "schools can't see each other's data".
//
// SUPERADMIN accounts have no school_id (they operate at the platform level,
// via the /schools and /subscriptions routes), so they are intentionally
// rejected here rather than allowed through with a null/blank scope.
module.exports = function tenantScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (!req.user.school_id) {
    return res.status(403).json({ success: false, message: 'This action requires a school-scoped account' });
  }

  req.schoolId = req.user.school_id;
  return next();
};
