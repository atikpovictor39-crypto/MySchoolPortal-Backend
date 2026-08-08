const db = require('../../config/db');
const pushService = require('../push/push.service');

const ALLOWED_STATUSES = ['present', 'absent', 'late', 'excused'];

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

// Full class roster for a date, each student annotated with their
// attendance status for that date (null if not yet marked). This is what
// both the "load the checklist" and "view what was recorded" views need.
async function getAttendanceSheet(schoolId, classId, date) {
  const [rows] = await db.query(
    `SELECT s.id AS student_id, s.admission_no, s.first_name, s.last_name, a.status
     FROM students s
     LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
     WHERE s.school_id = ? AND s.class_id = ? AND s.status = 'active'
     ORDER BY s.last_name, s.first_name`,
    [date, schoolId, classId]
  );
  return rows;
}

// Bulk upsert: re-marking the same class+date overwrites the previous
// status per student (via the UNIQUE(student_id, date) key) instead of
// erroring, since a teacher correcting a mistake just re-saves the sheet.
async function markAttendance(schoolId, classId, date, markedBy, records) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const { studentId, status } of records) {
      const [studentRows] = await conn.query(
        'SELECT id FROM students WHERE id = ? AND school_id = ? AND class_id = ? LIMIT 1',
        [studentId, schoolId, classId]
      );
      if (studentRows.length === 0) {
        const err = new Error(`studentId ${studentId} is not an active student in this class`);
        err.status = 400;
        throw err;
      }

      await conn.query(
        `INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), class_id = VALUES(class_id), marked_by = VALUES(marked_by)`,
        [schoolId, studentId, classId, date, status, markedBy]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const sheet = await getAttendanceSheet(schoolId, classId, date);

  // Fire-and-forget: notifying guardians is best-effort. It must never make
  // an already-committed attendance save fail or feel slow to the teacher.
  notifyGuardiansOfAbsence(schoolId, date, records, sheet).catch((err) => {
    console.error('Failed to notify guardians of absence:', err.message);
  });

  return sheet;
}

async function notifyGuardiansOfAbsence(schoolId, date, records, sheet) {
  const absentStudentIds = records.filter((r) => r.status === 'absent').map((r) => r.studentId);
  if (absentStudentIds.length === 0) return;

  const nameByStudentId = Object.fromEntries(sheet.map((s) => [s.student_id, `${s.first_name} ${s.last_name}`]));

  const [guardianRows] = await db.query(
    `SELECT student_id, parent_user_id FROM student_guardians WHERE school_id = ? AND student_id IN (?)`,
    [schoolId, absentStudentIds]
  );

  await Promise.all(
    guardianRows.map((g) =>
      pushService.sendToUser(schoolId, g.parent_user_id, {
        title: 'Attendance update',
        body: `${nameByStudentId[g.student_id] || 'Your child'} was marked absent on ${date}.`,
        url: '/my-children',
      })
    )
  );
}

module.exports = { classBelongsToSchool, getAttendanceSheet, markAttendance, ALLOWED_STATUSES };
