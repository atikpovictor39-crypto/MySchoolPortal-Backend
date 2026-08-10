const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, uniqueEmail, login } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

// Creates a teacher WITHOUT clearing must_change_password — unlike the
// createTeacher fixture helper, this test file is specifically about that flag.
async function createRawTeacher(adminToken, email, password) {
  const res = await request(app)
    .post('/api/v1/teachers')
    .set('Authorization', auth(adminToken))
    .send({ name: 'Fresh Teacher', email, password });
  expect(res.status).toBe(201);
  return login(email, password);
}

describe('Forced password change for admin-created accounts', () => {
  it('a self-registered SCHOOL_ADMIN never has must_change_password set', async () => {
    const school = await setupTenant();
    expect(school.user.must_change_password).toBe(false);
  });

  it('a freshly created teacher must change their password', async () => {
    const school = await setupTenant();
    const email = uniqueEmail('teacher');
    const teacher = await createRawTeacher(school.accessToken, email, 'teacherpass123');
    expect(teacher.user.must_change_password).toBe(true);
  });

  it('blocks a must-change-password teacher from tenant routes', async () => {
    const school = await setupTenant();
    const email = uniqueEmail('teacher');
    const teacher = await createRawTeacher(school.accessToken, email, 'teacherpass123');

    const res = await request(app).get('/api/v1/teachers/clock-status').set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MUST_CHANGE_PASSWORD');
  });

  it('rejects a change with the wrong current password', async () => {
    const school = await setupTenant();
    const email = uniqueEmail('teacher');
    const teacher = await createRawTeacher(school.accessToken, email, 'teacherpass123');

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', auth(teacher.accessToken))
      .send({ currentPassword: 'wrongpassword', newPassword: 'brandnewpass123' });
    expect(res.status).toBe(401);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const school = await setupTenant();
    const email = uniqueEmail('teacher');
    const teacher = await createRawTeacher(school.accessToken, email, 'teacherpass123');

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', auth(teacher.accessToken))
      .send({ currentPassword: 'teacherpass123', newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('clears the flag, unlocks tenant routes with the new token, and the old password stops working', async () => {
    const school = await setupTenant();
    const email = uniqueEmail('teacher');
    const teacher = await createRawTeacher(school.accessToken, email, 'teacherpass123');

    const changeRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', auth(teacher.accessToken))
      .send({ currentPassword: 'teacherpass123', newPassword: 'brandnewpass123' });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.data.user.must_change_password).toBe(false);

    const newToken = changeRes.body.data.accessToken;
    const tenantRes = await request(app).get('/api/v1/teachers/clock-status').set('Authorization', auth(newToken));
    expect(tenantRes.status).toBe(200);

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'teacherpass123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'brandnewpass123' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.user.must_change_password).toBe(false);
  });

  it('a guardian created by admin also must change their password', async () => {
    const school = await setupTenant();
    const studentRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, admissionNo: `ADM-${Date.now()}`, firstName: 'Test', lastName: 'Student' });
    const studentId = studentRes.body.data.id;

    const email = uniqueEmail('guardian');
    const guardianRes = await request(app)
      .post(`/api/v1/students/${studentId}/guardians`)
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Fresh Guardian', email, password: 'guardianpass123', relationship: 'Mother' });
    expect(guardianRes.status).toBe(201);

    const guardian = await login(email, 'guardianpass123');
    expect(guardian.user.must_change_password).toBe(true);

    const res = await request(app)
      .get('/api/v1/parent/children')
      .set('Authorization', auth(guardian.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MUST_CHANGE_PASSWORD');
  });
});
