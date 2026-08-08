const express = require('express');
const router = express.Router();
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');

router.use(requireAuth, tenantScope);

// TODO: list/invite/update users within req.schoolId (Teachers, Parents, etc.)
router.get('/', (req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }));

module.exports = router;
