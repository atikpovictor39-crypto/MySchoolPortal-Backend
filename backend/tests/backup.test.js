const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, createSuperAdmin, setupTenant, createStudent } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Platform backup', () => {
  it('downloads a JSON backup containing schools and their data', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Backup', lastName: 'Test' });

    const res = await request(app).get('/api/v1/platform/backup').set('Authorization', auth(superadmin.accessToken));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="myschoolportal-backup-.*\.json"/);

    const body = JSON.parse(res.text);
    expect(body.generated_at).toBeTruthy();
    expect(body.tables.schools.some((s) => s.id === tenant.user.school_id)).toBe(true);
    expect(body.tables.students.some((s) => s.first_name === 'Backup')).toBe(true);
    expect(body.tables.users.every((u) => !('password_hash' in u))).toBe(true);
  });

  it('blocks a SCHOOL_ADMIN from the backup endpoint', async () => {
    const tenant = await setupTenant();
    const res = await request(app).get('/api/v1/platform/backup').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(403);
  });
});
