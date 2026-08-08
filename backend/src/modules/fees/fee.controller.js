const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const feeService = require('./fee.service');

// ---- Fee Structures ----

exports.listStructures = asyncHandler(async (req, res) => {
  const structures = await feeService.listFeeStructures(req.schoolId);
  return ok(res, structures);
});

exports.createStructure = asyncHandler(async (req, res) => {
  const { academicYearId, classId, name, amountCents, dueDate } = req.body;
  if (!academicYearId || !name || !amountCents) {
    return fail(res, 'academicYearId, name and amountCents are required', 400);
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return fail(res, 'amountCents must be a positive integer (cents, not a decimal currency amount)', 400);
  }

  const structure = await feeService.createFeeStructure(req.schoolId, {
    academicYearId,
    classId,
    name,
    amountCents,
    dueDate,
  });
  return ok(res, structure, 201);
});

exports.generateInvoices = asyncHandler(async (req, res) => {
  const result = await feeService.generateInvoices(req.schoolId, req.params.id);
  return ok(res, result);
});

// ---- Invoices ----

exports.listInvoices = asyncHandler(async (req, res) => {
  const { studentId, classId, status } = req.query;
  if (status && !feeService.INVOICE_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${feeService.INVOICE_STATUSES.join(', ')}`, 400);
  }
  const invoices = await feeService.listInvoices(req.schoolId, { studentId, classId, status });
  return ok(res, invoices);
});

exports.getInvoice = asyncHandler(async (req, res) => {
  const invoice = await feeService.getInvoiceById(req.schoolId, req.params.id);
  if (!invoice) return fail(res, 'Invoice not found', 404);
  return ok(res, invoice);
});

// ---- Payments ----

exports.recordPayment = asyncHandler(async (req, res) => {
  const { amountCents, paymentMethod, paymentRef, paidAt } = req.body;
  if (!amountCents || !Number.isInteger(amountCents) || amountCents <= 0) {
    return fail(res, 'amountCents must be a positive integer', 400);
  }
  if (paymentMethod && !feeService.PAYMENT_METHODS.includes(paymentMethod)) {
    return fail(res, `paymentMethod must be one of: ${feeService.PAYMENT_METHODS.join(', ')}`, 400);
  }

  const invoice = await feeService.recordPayment(req.schoolId, req.params.id, {
    amountCents,
    paymentMethod,
    paymentRef,
    paidAt,
    recordedBy: req.user.id,
  });
  return ok(res, invoice, 201);
});

// ---- Summary ----

exports.getSummary = asyncHandler(async (req, res) => {
  const summary = await feeService.getFeesSummary(req.schoolId);
  return ok(res, summary);
});

// ---- Debtors ----

exports.listDebtors = asyncHandler(async (req, res) => {
  const debtors = await feeService.listDebtors(req.schoolId);
  return ok(res, debtors);
});

// ---- Payment Claims ----

exports.listClaims = asyncHandler(async (req, res) => {
  const { status } = req.query;
  if (status && !feeService.CLAIM_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${feeService.CLAIM_STATUSES.join(', ')}`, 400);
  }
  const claims = await feeService.listPaymentClaims(req.schoolId, { status });
  return ok(res, claims);
});

exports.confirmClaim = asyncHandler(async (req, res) => {
  const claim = await feeService.confirmPaymentClaim(req.schoolId, req.params.id, req.user.id);
  return ok(res, claim);
});

exports.rejectClaim = asyncHandler(async (req, res) => {
  const claim = await feeService.rejectPaymentClaim(req.schoolId, req.params.id, req.user.id, req.body.reason);
  return ok(res, claim);
});
