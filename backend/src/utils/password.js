// Pure-JS bcrypt implementation — swapped from the native `bcrypt` package
// to drop its node-pre-gyp/tar dependency chain (a flagged critical CVE,
// build-time only, but avoidable entirely). Same hash algorithm/format, so
// existing password hashes keep verifying correctly.
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { hashPassword, comparePassword };
