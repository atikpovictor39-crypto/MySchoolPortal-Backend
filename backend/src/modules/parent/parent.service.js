const db = require('../../config/db');

// The single choke point every parent.controller.js handler must pass
// through before touching a specific student's data.
async function isOwnChild(schoolId, parentUserId, studentId) {
  const [rows] = await db.query(
    'SELECT id FROM student_guardians WHERE school_id = ? AND parent_user_id = ? AND student_id = ? LIMIT 1',
    [schoolId, parentUserId, studentId]
  );
  return rows.length > 0;
}

async function listChildren(schoolId, parentUserId) {
  const [rows] = await db.query(
    `SELECT s.id, s.admission_no, s.first_name, s.last_name, s.class_id, c.name AS class_name, c.section
     FROM student_guardians sg
     JOIN students s ON s.id = sg.student_id
     JOIN classes c ON c.id = s.class_id
     WHERE sg.school_id = ? AND sg.parent_user_id = ?
     ORDER BY s.first_name, s.last_name`,
    [schoolId, parentUserId]
  );
  return rows;
}

async function getChildAttendance(schoolId, studentId, { from, to } = {}) {
  const conditions = ['student_id = ?', 'school_id = ?'];
  const params = [studentId, schoolId];
  if (from) {
    conditions.push('date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('date <= ?');
    params.push(to);
  }

  const [rows] = await db.query(
    `SELECT date, status FROM attendance WHERE ${conditions.join(' AND ')} ORDER BY date DESC`,
    params
  );
  return rows;
}

async function getChildExams(schoolId, studentId) {
  const [rows] = await db.query(
    `SELECT e.id, e.name, e.term, e.created_at
     FROM exams e
     JOIN students s ON s.class_id = e.class_id
     WHERE s.id = ? AND e.school_id = ?
     ORDER BY e.created_at DESC`,
    [studentId, schoolId]
  );
  return rows;
}

// latest_claim_status lets the parent's Fees page show "Pending review" on an
// invoice they've already claimed a payment for, instead of letting them
// submit the same claim over and over while waiting on the admin.
async function getChildFees(schoolId, studentId) {
  const [rows] = await db.query(
    `SELECT fi.id, fi.amount_due_cents, fi.amount_paid_cents, fi.status, fi.due_date, fs.name AS fee_name,
       (SELECT fpc.status FROM fee_payment_claims fpc
        WHERE fpc.invoice_id = fi.id ORDER BY fpc.created_at DESC LIMIT 1) AS latest_claim_status
     FROM fee_invoices fi
     JOIN fee_structures fs ON fs.id = fi.fee_structure_id
     WHERE fi.student_id = ? AND fi.school_id = ?
     ORDER BY fi.created_at DESC`,
    [studentId, schoolId]
  );
  return rows;
}

async function getChildClassId(schoolId, studentId) {
  const [rows] = await db.query('SELECT class_id FROM students WHERE id = ? AND school_id = ? LIMIT 1', [
    studentId,
    schoolId,
  ]);
  return rows[0]?.class_id || null;
}

// Powers the Overview dashboard's attendance-rate and fee-balance cards.
async function getChildOverviewStats(schoolId, studentId) {
  const [[attendanceRow]] = await db.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'present') AS "presentCount"
     FROM attendance WHERE student_id = ? AND school_id = ?`,
    [studentId, schoolId]
  );
  const attendanceRate =
    attendanceRow.total > 0 ? Math.round((attendanceRow.presentCount / attendanceRow.total) * 100) : null;

  const [[feeRow]] = await db.query(
    `SELECT COALESCE(SUM(amount_due_cents), 0) AS "totalDue", COALESCE(SUM(amount_paid_cents), 0) AS "totalPaid"
     FROM fee_invoices WHERE student_id = ? AND school_id = ?`,
    [studentId, schoolId]
  );
  const feeBalanceCents = feeRow.totalDue - feeRow.totalPaid;
  const feeStatus =
    feeRow.totalDue === 0 ? 'none' : feeBalanceCents <= 0 ? 'paid' : feeRow.totalPaid > 0 ? 'partial' : 'unpaid';

  return { attendanceRate, feeBalanceCents, feeStatus };
}

module.exports = {
  isOwnChild,
  listChildren,
  getChildAttendance,
  getChildExams,
  getChildFees,
  getChildClassId,
  getChildOverviewStats,
};
