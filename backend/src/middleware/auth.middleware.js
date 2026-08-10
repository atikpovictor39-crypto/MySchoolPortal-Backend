const { verifyAccessToken } = require('../utils/jwt');

// Verifies the JWT access token from "Authorization: Bearer <token>" and
// attaches its claims to req.user. Everything downstream (tenant scoping,
// role checks) trusts req.user without touching the DB again.
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = verifyAccessToken(token); // { id, role, school_id, is_demo, must_change_password, superadmin_scope, iat, exp }
    req.user = {
      id: payload.id,
      role: payload.role,
      school_id: payload.school_id,
      is_demo: Boolean(payload.is_demo),
      must_change_password: Boolean(payload.must_change_password),
      superadmin_scope: payload.superadmin_scope || null,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
