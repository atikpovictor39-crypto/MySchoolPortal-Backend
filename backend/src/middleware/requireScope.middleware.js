// Factory: requireScope('support', 'billing') restricts a SUPERADMIN route
// to sub-admins with one of the given scopes. A NULL/'full' scope (the
// original, unrestricted SuperAdmin) always passes, no matter what's listed.
// Calling requireScope() with no arguments means "full-scope only" — used
// for sensitive platform-level operations like managing other SuperAdmin
// accounts, where even a sub-admin shouldn't be allowed in.
// Must run after requireAuth + requireRole('SUPERADMIN').
module.exports = function requireScope(...allowedScopes) {
  return (req, res, next) => {
    const scope = req.user.superadmin_scope;
    if (!scope || scope === 'full') return next();
    if (allowedScopes.includes(scope)) return next();
    return res.status(403).json({
      success: false,
      message: 'Your SuperAdmin account does not have permission to perform this action',
    });
  };
};
