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
    // Only school-scoped entries carry a school_name — platform-level ones
    // (a SuperAdmin logging in, see below) legitimately have none.
    expect(res.body.data.filter((log) => log.school_id).every((log) => log.school_name)).toBe(true);
    const actions = res.body.data.map((l) => l.action);
    expect(actions).toContain('student.created');
  });

  it('records a SuperAdmin login as a platform-level entry (no school)', async () => {
    const superadmin = await createSuperAdmin();

    const res = await request(app)
      .get('/api/v1/platform/audit-logs')
      .set('Authorization', auth(superadmin.accessToken));

    expect(res.status).toBe(200);
    const loginEntry = res.body.data.find((log) => log.action === 'superadmin.login');
    expect(loginEntry).toBeTruthy();
    expect(loginEntry.school_id).toBeNull();
    expect(loginEntry.school_name).toBeNull();
    expect(loginEntry.user_name).toBe('Platform Admin');
  });

  it('does not log a routine SCHOOL_ADMIN login', async () => {
    const superadmin = await createSuperAdmin(); // this itself logs in once, as SUPERADMIN
    const tenant = await setupTenant();

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: tenant.credentials.adminEmail, password: tenant.credentials.adminPassword });

    const res = await request(app)
      .get('/api/v1/platform/audit-logs')
      .set('Authorization', auth(superadmin.accessToken));

    expect(res.status).toBe(200);
    // Exactly one "Logged in" entry — the SuperAdmin's own from createSuperAdmin()
    // above — and none for the SCHOOL_ADMIN login that just happened.
    expect(res.body.data.filter((log) => log.description === 'Logged in').length).toBe(1);
  });

  it('records onboarding a new school and changing its status', async () => {
    const superadmin = await createSuperAdmin();

    const createRes = await request(app)
      .post('/api/v1/schools')
      .set('Authorization', auth(superadmin.accessToken))
      .send({
        name: 'Sunrise Academy',
        adminName: 'New Admin',
        adminEmail: `sunrise-${Date.now()}@example.com`,
        adminPassword: 'testpassword123',
      });
    expect(createRes.status).toBe(201);
    const schoolId = createRes.body.data.id;

    await request(app)
      .patch(`/api/v1/schools/${schoolId}/status`)
      .set('Authorization', auth(superadmin.accessToken))
      .send({ status: 'suspended' });

    const res = await request(app)
      .get(`/api/v1/platform/audit-logs?school_id=${schoolId}`)
      .set('Authorization', auth(superadmin.accessToken));

    expect(res.status).toBe(200);
    const actions = res.body.data.map((l) => l.action);
    expect(actions).toContain('school.created');
    expect(actions).toContain('school.status_changed');
    expect(res.body.data.every((log) => log.school_name === 'Sunrise Academy')).toBe(true);
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
