const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, registerSchool, createTeacher } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

async function getRawResetToken(userId) {
  // The endpoint only ever emails the raw token (never returns it), so
  // tests reach into the service layer directly to get one to work with —
  // same pattern as emailVerification.test.js's createVerificationCode.
  const authService = require('../src/modules/auth/auth.service');
  const [rows] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
  const result = await authService.createPasswordResetToken(rows[0].email);
  return result.rawToken;
}

describe('Forgot password', () => {
  it('responds the same way for a registered and an unregistered email (no enumeration)', async () => {
    const school = await registerSchool();

    const registered = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: school.credentials.adminEmail });
    const unregistered = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-here@example.com' });

    expect(registered.status).toBe(200);
    expect(unregistered.status).toBe(200);
    expect(registered.body.data.message).toBe(unregistered.body.data.message);
  });

  it('creates a reset token row for a registered email', async () => {
    const school = await registerSchool();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: school.credentials.adminEmail });

    const [rows] = await db.query('SELECT id FROM password_reset_tokens WHERE user_id = ?', [school.user.id]);
    expect(rows.length).toBe(1);
  });

  it('requires an email', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('Reset password', () => {
  it('resets the password with a valid token', async () => {
    const school = await registerSchool();
    const rawToken = await getRawResetToken(school.user.id);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'brandnewpass123' });
    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: 'brandnewpass123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'brandnewpass123' });
    expect(res.status).toBe(400);
  });

  it('rejects reusing an already-consumed token', async () => {
    const school = await registerSchool();
    const rawToken = await getRawResetToken(school.user.id);

    await request(app).post('/api/v1/auth/reset-password').send({ token: rawToken, newPassword: 'brandnewpass123' });
    const secondAttempt = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'anotherpass456' });
    expect(secondAttempt.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const school = await registerSchool();
    const rawToken = await getRawResetToken(school.user.id);
    await db.query("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = ?", [
      school.user.id,
    ]);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'brandnewpass123' });
    expect(res.status).toBe(400);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const school = await registerSchool();
    const rawToken = await getRawResetToken(school.user.id);

    const res = await request(app).post('/api/v1/auth/reset-password').send({ token: rawToken, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('clears must_change_password for a teacher who resets via email', async () => {
    const school = await registerSchool();
    const teacher = await createTeacher(school.accessToken);
    // createTeacher fixture clears must_change_password for convenience — set it back
    // to TRUE to simulate a real freshly-created teacher for this specific test.
    await db.query('UPDATE users SET must_change_password = TRUE WHERE id = ?', [teacher.user.id]);

    const rawToken = await getRawResetToken(teacher.user.id);
    await request(app).post('/api/v1/auth/reset-password').send({ token: rawToken, newPassword: 'brandnewpass123' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: teacher.user.email, password: 'brandnewpass123' });
    expect(login.body.data.user.must_change_password).toBe(false);
  });

  it('revokes existing refresh tokens on reset', async () => {
    const school = await registerSchool();
    const [before] = await db.query(
      'SELECT id FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL',
      [school.user.id]
    );
    expect(before.length).toBeGreaterThan(0);

    const rawToken = await getRawResetToken(school.user.id);
    await request(app).post('/api/v1/auth/reset-password').send({ token: rawToken, newPassword: 'brandnewpass123' });

    const [after] = await db.query(
      'SELECT id FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL',
      [school.user.id]
    );
    expect(after.length).toBe(0);
  });
});
