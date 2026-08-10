const db = require('../../config/db');
const { toCsv } = require('../../utils/csv');

function money(cents) {
  return (Number(cents) / 100).toFixed(2);
}

async function exportStudents(schoolId) {
  const [rows] = await db.query(
    `SELECT s.admission_no, s.first_name, s.last_name, s.date_of_birth, s.gender, s.status, s.enrolled_at,
       c.name AS class_name, c.section
     FROM students s
     JOIN classes c ON c.id = s.class_id
     WHERE s.school_id = ?
     ORDER BY c.name, c.section, s.last_name, s.first_name`,
    [schoolId]
  );
  const csv = toCsv(rows, [
    { label: 'Admission No', value: (r) => r.admission_no },
    { label: 'First Name', value: (r) => r.first_name },
    { label: 'Last Name', value: (r) => r.last_name },
    { label: 'Date of Birth', value: (r) => r.date_of_birth?.toISOString?.().slice(0, 10) ?? r.date_of_birth },
    { label: 'Gender', value: (r) => r.gender },
    { label: 'Status', value: (r) => r.status },
    { label: 'Enrolled', value: (r) => r.enrolled_at?.toISOString?.().slice(0, 10) ?? r.enrolled_at },
    { label: 'Class', value: (r) => r.class_name },
    { label: 'Section', value: (r) => r.section },
  ]);
  return { filename: 'students.csv', csv };
}

async function exportTeachers(schoolId) {
  const [rows] = await db.query(
    `SELECT u.name, u.email, u.phone, t.employee_no, t.hire_date
     FROM teachers t
     JOIN users u ON u.id = t.user_id
     WHERE t.school_id = ?
     ORDER BY u.name`,
    [schoolId]
  );
  const csv = toCsv(rows, [
    { label: 'Name', value: (r) => r.name },
    { label: 'Email', value: (r) => r.email },
    { label: 'Phone', value: (r) => r.phone },
    { label: 'Employee No', value: (r) => r.employee_no },
    { label: 'Hire Date', value: (r) => r.hire_date?.toISOString?.().slice(0, 10) ?? r.hire_date },
  ]);
  return { filename: 'teachers.csv', csv };
}

async function exportFees(schoolId) {
  const [rows] = await db.query(
    `SELECT s.admission_no, s.first_name, s.last_name, fs.name AS fee_name,
       fi.amount_due_cents, fi.amount_paid_cents, fi.status, fi.due_date, fi.created_at
     FROM fee_invoices fi
     JOIN students s ON s.id = fi.student_id
     JOIN fee_structures fs ON fs.id = fi.fee_structure_id
     WHERE fi.school_id = ?
     ORDER BY fi.created_at DESC`,
    [schoolId]
  );
  const csv = toCsv(rows, [
    { label: 'Admission No', value: (r) => r.admission_no },
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name}` },
    { label: 'Fee', value: (r) => r.fee_name },
    { label: 'Amount Due', value: (r) => money(r.amount_due_cents) },
    { label: 'Amount Paid', value: (r) => money(r.amount_paid_cents) },
    { label: 'Status', value: (r) => r.status },
    { label: 'Due Date', value: (r) => r.due_date?.toISOString?.().slice(0, 10) ?? r.due_date },
    { label: 'Invoiced On', value: (r) => r.created_at?.toISOString?.().slice(0, 10) ?? r.created_at },
  ]);
  return { filename: 'fee-invoices.csv', csv };
}

async function exportAttendance(schoolId) {
  const [rows] = await db.query(
    `SELECT s.admission_no, s.first_name, s.last_name, c.name AS class_name, c.section, a.date, a.status
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     JOIN classes c ON c.id = a.class_id
     WHERE a.school_id = ?
     ORDER BY a.date DESC, s.last_name, s.first_name`,
    [schoolId]
  );
  const csv = toCsv(rows, [
    { label: 'Date', value: (r) => r.date?.toISOString?.().slice(0, 10) ?? r.date },
    { label: 'Admission No', value: (r) => r.admission_no },
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name}` },
    { label: 'Class', value: (r) => r.class_name },
    { label: 'Section', value: (r) => r.section },
    { label: 'Status', value: (r) => r.status },
  ]);
  return { filename: 'attendance.csv', csv };
}

async function exportResults(schoolId) {
  const [rows] = await db.query(
    `SELECT s.admission_no, s.first_name, s.last_name, e.name AS exam_name, e.term,
       sub.name AS subject_name, r.marks_obtained, r.grade
     FROM results r
     JOIN students s ON s.id = r.student_id
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     JOIN exams e ON e.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE r.school_id = ?
     ORDER BY e.name, s.last_name, s.first_name, sub.name`,
    [schoolId]
  );
  const csv = toCsv(rows, [
    { label: 'Exam', value: (r) => r.exam_name },
    { label: 'Term', value: (r) => r.term },
    { label: 'Admission No', value: (r) => r.admission_no },
    { label: 'Student', value: (r) => `${r.first_name} ${r.last_name}` },
    { label: 'Subject', value: (r) => r.subject_name },
    { label: 'Marks', value: (r) => r.marks_obtained },
    { label: 'Grade', value: (r) => r.grade },
  ]);
  return { filename: 'results.csv', csv };
}

const EXPORTERS = {
  students: exportStudents,
  teachers: exportTeachers,
  fees: exportFees,
  attendance: exportAttendance,
  results: exportResults,
};

module.exports = { EXPORTERS };
