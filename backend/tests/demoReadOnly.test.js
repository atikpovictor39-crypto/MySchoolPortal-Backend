const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, registerSchool, login } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

async function markSchoolDemo(schoolId) {
  await db.query('UPDATE schools SET is_demo = TRUE WHERE id = ?', [schoolId]);
}

describe('Demo school read-only enforcement', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('blocks a mutating request from a demo school admin', async () => {
    const school = await registerSchool();
    await markSchoolDemo(school.user.school_id);
    // The original token was issued before is_demo flipped to TRUE — log in
    // again so the fresh access token actually carries is_demo: true.
    const relogged = await login(school.credentials.adminEmail, school.credentials.adminPassword);

    const res = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', auth(relogged.accessToken))
      .send({ name: '2025/2026', startDate: '2025-09-01', endDate: '2026-07-31', isCurrent: true });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/read-only demo/i);
  });

  it('still allows GET requests for a demo school admin', async () => {
    const school = await registerSchool();
    await markSchoolDemo(school.user.school_id);
    const relogged = await login(school.credentials.adminEmail, school.credentials.adminPassword);

    const res = await request(app).get('/api/v1/academic-years').set('Authorization', auth(relogged.accessToken));

    expect(res.status).toBe(200);
  });

  it('allows a non-demo school admin to write normally', async () => {
    const school = await registerSchool();

    const res = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', auth(school.accessToken))
      .send({ name: '2025/2026', startDate: '2025-09-01', endDate: '2026-07-31', isCurrent: true });

    expect(res.status).toBe(201);
  });
});
