const express = require('express');
const router = express.Router();
const controller = require('./platform.controller');
const ticketController = require('../tickets/ticket.controller');
const requireAuth = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');

// Public — no auth. The frontend needs to know whether maintenance mode is
// on before anyone has logged in (or even reached the login form).
router.get('/status', controller.getStatus);

// Everything else is platform-level and SuperAdmin-only. No tenantScope —
// these operations aren't tied to one school.
router.use(requireAuth, requireRole('SUPERADMIN'));

router.get('/backup', controller.downloadBackup);
router.patch('/maintenance', controller.updateMaintenance);

// Support tickets, seen across every school (the school-side equivalents
// live at /tickets, tenant-scoped, SCHOOL_ADMIN only).
router.get('/tickets', ticketController.listAll);
router.get('/tickets/:id', ticketController.getOne);
router.post('/tickets/:id/replies', ticketController.replyAsSuperAdmin);
router.patch('/tickets/:id/status', ticketController.updateStatus);

module.exports = router;
