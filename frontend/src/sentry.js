import * as Sentry from '@sentry/react';

// No-ops entirely without a DSN — same pattern as the backend's sentry.js —
// so local dev never needs a Sentry project configured to run.
const dsn = import.meta.env.VITE_SENTRY_DSN;
export const isSentryConfigured = Boolean(dsn);

if (isSentryConfigured) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // No performance tracing or session replay yet — this is just crash
    // visibility for now, kept free-tier-friendly.
    tracesSampleRate: 0,
  });
}

export { Sentry };
