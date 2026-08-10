const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// The test suite makes hundreds of login/register calls back-to-back from
// the same source in a single run — without this they'd trip their own
// rate limits and fail for a reason that has nothing to do with what
// they're testing.
const skip = () => env.nodeEnv === 'test';

// In-memory store: a real first layer of defense (blocks scripted attacks
// hitting the same warm serverless instance) but not a hard guarantee on
// Vercel, where a distributed attempt across cold starts/regions gets a
// fresh counter each time. If this ever needs to be airtight, swap the
// store for something like Upstash Redis — the limiter configs below don't
// change, only how counts are stored.
function fail(message) {
  return (req, res) => res.status(429).json({ success: false, message });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: fail('Too many login attempts. Please wait a few minutes and try again.'),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: fail('Too many signup attempts from this network. Please try again later.'),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: fail('Too many password reset requests. Please try again later.'),
});

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter };
