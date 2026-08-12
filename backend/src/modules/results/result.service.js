const db = require('../../config/db');

// Default grading scale — no per-school customization yet, same simplification
// as fee currency: one reasonable default now, configurable later.
function calculateGrade(percentage) {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
}

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function academicYearBelongsToSchool(schoolId, academicYearId) {
  const [rows] = await db.query('SELECT id FROM academic_years WHERE id = ? AND school_id = ? LIMIT 1', [
    academicYearId,
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

// ---- Exams ----

const EXAM_COLUMNS =
  'id, academic_year_id, class_id, name, term, term_start_date, term_end_date, reopening_date, headmaster_signed_date, created_at';

async function listExams(schoolId, { classId } = {}) {
  const conditions = ['school_id = ?'];
  const params = [schoolId];
  if (classId) {
    conditions.push('class_id = ?');
    params.push(classId);
  }

  const [rows] = await db.query(
    `SELECT ${EXAM_COLUMNS} FROM exams WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

async function getExamById(schoolId, id) {
  const [examRows] = await db.query(`SELECT ${EXAM_COLUMNS} FROM exams WHERE id = ? AND school_id = ? LIMIT 1`, [
    id,
    schoolId,
  ]);
  const exam = examRows[0];
  if (!exam) return null;

  const [subjectRows] = await db.query(
    `SELECT es.id AS exam_subject_id, es.subject_id, sub.name AS subject_name, es.max_marks, es.passing_marks
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = ? AND es.school_id = ?
     ORDER BY sub.name`,
    [id, schoolId]
  );

  return { ...exam, subjects: subjectRows };
}

async function createExam(schoolId, { academicYearId, classId, name, term, termStartDate, termEndDate, reopeningDate }) {
  if (!(await academicYearBelongsToSchool(schoolId, academicYearId))) {
    const err = new Error('academicYearId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (!(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO exams (school_id, academic_year_id, class_id, name, term, term_start_date, term_end_date, reopening_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [schoolId, academicYearId, classId, name, term || null, termStartDate || null, termEndDate || null, reopeningDate || null]
  );
  return getExamById(schoolId, result[0].id);
}

// Term dates are typically only known/settled near the end of term (once
// vacation and re-opening are confirmed), so these are edited after the
// exam already exists rather than required up front at creation.
async function updateExam(schoolId, id, { name, term, termStartDate, termEndDate, reopeningDate, headmasterSignedDate }) {
  const existing = await getExamById(schoolId, id);
  if (!existing) return null;

  const fields = [];
  const params = [];
  const set = (column, value) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  };
  set('name', name);
  set('term', term);
  set('term_start_date', termStartDate);
  set('term_end_date', termEndDate);
  set('reopening_date', reopeningDate);
  // Same date for every student's report card in this exam — the headmaster
  // signs one batch, not one date per student.
  set('headmaster_signed_date', headmasterSignedDate);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE exams SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getExamById(schoolId, id);
}

// Upsert one or more subjects onto an exam (via the UNIQUE(exam_id, subject_id)
// key) — re-adding the same subject just updates its max/passing marks.
async function addExamSubjects(schoolId, examId, subjects) {
  const exam = await getExamById(schoolId, examId);
  if (!exam) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  for (const { subjectId, maxMarks, passingMarks } of subjects) {
    if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
      const err = new Error(`subjectId ${subjectId} does not belong to this school`);
      err.status = 400;
      throw err;
    }
    await db.query(
      `INSERT INTO exam_subjects (school_id, exam_id, subject_id, max_marks, passing_marks)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT ON CONSTRAINT uq_exam_subject
       DO UPDATE SET max_marks = EXCLUDED.max_marks, passing_marks = EXCLUDED.passing_marks`,
      [schoolId, examId, subjectId, maxMarks || 100, passingMarks || 40]
    );
  }

  return getExamById(schoolId, examId);
}

// ---- Results entry ----

async function getExamSubject(schoolId, examSubjectId) {
  const [rows] = await db.query(
    `SELECT es.id, es.exam_id, es.subject_id, es.max_marks, es.passing_marks, e.class_id
     FROM exam_subjects es
     JOIN exams e ON e.id = es.exam_id
     WHERE es.id = ? AND es.school_id = ? LIMIT 1`,
    [examSubjectId, schoolId]
  );
  return rows[0] || null;
}

async function getResultsSheet(schoolId, examSubjectId) {
  const examSubject = await getExamSubject(schoolId, examSubjectId);
  if (!examSubject) {
    const err = new Error('Exam subject not found');
    err.status = 404;
    throw err;
  }

  const [rows] = await db.query(
    `SELECT s.id AS student_id, s.admission_no, s.first_name, s.last_name,
       r.marks_obtained, r.grade, r.remarks
     FROM students s
     LEFT JOIN results r ON r.student_id = s.id AND r.exam_subject_id = ?
     WHERE s.school_id = ? AND s.class_id = ? AND s.status = 'active'
     ORDER BY s.last_name, s.first_name`,
    [examSubjectId, schoolId, examSubject.class_id]
  );

  return { examSubject, students: rows };
}

// Bulk upsert (mirrors the attendance "mark" pattern): re-saving the same
// exam-subject sheet overwrites previous marks via UNIQUE(exam_subject_id, student_id).
async function saveResults(schoolId, examSubjectId, enteredBy, records) {
  const examSubject = await getExamSubject(schoolId, examSubjectId);
  if (!examSubject) {
    const err = new Error('Exam subject not found');
    err.status = 404;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const { studentId, marksObtained, remarks } of records) {
      if (marksObtained < 0 || marksObtained > examSubject.max_marks) {
        const err = new Error(`marksObtained for student ${studentId} must be between 0 and ${examSubject.max_marks}`);
        err.status = 400;
        throw err;
      }

      const [studentRows] = await conn.query(
        'SELECT id FROM students WHERE id = ? AND school_id = ? AND class_id = ? LIMIT 1',
        [studentId, schoolId, examSubject.class_id]
      );
      if (studentRows.length === 0) {
        const err = new Error(`studentId ${studentId} is not an active student in this class`);
        err.status = 400;
        throw err;
      }

      const percentage = (marksObtained / examSubject.max_marks) * 100;
      const grade = calculateGrade(percentage);

      await conn.query(
        `INSERT INTO results (school_id, exam_subject_id, student_id, marks_obtained, grade, remarks, entered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT ON CONSTRAINT uq_result
         DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, grade = EXCLUDED.grade,
           remarks = EXCLUDED.remarks, entered_by = EXCLUDED.entered_by`,
        [schoolId, examSubjectId, studentId, marksObtained, grade, remarks || null, enteredBy]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getResultsSheet(schoolId, examSubjectId);
}

// ---- Report cards & class ranking ----

// Ranks every student in the exam's class by total marks obtained across
// whatever exam_subjects they have results for. Students with zero results
// are excluded — there's nothing meaningful to rank yet.
async function computeClassRanking(schoolId, examId) {
  const [examRows] = await db.query('SELECT class_id FROM exams WHERE id = ? AND school_id = ? LIMIT 1', [
    examId,
    schoolId,
  ]);
  const exam = examRows[0];
  if (!exam) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  const [rows] = await db.query(
    `SELECT s.id AS student_id, s.first_name, s.last_name, s.admission_no,
       COALESCE(SUM(CASE WHEN r.id IS NOT NULL THEN r.marks_obtained ELSE 0 END), 0) AS total_obtained,
       COALESCE(SUM(CASE WHEN r.id IS NOT NULL THEN es.max_marks ELSE 0 END), 0) AS total_max,
       COUNT(r.id) AS subjects_entered
     FROM students s
     LEFT JOIN exam_subjects es ON es.exam_id = ?
     LEFT JOIN results r ON r.exam_subject_id = es.id AND r.student_id = s.id
     WHERE s.school_id = ? AND s.class_id = ? AND s.status = 'active'
     GROUP BY s.id, s.first_name, s.last_name, s.admission_no
     HAVING COUNT(r.id) > 0
     ORDER BY total_obtained DESC`,
    [examId, schoolId, exam.class_id]
  );

  return rows.map((row, index) => ({ ...row, position: index + 1, classSize: rows.length }));
}

async function getClassReport(schoolId, examId) {
  return computeClassRanking(schoolId, examId);
}

// Rank within EACH subject individually (not the same as the overall class
// position) — e.g. a student might be 3rd in the class overall but 1st in
// Science specifically. RANK() so tied scores share a position rather than
// silently picking a winner.
async function getPerSubjectPositions(schoolId, examId) {
  const [rows] = await db.query(
    `SELECT r.exam_subject_id, r.student_id,
       RANK() OVER (PARTITION BY r.exam_subject_id ORDER BY r.marks_obtained DESC) AS position
     FROM results r
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     WHERE es.exam_id = ? AND es.school_id = ?`,
    [examId, schoolId]
  );

  const positions = {};
  for (const row of rows) {
    positions[row.exam_subject_id] = positions[row.exam_subject_id] || {};
    positions[row.exam_subject_id][row.student_id] = row.position;
  }
  return positions;
}

// "No. of times present/absent" on the printed slip, summed over the exam's
// own term_start_date/term_end_date — null/null (not 0/0) when those
// haven't been set yet, so the frontend can show "not available" instead of
// a misleading zero.
async function getAttendanceSummary(schoolId, studentId, fromDate, toDate) {
  if (!fromDate || !toDate) return { present: null, total: null };

  const [rows] = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('present', 'late')) AS present,
       COUNT(*) AS total
     FROM attendance
     WHERE school_id = ? AND student_id = ? AND date BETWEEN ? AND ?`,
    [schoolId, studentId, fromDate, toDate]
  );
  return { present: Number(rows[0].present), total: Number(rows[0].total) };
}

async function getReportCardNotes(schoolId, examId, studentId) {
  const [rows] = await db.query(
    `SELECT interest, academic_strength, class_teacher_remarks, entered_by, headmaster_remarks, promoted_to
     FROM report_card_notes WHERE exam_id = ? AND student_id = ? AND school_id = ? LIMIT 1`,
    [examId, studentId, schoolId]
  );
  return (
    rows[0] || {
      interest: null,
      academic_strength: null,
      class_teacher_remarks: null,
      entered_by: null,
      headmaster_remarks: null,
      promoted_to: null,
    }
  );
}

// A field left `undefined` here means "the caller isn't allowed to touch
// this" (see result.controller.js's TEACHER-vs-headmasterRemarks handling),
// not "clear it" — so it's merged against whatever's already saved rather
// than blindly overwritten, unlike an explicit '' which does clear a field.
//
// enteredByUserId is recorded as `entered_by` only when classTeacherRemarks
// is actually part of this save — it's used as a "Teacher's Name" fallback
// on the printed report card when the class has no official class_teacher_id
// assigned, and shouldn't shift to whoever happened to touch an unrelated
// field (e.g. an admin only updating headmaster's remarks). The headmaster's
// signature itself lives on the school profile (set once, applies to every
// report card) and the signed date on the exam (set once per exam batch) —
// neither belongs here, since re-typing a signature per student defeats the
// point of it being a signature.
async function upsertReportCardNotes(
  schoolId,
  examId,
  studentId,
  { interest, academicStrength, classTeacherRemarks, headmasterRemarks, promotedTo },
  enteredByUserId
) {
  const exam = await getExamById(schoolId, examId);
  if (!exam) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }
  const [studentRows] = await db.query(
    'SELECT id FROM students WHERE id = ? AND school_id = ? AND class_id = ? LIMIT 1',
    [studentId, schoolId, exam.class_id]
  );
  if (studentRows.length === 0) {
    const err = new Error("Student not found in this exam's class");
    err.status = 404;
    throw err;
  }

  const existing = await getReportCardNotes(schoolId, examId, studentId);
  const merged = {
    interest: interest !== undefined ? interest || null : existing.interest,
    academicStrength: academicStrength !== undefined ? academicStrength || null : existing.academic_strength,
    classTeacherRemarks:
      classTeacherRemarks !== undefined ? classTeacherRemarks || null : existing.class_teacher_remarks,
    enteredBy: classTeacherRemarks !== undefined ? enteredByUserId || null : existing.entered_by,
    headmasterRemarks: headmasterRemarks !== undefined ? headmasterRemarks || null : existing.headmaster_remarks,
    promotedTo: promotedTo !== undefined ? promotedTo || null : existing.promoted_to,
  };

  await db.query(
    `INSERT INTO report_card_notes
       (school_id, exam_id, student_id, interest, academic_strength, class_teacher_remarks, entered_by,
        headmaster_remarks, promoted_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT ON CONSTRAINT uq_report_card_notes
     DO UPDATE SET interest = EXCLUDED.interest, academic_strength = EXCLUDED.academic_strength,
       class_teacher_remarks = EXCLUDED.class_teacher_remarks, entered_by = EXCLUDED.entered_by,
       headmaster_remarks = EXCLUDED.headmaster_remarks, promoted_to = EXCLUDED.promoted_to`,
    [
      schoolId,
      examId,
      studentId,
      merged.interest,
      merged.academicStrength,
      merged.classTeacherRemarks,
      merged.enteredBy,
      merged.headmasterRemarks,
      merged.promotedTo,
    ]
  );

  return getReportCardNotes(schoolId, examId, studentId);
}

async function getReportCard(schoolId, examId, studentId) {
  const exam = await getExamById(schoolId, examId);
  if (!exam) {
    const err = new Error('Exam not found');
    err.status = 404;
    throw err;
  }

  const [studentRows] = await db.query(
    'SELECT id, first_name, last_name, admission_no FROM students WHERE id = ? AND school_id = ? AND class_id = ? LIMIT 1',
    [studentId, schoolId, exam.class_id]
  );
  const student = studentRows[0];
  if (!student) {
    const err = new Error("Student not found in this exam's class");
    err.status = 404;
    throw err;
  }

  const [subjectRows] = await db.query(
    `SELECT es.id AS exam_subject_id, sub.name AS subject_name, es.max_marks, es.passing_marks,
       r.marks_obtained, r.grade, r.remarks
     FROM exam_subjects es
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN results r ON r.exam_subject_id = es.id AND r.student_id = ?
     WHERE es.exam_id = ? AND es.school_id = ?
     ORDER BY sub.name`,
    [studentId, examId, schoolId]
  );

  const perSubjectPositions = await getPerSubjectPositions(schoolId, examId);
  for (const s of subjectRows) {
    s.position = perSubjectPositions[s.exam_subject_id]?.[Number(studentId)] ?? null;
  }

  const entered = subjectRows.filter((s) => s.marks_obtained !== null);
  const totalObtained = entered.reduce((sum, s) => sum + Number(s.marks_obtained), 0);
  const totalMax = entered.reduce((sum, s) => sum + Number(s.max_marks), 0);
  const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const overallGrade = entered.length > 0 ? calculateGrade(percentage) : null;

  const ranking = await computeClassRanking(schoolId, examId);
  const rankEntry = ranking.find((r) => r.student_id === Number(studentId));

  const [rollRows] = await db.query(
    "SELECT COUNT(*) AS count FROM students WHERE school_id = ? AND class_id = ? AND status = 'active'",
    [schoolId, exam.class_id]
  );

  const [teacherRows] = await db.query(
    `SELECT u.name FROM classes c
     JOIN teachers t ON t.id = c.class_teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE c.id = ? LIMIT 1`,
    [exam.class_id]
  );

  // Resolved here (rather than left for the frontend to cross-reference a
  // classes/academic-years lookup list) since the parent-facing report card
  // has no access to those staff-only endpoints at all.
  const [classRows] = await db.query('SELECT name, section FROM classes WHERE id = ? LIMIT 1', [exam.class_id]);
  const [yearRows] = await db.query('SELECT name FROM academic_years WHERE id = ? LIMIT 1', [exam.academic_year_id]);
  exam.class_name = classRows[0]?.name || null;
  exam.class_section = classRows[0]?.section || null;
  exam.academic_year_name = yearRows[0]?.name || null;

  const attendance = await getAttendanceSummary(
    schoolId,
    studentId,
    exam.term_start_date,
    exam.term_end_date
  );
  const notes = await getReportCardNotes(schoolId, examId, studentId);

  // Falls back to whoever actually wrote the class teacher's remarks when
  // the class has no official class_teacher_id assigned — otherwise
  // "Teacher's Name" on the printed slip is just blank even though someone
  // clearly did fill the remarks in.
  let classTeacherName = teacherRows[0]?.name || null;
  if (!classTeacherName && notes.entered_by) {
    const [enteredByRows] = await db.query('SELECT name FROM users WHERE id = ? LIMIT 1', [notes.entered_by]);
    classTeacherName = enteredByRows[0]?.name || null;
  }

  return {
    exam,
    student,
    subjects: subjectRows,
    totalObtained,
    totalMax,
    percentage: Math.round(percentage * 100) / 100,
    overallGrade,
    position: rankEntry ? rankEntry.position : null,
    classSize: ranking.length,
    noOnRoll: Number(rollRows[0].count),
    classTeacherName,
    attendance,
    notes,
  };
}

// Lightweight summary for dashboard-style views (parent Overview card) that
// don't need the full per-subject breakdown getReportCard returns.
async function getExamSummaryForStudent(schoolId, examId, studentId) {
  const ranking = await computeClassRanking(schoolId, examId);
  if (ranking.length === 0) {
    return { classAverage: null, position: null, classSize: 0 };
  }

  const totalPercentage = ranking.reduce(
    (sum, r) => sum + (r.total_max > 0 ? (r.total_obtained / r.total_max) * 100 : 0),
    0
  );
  const classAverage = Math.round((totalPercentage / ranking.length) * 10) / 10;
  const rankEntry = ranking.find((r) => r.student_id === Number(studentId));

  return { classAverage, position: rankEntry ? rankEntry.position : null, classSize: ranking.length };
}

module.exports = {
  listExams,
  getExamById,
  createExam,
  updateExam,
  addExamSubjects,
  getResultsSheet,
  saveResults,
  getReportCard,
  getClassReport,
  getExamSummaryForStudent,
  upsertReportCardNotes,
};
