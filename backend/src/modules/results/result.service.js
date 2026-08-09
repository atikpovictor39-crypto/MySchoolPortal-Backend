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

async function listExams(schoolId, { classId } = {}) {
  const conditions = ['school_id = ?'];
  const params = [schoolId];
  if (classId) {
    conditions.push('class_id = ?');
    params.push(classId);
  }

  const [rows] = await db.query(
    `SELECT id, academic_year_id, class_id, name, term, created_at
     FROM exams WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

async function getExamById(schoolId, id) {
  const [examRows] = await db.query(
    'SELECT id, academic_year_id, class_id, name, term, created_at FROM exams WHERE id = ? AND school_id = ? LIMIT 1',
    [id, schoolId]
  );
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

async function createExam(schoolId, { academicYearId, classId, name, term }) {
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
    'INSERT INTO exams (school_id, academic_year_id, class_id, name, term) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [schoolId, academicYearId, classId, name, term || null]
  );
  return getExamById(schoolId, result[0].id);
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

async function getReportCard(schoolId, examId, studentId) {
  const [examRows] = await db.query(
    'SELECT id, academic_year_id, class_id, name, term FROM exams WHERE id = ? AND school_id = ? LIMIT 1',
    [examId, schoolId]
  );
  const exam = examRows[0];
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

  const entered = subjectRows.filter((s) => s.marks_obtained !== null);
  const totalObtained = entered.reduce((sum, s) => sum + Number(s.marks_obtained), 0);
  const totalMax = entered.reduce((sum, s) => sum + Number(s.max_marks), 0);
  const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const overallGrade = entered.length > 0 ? calculateGrade(percentage) : null;

  const ranking = await computeClassRanking(schoolId, examId);
  const rankEntry = ranking.find((r) => r.student_id === Number(studentId));

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
  addExamSubjects,
  getResultsSheet,
  saveResults,
  getReportCard,
  getClassReport,
  getExamSummaryForStudent,
};
