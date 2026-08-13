const db = require('../../config/db');

const COLUMNS = 'id, academic_year_id, name, section, class_teacher_id';

async function academicYearBelongsToSchool(schoolId, academicYearId) {
  const [rows] = await db.query('SELECT id FROM academic_years WHERE id = ? AND school_id = ? LIMIT 1', [
    academicYearId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function teacherBelongsToSchool(schoolId, teacherId) {
  const [rows] = await db.query('SELECT id FROM teachers WHERE id = ? AND school_id = ? LIMIT 1', [
    teacherId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function subjectBelongsToSchool(schoolId, subjectId) {
  const [rows] = await db.query('SELECT id FROM subjects WHERE id = ? AND school_id = ? LIMIT 1', [
    subjectId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function listClasses(schoolId, { academicYearId } = {}) {
  const conditions = ['school_id = ?'];
  const params = [schoolId];
  if (academicYearId) {
    conditions.push('academic_year_id = ?');
    params.push(academicYearId);
  }

  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM classes WHERE ${conditions.join(' AND ')} ORDER BY name, section`,
    params
  );
  return rows;
}

async function getClassById(schoolId, id) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM classes WHERE id = ? AND school_id = ? LIMIT 1`, [
    id,
    schoolId,
  ]);
  return rows[0] || null;
}

async function createClass(schoolId, { academicYearId, name, section, classTeacherId }) {
  if (!(await academicYearBelongsToSchool(schoolId, academicYearId))) {
    const err = new Error('academicYearId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (classTeacherId && !(await teacherBelongsToSchool(schoolId, classTeacherId))) {
    const err = new Error('classTeacherId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    'INSERT INTO classes (school_id, academic_year_id, name, section, class_teacher_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [schoolId, academicYearId, name, section || null, classTeacherId || null]
  );
  return getClassById(schoolId, result[0].id);
}

async function updateClass(schoolId, id, { academicYearId, name, section, classTeacherId }) {
  const existing = await getClassById(schoolId, id);
  if (!existing) return null;

  if (academicYearId !== undefined && !(await academicYearBelongsToSchool(schoolId, academicYearId))) {
    const err = new Error('academicYearId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (
    classTeacherId !== undefined &&
    classTeacherId !== null &&
    !(await teacherBelongsToSchool(schoolId, classTeacherId))
  ) {
    const err = new Error('classTeacherId does not belong to this school');
    err.status = 400;
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
  set('academic_year_id', academicYearId);
  set('name', name);
  set('section', section);
  set('class_teacher_id', classTeacherId);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE classes SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getClassById(schoolId, id);
}

// students.class_id is ON DELETE RESTRICT at the DB level, so an unchecked
// delete here would just surface as a raw constraint-violation 500 — this
// pre-check turns it into the same friendly 400 pattern used elsewhere.
async function deleteClass(schoolId, id) {
  const existing = await getClassById(schoolId, id);
  if (!existing) return null;

  const [rows] = await db.query('SELECT COUNT(*) AS count FROM students WHERE class_id = ? AND school_id = ?', [
    id,
    schoolId,
  ]);
  if (Number(rows[0].count) > 0) {
    const err = new Error('This class still has students enrolled — move or remove them first');
    err.status = 400;
    throw err;
  }

  await db.query('DELETE FROM classes WHERE id = ? AND school_id = ?', [id, schoolId]);
  return true;
}

// ---- Class subjects: which subjects a class takes, who teaches each, and
// how many periods a week — feeds the timetable auto-generator. Optional
// for schools that only ever build their timetable by hand. ----

const CLASS_SUBJECT_COLUMNS = `cs.id, cs.class_id, cs.subject_id, sub.name AS subject_name,
  cs.teacher_id, u.name AS teacher_name, cs.periods_per_week`;

async function listClassSubjects(schoolId, classId) {
  const [rows] = await db.query(
    `SELECT ${CLASS_SUBJECT_COLUMNS}
     FROM class_subjects cs
     JOIN subjects sub ON sub.id = cs.subject_id
     LEFT JOIN teachers t ON t.id = cs.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE cs.class_id = ? AND cs.school_id = ?
     ORDER BY sub.name`,
    [classId, schoolId]
  );
  return rows;
}

async function getClassSubjectById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${CLASS_SUBJECT_COLUMNS}
     FROM class_subjects cs
     JOIN subjects sub ON sub.id = cs.subject_id
     LEFT JOIN teachers t ON t.id = cs.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE cs.id = ? AND cs.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

// Upsert on (class_id, subject_id) — re-adding the same subject to a class
// just updates its teacher/periods-per-week, mirroring how exam_subjects
// and results.service.js's saveResults handle the same "add or update"
// shape elsewhere in the app.
async function addClassSubject(schoolId, classId, { subjectId, teacherId, periodsPerWeek }) {
  if (!(await getClassById(schoolId, classId))) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
    const err = new Error('subjectId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (teacherId && !(await teacherBelongsToSchool(schoolId, teacherId))) {
    const err = new Error('teacherId does not belong to this school');
    err.status = 400;
    throw err;
  }
  const weeklyPeriods = periodsPerWeek || 1;
  if (weeklyPeriods < 1 || weeklyPeriods > 20) {
    const err = new Error('periodsPerWeek must be between 1 and 20');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id, periods_per_week)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT ON CONSTRAINT uq_class_subject
     DO UPDATE SET teacher_id = EXCLUDED.teacher_id, periods_per_week = EXCLUDED.periods_per_week
     RETURNING id`,
    [schoolId, classId, subjectId, teacherId || null, weeklyPeriods]
  );
  return getClassSubjectById(schoolId, result[0].id);
}

async function updateClassSubject(schoolId, id, { teacherId, periodsPerWeek }) {
  const existing = await getClassSubjectById(schoolId, id);
  if (!existing) return null;

  if (teacherId !== undefined && teacherId !== null && !(await teacherBelongsToSchool(schoolId, teacherId))) {
    const err = new Error('teacherId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (periodsPerWeek !== undefined && (periodsPerWeek < 1 || periodsPerWeek > 20)) {
    const err = new Error('periodsPerWeek must be between 1 and 20');
    err.status = 400;
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
  set('teacher_id', teacherId);
  set('periods_per_week', periodsPerWeek);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE class_subjects SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getClassSubjectById(schoolId, id);
}

async function removeClassSubject(schoolId, id) {
  const [result] = await db.query('DELETE FROM class_subjects WHERE id = ? AND school_id = ?', [id, schoolId]);
  return result.affectedRows > 0;
}

module.exports = {
  listClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  listClassSubjects,
  addClassSubject,
  updateClassSubject,
  removeClassSubject,
};
