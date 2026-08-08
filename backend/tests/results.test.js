// Regression coverage for a real bug found during manual testing: report
// card `position` came back null for every student because Express route
// params are strings while the ranking query returns numeric student_id,
// so a strict `===` comparison silently never matched. Fixed with
// Number(studentId) in result.service.js — these tests pin that behavior.
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

let school;
let studentTop;
let studentBottom;
let subjectId;
let examId;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  studentTop = await createStudent(school.accessToken, school.classId, { firstName: 'Amara', admissionNo: 'A1' });
  studentBottom = await createStudent(school.accessToken, school.classId, { firstName: 'Ben', admissionNo: 'A2' });

  const subjectRes = await request(app)
    .post('/api/v1/subjects')
    .set('Authorization', auth(school.accessToken))
    .send({ name: 'Mathematics' });
  subjectId = subjectRes.body.data.id;

  const examRes = await request(app)
    .post('/api/v1/results/exams')
    .set('Authorization', auth(school.accessToken))
    .send({ academicYearId: school.academicYearId, classId: school.classId, name: 'Term 1 Exam' });
  examId = examRes.body.data.id;

  const addSubjectRes = await request(app)
    .post(`/api/v1/results/exams/${examId}/subjects`)
    .set('Authorization', auth(school.accessToken))
    .send({ subjects: [{ subjectId, maxMarks: 100, passingMarks: 40 }] });
  const examSubjectId = addSubjectRes.body.data.subjects[0].exam_subject_id;

  await request(app)
    .post(`/api/v1/results/exam-subjects/${examSubjectId}`)
    .set('Authorization', auth(school.accessToken))
    .send({
      records: [
        { studentId: studentTop.id, marksObtained: 95 },
        { studentId: studentBottom.id, marksObtained: 60 },
      ],
    });
});

afterAll(async () => {
  await db.end();
});

describe('Report card position', () => {
  it('gives the higher scorer position 1, not null', async () => {
    const res = await request(app)
      .get(`/api/v1/results/exams/${examId}/report-card/${studentTop.id}`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.position).toBe(1);
    expect(res.body.data.classSize).toBe(2);
    expect(res.body.data.totalObtained).toBe(95);
    expect(res.body.data.overallGrade).toBe('A');
  });

  it('gives the lower scorer position 2, not null', async () => {
    const res = await request(app)
      .get(`/api/v1/results/exams/${examId}/report-card/${studentBottom.id}`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.position).toBe(2);
    expect(res.body.data.totalObtained).toBe(60);
    expect(res.body.data.overallGrade).toBe('C');
  });

  it('class ranking agrees with each report card', async () => {
    const res = await request(app)
      .get(`/api/v1/results/exams/${examId}/class-report`)
      .set('Authorization', auth(school.accessToken));

    expect(res.body.data.map((r) => r.student_id)).toEqual([studentTop.id, studentBottom.id]);
    expect(res.body.data[0].position).toBe(1);
    expect(res.body.data[1].position).toBe(2);
  });
});

describe('Score entry validation', () => {
  it('rejects marks above max_marks', async () => {
    const examSubjectsRes = await request(app)
      .get(`/api/v1/results/exams/${examId}`)
      .set('Authorization', auth(school.accessToken));
    const examSubjectId = examSubjectsRes.body.data.subjects[0].exam_subject_id;

    const res = await request(app)
      .post(`/api/v1/results/exam-subjects/${examSubjectId}`)
      .set('Authorization', auth(school.accessToken))
      .send({ records: [{ studentId: studentTop.id, marksObtained: 150 }] });

    expect(res.status).toBe(400);
  });
});
