const express = require('express');
const router = express.Router();
const requireAuth = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');

// SuperAdmin manages plans/subscriptions across all tenants; SchoolAdmin can view their own.
router.get('/plans', requireAuth, (req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }));
router.get('/mine', requireAuth, requireRole('SCHOOL_ADMIN'), (req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }));

module.exports = router;
