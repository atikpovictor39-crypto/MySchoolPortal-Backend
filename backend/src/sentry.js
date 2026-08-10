// Required at the very top of app.js, before anything else — Sentry's own
// docs call this out explicitly so its instrumentation is in place before
// other modules (db, express, etc.) are loaded. No-ops entirely without a
// DSN, same isConfigured pattern as email.service.js/push.service.js, so
// local dev and CI never need Sentry set up to run.
const Sentry = require('@sentry/node');
const env = require('./config/env');

const isConfigured = Boolean(env.sentryDsn);

if (isConfigured) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    // Traces cost quota on Sentry's free tier and this app doesn't need
    // full performance monitoring yet — keep this at 0 and revisit if
    // request tracing becomes worth paying for.
    tracesSampleRate: 0,
  });
}

module.exports = { Sentry, isConfigured };
