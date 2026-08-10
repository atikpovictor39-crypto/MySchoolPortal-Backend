const express = require('express');
const router = express.Router();
const controller = require('./fee.controller');
const requireAuth = require('../../middleware/auth.middleware');
const tenantScope = require('../../middleware/tenant.middleware');
const blockDemoWrites = require('../../middleware/demoReadOnly.middleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange.middleware');
const blockDuringMaintenance = require('../../middleware/maintenanceMode.middleware');
const requireRole = require('../../middleware/role.middleware');

router.use(requireAuth, tenantScope, requirePasswordChange, blockDuringMaintenance, blockDemoWrites);

// Admin-only for viewing too, not just mutating — invoices/debtors expose
// every family's financial data, not just one. Parents use /api/v1/parent/*
// to see only their own child's invoices.
router.get('/structures', requireRole('SCHOOL_ADMIN'), controller.listStructures);
router.post('/structures', requireRole('SCHOOL_ADMIN'), controller.createStructure);
router.post('/structures/:id/generate-invoices', requireRole('SCHOOL_ADMIN'), controller.generateInvoices);

router.get('/invoices', requireRole('SCHOOL_ADMIN'), controller.listInvoices);
router.get('/invoices/:id', requireRole('SCHOOL_ADMIN'), controller.getInvoice);
router.post('/invoices/:id/payments', requireRole('SCHOOL_ADMIN'), controller.recordPayment);

router.get('/summary', requireRole('SCHOOL_ADMIN'), controller.getSummary);
router.get('/debtors', requireRole('SCHOOL_ADMIN'), controller.listDebtors);

router.get('/claims', requireRole('SCHOOL_ADMIN'), controller.listClaims);
router.post('/claims/:id/confirm', requireRole('SCHOOL_ADMIN'), controller.confirmClaim);
router.post('/claims/:id/reject', requireRole('SCHOOL_ADMIN'), controller.rejectClaim);

module.exports = router;
