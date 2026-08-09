const path = require('path');

// Resolve relative to this file (backend/.env), not process.cwd() —
// otherwise "DB_NAME missing" happens simply because the process started
// from the wrong folder (e.g. the repo root instead of backend/).
// NODE_ENV=test loads .env.test (school_saas_test) and NODE_ENV=production
// loads .env.production (Supabase) — local `npm run dev` always stays on
// plain .env (local Postgres) so dev never accidentally touches prod data.
const envFile =
  process.env.NODE_ENV === 'test' ? '.env.test' : process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.resolve(__dirname, '../../', envFile) });

function required(name) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  db: {
    // Set DATABASE_URL (what Supabase/most hosts give you) to connect with a
    // single connection string instead of the discrete DB_* fields below —
    // db.js prefers this when present. Local dev keeps using DB_HOST etc.
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DATABASE_URL ? undefined : required('DB_NAME'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Not required() — push notifications are a progressive enhancement.
  // If unset, push.service.js no-ops instead of crashing the whole server.
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },

  // Not required() either — same reasoning as VAPID above. Unset in dev is
  // fine (email.service.js just logs instead of sending); the daily
  // subscription-lifecycle cron and signup welcome email both go through it.
  email: {
    apiKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM || 'MySchoolPortal <onboarding@resend.dev>',
  },

  // Shared secret the subscription-lifecycle cron endpoint checks for, so it
  // can't be triggered by anyone who isn't Vercel's own cron caller.
  cronSecret: process.env.CRON_SECRET || null,
};
