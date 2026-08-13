const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createTeacher, uniqueEmail } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Editing and deleting a teacher', () => {
  it('updates a teacher\'s name, email and employee number', async () => {
    const tenant = await setupTenant();
    const teacherRes = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Original Name', email: uniqueEmail('teacher'), password: 'teacherpass123' });
    const teacherId = teacherRes.body.data.id;

    const newEmail = uniqueEmail('updated-teacher');
    const res = await request(app)
      .put(`/api/v1/teachers/${teacherId}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Updated Name', email: newEmail, employeeNo: 'EMP-42' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
    expect(res.body.data.email).toBe(newEmail);
    expect(res.body.data.employee_no).toBe('EMP-42');
  });

  it('rejects updating to an email already used by someone else', async () => {
    const tenant = await setupTenant();
    const emailA = uniqueEmail('teacher-a');
    await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher A', email: emailA, password: 'teacherpass123' });
    const teacherBRes = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Teacher B', email: uniqueEmail('teacher-b'), password: 'teacherpass123' });

    const res = await request(app)
      .put(`/api/v1/teachers/${teacherBRes.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ email: emailA });

    expect(res.status).toBe(409);
  });

  it('404s updating a teacher that does not exist', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .put('/api/v1/teachers/999999')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Nobody' });
    expect(res.status).toBe(404);
  });

  it('deletes a teacher', async () => {
    const tenant = await setupTenant();
    const teacherRes = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'To Delete', email: uniqueEmail('delete-me'), password: 'teacherpass123' });
    const teacherId = teacherRes.body.data.id;

    const res = await request(app).delete(`/api/v1/teachers/${teacherId}`).set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(tenant.accessToken));
    expect(listRes.body.data.find((t) => t.id === teacherId)).toBeUndefined();
  });

  it('unassigns a deleted teacher as class teacher instead of failing', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    const teacherId = (await db.query('SELECT id FROM teachers WHERE user_id = ?', [teacher.user.id]))[0][0].id;

    await request(app)
      .put(`/api/v1/classes/${tenant.classId}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ classTeacherId: teacherId });

    const res = await request(app).delete(`/api/v1/teachers/${teacherId}`).set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);

    const classRes = await request(app)
      .get(`/api/v1/classes/${tenant.classId}`)
      .set('Authorization', auth(tenant.accessToken));
    expect(classRes.body.data.class_teacher_id).toBeNull();
  });
});

describe('Searching teachers', () => {
  it('matches by name, email, or employee number, case-insensitively', async () => {
    const tenant = await setupTenant();
    const amaEmail = uniqueEmail('ama.boateng');
    await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Ama Boateng', email: amaEmail, password: 'teacherpass123', employeeNo: 'EMP-0100' });
    await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Kwame Mensah', email: uniqueEmail('kwame'), password: 'teacherpass123' });

    const byName = await request(app)
      .get('/api/v1/teachers?search=ama')
      .set('Authorization', auth(tenant.accessToken));
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].name).toBe('Ama Boateng');

    const byEmail = await request(app)
      .get(`/api/v1/teachers?search=${encodeURIComponent(amaEmail.toUpperCase())}`)
      .set('Authorization', auth(tenant.accessToken));
    expect(byEmail.body.data).toHaveLength(1);

    const byEmployeeNo = await request(app)
      .get('/api/v1/teachers?search=EMP-0100')
      .set('Authorization', auth(tenant.accessToken));
    expect(byEmployeeNo.body.data).toHaveLength(1);
    expect(byEmployeeNo.body.data[0].name).toBe('Ama Boateng');
  });

  it('returns everyone when no search is given, and nobody for a non-match', async () => {
    const tenant = await setupTenant();
    await createTeacher(tenant.accessToken, { name: 'Someone' });

    const noSearch = await request(app).get('/api/v1/teachers').set('Authorization', auth(tenant.accessToken));
    expect(noSearch.body.data).toHaveLength(1);

    const noMatch = await request(app)
      .get('/api/v1/teachers?search=nobody-with-this-name')
      .set('Authorization', auth(tenant.accessToken));
    expect(noMatch.body.data).toHaveLength(0);
  });

  it("only searches within the requesting school's own teachers", async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant({ adminEmail: uniqueEmail('other-admin') });
    await createTeacher(tenantA.accessToken, { name: 'Shared Name Teacher' });
    await createTeacher(tenantB.accessToken, { name: 'Shared Name Teacher' });

    const res = await request(app)
      .get('/api/v1/teachers?search=Shared Name')
      .set('Authorization', auth(tenantA.accessToken));
    expect(res.body.data).toHaveLength(1);
  });
});
