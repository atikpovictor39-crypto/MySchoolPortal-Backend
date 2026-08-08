const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, login } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

describe('School payment details (Mobile Money + bank)', () => {
  let school;

  beforeEach(async () => {
    await resetDatabase();
    school = await setupTenant();
  });

  it('starts out empty for a freshly onboarded school', async () => {
    const res = await request(app)
      .get('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      momo_provider: null,
      momo_number: null,
      momo_account_name: null,
      bank_name: null,
      bank_account_number: null,
      bank_account_name: null,
    });
  });

  it('lets the SchoolAdmin set and then read back the payment details', async () => {
    const payload = {
      momoProvider: 'MTN',
      momoNumber: '0244000000',
      momoAccountName: 'Test School Ltd',
      bankName: 'GCB Bank',
      bankAccountNumber: '1234567890',
      bankAccountName: 'Test School Ltd',
    };

    const putRes = await request(app)
      .put('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(school.accessToken))
      .send(payload);
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.momo_number).toBe('0244000000');
    expect(putRes.body.data.bank_name).toBe('GCB Bank');

    const getRes = await request(app)
      .get('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(school.accessToken));
    expect(getRes.body.data).toMatchObject({
      momo_provider: 'MTN',
      momo_number: '0244000000',
      bank_account_name: 'Test School Ltd',
    });
  });

  it('rejects a field that is too long instead of silently truncating it', async () => {
    const res = await request(app)
      .put('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(school.accessToken))
      .send({ bankName: 'x'.repeat(200) });

    expect(res.status).toBe(400);
  });

  it('keeps each school\'s payment details isolated from every other school', async () => {
    await request(app)
      .put('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(school.accessToken))
      .send({ momoNumber: '0244000000' });

    const otherSchool = await setupTenant({ schoolName: 'Other School' });
    const res = await request(app)
      .get('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(otherSchool.accessToken));

    expect(res.body.data.momo_number).toBeNull();
  });

  it('blocks non-SchoolAdmin roles from the settings endpoint', async () => {
    const ownChild = await createStudent(school.accessToken, school.classId, { firstName: 'Amara' });
    await request(app)
      .post(`/api/v1/students/${ownChild.id}/guardians`)
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Test Parent', email: 'payparent@example.com', password: 'parentpass123', relationship: 'Mother' });
    const { accessToken: parentToken } = await login('payparent@example.com', 'parentpass123');

    const res = await request(app)
      .get('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(parentToken));
    expect(res.status).toBe(403);
  });

  it('lets a parent read (but the route offers no way to write) the school payment details', async () => {
    await request(app)
      .put('/api/v1/schools/me/payment-details')
      .set('Authorization', auth(school.accessToken))
      .send({ momoProvider: 'Vodafone Cash', momoNumber: '0201234567' });

    const ownChild = await createStudent(school.accessToken, school.classId, { firstName: 'Kwame' });
    await request(app)
      .post(`/api/v1/students/${ownChild.id}/guardians`)
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Parent Two', email: 'payparent2@example.com', password: 'parentpass123', relationship: 'Father' });
    const { accessToken: parentToken } = await login('payparent2@example.com', 'parentpass123');

    const res = await request(app)
      .get('/api/v1/parent/payment-details')
      .set('Authorization', auth(parentToken));
    expect(res.status).toBe(200);
    expect(res.body.data.momo_provider).toBe('Vodafone Cash');
    expect(res.body.data.momo_number).toBe('0201234567');
  });
});
