const env = require('../config/env');

// Vercel Cron automatically sends "Authorization: Bearer <CRON_SECRET>" for
// jobs it triggers (see vercel.json) when CRON_SECRET is set as a project
// env var — this is the only thing standing between this endpoint and the
// public internet, so a misconfigured/missing secret must fail closed.
module.exports = function cronAuth(req, res, next) {
  if (!env.cronSecret) {
    return res.status(503).json({ success: false, message: 'CRON_SECRET is not configured' });
  }
  if (req.headers.authorization !== `Bearer ${env.cronSecret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return next();
};
