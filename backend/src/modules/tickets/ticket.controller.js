const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const ticketService = require('./ticket.service');

// ---- School side ----

exports.create = asyncHandler(async (req, res) => {
  const { subject, message, priority } = req.body;
  if (!subject || !message) {
    return fail(res, 'subject and message are required', 400);
  }
  if (priority && !ticketService.PRIORITIES.includes(priority)) {
    return fail(res, `priority must be one of: ${ticketService.PRIORITIES.join(', ')}`, 400);
  }
  const ticket = await ticketService.createTicket(req.schoolId, req.user.id, { subject, message, priority });
  return ok(res, ticket, 201);
});

exports.listMine = asyncHandler(async (req, res) => {
  const tickets = await ticketService.listTicketsForSchool(req.schoolId);
  return ok(res, tickets);
});

exports.getMine = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getTicketById(req.params.id, req.schoolId);
  if (!ticket) return fail(res, 'Ticket not found', 404);
  return ok(res, ticket);
});

exports.replyAsSchool = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return fail(res, 'message is required', 400);

  const ticket = await ticketService.getTicketById(req.params.id, req.schoolId);
  if (!ticket) return fail(res, 'Ticket not found', 404);

  await ticketService.addReply(req.params.id, req.user.id, message);
  return ok(res, await ticketService.getTicketById(req.params.id, req.schoolId), 201);
});

// ---- SuperAdmin side ----

exports.listAll = asyncHandler(async (req, res) => {
  const { status } = req.query;
  if (status && !ticketService.STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${ticketService.STATUSES.join(', ')}`, 400);
  }
  const tickets = await ticketService.listAllTickets({ status });
  return ok(res, tickets);
});

exports.getOne = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getTicketById(req.params.id);
  if (!ticket) return fail(res, 'Ticket not found', 404);
  return ok(res, ticket);
});

exports.replyAsSuperAdmin = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return fail(res, 'message is required', 400);

  const ticket = await ticketService.getTicketById(req.params.id);
  if (!ticket) return fail(res, 'Ticket not found', 404);

  await ticketService.addReply(req.params.id, req.user.id, message);
  return ok(res, await ticketService.getTicketById(req.params.id), 201);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!ticketService.STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${ticketService.STATUSES.join(', ')}`, 400);
  }
  const ticket = await ticketService.updateTicketStatus(req.params.id, status);
  if (!ticket) return fail(res, 'Ticket not found', 404);
  return ok(res, ticket);
});
