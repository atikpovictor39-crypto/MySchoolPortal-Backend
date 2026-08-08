const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

let school;
let student;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  student = await createStudent(school.accessToken, school.classId);
});

afterAll(async () => {
  await db.end();
});

describe('Marking attendance', () => {
  it('marks a student absent', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: student.id, status: 'absent' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.students[0].status).toBe('absent');
  });

  it('re-marking the same day upserts instead of erroring', async () => {
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: student.id, status: 'absent' }] });

    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: student.id, status: 'present' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.students[0].status).toBe('present');

    // Confirm it's genuinely one row updated, not a second row inserted.
    const sheet = await request(app)
      .get(`/api/v1/attendance?class_id=${school.classId}&date=2026-01-15`)
      .set('Authorization', auth(school.accessToken));
    expect(sheet.body.data.students).toHaveLength(1);
  });

  it('rejects a student who is not in the given class', async () => {
    const otherSchool = await setupTenant({ schoolName: 'Other School' });
    const otherStudent = await createStudent(otherSchool.accessToken, otherSchool.classId);

    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: otherStudent.id, status: 'present' }] });

    expect(res.status).toBe(400);
  });
});
