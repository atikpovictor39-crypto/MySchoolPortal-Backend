const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, login } = require('./helpers/fixtures');

let school;
let ownChild;
let otherChild;
let parentEmail;
let parentPassword;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  ownChild = await createStudent(school.accessToken, school.classId, { firstName: 'Amara' });
  otherChild = await createStudent(school.accessToken, school.classId, { firstName: 'Ben' });

  parentEmail = 'parent-test@example.com';
  parentPassword = 'parentpass123';
  await request(app)
    .post(`/api/v1/students/${ownChild.id}/guardians`)
    .set('Authorization', auth(school.accessToken))
    .send({ name: 'Test Parent', email: parentEmail, password: parentPassword, relationship: 'Mother' });
});

afterAll(async () => {
  await db.end();
});

describe('Parent ownership boundary', () => {
  it('sees exactly their own linked child, nothing else', async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app).get('/api/v1/parent/children').set('Authorization', auth(accessToken));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(ownChild.id);
  });

  it('is blocked from a child that is not theirs, even by ID', async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app)
      .get(`/api/v1/parent/children/${otherChild.id}/fees`)
      .set('Authorization', auth(accessToken));

    expect(res.status).toBe(403);
  });

  it('can read fees for its own child', async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app)
      .get(`/api/v1/parent/children/${ownChild.id}/fees`)
      .set('Authorization', auth(accessToken));

    expect(res.status).toBe(200);
  });

  it('is blocked from staff-only endpoints entirely', async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app).get('/api/v1/students').set('Authorization', auth(accessToken));

    expect(res.status).toBe(403);
  });
});
