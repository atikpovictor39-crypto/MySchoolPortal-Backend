const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, createSuperAdmin, registerSchool, login, uniqueEmail } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('SuperAdmin account management', () => {
  it('lets a SuperAdmin create another SuperAdmin', async () => {
    const superadmin = await createSuperAdmin();
    const email = uniqueEmail('partner');

    const res = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Partner Admin', email, password: 'partnerpass123' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.status).toBe('active');
  });

  it('the new account must change its temp password on first login', async () => {
    const superadmin = await createSuperAdmin();
    const email = uniqueEmail('partner');
    await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Partner Admin', email, password: 'partnerpass123' });

    const loginRes = await login(email, 'partnerpass123');
    expect(loginRes.user.must_change_password).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const superadmin = await createSuperAdmin();
    const school = await registerSchool();

    const res = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Dup', email: school.credentials.adminEmail, password: 'partnerpass123' });
    expect(res.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const superadmin = await createSuperAdmin();
    const res = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Partner', email: uniqueEmail('partner'), password: 'short' });
    expect(res.status).toBe(400);
  });

  it('lists all SuperAdmin accounts', async () => {
    const superadmin = await createSuperAdmin();
    await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Partner Admin', email: uniqueEmail('partner'), password: 'partnerpass123' });

    const res = await request(app).get('/api/v1/superadmins').set('Authorization', auth(superadmin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('lets a SuperAdmin suspend another and blocks their login', async () => {
    const superadmin = await createSuperAdmin();
    const email = uniqueEmail('partner');
    const password = 'partnerpass123';
    const createRes = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Partner Admin', email, password });
    const partnerId = createRes.body.data.id;

    const suspendRes = await request(app)
      .patch(`/api/v1/superadmins/${partnerId}/status`)
      .set('Authorization', auth(superadmin.accessToken))
      .send({ status: 'suspended' });
    expect(suspendRes.status).toBe(200);

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(loginRes.status).toBe(401);
  });

  it('blocks a SuperAdmin from suspending their own account', async () => {
    const superadmin = await createSuperAdmin();
    const meRes = await request(app).get('/api/v1/superadmins').set('Authorization', auth(superadmin.accessToken));
    const myId = meRes.body.data[0].id;

    const res = await request(app)
      .patch(`/api/v1/superadmins/${myId}/status`)
      .set('Authorization', auth(superadmin.accessToken))
      .send({ status: 'suspended' });
    expect(res.status).toBe(400);
  });

  it('blocks a SCHOOL_ADMIN from the superadmins endpoints entirely', async () => {
    const school = await registerSchool();
    const res = await request(app).get('/api/v1/superadmins').set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(403);
  });
});
