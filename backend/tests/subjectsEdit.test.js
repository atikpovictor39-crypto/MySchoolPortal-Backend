const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createTeacher } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

async function createSubject(token, overrides = {}) {
  const res = await request(app)
    .post('/api/v1/subjects')
    .set('Authorization', auth(token))
    .send({ name: overrides.name || 'Mathematics', code: overrides.code || 'MTH' });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Editing and deleting a subject', () => {
  it('updates a subject', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);

    const res = await request(app)
      .put(`/api/v1/subjects/${subject.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Further Mathematics', code: 'FMTH' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Further Mathematics');
  });

  it('deletes an unassigned subject', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);

    const res = await request(app).delete(`/api/v1/subjects/${subject.id}`).set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);
  });

  it('refuses to delete a subject that is assigned to a class', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);
    // No API to create a class_subjects assignment yet — inserted directly
    // to exercise the pre-delete check itself.
    await db.query('INSERT INTO class_subjects (school_id, class_id, subject_id) VALUES (?, ?, ?)', [
      tenant.user.school_id,
      tenant.classId,
      subject.id,
    ]);

    const res = await request(app).delete(`/api/v1/subjects/${subject.id}`).set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/assigned to one or more classes/i);
  });

  it('404s deleting a subject that does not exist', async () => {
    const tenant = await setupTenant();
    const res = await request(app).delete('/api/v1/subjects/999999').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(404);
  });
});

describe('Teacher access to the subject list', () => {
  it('lets a TEACHER add, edit, and delete a subject', async () => {
    const tenant = await setupTenant();
    const teacherLogin = await createTeacher(tenant.accessToken);

    const createRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ name: 'Physical Education', code: 'PE' });
    expect(createRes.status).toBe(201);
    const subject = createRes.body.data;

    const updateRes = await request(app)
      .put(`/api/v1/subjects/${subject.id}`)
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ name: 'Physical Education & Sports', code: 'PES' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Physical Education & Sports');

    const deleteRes = await request(app)
      .delete(`/api/v1/subjects/${subject.id}`)
      .set('Authorization', auth(teacherLogin.accessToken));
    expect(deleteRes.status).toBe(200);
  });
});
