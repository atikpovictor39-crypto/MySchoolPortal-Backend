const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, uniqueEmail } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Auto-generated student admission numbers', () => {
  it('generates a sequential admission number when none is given', async () => {
    const tenant = await setupTenant();

    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, firstName: 'Ama', lastName: 'Owusu' });
    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, firstName: 'Kofi', lastName: 'Mensah' });

    expect(res1.status).toBe(201);
    expect(res1.body.data.admission_no).toBe('STU-0001');
    expect(res2.status).toBe(201);
    expect(res2.body.data.admission_no).toBe('STU-0002');
  });

  it('still honors an explicitly provided admission number', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, admissionNo: 'CUSTOM-99', firstName: 'Ama', lastName: 'Owusu' });

    expect(res.status).toBe(201);
    expect(res.body.data.admission_no).toBe('CUSTOM-99');
  });

  it('rejects a duplicate explicit admission number with a friendly message', async () => {
    const tenant = await setupTenant();
    await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, admissionNo: 'DUP-1', firstName: 'Ama', lastName: 'Owusu' });

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, admissionNo: 'DUP-1', firstName: 'Kofi', lastName: 'Mensah' });

    expect(res.status).toBe(409);
  });

  it('keeps numbering per school, not globally', async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();

    await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenantA.accessToken))
      .send({ classId: tenantA.classId, firstName: 'Ama', lastName: 'Owusu' });
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenantB.accessToken))
      .send({ classId: tenantB.classId, firstName: 'Kofi', lastName: 'Mensah' });

    expect(res.body.data.admission_no).toBe('STU-0001'); // tenantB starts fresh, unaffected by tenantA
  });

  it('does not reuse a deleted admission number that was not the highest one', async () => {
    const tenant = await setupTenant();
    await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, firstName: 'Ama', lastName: 'Owusu' }); // STU-0001
    const second = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, firstName: 'Kofi', lastName: 'Mensah' }); // STU-0002
    await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, firstName: 'Yaw', lastName: 'Boateng' }); // STU-0003

    // Deleting the middle one leaves a gap — the next number still comes
    // from the current highest (STU-0003), not from filling that gap.
    await db.query('DELETE FROM students WHERE id = ?', [second.body.data.id]);

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, firstName: 'Adjoa', lastName: 'Asante' });

    expect(res.body.data.admission_no).toBe('STU-0004');
  });
});

describe('Auto-generated teacher employee numbers', () => {
  it('generates a sequential employee number when none is given', async () => {
    const tenant = await setupTenant();

    const res1 = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher A', email: uniqueEmail('teacher-a'), password: 'teacherpass123' });
    const res2 = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher B', email: uniqueEmail('teacher-b'), password: 'teacherpass123' });

    expect(res1.status).toBe(201);
    expect(res1.body.data.employee_no).toBe('EMP-0001');
    expect(res2.status).toBe(201);
    expect(res2.body.data.employee_no).toBe('EMP-0002');
  });

  it('still honors an explicitly provided employee number', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher A', email: uniqueEmail('teacher'), password: 'teacherpass123', employeeNo: 'STAFF-7' });

    expect(res.status).toBe(201);
    expect(res.body.data.employee_no).toBe('STAFF-7');
  });

  it('rejects a duplicate explicit employee number with a friendly message', async () => {
    const tenant = await setupTenant();
    await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher A', email: uniqueEmail('teacher-a'), password: 'teacherpass123', employeeNo: 'DUP-1' });

    const res = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher B', email: uniqueEmail('teacher-b'), password: 'teacherpass123', employeeNo: 'DUP-1' });

    expect(res.status).toBe(409);
  });

  it('rejects updating a teacher to an employee number already used by someone else', async () => {
    const tenant = await setupTenant();
    await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher A', email: uniqueEmail('teacher-a'), password: 'teacherpass123', employeeNo: 'EMP-0001' });
    const teacherBRes = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher B', email: uniqueEmail('teacher-b'), password: 'teacherpass123' });

    const res = await request(app)
      .put(`/api/v1/teachers/${teacherBRes.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ employeeNo: 'EMP-0001' });

    expect(res.status).toBe(409);
  });
});
