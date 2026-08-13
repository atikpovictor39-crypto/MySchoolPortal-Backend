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
         ON CONFLICT ON CONSTRAINT uq_attendance_day
         DO UPDATE SET status = EXCLUDED.status, class_id = EXCLUDED.class_id, marked_by = EXCLUDED.marked_by`,
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

  // Awaited, not fire-and-forget — on serverless the function can be frozen
  // the instant the response is sent, so background work after return isn't
  // guaranteed to run. Still best-effort: a notification failure must never
  // fail an already-committed attendance save.
  try {
    await notifyGuardiansOfAbsence(schoolId, date, records, sheet);
  } catch (err) {
    console.error('Failed to notify guardians of absence:', err.message);
  }

  return sheet;
}

async function notifyGuardiansOfAbsence(schoolId, date, records, sheet) {
  const absentStudentIds = records.filter((r) => r.status === 'absent').map((r) => r.studentId);
  if (absentStudentIds.length === 0) return;

  const nameByStudentId = Object.fromEntries(sheet.map((s) => [s.student_id, `${s.first_name} ${s.last_name}`]));

  const [guardianRows] = await db.query(
    `SELECT student_id, parent_user_id FROM student_guardians WHERE school_id = ? AND student_id = ANY(?)`,
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

// School-wide attendance rate for a single date (defaults to today, see
// controller). rate is null rather than 0 when nothing has been marked yet,
// so the dashboard can show "not marked yet" instead of a misleading 0%.
async function getAttendanceSummary(schoolId, date) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS "totalMarked", COUNT(*) FILTER (WHERE status = 'present') AS "presentCount"
     FROM attendance WHERE school_id = ? AND date = ?`,
    [schoolId, date]
  );
  const rate = row.totalMarked > 0 ? Math.round((row.presentCount / row.totalMarked) * 100) : null;
  return { date, totalMarked: row.totalMarked, presentCount: row.presentCount, rate };
}

// Per-student attendance totals over a date range (inclusive) — powers the
// Attendance page's "View Reports" mode and its CSV export. A student with
// zero marked days still appears, with every count at 0 and rate null
// (COUNT/FILTER over a LEFT JOIN naturally gives 0, not a missing row).
async function getAttendanceReport(schoolId, classId, fromDate, toDate) {
  const [rows] = await db.query(
    `SELECT s.id AS student_id, s.admission_no, s.first_name, s.last_name,
       COUNT(a.id) FILTER (WHERE a.status = 'present') AS present_count,
       COUNT(a.id) FILTER (WHERE a.status = 'absent') AS absent_count,
       COUNT(a.id) FILTER (WHERE a.status = 'late') AS late_count,
       COUNT(a.id) FILTER (WHERE a.status = 'excused') AS excused_count,
       COUNT(a.id) AS total_marked
     FROM students s
     LEFT JOIN attendance a ON a.student_id = s.id AND a.date BETWEEN ? AND ?
     WHERE s.school_id = ? AND s.class_id = ? AND s.status = 'active'
     GROUP BY s.id, s.admission_no, s.first_name, s.last_name
     ORDER BY s.last_name, s.first_name`,
    [fromDate, toDate, schoolId, classId]
  );
  return rows.map((r) => ({
    ...r,
    present_count: Number(r.present_count),
    absent_count: Number(r.absent_count),
    late_count: Number(r.late_count),
    excused_count: Number(r.excused_count),
    total_marked: Number(r.total_marked),
    rate: Number(r.total_marked) > 0 ? Math.round((Number(r.present_count) / Number(r.total_marked)) * 100) : null,
  }));
}

module.exports = {
  classBelongsToSchool,
  getAttendanceSheet,
  markAttendance,
  getAttendanceSummary,
  getAttendanceReport,
  ALLOWED_STATUSES,
};
