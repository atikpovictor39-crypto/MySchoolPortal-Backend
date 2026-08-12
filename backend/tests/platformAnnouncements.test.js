const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const {
  app,
  request,
  auth,
  createSuperAdmin,
  setupTenant,
  createStudent,
  createGuardian,
} = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Platform-wide announcements (broadcasts)', () => {
  it('a SuperAdmin can post a broadcast and it shows up for every school', async () => {
    const superadmin = await createSuperAdmin();
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();

    const createRes = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'New report card feature', content: 'Now live for every school.', targetRole: 'all' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.school_id).toBeNull();

    const resA = await request(app).get('/api/v1/announcements').set('Authorization', auth(tenantA.accessToken));
    const resB = await request(app).get('/api/v1/announcements').set('Authorization', auth(tenantB.accessToken));
    expect(resA.body.data.some((a) => a.title === 'New report card feature')).toBe(true);
    expect(resB.body.data.some((a) => a.title === 'New report card feature')).toBe(true);
  });

  it('a parent sees a platform broadcast targeted at parents', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    const student = await createStudent(tenant.accessToken, tenant.classId);
    const guardian = await createGuardian(tenant.accessToken, student.id);

    await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'Platform maintenance notice', content: 'Heads up.', targetRole: 'parents' });

    const res = await request(app).get('/api/v1/parent/announcements').set('Authorization', auth(guardian.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a) => a.title === 'Platform maintenance notice')).toBe(true);
  });

  it('a SCHOOL_ADMIN cannot delete a platform broadcast through the school-scoped route', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    const created = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'Broadcast', content: 'x', targetRole: 'all' });

    const res = await request(app)
      .delete(`/api/v1/announcements/${created.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(404);
  });

  it('a SuperAdmin can delete their own broadcast', async () => {
    const superadmin = await createSuperAdmin();
    const created = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'Broadcast', content: 'x', targetRole: 'all' });

    const res = await request(app)
      .delete(`/api/v1/platform/announcements/${created.body.data.id}`)
      .set('Authorization', auth(superadmin.accessToken));
    expect(res.status).toBe(200);

    const list = await request(app)
      .get('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken));
    expect(list.body.data.length).toBe(0);
  });

  it('blocks a SCHOOL_ADMIN from posting a broadcast', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'x', content: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('Platform announcements targeted at one school', () => {
  it('reaches only the targeted school, not others', async () => {
    const superadmin = await createSuperAdmin();
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();

    const createRes = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'About your account', content: 'Just for you.', schoolId: tenantA.user.school_id });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.school_id).toBe(tenantA.user.school_id);
    expect(createRes.body.data.target_school_name).toBeTruthy();

    const resA = await request(app).get('/api/v1/announcements').set('Authorization', auth(tenantA.accessToken));
    const resB = await request(app).get('/api/v1/announcements').set('Authorization', auth(tenantB.accessToken));
    expect(resA.body.data.some((a) => a.title === 'About your account')).toBe(true);
    expect(resB.body.data.some((a) => a.title === 'About your account')).toBe(false);
  });

  it("still shows up in the SuperAdmin's own list alongside all-school broadcasts", async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();

    await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'Targeted', content: 'x', schoolId: tenant.user.school_id });
    await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'Broadcast', content: 'x' });

    const list = await request(app)
      .get('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken));
    expect(list.status).toBe(200);
    const titles = list.body.data.map((a) => a.title);
    expect(titles).toEqual(expect.arrayContaining(['Targeted', 'Broadcast']));
    const targeted = list.body.data.find((a) => a.title === 'Targeted');
    expect(targeted.target_school_name).toBeTruthy();
    const broadcast = list.body.data.find((a) => a.title === 'Broadcast');
    expect(broadcast.target_school_name).toBeNull();
  });

  it('rejects a schoolId that does not exist', async () => {
    const superadmin = await createSuperAdmin();
    const res = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'x', content: 'x', schoolId: 999999 });
    expect(res.status).toBe(400);
  });

  it('still blocks the targeted school from editing or deleting it', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    const created = await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'About your account', content: 'x', schoolId: tenant.user.school_id });

    const updateRes = await request(app)
      .put(`/api/v1/announcements/${created.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'Edited by the school' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/announcements/${created.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken));
    expect(deleteRes.status).toBe(404);
  });

  it('a support-scoped SuperAdmin can list schools to pick a target', async () => {
    const supportAdmin = await createSuperAdmin({ scope: 'support' });
    await setupTenant();

    const res = await request(app).get('/api/v1/schools').set('Authorization', auth(supportAdmin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
