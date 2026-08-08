const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, uniqueEmail, registerSchool, login } = require('./helpers/fixtures');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.end();
});

describe('POST /auth/register', () => {
  it('creates a school + admin and returns a usable token', async () => {
    const email = uniqueEmail('admin');
    const res = await request(app).post('/api/v1/auth/register').send({
      schoolName: 'Brand New School',
      adminName: 'New Admin',
      adminEmail: email,
      adminPassword: 'testpassword123',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user).toMatchObject({ role: 'SCHOOL_ADMIN', email });
    expect(res.body.data.user.school_id).toBeTruthy();
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail('admin');
    await registerSchool({ adminEmail: email });

    const res = await request(app).post('/api/v1/auth/register').send({
      schoolName: 'Another School',
      adminName: 'Someone Else',
      adminEmail: email,
      adminPassword: 'testpassword123',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      schoolName: 'Short Pass School',
      adminName: 'Admin',
      adminEmail: uniqueEmail('admin'),
      adminPassword: 'short',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { credentials } = await registerSchool();
    const { accessToken, user } = await login(credentials.adminEmail, credentials.adminPassword);

    expect(accessToken).toBeTruthy();
    expect(user.email).toBe(credentials.adminEmail);
  });

  it('rejects the wrong password', async () => {
    const { credentials } = await registerSchool();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.adminEmail, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects a nonexistent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
  });
});

describe('Authenticated route protection', () => {
  it('rejects a protected route with no token', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed/garbage token', async () => {
    const res = await request(app).get('/api/v1/students').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
