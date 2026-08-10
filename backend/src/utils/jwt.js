const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Access token payload is the one every downstream middleware relies on:
// auth.middleware trusts { id, role, school_id } straight out of the token
// without a DB round-trip, so tenant scoping stays fast on every request.
function signAccessToken(user) {
  return jwt.sign(
    {
      id: Number(user.id),
      role: user.role,
      school_id: user.school_id != null ? Number(user.school_id) : null,
      is_demo: Boolean(user.is_demo),
      must_change_password: Boolean(user.must_change_password),
      superadmin_scope: user.superadmin_scope || null,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

// Refresh token stays minimal (just the user id) — role/school_id are re-read
// from the DB on refresh so a role change or suspension takes effect immediately
// instead of surviving until the old access token expires.
function signRefreshToken(user) {
  return jwt.sign({ id: Number(user.id) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
