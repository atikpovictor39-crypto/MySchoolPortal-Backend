const express = require('express');
const router = express.Router();
const controller = require('./school.controller');
const requireAuth = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');

// SuperAdmin-only: create a new school + its first SchoolAdmin login (onboarding)
router.post('/', requireAuth, requireRole('SUPERADMIN'), controller.createSchool);
router.get('/', requireAuth, requireRole('SUPERADMIN'), controller.listSchools);

module.exports = router;
