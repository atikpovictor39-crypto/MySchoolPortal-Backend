const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Editing and deleting a class', () => {
  it('updates a class', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .put(`/api/v1/classes/${tenant.classId}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Grade 6', section: 'B' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Grade 6');
    expect(res.body.data.section).toBe('B');
  });

  it('deletes an empty class', async () => {
    const tenant = await setupTenant();
    const res = await request(app).delete(`/api/v1/classes/${tenant.classId}`).set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/v1/classes').set('Authorization', auth(tenant.accessToken));
    expect(listRes.body.data.find((c) => c.id === tenant.classId)).toBeUndefined();
  });

  it('refuses to delete a class that still has students enrolled', async () => {
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId);

    const res = await request(app).delete(`/api/v1/classes/${tenant.classId}`).set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/students enrolled/i);
  });

  it('404s deleting a class that does not exist', async () => {
    const tenant = await setupTenant();
    const res = await request(app).delete('/api/v1/classes/999999').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(404);
  });

  it("cannot delete another school's class", async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    const res = await request(app).delete(`/api/v1/classes/${tenantB.classId}`).set('Authorization', auth(tenantA.accessToken));
    expect(res.status).toBe(404);
  });
});
