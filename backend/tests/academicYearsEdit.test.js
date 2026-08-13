const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

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

describe('Academic years with stats', () => {
  it('reports class and active-student counts per year', async () => {
    const tenant = await setupTenant(); // one class already exists under this year
    await createStudent(tenant.accessToken, tenant.classId);
    await createStudent(tenant.accessToken, tenant.classId);

    const otherClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(tenant.accessToken))
      .send({ academicYearId: tenant.academicYearId, name: 'Grade 6' });
    await createStudent(tenant.accessToken, otherClassRes.body.data.id);

    const res = await request(app)
      .get('/api/v1/academic-years?withStats=true')
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    const row = res.body.data.find((y) => y.id === tenant.academicYearId);
    expect(row.class_count).toBe(2);
    expect(row.student_count).toBe(3);
  });

  it('reports zero counts for a year with no classes yet', async () => {
    const tenant = await setupTenant();
    const newYearRes = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: '2030/2031', startDate: '2030-09-01', endDate: '2031-07-31' });

    const res = await request(app)
      .get('/api/v1/academic-years?withStats=true')
      .set('Authorization', auth(tenant.accessToken));

    const row = res.body.data.find((y) => y.id === newYearRes.body.data.id);
    expect(row.class_count).toBe(0);
    expect(row.student_count).toBe(0);
  });

  it('the plain (non-stats) list is unaffected — still the lightweight shape', async () => {
    const tenant = await setupTenant();
    const res = await request(app).get('/api/v1/academic-years').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('class_count');
  });

  it('lets an admin set a different year as current, unsetting the old one', async () => {
    const tenant = await setupTenant(); // its academic year is created with isCurrent: true
    const newYearRes = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: '2030/2031', startDate: '2030-09-01', endDate: '2031-07-31' });

    await request(app)
      .put(`/api/v1/academic-years/${newYearRes.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ isCurrent: true });

    const res = await request(app)
      .get('/api/v1/academic-years?withStats=true')
      .set('Authorization', auth(tenant.accessToken));
    const oldYear = res.body.data.find((y) => y.id === tenant.academicYearId);
    const newYear = res.body.data.find((y) => y.id === newYearRes.body.data.id);
    expect(oldYear.is_current).toBe(false);
    expect(newYear.is_current).toBe(true);
  });
});
