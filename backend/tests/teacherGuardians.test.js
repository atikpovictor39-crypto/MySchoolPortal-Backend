const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, createTeacher } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

async function assignClassTeacher(tenant, teacherId) {
  const res = await request(app)
    .put(`/api/v1/classes/${tenant.classId}`)
    .set('Authorization', auth(tenant.accessToken))
    .send({ classTeacherId: teacherId });
  expect(res.status).toBe(200);
}

async function getTeacherRowId(adminToken) {
  const res = await request(app).get('/api/v1/teachers').set('Authorization', auth(adminToken));
  return res.body.data[0].id;
}

describe('GET /teachers/me', () => {
  it('resolves the logged-in teacher own teachers.id', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);

    const res = await request(app).get('/api/v1/teachers/me').set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.teacherId).toBe('number');
  });

  it('is blocked for a SCHOOL_ADMIN (teacher-only route)', async () => {
    const tenant = await setupTenant();
    const res = await request(app).get('/api/v1/teachers/me').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(403);
  });
});

describe('Teacher-managed guardians, scoped to their own class', () => {
  it('lets the class teacher add a guardian for a student in their class', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    const teacherRowId = await getTeacherRowId(tenant.accessToken);
    await assignClassTeacher(tenant, teacherRowId);
    const student = await createStudent(tenant.accessToken, tenant.classId);

    const res = await request(app)
      .post(`/api/v1/students/${student.id}/guardians`)
      .set('Authorization', auth(teacher.accessToken))
      .send({ name: 'Class Teacher Guardian', email: 'ctguardian@example.com', password: 'guardianpass123', relationship: 'Mother' });

    expect(res.status).toBe(201);
    expect(res.body.data.some((g) => g.email === 'ctguardian@example.com')).toBe(true);
  });

  it('lets the class teacher list guardians for a student in their class', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    const teacherRowId = await getTeacherRowId(tenant.accessToken);
    await assignClassTeacher(tenant, teacherRowId);
    const student = await createStudent(tenant.accessToken, tenant.classId);

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/guardians`)
      .set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(200);
  });

  it('blocks a teacher who is not the class teacher of that student', async () => {
    const tenant = await setupTenant();
    const otherTeacher = await createTeacher(tenant.accessToken); // never assigned as class_teacher_id
    const student = await createStudent(tenant.accessToken, tenant.classId);

    const res = await request(app)
      .post(`/api/v1/students/${student.id}/guardians`)
      .set('Authorization', auth(otherTeacher.accessToken))
      .send({ name: 'Should Not Work', email: 'blocked@example.com', password: 'guardianpass123' });

    expect(res.status).toBe(403);
  });

  it('blocks listing guardians for a teacher who is not the class teacher', async () => {
    const tenant = await setupTenant();
    const otherTeacher = await createTeacher(tenant.accessToken);
    const student = await createStudent(tenant.accessToken, tenant.classId);

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/guardians`)
      .set('Authorization', auth(otherTeacher.accessToken));
    expect(res.status).toBe(403);
  });

  it('still lets SCHOOL_ADMIN manage guardians regardless of class teacher assignment', async () => {
    const tenant = await setupTenant();
    const student = await createStudent(tenant.accessToken, tenant.classId);

    const res = await request(app)
      .post(`/api/v1/students/${student.id}/guardians`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Admin Added Guardian', email: 'adminguardian@example.com', password: 'guardianpass123' });
    expect(res.status).toBe(201);
  });

  it('records an audit log entry when a guardian is added', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    const teacherRowId = await getTeacherRowId(tenant.accessToken);
    await assignClassTeacher(tenant, teacherRowId);
    const student = await createStudent(tenant.accessToken, tenant.classId);

    await request(app)
      .post(`/api/v1/students/${student.id}/guardians`)
      .set('Authorization', auth(teacher.accessToken))
      .send({ name: 'Audited Guardian', email: 'audited@example.com', password: 'guardianpass123' });

    const logRes = await request(app).get('/api/v1/audit-logs').set('Authorization', auth(tenant.accessToken));
    const entry = logRes.body.data.find((l) => l.action === 'guardian.added');
    expect(entry).toBeTruthy();
    expect(entry.description).toMatch(/Audited Guardian/);
  });
});
