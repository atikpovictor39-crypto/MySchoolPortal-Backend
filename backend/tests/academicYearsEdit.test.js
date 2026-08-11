const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Editing and deleting an academic year', () => {
  it('updates an academic year', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .put(`/api/v1/academic-years/${tenant.academicYearId}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: '2027/2028' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('2027/2028');
  });

  it('refuses to delete an academic year that still has classes', async () => {
    const tenant = await setupTenant(); // setupTenant creates one class under this year
    const res = await request(app)
      .delete(`/api/v1/academic-years/${tenant.academicYearId}`)
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/classes under it/i);
  });

  it('deletes an academic year once its classes are gone', async () => {
    const tenant = await setupTenant();
    await request(app).delete(`/api/v1/classes/${tenant.classId}`).set('Authorization', auth(tenant.accessToken));

    const res = await request(app)
      .delete(`/api/v1/academic-years/${tenant.academicYearId}`)
      .set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);
  });

  it('404s deleting an academic year that does not exist', async () => {
    const tenant = await setupTenant();
    const res = await request(app).delete('/api/v1/academic-years/999999').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(404);
  });
});
