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

// Richer than listClasses — used only by the Classes page's own table
// (teacher name, roll count, subject count, derived status), not the many
// other pages that just need a lightweight dropdown of {id, name, section}.
async function listClassesWithStats(schoolId, { academicYearId, classTeacherId } = {}) {
  const conditions = ['c.school_id = ?'];
  const whereParams = [schoolId];
  if (academicYearId) {
    conditions.push('c.academic_year_id = ?');
    whereParams.push(academicYearId);
  }
  if (classTeacherId) {
    conditions.push('c.class_teacher_id = ?');
    whereParams.push(classTeacherId);
  }

  const [rows] = await db.query(
    `SELECT c.id, c.academic_year_id, c.name, c.section, c.class_teacher_id,
       u.name AS class_teacher_name,
       ay.name AS academic_year_name, ay.is_current,
       COALESCE(sc.student_count, 0) AS student_count,
       COALESCE(cs.subject_count, 0) AS subject_count
     FROM classes c
     LEFT JOIN teachers t ON t.id = c.class_teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     JOIN academic_years ay ON ay.id = c.academic_year_id
     LEFT JOIN (
       SELECT class_id, COUNT(*) AS student_count FROM students
       WHERE school_id = ? AND status = 'active' GROUP BY class_id
     ) sc ON sc.class_id = c.id
     LEFT JOIN (
       SELECT class_id, COUNT(*) AS subject_count FROM class_subjects
       WHERE school_id = ? GROUP BY class_id
     ) cs ON cs.class_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.name, c.section`,
    [schoolId, schoolId, ...whereParams]
  );

  return rows.map((r) => ({
    ...r,
    student_count: Number(r.student_count),
    subject_count: Number(r.subject_count),
    // Only one academic year is ever is_current per school, so "not the
    // current year" reliably means archived (a school essentially never
    // pre-creates classes for a future year before making it current).
    status: r.is_current ? 'active' : 'archived',
  }));
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

// Assigns each of `subjects` to each of `classIds` — e.g. "Math, English,
// Science to every Grade 5 class" in one action. Deliberately doesn't take a
// teacher (a shared teacher across several different classes is rarely
// right) — each class's teacher gets set afterward from its own Subjects
// panel. Not wrapped in a single transaction: classIds/subjectIds come from
// live dropdowns so a mid-loop failure is essentially unreachable in
// practice, and each upsert is independently idempotent to re-run.
async function bulkAssignSubjects(schoolId, classIds, subjects) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    const err = new Error('classIds must be a non-empty array');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(subjects) || subjects.length === 0) {
    const err = new Error('subjects must be a non-empty array of { subjectId, periodsPerWeek }');
    err.status = 400;
    throw err;
  }

  let assignedCount = 0;
  for (const classId of classIds) {
    for (const { subjectId, periodsPerWeek } of subjects) {
      await addClassSubject(schoolId, classId, { subjectId, periodsPerWeek });
      assignedCount++;
    }
  }
  return { assignedCount, classIds, subjectIds: subjects.map((s) => s.subjectId) };
}

// End-of-year bulk promotion: moves the given (already-vetted-by-the-caller,
// e.g. "not repeating") active students from sourceClassId to a target
// class — an existing one (targetClassId) or a brand new one created here
// (targetNewClass). Only class_id changes; class_subjects/timetable for the
// student's new class are whatever that class already has (typically set up
// fresh, the normal way, since it's usually a new academic year).
async function promoteStudents(schoolId, { sourceClassId, studentIds, targetClassId, targetNewClass }) {
  if (!(await getClassById(schoolId, sourceClassId))) {
    const err = new Error('sourceClassId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    const err = new Error('studentIds must be a non-empty array');
    err.status = 400;
    throw err;
  }

  let resolvedTargetClassId = targetClassId;
  if (!resolvedTargetClassId) {
    if (!targetNewClass?.academicYearId || !targetNewClass?.name) {
      const err = new Error('Provide either targetClassId or targetNewClass { academicYearId, name, section }');
      err.status = 400;
      throw err;
    }
    const created = await createClass(schoolId, targetNewClass);
    resolvedTargetClassId = created.id;
  } else if (!(await getClassById(schoolId, resolvedTargetClassId))) {
    const err = new Error('targetClassId does not belong to this school');
    err.status = 400;
    throw err;
  }

  // Confirms every studentId genuinely belongs to this school AND the
  // stated source class, so this can't be used to pull in an arbitrary
  // student from elsewhere.
  const [validRows] = await db.query(
    `SELECT id FROM students WHERE school_id = ? AND class_id = ? AND id = ANY(?) AND status = 'active'`,
    [schoolId, sourceClassId, studentIds]
  );
  if (validRows.length !== studentIds.length) {
    const err = new Error('One or more studentIds are not active students in the source class');
    err.status = 400;
    throw err;
  }

  await db.query('UPDATE students SET class_id = ? WHERE school_id = ? AND id = ANY(?)', [
    resolvedTargetClassId,
    schoolId,
    studentIds,
  ]);

  return { promotedCount: studentIds.length, targetClassId: resolvedTargetClassId };
}

module.exports = {
  listClasses,
  listClassesWithStats,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  listClassSubjects,
  addClassSubject,
  updateClassSubject,
  removeClassSubject,
  bulkAssignSubjects,
  promoteStudents,
};
