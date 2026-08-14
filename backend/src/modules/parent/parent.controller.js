const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const parentService = require('./parent.service');
const resultService = require('../results/result.service');
const announcementService = require('../announcements/announcement.service');
const homeworkService = require('../homework/homework.service');
const timetableService = require('../timetable/timetable.service');
const schoolService = require('../schools/school.service');
const feeService = require('../fees/fee.service');
const notificationService = require('../notifications/notification.service');

exports.listChildren = asyncHandler(async (req, res) => {
  const children = await parentService.listChildren(req.schoolId, req.user.id);
  return ok(res, children);
});

exports.listAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listForParent(req.schoolId, req.user.id);
  return ok(res, announcements);
});

// Powers the badge next to the Announcements nav link.
exports.unreadAnnouncementsCount = asyncHandler(async (req, res) => {
  const count = await announcementService.countUnreadForParent(req.schoolId, req.user.id);
  return ok(res, { count });
});

// Called when the Announcements page mounts — clears the badge.
exports.markAnnouncementsSeen = asyncHandler(async (req, res) => {
  await announcementService.markAnnouncementsSeen(req.user.id);
  return ok(res, null);
});

// School-level info, not tied to any specific child — no ownership check needed.
exports.getPaymentDetails = asyncHandler(async (req, res) => {
  const details = await schoolService.getPaymentDetails(req.schoolId);
  return ok(res, details);
});

// Name/address/phone/logo for the report card letterhead — not sensitive
// (payment details above are the separate, actually-sensitive endpoint).
exports.getSchoolInfo = asyncHandler(async (req, res) => {
  const profile = await schoolService.getSchoolProfile(req.schoolId);
  return ok(res, profile);
});

// Every handler below touches one specific student — always re-verify
// ownership from the DB per request rather than trusting the URL, since a
// parent could otherwise just change the studentId and read anyone's child.
async function assertOwnChild(req, res) {
  const owns = await parentService.isOwnChild(req.schoolId, req.user.id, req.params.studentId);
  if (!owns) {
    fail(res, 'Not your child', 403);
    return false;
  }
  return true;
}

exports.getChildAttendance = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const { from, to } = req.query;
  const attendance = await parentService.getChildAttendance(req.schoolId, req.params.studentId, { from, to });
  return ok(res, attendance);
});

exports.getChildExams = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const exams = await parentService.getChildExams(req.schoolId, req.params.studentId);
  return ok(res, exams);
});

exports.getChildReportCard = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const reportCard = await resultService.getReportCard(req.schoolId, req.params.examId, req.params.studentId);
  return ok(res, reportCard);
});

exports.getChildFees = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const fees = await parentService.getChildFees(req.schoolId, req.params.studentId);
  return ok(res, fees);
});

// Powers the parent-facing receipt drill-down — reuses the same invoice +
// payments shape the admin sees, but studentId and invoiceId are independent
// URL params, so re-check the invoice actually belongs to this child rather
// than just any invoice in the school.
exports.getChildInvoice = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const invoice = await feeService.getInvoiceById(req.schoolId, req.params.invoiceId);
  if (!invoice || String(invoice.student_id) !== String(req.params.studentId)) {
    return fail(res, 'Invoice not found', 404);
  }
  return ok(res, invoice);
});

// "I've made this payment" — the parent self-identifies as the payer for a
// specific invoice so the admin isn't left guessing whose money just landed.
exports.submitPaymentClaim = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;

  const { amountCents, paymentMethod, paidAt, reference } = req.body;
  if (!amountCents || !Number.isInteger(amountCents) || amountCents <= 0) {
    return fail(res, 'amountCents must be a positive integer', 400);
  }
  if (!feeService.CLAIM_PAYMENT_METHODS.includes(paymentMethod)) {
    return fail(res, `paymentMethod must be one of: ${feeService.CLAIM_PAYMENT_METHODS.join(', ')}`, 400);
  }
  if (!paidAt) {
    return fail(res, 'paidAt is required', 400);
  }
  if (reference && (typeof reference !== 'string' || reference.length > 150)) {
    return fail(res, 'reference must be a string of at most 150 characters', 400);
  }

  const claim = await feeService.createPaymentClaim(req.schoolId, {
    invoiceId: req.params.invoiceId,
    studentId: req.params.studentId,
    parentUserId: req.user.id,
    amountCents,
    paymentMethod,
    paidAt,
    reference,
  });

  await notificationService.create(req.schoolId, {
    type: 'payment_claim',
    title: 'New payment claim submitted',
    message: `${claim.parent_name} claims to have paid GHS ${(amountCents / 100).toFixed(2)} for ${claim.first_name} ${claim.last_name}`,
  });

  return ok(res, claim, 201);
});

exports.getChildHomework = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const classId = await parentService.getChildClassId(req.schoolId, req.params.studentId);
  const homework = await homeworkService.listForClass(req.schoolId, classId);
  return ok(res, homework);
});

exports.getChildTimetable = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const classId = await parentService.getChildClassId(req.schoolId, req.params.studentId);
  const timetable = await timetableService.listTimetable(req.schoolId, { classId });
  return ok(res, timetable);
});

// Powers the Overview dashboard: attendance rate, fee balance, and — if any
// exam exists for the child's class — that exam's class average and position.
exports.getChildOverview = asyncHandler(async (req, res) => {
  if (!(await assertOwnChild(req, res))) return;
  const studentId = req.params.studentId;

  const [stats, exams] = await Promise.all([
    parentService.getChildOverviewStats(req.schoolId, studentId),
    parentService.getChildExams(req.schoolId, studentId),
  ]);

  let examSummary = { latestExam: null, classAverage: null, position: null, classSize: null };
  if (exams.length > 0) {
    const latestExam = exams[0];
    const summary = await resultService.getExamSummaryForStudent(req.schoolId, latestExam.id, studentId);
    examSummary = { latestExam, ...summary };
  }

  return ok(res, { ...stats, ...examSummary });
});
