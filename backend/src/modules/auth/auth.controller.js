const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');
const emailService = require('../email/email.service');
const { comparePassword } = require('../../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { msFromDuration } = require('../../utils/time');
const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function refreshCookieOptions() {
  // Frontend and backend live on separate domains in production (e.g. two
  // Vercel projects), so the refresh cookie has to be sent cross-site —
  // SameSite=Lax is dropped by the browser on cross-origin XHR/fetch and
  // would silently break session refresh. None requires Secure, which is
  // only valid over HTTPS, hence both being tied to the same condition.
  const isProd = env.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: msFromDuration(env.jwt.refreshExpiresIn),
    path: REFRESH_COOKIE_PATH,
  };
}

// Shared by login and refresh: a school-scoped user is blocked if either the
// school itself was suspended by SuperAdmin, or its subscription lapsed past
// the grace period (see subscription.service.js's processSubscriptionLifecycle).
function schoolAccessError(user) {
  if (!user.school_id) return null;
  if (user.school_status !== 'active') {
    return { status: 403, message: "This school's account is currently suspended. Contact your platform administrator." };
  }
  if (user.subscription_status === 'expired') {
    return { status: 403, message: 'This school\'s subscription has expired. Contact your platform administrator to renew.' };
  }
  return null;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    school_id: user.school_id,
    school_name: user.school_name || null,
    email_verified: Boolean(user.email_verified_at),
    must_change_password: Boolean(user.must_change_password),
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

  // Checked after the password so a suspended school doesn't double as a way
  // to probe whether an email/password combo is otherwise valid.
  const accessError = schoolAccessError(user);
  if (accessError) {
    return res.status(accessError.status).json({ success: false, message: accessError.message });
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
  const accessError = schoolAccessError(user);
  if (accessError) {
    return res.status(accessError.status).json({ success: false, message: accessError.message });
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
  const { maxAge, ...clearOptions } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);
  return res.json({ success: true, data: null });
});

// POST /auth/verify-email — authenticated (mounted behind requireAuth), so
// it works off req.user.id rather than a caller-supplied email/userId —
// nothing here lets a caller probe or brute-force another account's code
// without already holding that account's access token.
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'code is required' });
  }

  const user = await authService.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }
  if (user.email_verified_at) {
    return res.json({ success: true, data: { user: publicUser(user) } });
  }

  await authService.verifyEmailCode(user.id, code);
  const verifiedUser = await authService.findUserById(user.id);
  return res.json({ success: true, data: { user: publicUser(verifiedUser) } });
});

// POST /auth/resend-verification — reissues a fresh code (superseding
// whatever was sent before) and emails it again. Rate-limited to one per
// 60 seconds via authService.assertCanResendVerificationCode.
exports.resendVerificationCode = asyncHandler(async (req, res) => {
  const user = await authService.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }
  if (user.email_verified_at) {
    return res.json({ success: true, data: { alreadyVerified: true } });
  }

  await authService.assertCanResendVerificationCode(user.id);
  const code = await authService.createVerificationCode(user.id);
  emailService.sendVerificationEmail(user.email, user.name, code).catch((err) => {
    console.error('Failed to send verification email:', err.message);
  });

  return res.json({ success: true, data: { sent: true } });
});

// POST /auth/change-password — used both for a voluntary change and the
// mandatory one a teacher/guardian faces on first login (must_change_password,
// enforced server-side by requirePasswordChange.middleware.js on every other
// tenant route). Re-signs the access token since that flag flipping needs
// to take effect immediately, not wait for the token to expire or refresh.
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'newPassword must be at least 8 characters' });
  }

  await authService.changePassword(req.user.id, currentPassword, newPassword);

  const user = await authService.findUserById(req.user.id);
  const accessToken = signAccessToken(user);
  return res.json({ success: true, data: { accessToken, user: publicUser(user) } });
});
