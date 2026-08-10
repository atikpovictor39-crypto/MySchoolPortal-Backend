const express = require('express');
const router = express.Router();
const controller = require('./notification.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, blockDemoWrites, requireRole('SCHOOL_ADMIN'));

router.get('/', controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/:id/read', controller.markRead);
router.post('/mark-all-read', controller.markAllRead);

module.exports = router;
