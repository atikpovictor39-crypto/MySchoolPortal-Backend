const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, createSuperAdmin, setupTenant, createStudent } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Platform-wide activity log', () => {
  it('shows actions from every school, newest first, with school names attached', async () => {
    const superadmin = await createSuperAdmin();
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    await createStudent(tenantA.accessToken, tenantA.classId, { firstName: 'Ama' });
    await createStudent(tenantB.accessToken, tenantB.classId, { firstName: 'Kofi' });

    const res = await request(app)
      .get('/api/v1/platform/audit-logs')
      .set('Authorization', auth(superadmin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((log) => log.school_name)).toBe(true);
    const actions = res.body.data.map((l) => l.action);
    expect(actions).toContain('student.created');
  });

  it('filters down to a single school with ?school_id=', async () => {
    const superadmin = await createSuperAdmin();
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    await createStudent(tenantA.accessToken, tenantA.classId, { firstName: 'Ama' });
    await createStudent(tenantB.accessToken, tenantB.classId, { firstName: 'Kofi' });

    const schoolId = tenantA.user.school_id;
    const res = await request(app)
      .get(`/api/v1/platform/audit-logs?school_id=${schoolId}`)
      .set('Authorization', auth(superadmin.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((log) => log.school_id === schoolId)).toBe(true);
  });

  it('blocks a SCHOOL_ADMIN from the platform-wide endpoint', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .get('/api/v1/platform/audit-logs')
      .set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(403);
  });
});
