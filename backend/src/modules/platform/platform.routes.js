const express = require('express');
const router = express.Router();
const controller = require('./platform.controller');
const ticketController = require('../tickets/ticket.controller');
const auditController = require('../audit/audit.controller');
const announcementController = require('../announcements/announcement.controller');
const requireAuth = require('../../middleware/auth.middleware');
const requireRole = require('../../middleware/role.middleware');
const requireScope = require('../../middleware/requireScope.middleware');

// Public — no auth. The frontend needs to know whether maintenance mode is
// on before anyone has logged in (or even reached the login form).
router.get('/status', controller.getStatus);

// Everything else is platform-level and SuperAdmin-only. No tenantScope —
// these operations aren't tied to one school.
router.use(requireAuth, requireRole('SUPERADMIN'));

// Technical/operational — developer scope.
router.get('/backup', requireScope('developer'), controller.downloadBackup);
router.patch('/maintenance', requireScope('developer'), controller.updateMaintenance);

// Support tickets, seen across every school (the school-side equivalents
// live at /tickets, tenant-scoped, SCHOOL_ADMIN only).
router.get('/tickets', requireScope('support'), ticketController.listAll);
router.get('/tickets/:id', requireScope('support'), ticketController.getOne);
router.post('/tickets/:id/replies', requireScope('support'), ticketController.replyAsSuperAdmin);
router.patch('/tickets/:id/status', requireScope('support'), ticketController.updateStatus);

// Activity across every school, newest first (same audit_logs table each
// school's own Audit Log page reads from, just without the school_id filter).
// Useful to both support (investigating a school's issue) and developer
// (debugging) scopes.
router.get('/audit-logs', requireScope('support', 'developer'), auditController.listPlatform);

// Broadcasts to every school at once (school_id IS NULL) — shown alongside
// each school's own announcements on their existing Announcements pages.
router.get('/announcements', requireScope('support'), announcementController.listPlatform);
router.post('/announcements', requireScope('support'), announcementController.createPlatform);
router.delete('/announcements/:id', requireScope('support'), announcementController.removePlatform);

module.exports = router;
