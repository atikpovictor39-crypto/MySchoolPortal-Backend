const db = require('../../config/db');
const { hashPassword } = require('../../utils/password');

async function listTeachers(schoolId) {
  const [rows] = await db.query(
    `SELECT t.id, t.employee_no, t.hire_date, u.name, u.email
     FROM teachers t JOIN users u ON u.id = t.user_id
     WHERE t.school_id = ? ORDER BY u.name`,
    [schoolId]
  );
  return rows;
}

// Creates a TEACHER user + linked teachers row in one transaction, same
// shape as auth.service.registerSchoolWithAdmin and student.service.addGuardian.
async function createTeacher(schoolId, { name, email, password, employeeNo }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      const err = new Error('Email is already registered');
      err.status = 409;
      throw err;
    }
    if (!password || password.length < 8) {
      const err = new Error('password must be at least 8 characters');
      err.status = 400;
      throw err;
    }

    const passwordHash = await hashPassword(password);
    const [userResult] = await conn.query(
      'INSERT INTO users (school_id, role, name, email, password_hash, status) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [schoolId, 'TEACHER', name, email, passwordHash, 'active']
    );
    const userId = userResult[0].id;

    const [teacherResult] = await conn.query(
      'INSERT INTO teachers (school_id, user_id, employee_no) VALUES (?, ?, ?) RETURNING id',
      [schoolId, userId, employeeNo || null]
    );

    await conn.commit();
    return { id: teacherResult[0].id, user_id: userId, name, email, employee_no: employeeNo || null };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getTeacherIdForUser(schoolId, userId) {
  const [rows] = await db.query('SELECT id FROM teachers WHERE user_id = ? AND school_id = ? LIMIT 1', [
    userId,
    schoolId,
  ]);
  return rows[0]?.id || null;
}

const CLOCK_COLUMNS = `tc.id, tc.teacher_id, u.name AS teacher_name, tc.clock_in_at, tc.clock_out_at`;

async function getClockInById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${CLOCK_COLUMNS} FROM teacher_clock_ins tc
     JOIN teachers t ON t.id = tc.teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE tc.id = ? AND tc.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

async function getOpenClockIn(schoolId, teacherId) {
  const [rows] = await db.query(
    'SELECT id, clock_in_at FROM teacher_clock_ins WHERE teacher_id = ? AND school_id = ? AND clock_out_at IS NULL LIMIT 1',
    [teacherId, schoolId]
  );
  return rows[0] || null;
}

async function clockIn(schoolId, userId) {
  const teacherId = await getTeacherIdForUser(schoolId, userId);
  if (!teacherId) {
    const err = new Error('No teacher profile is linked to this account');
    err.status = 400;
    throw err;
  }

  if (await getOpenClockIn(schoolId, teacherId)) {
    const err = new Error('Already clocked in');
    err.status = 409;
    throw err;
  }

  const [result] = await db.query(
    'INSERT INTO teacher_clock_ins (school_id, teacher_id, clock_in_at) VALUES (?, ?, NOW()) RETURNING id',
    [schoolId, teacherId]
  );
  return getClockInById(schoolId, result[0].id);
}

async function clockOut(schoolId, userId) {
  const teacherId = await getTeacherIdForUser(schoolId, userId);
  if (!teacherId) {
    const err = new Error('No teacher profile is linked to this account');
    err.status = 400;
    throw err;
  }

  const open = await getOpenClockIn(schoolId, teacherId);
  if (!open) {
    const err = new Error('Not currently clocked in');
    err.status = 409;
    throw err;
  }

  await db.query('UPDATE teacher_clock_ins SET clock_out_at = NOW() WHERE id = ?', [open.id]);
  return getClockInById(schoolId, open.id);
}

async function getMyStatus(schoolId, userId) {
  const teacherId = await getTeacherIdForUser(schoolId, userId);
  if (!teacherId) return { clockedIn: false, clockInAt: null };

  const open = await getOpenClockIn(schoolId, teacherId);
  return { clockedIn: Boolean(open), clockInAt: open?.clock_in_at || null };
}

async function listClockIns(schoolId, { teacherId, date } = {}) {
  const conditions = ['tc.school_id = ?'];
  const params = [schoolId];
  if (teacherId) {
    conditions.push('tc.teacher_id = ?');
    params.push(teacherId);
  }
  if (date) {
    conditions.push('DATE(tc.clock_in_at) = ?');
    params.push(date);
  }

  const [rows] = await db.query(
    `SELECT ${CLOCK_COLUMNS} FROM teacher_clock_ins tc
     JOIN teachers t ON t.id = tc.teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY tc.clock_in_at DESC`,
    params
  );
  return rows;
}

// ---- Leave requests ----

const LEAVE_COLUMNS = `lr.id, lr.teacher_id, u.name AS teacher_name, lr.start_date, lr.end_date,
  lr.reason, lr.status, lr.reviewed_by, ru.name AS reviewed_by_name, lr.reviewed_at, lr.created_at`;

async function getLeaveRequestById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${LEAVE_COLUMNS} FROM leave_requests lr
     JOIN teachers t ON t.id = lr.teacher_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users ru ON ru.id = lr.reviewed_by
     WHERE lr.id = ? AND lr.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

async function createLeaveRequest(schoolId, userId, { startDate, endDate, reason }) {
  const teacherId = await getTeacherIdForUser(schoolId, userId);
  if (!teacherId) {
    const err = new Error('No teacher profile is linked to this account');
    err.status = 400;
    throw err;
  }
  if (new Date(startDate) > new Date(endDate)) {
    const err = new Error('startDate must be on or before endDate');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    'INSERT INTO leave_requests (school_id, teacher_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [schoolId, teacherId, startDate, endDate, reason || null]
  );
  return getLeaveRequestById(schoolId, result[0].id);
}

async function listLeaveRequests(schoolId, { teacherId, status } = {}) {
  const conditions = ['lr.school_id = ?'];
  const params = [schoolId];
  if (teacherId) {
    conditions.push('lr.teacher_id = ?');
    params.push(teacherId);
  }
  if (status) {
    conditions.push('lr.status = ?');
    params.push(status);
  }

  const [rows] = await db.query(
    `SELECT ${LEAVE_COLUMNS} FROM leave_requests lr
     JOIN teachers t ON t.id = lr.teacher_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users ru ON ru.id = lr.reviewed_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY lr.created_at DESC`,
    params
  );
  return rows;
}

async function reviewLeaveRequest(schoolId, id, reviewerUserId, decision) {
  const existing = await getLeaveRequestById(schoolId, id);
  if (!existing) return null;
  if (existing.status !== 'pending') {
    const err = new Error(`This request was already ${existing.status}`);
    err.status = 409;
    throw err;
  }

  await db.query('UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [
    decision,
    reviewerUserId,
    id,
  ]);
  return getLeaveRequestById(schoolId, id);
}

module.exports = {
  listTeachers,
  createTeacher,
  getTeacherIdForUser,
  clockIn,
  clockOut,
  getMyStatus,
  listClockIns,
  createLeaveRequest,
  listLeaveRequests,
  reviewLeaveRequest,
};
