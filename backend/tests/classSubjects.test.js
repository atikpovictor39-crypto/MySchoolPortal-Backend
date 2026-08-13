// Coverage for assigning subjects (+ teacher + periods/week) to a class —
// the prerequisite data the timetable auto-generator reads from (see
// timetableGenerate.test.js).
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createTeacher } = require('./helpers/fixtures');

let school;
let subjectId;
let teacherId;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();

  const subjectRes = await request(app)
    .post('/api/v1/subjects')
    .set('Authorization', auth(school.accessToken))
    .send({ name: 'Mathematics' });
  subjectId = subjectRes.body.data.id;

  await createTeacher(school.accessToken, { name: 'Mrs. Owusu' });
  const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
  teacherId = teachersRes.body.data.find((t) => t.name === 'Mrs. Owusu').id;
});

afterAll(async () => {
  await db.end();
});

describe('Class subjects', () => {
  it('assigns a subject with a teacher and periods/week', async () => {
    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId, teacherId, periodsPerWeek: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.subject_name).toBe('Mathematics');
    expect(res.body.data.teacher_name).toBe('Mrs. Owusu');
    expect(res.body.data.periods_per_week).toBe(5);
  });

  it('defaults periods_per_week to 1 when omitted', async () => {
    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId });

    expect(res.status).toBe(201);
    expect(res.body.data.periods_per_week).toBe(1);
    expect(res.body.data.teacher_id).toBeNull();
  });

  it('re-adding the same subject updates rather than duplicates', async () => {
    await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId, periodsPerWeek: 3 });

    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId, teacherId, periodsPerWeek: 6 });

    expect(res.status).toBe(201);
    expect(res.body.data.periods_per_week).toBe(6);
    expect(res.body.data.teacher_name).toBe('Mrs. Owusu');

    const listRes = await request(app)
      .get(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken));
    expect(listRes.body.data).toHaveLength(1);
  });

  it('rejects periodsPerWeek out of range', async () => {
    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId, periodsPerWeek: 25 });

    expect(res.status).toBe(400);
  });

  it('lists subjects for a class', async () => {
    await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId, periodsPerWeek: 4 });

    const res = await request(app)
      .get(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].subject_name).toBe('Mathematics');
  });

  it('updates the teacher and periods/week on an existing assignment', async () => {
    const created = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId, periodsPerWeek: 3 });

    const res = await request(app)
      .put(`/api/v1/classes/${school.classId}/subjects/${created.body.data.id}`)
      .set('Authorization', auth(school.accessToken))
      .send({ teacherId, periodsPerWeek: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.teacher_name).toBe('Mrs. Owusu');
    expect(res.body.data.periods_per_week).toBe(7);
  });

  it('removes a subject from a class', async () => {
    const created = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId });

    const res = await request(app)
      .delete(`/api/v1/classes/${school.classId}/subjects/${created.body.data.id}`)
      .set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken));
    expect(listRes.body.data).toHaveLength(0);
  });

  it('blocks a TEACHER from adding a class subject, but allows viewing', async () => {
    const teacherLogin = await createTeacher(school.accessToken);

    const createRes = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ subjectId });
    expect(createRes.status).toBe(403);

    const listRes = await request(app)
      .get(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(teacherLogin.accessToken));
    expect(listRes.status).toBe(200);
  });

  it('rejects a subjectId from another school', async () => {
    const otherSchool = await setupTenant({ adminEmail: 'other-admin@example.com' });
    const otherSubjectRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(otherSchool.accessToken))
      .send({ name: 'Foreign Subject' });

    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId: otherSubjectRes.body.data.id });

    expect(res.status).toBe(400);
  });
});
