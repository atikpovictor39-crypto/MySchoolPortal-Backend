const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const {
  app,
  request,
  auth,
  setupTenant,
  createTeacher,
  createStudent,
  createGuardian,
  createSuperAdmin,
} = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Announcements unread count — staff side', () => {
  it('counts every visible announcement as unread until the page is marked seen', async () => {
    const tenant = await setupTenant();
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'First', content: 'x' });
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'Second', content: 'y' });

    const beforeRes = await request(app)
      .get('/api/v1/announcements/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.data.count).toBe(2);

    const seenRes = await request(app).post('/api/v1/announcements/seen').set('Authorization', auth(tenant.accessToken));
    expect(seenRes.status).toBe(200);

    const afterRes = await request(app)
      .get('/api/v1/announcements/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(afterRes.body.data.count).toBe(0);
  });

  it('bumps the count back up for a new announcement posted after marking seen', async () => {
    const tenant = await setupTenant();
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'Old news', content: 'x' });
    await request(app).post('/api/v1/announcements/seen').set('Authorization', auth(tenant.accessToken));

    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'Fresh news', content: 'y' });

    const res = await request(app)
      .get('/api/v1/announcements/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(res.body.data.count).toBe(1);
  });

  it('counts a platform-wide broadcast the same as a school announcement', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();

    await request(app)
      .post('/api/v1/platform/announcements')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ title: 'New feature', content: 'x', targetRole: 'all' });

    const res = await request(app)
      .get('/api/v1/announcements/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(res.body.data.count).toBe(1);
  });

  it('does not count another school\'s announcements', async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenantB.accessToken))
      .send({ title: 'Not yours', content: 'x' });

    const res = await request(app)
      .get('/api/v1/announcements/unread-count')
      .set('Authorization', auth(tenantA.accessToken));
    expect(res.body.data.count).toBe(0);
  });

  it('a TEACHER can also check and clear the unread count', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'For everyone', content: 'x' });

    const res = await request(app)
      .get('/api/v1/announcements/unread-count')
      .set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);

    const seenRes = await request(app)
      .post('/api/v1/announcements/seen')
      .set('Authorization', auth(teacher.accessToken));
    expect(seenRes.status).toBe(200);
  });
});

describe('Announcements unread count — parent side', () => {
  async function setupParent(tenant) {
    const student = await createStudent(tenant.accessToken, tenant.classId);
    return createGuardian(tenant.accessToken, student.id);
  }

  it('counts announcements targeted at parents and clears after marking seen', async () => {
    const tenant = await setupTenant();
    const guardian = await setupParent(tenant);

    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'For parents', content: 'x', targetRole: 'parents' });

    const beforeRes = await request(app)
      .get('/api/v1/parent/announcements/unread-count')
      .set('Authorization', auth(guardian.accessToken));
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.data.count).toBe(1);

    await request(app).post('/api/v1/parent/announcements/seen').set('Authorization', auth(guardian.accessToken));

    const afterRes = await request(app)
      .get('/api/v1/parent/announcements/unread-count')
      .set('Authorization', auth(guardian.accessToken));
    expect(afterRes.body.data.count).toBe(0);
  });

  it('does not count an announcement targeted only at teachers', async () => {
    const tenant = await setupTenant();
    const guardian = await setupParent(tenant);

    await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', auth(tenant.accessToken))
      .send({ title: 'Staff meeting', content: 'x', targetRole: 'teachers' });

    const res = await request(app)
      .get('/api/v1/parent/announcements/unread-count')
      .set('Authorization', auth(guardian.accessToken));
    expect(res.body.data.count).toBe(0);
  });
});
