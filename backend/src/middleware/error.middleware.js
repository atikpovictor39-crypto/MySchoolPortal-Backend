const { fail } = require('../utils/apiResponse');

function notFound(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// Express recognizes error middleware by its 4-argument signature.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  return fail(res, err.message || 'Internal server error', status);
}

module.exports = { notFound, errorHandler };
