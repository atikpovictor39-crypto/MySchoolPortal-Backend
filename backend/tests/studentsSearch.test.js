const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

async function createClass(token, academicYearId, overrides = {}) {
  const res = await request(app)
    .post('/api/v1/classes')
    .set('Authorization', auth(token))
    .send({ academicYearId, name: overrides.name || 'Grade 6', section: overrides.section });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Searching and filtering students', () => {
  it('finds a student by first name, case-insensitively', async () => {
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Kwame', lastName: 'Mensah' });
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Ama', lastName: 'Owusu' });

    const res = await request(app)
      .get('/api/v1/students?search=kwame')
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].first_name).toBe('Kwame');
  });

  it('finds a student by admission number', async () => {
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId, { admissionNo: 'ADM-7788' });
    await createStudent(tenant.accessToken, tenant.classId, { admissionNo: 'ADM-1000' });

    const res = await request(app)
      .get('/api/v1/students?search=7788')
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].admission_no).toBe('ADM-7788');
  });

  it('filters by class', async () => {
    const tenant = await setupTenant();
    const otherClass = await createClass(tenant.accessToken, tenant.academicYearId, { name: 'Grade 7' });
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'InFirstClass' });
    await createStudent(tenant.accessToken, otherClass.id, { firstName: 'InOtherClass' });

    const res = await request(app)
      .get(`/api/v1/students?classId=${otherClass.id}`)
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].first_name).toBe('InOtherClass');
  });

  it('combines class filter and search', async () => {
    const tenant = await setupTenant();
    const otherClass = await createClass(tenant.accessToken, tenant.academicYearId, { name: 'Grade 7' });
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Kwame' });
    await createStudent(tenant.accessToken, otherClass.id, { firstName: 'Kwame' });

    const res = await request(app)
      .get(`/api/v1/students?classId=${tenant.classId}&search=kwame`)
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].class_id).toBe(tenant.classId);
  });

  it("does not leak another school's students into a search", async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    await createStudent(tenantB.accessToken, tenantB.classId, { firstName: 'Kwame' });

    const res = await request(app)
      .get('/api/v1/students?search=kwame')
      .set('Authorization', auth(tenantA.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(0);
  });
});
