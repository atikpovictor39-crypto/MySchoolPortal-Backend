// Must be required first — see sentry.js for why.
const { Sentry, isConfigured: sentryConfigured } = require('./sentry');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Vercel sits in front of this as a reverse proxy — without trusting it,
// every request looks like it comes from the same internal IP, which would
// make the rate limiters below useless (one shared bucket for everyone).
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    // No Origin header at all (curl, server-to-server, native apps) is let
    // through; browser requests are checked against the allowlist so a
    // mismatched domain fails loudly server-side instead of being silently
    // dropped by the browser after the request already ran.
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Temporary — verifying Sentry actually captures a real error in
// production. Removed again once confirmed in the Sentry dashboard.
app.get('/health/sentry-test', () => {
  throw new Error('Sentry backend verification test — safe to ignore');
});

app.use('/api/v1', routes);

app.use(notFound);

// Must be registered after routes but before the app's own error handler —
// Sentry's own docs are explicit about this ordering. Only reports 5xx:
// expected 4xx (bad password, duplicate email, etc.) already flow through
// asyncHandler -> errorHandler same as real crashes, and flooding Sentry
// with "wrong password" would bury the errors actually worth seeing.
if (sentryConfigured) {
  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError: (err) => !err.status || err.status >= 500,
  });
}

app.use(errorHandler);

module.exports = app;
