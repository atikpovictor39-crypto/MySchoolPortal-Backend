// Factory: requireRole('SCHOOL_ADMIN', 'TEACHER') restricts a route to the
// given roles. Must run after requireAuth (needs req.user.role).
module.exports = function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }

    return next();
  };
};
