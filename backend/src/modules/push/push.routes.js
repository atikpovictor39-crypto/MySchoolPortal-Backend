const express = require('express');
const router = express.Router();
const controller = require('./push.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');

router.get('/public-key', controller.getPublicKey); // no auth needed — it's public by definition

router.use(requireAuth, tenantScope, requirePasswordChange, blockDemoWrites);
router.post('/subscribe', controller.subscribe);
router.post('/unsubscribe', controller.unsubscribe);

module.exports = router;
