const express = require('express');
const router = express.Router();
const controller = require('./subscription.controller');
const cronAuth = require('../../middleware/cronAuth.middleware');

// Deliberately separate from the normal JWT-protected /subscriptions router
// — this has no logged-in user behind it, just Vercel's cron caller.
router.get('/subscriptions', cronAuth, controller.runLifecycleCron);

module.exports = router;
