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
    'INSERT INTO classes (school_id, academic_year_id, name, section, class_teacher_id) VALUES (?, ?, ?, ?, ?)',
    [schoolId, academicYearId, name, section || null, classTeacherId || null]
  );
  return getClassById(schoolId, result.insertId);
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

module.exports = { listClasses, getClassById, createClass, updateClass };
