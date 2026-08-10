const express = require('express');
const router = express.Router();
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDemoWrites);

// TODO: list/invite/update users within req.schoolId (Teachers, Parents, etc.)
router.get('/', (req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }));

module.exports = router;
