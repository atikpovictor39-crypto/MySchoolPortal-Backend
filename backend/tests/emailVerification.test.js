const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, registerSchool } = require('./helpers/fixtures');
const authService = require('../src/modules/auth/auth.service');

afterAll(async () => {
  await db.end();
});

describe('Email verification', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('marks a fresh signup as unverified', async () => {
    const school = await registerSchool();
    expect(school.user.email_verified).toBe(false);
  });

  it('creates a verification code row on signup', async () => {
    const school = await registerSchool();
    const [rows] = await db.query('SELECT id FROM email_verification_codes WHERE user_id = ?', [school.user.id]);
    expect(rows.length).toBe(1);
  });

  it('verifies with the correct code', async () => {
    const school = await registerSchool();
    const code = await authService.createVerificationCode(school.user.id);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', auth(school.accessToken))
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email_verified).toBe(true);
  });

  it('rejects an incorrect code and counts the attempt', async () => {
    const school = await registerSchool();
    await authService.createVerificationCode(school.user.id);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', auth(school.accessToken))
      .send({ code: '000000' });

    expect(res.status).toBe(400);
    const [rows] = await db.query(
      'SELECT attempts FROM email_verification_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [school.user.id]
    );
    expect(rows[0].attempts).toBe(1);
  });

  it('locks out after too many incorrect attempts, even with the right code', async () => {
    const school = await registerSchool();
    const code = await authService.createVerificationCode(school.user.id);

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', auth(school.accessToken))
        .send({ code: '000000' });
    }

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', auth(school.accessToken))
      .send({ code });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too many/i);
  });

  it('rejects an expired code', async () => {
    const school = await registerSchool();
    const code = await authService.createVerificationCode(school.user.id);
    await db.query("UPDATE email_verification_codes SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = ?", [
      school.user.id,
    ]);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', auth(school.accessToken))
      .send({ code });

    expect(res.status).toBe(400);
  });

  it('a newer code supersedes an older one', async () => {
    const school = await registerSchool();
    const oldCode = await authService.createVerificationCode(school.user.id);
    await authService.createVerificationCode(school.user.id);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', auth(school.accessToken))
      .send({ code: oldCode });

    expect(res.status).toBe(400);
  });

  it('resend issues a new code that works', async () => {
    const school = await registerSchool();
    // registerSchool() already sent a code at signup — age it past the
    // cooldown so this test is checking resend itself, not the cooldown.
    await db.query(
      "UPDATE email_verification_codes SET created_at = NOW() - INTERVAL '2 minutes' WHERE user_id = ?",
      [school.user.id]
    );

    const resendRes = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', auth(school.accessToken))
      .send({});
    expect(resendRes.status).toBe(200);

    const [rows] = await db.query(
      'SELECT id FROM email_verification_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [school.user.id]
    );
    expect(rows.length).toBe(1);
  });

  it('blocks a second resend within the cooldown window', async () => {
    const school = await registerSchool();

    await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', auth(school.accessToken))
      .send({});

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', auth(school.accessToken))
      .send({});

    expect(res.status).toBe(429);
  });

  it('short-circuits as already verified once verified', async () => {
    const school = await registerSchool();
    const code = await authService.createVerificationCode(school.user.id);
    await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', auth(school.accessToken))
      .send({ code });

    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', auth(school.accessToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.alreadyVerified).toBe(true);
  });

  it('rejects verify-email without auth', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email').send({ code: '123456' });
    expect(res.status).toBe(401);
  });
});
