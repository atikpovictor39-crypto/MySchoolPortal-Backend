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

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
