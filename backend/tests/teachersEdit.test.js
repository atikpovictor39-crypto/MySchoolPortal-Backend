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
