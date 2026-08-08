const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createSuperAdmin, uniqueEmail } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

describe('SuperAdmin school onboarding', () => {
  let superAdmin;

  beforeEach(async () => {
    await resetDatabase();
    superAdmin = await createSuperAdmin();
  });

  it('creates a school and lists it back with plan info', async () => {
    const createRes = await request(app)
      .post('/api/v1/schools')
      .set('Authorization', auth(superAdmin.accessToken))
      .send({
        name: 'Onboarded School',
        adminName: 'New Admin',
        adminEmail: uniqueEmail('newadmin'),
        adminPassword: 'testpassword123',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('active');
    expect(createRes.body.data.plan_name).toBeTruthy();

    const listRes = await request(app).get('/api/v1/schools').set('Authorization', auth(superAdmin.accessToken));
    expect(listRes.body.data.some((s) => s.name === 'Onboarded School')).toBe(true);
  });

  it('blocks a non-SuperAdmin from creating or listing schools', async () => {
    const school = await setupTenant();
    const createRes = await request(app)
      .post('/api/v1/schools')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'x', adminName: 'x', adminEmail: uniqueEmail('x'), adminPassword: 'testpassword123' });
    expect(createRes.status).toBe(403);

    const listRes = await request(app).get('/api/v1/schools').set('Authorization', auth(school.accessToken));
    expect(listRes.status).toBe(403);
  });
});

describe('SuperAdmin suspends/reactivates a school', () => {
  let superAdmin;
  let school;

  beforeEach(async () => {
    await resetDatabase();
    superAdmin = await createSuperAdmin();
    school = await setupTenant();
  });

  it('suspends a school and blocks its SchoolAdmin from logging in', async () => {
    const suspendRes = await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ status: 'suspended' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status).toBe('suspended');

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    expect(loginRes.status).toBe(403);
  });

  it('blocks an already-issued refresh token once the school is suspended', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    const refreshCookie = loginRes.headers['set-cookie'];

    await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ status: 'suspended' });

    // The old access token itself is still cryptographically valid until it
    // expires, but re-deriving the user from the DB on refresh should catch it.
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(403);
  });

  it('reactivating restores login', async () => {
    await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ status: 'suspended' });

    await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ status: 'active' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    expect(loginRes.status).toBe(200);
  });

  it('rejects an invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ status: 'not-a-real-status' });
    expect(res.status).toBe(400);
  });

  it('blocks a non-SuperAdmin from changing school status', async () => {
    const res = await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(school.accessToken))
      .send({ status: 'suspended' });
    expect(res.status).toBe(403);
  });

  it('does not let a suspended school block a completely different school', async () => {
    const otherSchool = await setupTenant({ schoolName: 'Unrelated School' });
    await request(app)
      .patch(`/api/v1/schools/${school.user.school_id}/status`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ status: 'suspended' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: otherSchool.credentials.adminEmail, password: otherSchool.credentials.adminPassword });
    expect(loginRes.status).toBe(200);
  });
});
