const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

// Parses simple duration strings ('15m', '30d', '2h') into milliseconds.
// Used to align cookie maxAge / DB expires_at with the JWT's own expiresIn.
function msFromDuration(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration string: ${duration}`);
  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit];
}

module.exports = { msFromDuration };
