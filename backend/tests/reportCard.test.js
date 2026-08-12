// Coverage for the report-card redesign: exam term dates, per-subject
// positions, attendance summary, report_card_notes, the extended
// getReportCard shape, and the two access-control changes it required
// (broadened /schools/me GET, new /parent/school-info).
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, createTeacher, createGuardian } = require('./helpers/fixtures');

let school;
let student;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  student = await createStudent(school.accessToken, school.classId, { firstName: 'Amara', admissionNo: 'A1' });
});

afterAll(async () => {
  await db.end();
});

describe('Exam term dates (updateExam)', () => {
  it('sets term dates after the exam already exists', async () => {
    const examRes = await request(app)
      .post('/api/v1/results/exams')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, classId: school.classId, name: 'Term 1 Exam', term: 'Term 1' });
    const examId = examRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}`)
      .set('Authorization', auth(school.accessToken))
      .send({ termStartDate: '2026-01-05', termEndDate: '2026-04-03', reopeningDate: '2026-04-20' });

    expect(res.status).toBe(200);
    expect(res.body.data.term_start_date).toContain('2026-01-05');
    expect(res.body.data.term_end_date).toContain('2026-04-03');
    expect(res.body.data.reopening_date).toContain('2026-04-20');
  });

  it('leaves fields untouched when omitted from the update', async () => {
    const examRes = await request(app)
      .post('/api/v1/results/exams')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, classId: school.classId, name: 'Term 1 Exam' });
    const examId = examRes.body.data.id;

    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}`)
      .set('Authorization', auth(school.accessToken))
      .send({ term: 'Term 1' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Term 1 Exam');
    expect(res.body.data.term).toBe('Term 1');
  });

  it('404s for an exam that does not belong to this school', async () => {
    const res = await request(app)
      .put('/api/v1/results/exams/999999')
      .set('Authorization', auth(school.accessToken))
      .send({ term: 'Term 1' });

    expect(res.status).toBe(404);
  });
});

describe('Report card notes', () => {
  let examId;

  beforeEach(async () => {
    const examRes = await request(app)
      .post('/api/v1/results/exams')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, classId: school.classId, name: 'Term 1 Exam' });
    examId = examRes.body.data.id;
  });

  it('saves and returns interest/strength/remarks/promotion notes', async () => {
    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(school.accessToken))
      .send({
        interest: 'Football',
        academicStrength: 'Mathematics',
        classTeacherRemarks: 'A hardworking pupil.',
        headmasterRemarks: 'Keep it up.',
        promotedTo: 'Grade 6',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      interest: 'Football',
      academic_strength: 'Mathematics',
      class_teacher_remarks: 'A hardworking pupil.',
      headmaster_remarks: 'Keep it up.',
      promoted_to: 'Grade 6',
    });
  });

  it('re-saving the same student/exam updates rather than duplicates', async () => {
    await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(school.accessToken))
      .send({ interest: 'Football' });

    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(school.accessToken))
      .send({ interest: 'Chess' });

    expect(res.status).toBe(200);
    expect(res.body.data.interest).toBe('Chess');

    const [rows] = await db.query('SELECT COUNT(*) AS count FROM report_card_notes WHERE exam_id = ? AND student_id = ?', [
      examId,
      student.id,
    ]);
    expect(Number(rows[0].count)).toBe(1);
  });

  it('404s for a student outside the exam class', async () => {
    const otherSchool = await setupTenant({ adminEmail: 'other-admin@example.com' });
    const outsider = await createStudent(otherSchool.accessToken, otherSchool.classId, { firstName: 'Ola' });

    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${outsider.id}/notes`)
      .set('Authorization', auth(school.accessToken))
      .send({ interest: 'Football' });

    expect(res.status).toBe(404);
  });

  it('lets a TEACHER save interest/strength/class-teacher-remarks/promoted-to', async () => {
    const teacherLogin = await createTeacher(school.accessToken);
    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({
        interest: 'Athletics',
        academicStrength: 'Science',
        classTeacherRemarks: 'Improving steadily.',
        promotedTo: 'Grade 6',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      interest: 'Athletics',
      academic_strength: 'Science',
      class_teacher_remarks: 'Improving steadily.',
      promoted_to: 'Grade 6',
    });
  });

  it("ignores a TEACHER's attempt to set headmasterRemarks, and preserves an admin's existing value", async () => {
    await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(school.accessToken))
      .send({ headmasterRemarks: 'Set by the admin.' });

    const teacherLogin = await createTeacher(school.accessToken);
    const res = await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ interest: 'Athletics', headmasterRemarks: 'Sneaky teacher edit.' });

    expect(res.status).toBe(200);
    expect(res.body.data.interest).toBe('Athletics');
    expect(res.body.data.headmaster_remarks).toBe('Set by the admin.');
  });
});

describe('Extended report card shape', () => {
  it('includes per-subject positions, attendance, notes, roll count, class teacher and names', async () => {
    const studentB = await createStudent(school.accessToken, school.classId, { firstName: 'Ben', admissionNo: 'A2' });

    const mathRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Mathematics' });
    const englishRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'English' });

    const examRes = await request(app)
      .post('/api/v1/results/exams')
      .set('Authorization', auth(school.accessToken))
      .send({
        academicYearId: school.academicYearId,
        classId: school.classId,
        name: 'Term 1 Exam',
        term: 'Term 1',
        termStartDate: '2026-01-05',
        termEndDate: '2026-01-10',
      });
    const examId = examRes.body.data.id;

    const addSubjectsRes = await request(app)
      .post(`/api/v1/results/exams/${examId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({
        subjects: [
          { subjectId: mathRes.body.data.id, maxMarks: 100, passingMarks: 40 },
          { subjectId: englishRes.body.data.id, maxMarks: 100, passingMarks: 40 },
        ],
      });
    const [mathExamSubjectId, englishExamSubjectId] = addSubjectsRes.body.data.subjects
      .sort((a, b) => (a.subject_id === mathRes.body.data.id ? -1 : 1))
      .map((s) => s.exam_subject_id);

    // student (Amara) tops Math but comes second in English; studentB is the reverse.
    await request(app)
      .post(`/api/v1/results/exam-subjects/${mathExamSubjectId}`)
      .set('Authorization', auth(school.accessToken))
      .send({
        records: [
          { studentId: student.id, marksObtained: 90 },
          { studentId: studentB.id, marksObtained: 70 },
        ],
      });
    await request(app)
      .post(`/api/v1/results/exam-subjects/${englishExamSubjectId}`)
      .set('Authorization', auth(school.accessToken))
      .send({
        records: [
          { studentId: student.id, marksObtained: 60 },
          { studentId: studentB.id, marksObtained: 80 },
        ],
      });

    // Mark attendance inside the exam's term window.
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-06', records: [{ studentId: student.id, status: 'present' }] });
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-07', records: [{ studentId: student.id, status: 'absent' }] });

    await request(app)
      .put(`/api/v1/results/exams/${examId}/report-card/${student.id}/notes`)
      .set('Authorization', auth(school.accessToken))
      .send({ interest: 'Football', promotedTo: 'Grade 6' });

    await createTeacher(school.accessToken, { name: 'Mr. Mensah' });
    const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
    const teacherId = teachersRes.body.data.find((t) => t.name === 'Mr. Mensah').id;
    await request(app)
      .put(`/api/v1/classes/${school.classId}`)
      .set('Authorization', auth(school.accessToken))
      .send({ classTeacherId: teacherId });

    const res = await request(app)
      .get(`/api/v1/results/exams/${examId}/report-card/${student.id}`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    const card = res.body.data;

    // Overall totals rank Amara 2nd (150 vs 150 is a tie, but per-subject differs) —
    // what matters here is that per-subject position is independent of overall position.
    const mathRow = card.subjects.find((s) => s.exam_subject_id === mathExamSubjectId);
    const englishRow = card.subjects.find((s) => s.exam_subject_id === englishExamSubjectId);
    expect(mathRow.position).toBe(1); // Amara topped Math
    expect(englishRow.position).toBe(2); // Amara came second in English

    expect(card.noOnRoll).toBe(2);
    expect(card.classTeacherName).toBe('Mr. Mensah');
    expect(card.exam.class_name).toBe('Grade 5');
    expect(card.exam.class_section).toBe('A');
    expect(card.exam.academic_year_name).toBe('2025/2026');
    expect(card.attendance).toEqual({ present: 1, total: 2 });
    expect(card.notes.interest).toBe('Football');
    expect(card.notes.promoted_to).toBe('Grade 6');
  });

  it('reports null attendance when the exam has no term dates set', async () => {
    const examRes = await request(app)
      .post('/api/v1/results/exams')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, classId: school.classId, name: 'Term 1 Exam' });
    const examId = examRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/results/exams/${examId}/report-card/${student.id}`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.attendance).toEqual({ present: null, total: null });
    expect(res.body.data.notes).toEqual({
      interest: null,
      academic_strength: null,
      class_teacher_remarks: null,
      headmaster_remarks: null,
      promoted_to: null,
    });
  });
});

describe('School info access for the report card letterhead', () => {
  it('lets a TEACHER read /schools/me (broadened from admin-only)', async () => {
    const teacherLogin = await createTeacher(school.accessToken);
    const res = await request(app).get('/api/v1/schools/me').set('Authorization', auth(teacherLogin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBeTruthy();
  });

  it('still blocks a PARENT from /schools/me', async () => {
    const parentLogin = await createGuardian(school.accessToken, student.id);
    const res = await request(app).get('/api/v1/schools/me').set('Authorization', auth(parentLogin.accessToken));

    expect(res.status).toBe(403);
  });

  it('gives a PARENT the letterhead fields via /parent/school-info', async () => {
    const parentLogin = await createGuardian(school.accessToken, student.id);
    const res = await request(app)
      .get('/api/v1/parent/school-info')
      .set('Authorization', auth(parentLogin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBeTruthy();
    expect(res.body.data).toHaveProperty('address');
    expect(res.body.data).toHaveProperty('phone');
    expect(res.body.data).toHaveProperty('logo_url');
  });
});
