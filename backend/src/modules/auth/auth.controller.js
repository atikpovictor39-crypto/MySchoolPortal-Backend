const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');
const { comparePassword } = require('../../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { msFromDuration } = require('../../utils/time');
const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: msFromDuration(env.jwt.refreshExpiresIn),
    path: REFRESH_COOKIE_PATH,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    school_id: user.school_id,
    school_name: user.school_name || null,
  };
}

// POST /auth/register — self-service signup: creates a new School + its
// first SCHOOL_ADMIN in one go (the "start free trial" path). SuperAdmin-led
// onboarding for existing customers goes through POST /schools instead.
exports.register = asyncHandler(async (req, res) => {
  const { schoolName, adminName, adminEmail, adminPassword, planId } = req.body;

  if (!schoolName || !adminName || !adminEmail || !adminPassword) {
    return res
      .status(400)
      .json({ success: false, message: 'schoolName, adminName, adminEmail and adminPassword are required' });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const admin = await authService.registerSchoolWithAdmin({
    schoolName,
    adminName,
    adminEmail: adminEmail.toLowerCase().trim(),
    adminPassword,
    planId,
  });

  const accessToken = signAccessToken(admin);
  const refreshToken = signRefreshToken(admin);
  await authService.storeRefreshToken(admin.id, refreshToken);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return res.status(201).json({ success: true, data: { accessToken, user: publicUser(admin) } });
});

// POST /auth/login — works for every role (SuperAdmin, SchoolAdmin, Teacher,
// Parent, Student); the JWT payload carries { id, role, school_id } so
// tenant scoping and role checks need no further DB lookups downstream.
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required' });
  }

  const user = await authService.findUserByEmail(email.toLowerCase().trim());
  if (!user || user.status !== 'active') {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await authService.storeRefreshToken(user.id, refreshToken);
  await authService.touchLastLogin(user.id);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return res.json({ success: true, data: { accessToken, user: publicUser(user) } });
});

// POST /auth/refresh — issues a new short-lived access token from the
// httpOnly refresh cookie. Re-reads the user from the DB (not just the old
// token's claims) so a suspended account or role change takes effect
// immediately instead of surviving until the access token's own expiry.
exports.refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    return res.status(401).json({ success: false, message: 'Missing refresh token' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }

  const stored = await authService.findValidRefreshToken(rawToken);
  if (!stored || Number(stored.user_id) !== Number(payload.id)) {
    return res.status(401).json({ success: false, message: 'Refresh token has been revoked' });
  }

  const user = await authService.findUserById(payload.id);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ success: false, message: 'Account is no longer active' });
  }

  const accessToken = signAccessToken(user);
  return res.json({ success: true, data: { accessToken, user: publicUser(user) } });
});

// POST /auth/logout — revokes the refresh token server-side and clears the
// cookie. Without this, a stolen refresh token would stay valid until it
// naturally expired (30 days by default).
exports.logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    await authService.revokeRefreshToken(rawToken);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  return res.json({ success: true, data: null });
});
