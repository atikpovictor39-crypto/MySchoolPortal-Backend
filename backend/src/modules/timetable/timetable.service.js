const db = require('../../config/db');

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

const SLOT_COLUMNS = `ts.id, ts.class_id, ts.day_of_week, ts.start_time, ts.end_time,
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
     JOIN subjects sub ON sub.id = ts.subject_id
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
    `SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.subject_id, sub.name AS subject_name,
       ts.class_id, c.name AS class_name, c.section
     FROM timetable_slots ts
     JOIN subjects sub ON sub.id = ts.subject_id
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
     JOIN subjects sub ON sub.id = ts.subject_id
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

async function createSlot(schoolId, { classId, dayOfWeek, startTime, endTime, subjectId, teacherId }) {
  if (!(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
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
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    const err = new Error('startTime must be before endTime');
    err.status = 400;
    throw err;
  }

  await assertNoTeacherConflict(schoolId, teacherId, dayOfWeek, startTime);

  try {
    const [result] = await db.query(
      `INSERT INTO timetable_slots (school_id, class_id, day_of_week, start_time, end_time, subject_id, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [schoolId, classId, dayOfWeek, startTime, endTime, subjectId, teacherId || null]
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

  const { classId, dayOfWeek, startTime, endTime, subjectId, teacherId } = input;

  if (classId !== undefined && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (subjectId !== undefined && !(await subjectBelongsToSchool(schoolId, subjectId))) {
    const err = new Error('subjectId does not belong to this school');
    err.status = 400;
    throw err;
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
  set('subject_id', subjectId);
  set('teacher_id', teacherId);

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

module.exports = { DAY_NAMES, listTimetable, listTeacherTimetable, getSlotById, createSlot, updateSlot, deleteSlot };
