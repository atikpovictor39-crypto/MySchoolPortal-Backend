const db = require('../../config/db');

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const TICKET_COLUMNS = 't.id, t.school_id, t.created_by, u.name AS created_by_name, t.subject, t.message, t.status, t.priority, t.created_at, t.updated_at';

// ---- School side (tenant-scoped) ----

async function createTicket(schoolId, userId, { subject, message, priority }) {
  const [result] = await db.query(
    `INSERT INTO support_tickets (school_id, created_by, subject, message, priority)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    [schoolId, userId, subject, message, priority || 'normal']
  );
  return getTicketById(result[0].id, schoolId);
}

async function listTicketsForSchool(schoolId) {
  const [rows] = await db.query(
    `SELECT ${TICKET_COLUMNS} FROM support_tickets t JOIN users u ON u.id = t.created_by
     WHERE t.school_id = ? ORDER BY t.created_at DESC`,
    [schoolId]
  );
  return rows;
}

// ---- Shared ----

// schoolId is optional: pass it for the school-side ownership check,
// omit it for the SuperAdmin side which can see any ticket.
async function getTicketById(id, schoolId = null) {
  const where = schoolId ? 't.id = ? AND t.school_id = ?' : 't.id = ?';
  const params = schoolId ? [id, schoolId] : [id];
  const [rows] = await db.query(
    `SELECT ${TICKET_COLUMNS}, s.name AS school_name FROM support_tickets t
     JOIN users u ON u.id = t.created_by
     JOIN schools s ON s.id = t.school_id
     WHERE ${where} LIMIT 1`,
    params
  );
  const ticket = rows[0];
  if (!ticket) return null;

  const [replies] = await db.query(
    `SELECT r.id, r.message, r.created_at, r.author_id, u.name AS author_name, u.role AS author_role
     FROM support_ticket_replies r JOIN users u ON u.id = r.author_id
     WHERE r.ticket_id = ? ORDER BY r.created_at`,
    [id]
  );
  return { ...ticket, replies };
}

async function addReply(ticketId, authorId, message) {
  await db.query('INSERT INTO support_ticket_replies (ticket_id, author_id, message) VALUES (?, ?, ?)', [
    ticketId,
    authorId,
    message,
  ]);
  // Any reply nudges an idle ticket back to in_progress — nobody has to
  // remember to flip the status by hand every time they respond.
  await db.query("UPDATE support_tickets SET status = 'in_progress' WHERE id = ? AND status = 'open'", [ticketId]);
}

// ---- SuperAdmin side (platform-level) ----

async function listAllTickets({ status } = {}) {
  const where = ['1=1'];
  const params = [];
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  const [rows] = await db.query(
    `SELECT ${TICKET_COLUMNS}, s.name AS school_name FROM support_tickets t
     JOIN users u ON u.id = t.created_by
     JOIN schools s ON s.id = t.school_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.created_at DESC`,
    params
  );
  return rows;
}

async function updateTicketStatus(id, status) {
  const [result] = await db.query(
    'UPDATE support_tickets SET status = ? WHERE id = ? RETURNING id',
    [status, id]
  );
  if (result.length === 0) return null;
  return getTicketById(id);
}

module.exports = {
  STATUSES,
  PRIORITIES,
  createTicket,
  listTicketsForSchool,
  getTicketById,
  addReply,
  listAllTickets,
  updateTicketStatus,
};
