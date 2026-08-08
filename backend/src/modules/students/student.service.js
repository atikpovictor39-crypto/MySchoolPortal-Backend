const db = require('../../config/db');
const { hashPassword } = require('../../utils/password');

const ALLOWED_GENDERS = ['male', 'female', 'other'];
const ALLOWED_STATUSES = ['active', 'graduated', 'transferred', 'withdrawn'];

const STUDENT_COLUMNS = `id, class_id, user_id, admission_no, first_name, last_name,
  date_of_birth, gender, status, enrolled_at, created_at, updated_at`;

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function admissionNoTaken(schoolId, admissionNo, excludeStudentId = null) {
  const params = [schoolId, admissionNo];
  let sql = 'SELECT id FROM students WHERE school_id = ? AND admission_no = ?';
  if (excludeStudentId) {
    sql += ' AND id != ?';
    params.push(excludeStudentId);
  }
  const [rows] = await db.query(`${sql} LIMIT 1`, params);
  return rows.length > 0;
}

async function listStudents(schoolId, { classId, page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const conditions = ['school_id = ?'];
  const params = [schoolId];
  if (classId) {
    conditions.push('class_id = ?');
    params.push(classId);
  }
  const where = conditions.join(' AND ');

  const [rows] = await db.query(
    `SELECT ${STUDENT_COLUMNS} FROM students WHERE ${where} ORDER BY last_name, first_name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM students WHERE ${where}`, params);

  return { items: rows, pagination: { page: Math.max(Number(page) || 1, 1), pageSize: limit, total } };
}

async function getStudentById(schoolId, id) {
  const [rows] = await db.query(`SELECT ${STUDENT_COLUMNS} FROM students WHERE id = ? AND school_id = ? LIMIT 1`, [
    id,
    schoolId,
  ]);
  return rows[0] || null;
}

async function createStudent(schoolId, input) {
  const { classId, admissionNo, firstName, lastName, dateOfBirth, gender, enrolledAt } = input;

  if (!(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (await admissionNoTaken(schoolId, admissionNo)) {
    const err = new Error('admissionNo is already in use at this school');
    err.status = 409;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO students (school_id, class_id, admission_no, first_name, last_name, date_of_birth, gender, enrolled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, classId, admissionNo, firstName, lastName, dateOfBirth || null, gender || null, enrolledAt || new Date()]
  );

  return getStudentById(schoolId, result.insertId);
}

async function updateStudent(schoolId, id, input) {
  const existing = await getStudentById(schoolId, id);
  if (!existing) return null;

  const { classId, admissionNo, firstName, lastName, dateOfBirth, gender, status, enrolledAt } = input;

  if (classId !== undefined && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (admissionNo !== undefined && (await admissionNoTaken(schoolId, admissionNo, id))) {
    const err = new Error('admissionNo is already in use at this school');
    err.status = 409;
    throw err;
  }

  const fields = [];
  const params = [];
  const set = (column, value) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  };
  set('class_id', classId);
  set('admission_no', admissionNo);
  set('first_name', firstName);
  set('last_name', lastName);
  set('date_of_birth', dateOfBirth);
  set('gender', gender);
  set('status', status);
  set('enrolled_at', enrolledAt);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE students SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getStudentById(schoolId, id);
}

// ---- Guardians (parent accounts linked to a student) ----

async function listGuardians(schoolId, studentId) {
  const [rows] = await db.query(
    `SELECT u.id AS parent_user_id, u.name, u.email, sg.relationship, sg.is_primary
     FROM student_guardians sg
     JOIN users u ON u.id = sg.parent_user_id
     WHERE sg.student_id = ? AND sg.school_id = ?
     ORDER BY sg.is_primary DESC, u.name`,
    [studentId, schoolId]
  );
  return rows;
}

// Creates a PARENT user (or reuses an existing one with the same email —
// the same parent often has more than one child) and links them to this
// student. Runs as a transaction so a failure never leaves a userless link
// or a parent account with no linked child.
async function addGuardian(schoolId, studentId, { name, email, password, relationship, isPrimary }) {
  const student = await getStudentById(schoolId, studentId);
  if (!student) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let parentUserId;
    const [existingUsers] = await conn.query('SELECT id, role, school_id FROM users WHERE email = ? LIMIT 1', [
      email,
    ]);

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.role !== 'PARENT' || existing.school_id !== schoolId) {
        const err = new Error('Email is already in use by a different account');
        err.status = 409;
        throw err;
      }
      parentUserId = existing.id;
    } else {
      if (!password || password.length < 8) {
        const err = new Error('password must be at least 8 characters for a new guardian account');
        err.status = 400;
        throw err;
      }
      const passwordHash = await hashPassword(password);
      const [result] = await conn.query(
        'INSERT INTO users (school_id, role, name, email, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
        [schoolId, 'PARENT', name, email, passwordHash, 'active']
      );
      parentUserId = result.insertId;
    }

    const [existingLink] = await conn.query(
      'SELECT id FROM student_guardians WHERE student_id = ? AND parent_user_id = ? LIMIT 1',
      [studentId, parentUserId]
    );
    if (existingLink.length === 0) {
      await conn.query(
        'INSERT INTO student_guardians (school_id, student_id, parent_user_id, relationship, is_primary) VALUES (?, ?, ?, ?, ?)',
        [schoolId, studentId, parentUserId, relationship || null, isPrimary ? 1 : 0]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return listGuardians(schoolId, studentId);
}

module.exports = {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
  listGuardians,
  addGuardian,
  ALLOWED_GENDERS,
  ALLOWED_STATUSES,
};
