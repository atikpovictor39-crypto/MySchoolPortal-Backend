const db = require('../../config/db');

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_TYPES = ['subject', 'assembly', 'break'];

// Compares by minutes-since-midnight, not raw string comparison — a
// freshly-submitted 'HH:MM' and a DB-stored TIME string ('HH:MM:SS') would
// otherwise compare unequal-length strings and give the wrong answer for
// times that are actually equal (e.g. '09:00' vs '09:00:00').
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
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

async function teacherBelongsToSchool(schoolId, teacherId) {
  const [rows] = await db.query('SELECT id FROM teachers WHERE id = ? AND school_id = ? LIMIT 1', [
    teacherId,
    schoolId,
  ]);
  return rows.length > 0;
}

// subject_id/subject_name are only populated for slot_type = 'subject' —
// assembly and break periods have neither (see chk_subject_required_for_subject_slot).
const SLOT_COLUMNS = `ts.id, ts.class_id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_type,
  ts.subject_id, sub.name AS subject_name, ts.teacher_id, u.name AS teacher_name`;

async function listTimetable(schoolId, { classId, dayOfWeek } = {}) {
  const conditions = ['ts.school_id = ?'];
  const params = [schoolId];
  if (classId) {
    conditions.push('ts.class_id = ?');
    params.push(classId);
  }
  if (dayOfWeek) {
    conditions.push('ts.day_of_week = ?');
    params.push(dayOfWeek);
  }

  const [rows] = await db.query(
    `SELECT ${SLOT_COLUMNS}
     FROM timetable_slots ts
     LEFT JOIN subjects sub ON sub.id = ts.subject_id
     LEFT JOIN teachers t ON t.id = ts.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ts.day_of_week, ts.start_time`,
    params
  );
  return rows;
}

async function listTeacherTimetable(schoolId, teacherId) {
  const [rows] = await db.query(
    `SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.slot_type, ts.subject_id, sub.name AS subject_name,
       ts.class_id, c.name AS class_name, c.section
     FROM timetable_slots ts
     LEFT JOIN subjects sub ON sub.id = ts.subject_id
     JOIN classes c ON c.id = ts.class_id
     WHERE ts.school_id = ? AND ts.teacher_id = ?
     ORDER BY ts.day_of_week, ts.start_time`,
    [schoolId, teacherId]
  );
  return rows;
}

async function getSlotById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${SLOT_COLUMNS}
     FROM timetable_slots ts
     LEFT JOIN subjects sub ON sub.id = ts.subject_id
     LEFT JOIN teachers t ON t.id = ts.teacher_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE ts.id = ? AND ts.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

// A teacher can't be in two classrooms at once — checked across the whole
// school regardless of which class the new/edited slot belongs to.
async function assertNoTeacherConflict(schoolId, teacherId, dayOfWeek, startTime, excludeSlotId = null) {
  if (!teacherId) return;

  let sql =
    'SELECT id FROM timetable_slots WHERE school_id = ? AND teacher_id = ? AND day_of_week = ? AND start_time = ?';
  const params = [schoolId, teacherId, dayOfWeek, startTime];
  if (excludeSlotId) {
    sql += ' AND id != ?';
    params.push(excludeSlotId);
  }

  const [rows] = await db.query(sql, params);
  if (rows.length > 0) {
    const err = new Error('This teacher is already scheduled in another class at that day and time');
    err.status = 409;
    throw err;
  }
}

async function createSlot(schoolId, { classId, dayOfWeek, startTime, endTime, slotType, subjectId, teacherId }) {
  const type = slotType || 'subject';

  if (!(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  // Assembly/break aren't academic subjects — subjectId is ignored (forced
  // null) for them even if one was somehow sent, rather than silently
  // storing a subject on a non-subject period.
  if (type === 'subject') {
    if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
      const err = new Error('subjectId does not belong to this school');
      err.status = 400;
      throw err;
    }
  }
  if (teacherId && !(await teacherBelongsToSchool(schoolId, teacherId))) {
    const err = new Error('teacherId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    const err = new Error('startTime must be before endTime');
    err.status = 400;
    throw err;
  }

  await assertNoTeacherConflict(schoolId, teacherId, dayOfWeek, startTime);

  try {
    const [result] = await db.query(
      `INSERT INTO timetable_slots (school_id, class_id, day_of_week, start_time, end_time, slot_type, subject_id, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [schoolId, classId, dayOfWeek, startTime, endTime, type, type === 'subject' ? subjectId : null, teacherId || null]
    );
    return getSlotById(schoolId, result[0].id);
  } catch (err) {
    if (err.code === '23505') {
      const dupErr = new Error('This class already has a period starting at that day and time');
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function updateSlot(schoolId, id, input) {
  const existing = await getSlotById(schoolId, id);
  if (!existing) return null;

  const { classId, dayOfWeek, startTime, endTime, slotType, subjectId, teacherId } = input;
  const finalType = slotType !== undefined ? slotType : existing.slot_type;

  if (classId !== undefined && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  const finalSubjectId = subjectId !== undefined ? subjectId : existing.subject_id;
  if (finalType === 'subject') {
    if (!finalSubjectId || !(await subjectBelongsToSchool(schoolId, finalSubjectId))) {
      const err = new Error('subjectId does not belong to this school');
      err.status = 400;
      throw err;
    }
  }
  if (teacherId !== undefined && teacherId !== null && !(await teacherBelongsToSchool(schoolId, teacherId))) {
    const err = new Error('teacherId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const finalStart = startTime !== undefined ? startTime : existing.start_time;
  const finalEnd = endTime !== undefined ? endTime : existing.end_time;
  if (toMinutes(finalStart) >= toMinutes(finalEnd)) {
    const err = new Error('startTime must be before endTime');
    err.status = 400;
    throw err;
  }

  const finalDay = dayOfWeek !== undefined ? dayOfWeek : existing.day_of_week;
  const finalTeacher = teacherId !== undefined ? teacherId : existing.teacher_id;
  await assertNoTeacherConflict(schoolId, finalTeacher, finalDay, finalStart, id);

  const fields = [];
  const params = [];
  const set = (column, value) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  };
  set('class_id', classId);
  set('day_of_week', dayOfWeek);
  set('start_time', startTime);
  set('end_time', endTime);
  set('teacher_id', teacherId);
  // slot_type and subject_id are always written together whenever either
  // one changes, so switching e.g. Math -> Assembly clears subject_id in
  // the same statement instead of leaving a stale reference behind.
  if (slotType !== undefined || subjectId !== undefined) {
    fields.push('slot_type = ?', 'subject_id = ?');
    params.push(finalType, finalType === 'subject' ? finalSubjectId : null);
  }

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  try {
    await db.query(`UPDATE timetable_slots SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  } catch (err) {
    if (err.code === '23505') {
      const dupErr = new Error('This class already has a period starting at that day and time');
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }

  return getSlotById(schoolId, id);
}

async function deleteSlot(schoolId, id) {
  const [result] = await db.query('DELETE FROM timetable_slots WHERE id = ? AND school_id = ?', [id, schoolId]);
  return result.affectedRows > 0;
}

// ---- Substitute teachers (one-off cover for a single date) ----

const SUBSTITUTION_COLUMNS = `sub.id, sub.timetable_slot_id, sub.date, sub.substitute_teacher_id,
  u.name AS substitute_teacher_name, sub.reason, sub.created_at`;

// classId is optional — omit it to get every substitution on that date
// across the whole school (used when overlaying a "View by Teacher" grid,
// where slots span multiple classes).
async function listSubstitutions(schoolId, { date, classId } = {}) {
  const conditions = ['sub.school_id = ?', 'sub.date = ?'];
  const params = [schoolId, date];
  if (classId) {
    conditions.push('ts.class_id = ?');
    params.push(classId);
  }

  const [rows] = await db.query(
    `SELECT ${SUBSTITUTION_COLUMNS}
     FROM timetable_substitutions sub
     JOIN timetable_slots ts ON ts.id = sub.timetable_slot_id
     JOIN teachers t ON t.id = sub.substitute_teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sub.date`,
    params
  );
  return rows;
}

async function getSubstitutionById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${SUBSTITUTION_COLUMNS}
     FROM timetable_substitutions sub
     JOIN teachers t ON t.id = sub.substitute_teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE sub.id = ? AND sub.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

// Same "can't be in two places at once" rule as assertNoTeacherConflict,
// extended to cover a substitute: they can't already be the REGULAR teacher
// of another class at that day/time, nor already covering a different slot
// on the same date/time.
async function assertNoSubstituteConflict(schoolId, substituteTeacherId, dayOfWeek, startTime, date, excludeSubId = null) {
  const [regularConflict] = await db.query(
    'SELECT id FROM timetable_slots WHERE school_id = ? AND teacher_id = ? AND day_of_week = ? AND start_time = ?',
    [schoolId, substituteTeacherId, dayOfWeek, startTime]
  );
  if (regularConflict.length > 0) {
    const err = new Error('This teacher already regularly teaches another class at that day and time');
    err.status = 409;
    throw err;
  }

  let sql = `SELECT sub.id FROM timetable_substitutions sub
    JOIN timetable_slots ts ON ts.id = sub.timetable_slot_id
    WHERE sub.school_id = ? AND sub.substitute_teacher_id = ? AND sub.date = ? AND ts.start_time = ?`;
  const params = [schoolId, substituteTeacherId, date, startTime];
  if (excludeSubId) {
    sql += ' AND sub.id != ?';
    params.push(excludeSubId);
  }
  const [subConflict] = await db.query(sql, params);
  if (subConflict.length > 0) {
    const err = new Error('This teacher is already covering another class at that same date and time');
    err.status = 409;
    throw err;
  }
}

async function createSubstitution(schoolId, createdBy, { timetableSlotId, date, substituteTeacherId, reason }) {
  const slot = await getSlotById(schoolId, timetableSlotId);
  if (!slot) {
    const err = new Error('Timetable slot not found');
    err.status = 404;
    throw err;
  }
  if (slot.slot_type !== 'subject') {
    const err = new Error('Only a subject period can have a substitute teacher');
    err.status = 400;
    throw err;
  }
  // date has to actually be an occurrence of this slot's weekday — otherwise
  // "covering Monday's Math" could get recorded against a Wednesday.
  const [y, m, d] = date.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  const dateDayOfWeek = jsDay === 0 ? 7 : jsDay;
  if (dateDayOfWeek !== slot.day_of_week) {
    const err = new Error(`date must fall on a ${DAY_NAMES[slot.day_of_week]}, since that's this slot's day`);
    err.status = 400;
    throw err;
  }
  if (!(await teacherBelongsToSchool(schoolId, substituteTeacherId))) {
    const err = new Error('substituteTeacherId does not belong to this school');
    err.status = 400;
    throw err;
  }

  await assertNoSubstituteConflict(schoolId, substituteTeacherId, slot.day_of_week, slot.start_time, date);

  try {
    const [result] = await db.query(
      `INSERT INTO timetable_substitutions (school_id, timetable_slot_id, date, substitute_teacher_id, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [schoolId, timetableSlotId, date, substituteTeacherId, reason || null, createdBy]
    );
    return getSubstitutionById(schoolId, result[0].id);
  } catch (err) {
    if (err.code === '23505') {
      const dupErr = new Error('This period already has a substitute assigned for that date');
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }
}

async function deleteSubstitution(schoolId, id) {
  const [result] = await db.query('DELETE FROM timetable_substitutions WHERE id = ? AND school_id = ?', [id, schoolId]);
  return result.affectedRows > 0;
}

module.exports = {
  DAY_NAMES,
  SLOT_TYPES,
  listTimetable,
  listTeacherTimetable,
  getSlotById,
  createSlot,
  updateSlot,
  deleteSlot,
  listSubstitutions,
  createSubstitution,
  deleteSubstitution,
};
