const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, createSuperAdmin, setupTenant } = require('./helpers/fixtures');

afterAll(async () => {
  // platform_settings is a global singleton, not touched by resetDatabase() —
  // leaving maintenance mode on here would break every test file that runs
  // after this one in the same `--runInBand` suite.
  await db.query('UPDATE platform_settings SET maintenance_mode = FALSE, maintenance_message = NULL WHERE id = 1');
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
  await db.query('UPDATE platform_settings SET maintenance_mode = FALSE, maintenance_message = NULL WHERE id = 1');
});

describe('Maintenance mode', () => {
  it('status is public and reports off by default', async () => {
    const res = await request(app).get('/api/v1/platform/status');
    expect(res.status).toBe(200);
    expect(res.body.data.maintenanceMode).toBe(false);
  });

  it('a SuperAdmin can turn it on with a custom message', async () => {
    const superadmin = await createSuperAdmin();
    const res = await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ enabled: true, message: 'Back in an hour.' });

    expect(res.status).toBe(200);
    expect(res.body.data.maintenanceMode).toBe(true);

    const statusRes = await request(app).get('/api/v1/platform/status');
    expect(statusRes.body.data.maintenanceMode).toBe(true);
    expect(statusRes.body.data.message).toBe('Back in an hour.');
  });

  it('blocks a SCHOOL_ADMIN from tenant routes while it is on', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ enabled: true });

    const res = await request(app).get('/api/v1/students').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('MAINTENANCE_MODE');
  });

  it('still lets a SuperAdmin use platform/superadmin routes while it is on', async () => {
    const superadmin = await createSuperAdmin();
    await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ enabled: true });

    const res = await request(app).get('/api/v1/superadmins').set('Authorization', auth(superadmin.accessToken));
    expect(res.status).toBe(200);
  });

  it('login still works for everyone while maintenance mode is on', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ enabled: true });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: tenant.credentials.adminEmail, password: tenant.credentials.adminPassword });
    expect(res.status).toBe(200);
  });

  it('turning it back off restores access', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ enabled: true });
    await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ enabled: false });

    const res = await request(app).get('/api/v1/students').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);
  });

  it('blocks a SCHOOL_ADMIN from toggling maintenance mode', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .patch('/api/v1/platform/maintenance')
      .set('Authorization', auth(tenant.accessToken))
      .send({ enabled: true });
    expect(res.status).toBe(403);
  });
});
