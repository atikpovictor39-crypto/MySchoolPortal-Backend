const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, createGuardian } = require('./helpers/fixtures');

let school;
let student;
let invoiceId;
let parentToken;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  student = await createStudent(school.accessToken, school.classId);

  const structureRes = await request(app)
    .post('/api/v1/fees/structures')
    .set('Authorization', auth(school.accessToken))
    .send({ academicYearId: school.academicYearId, name: 'Term 1 Tuition', amountCents: 50000 });

  await request(app)
    .post(`/api/v1/fees/structures/${structureRes.body.data.id}/generate-invoices`)
    .set('Authorization', auth(school.accessToken));

  const invoicesRes = await request(app)
    .get('/api/v1/fees/invoices')
    .set('Authorization', auth(school.accessToken));
  invoiceId = invoicesRes.body.data[0].id;

  ({ accessToken: parentToken } = await createGuardian(school.accessToken, student.id, {
    name: 'Victor Parent',
    email: 'claimparent@example.com',
    password: 'parentpass123',
    relationship: 'Father',
  }));
});

afterAll(async () => {
  await db.end();
});

describe('Parent submits a payment claim', () => {
  it('lets a parent claim a payment against their own child\'s invoice', async () => {
    const res = await request(app)
      .post(`/api/v1/parent/children/${student.id}/fees/${invoiceId}/claims`)
      .set('Authorization', auth(parentToken))
      .send({ amountCents: 50000, paymentMethod: 'mobile_money', paidAt: '2026-08-08', reference: 'MP240808.1234' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.amount_cents).toBe(50000);
    expect(res.body.data.parent_name).toBe('Victor Parent');
  });

  it('is blocked from claiming a payment on a child that is not theirs', async () => {
    const otherChild = await createStudent(school.accessToken, school.classId, { firstName: 'NotMine' });
    const res = await request(app)
      .post(`/api/v1/parent/children/${otherChild.id}/fees/${invoiceId}/claims`)
      .set('Authorization', auth(parentToken))
      .send({ amountCents: 50000, paymentMethod: 'mobile_money', paidAt: '2026-08-08' });

    expect(res.status).toBe(403);
  });

  it('rejects a claimed amount larger than the remaining balance', async () => {
    const res = await request(app)
      .post(`/api/v1/parent/children/${student.id}/fees/${invoiceId}/claims`)
      .set('Authorization', auth(parentToken))
      .send({ amountCents: 999999, paymentMethod: 'mobile_money', paidAt: '2026-08-08' });

    expect(res.status).toBe(400);
  });

  it('rejects a payment method outside mobile_money/bank_transfer', async () => {
    const res = await request(app)
      .post(`/api/v1/parent/children/${student.id}/fees/${invoiceId}/claims`)
      .set('Authorization', auth(parentToken))
      .send({ amountCents: 50000, paymentMethod: 'cash', paidAt: '2026-08-08' });

    expect(res.status).toBe(400);
  });

  it('surfaces the pending claim status on the parent fees list', async () => {
    await request(app)
      .post(`/api/v1/parent/children/${student.id}/fees/${invoiceId}/claims`)
      .set('Authorization', auth(parentToken))
      .send({ amountCents: 50000, paymentMethod: 'mobile_money', paidAt: '2026-08-08' });

    const res = await request(app)
      .get(`/api/v1/parent/children/${student.id}/fees`)
      .set('Authorization', auth(parentToken));

    expect(res.body.data[0].latest_claim_status).toBe('pending');
  });
});

describe('Admin reviews payment claims', () => {
  let claimId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`/api/v1/parent/children/${student.id}/fees/${invoiceId}/claims`)
      .set('Authorization', auth(parentToken))
      .send({ amountCents: 50000, paymentMethod: 'mobile_money', paidAt: '2026-08-08', reference: 'MP240808.1234' });
    claimId = res.body.data.id;
  });

  it('lists pending claims for the school', async () => {
    const res = await request(app)
      .get('/api/v1/fees/claims?status=pending')
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(claimId);
  });

  it('confirming a claim records the payment and marks the invoice paid', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/claims/${claimId}/confirm`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');

    const invoiceRes = await request(app)
      .get(`/api/v1/fees/invoices/${invoiceId}`)
      .set('Authorization', auth(school.accessToken));
    expect(invoiceRes.body.data.status).toBe('paid');
    expect(invoiceRes.body.data.amount_paid_cents).toBe(50000);
  });

  it('rejecting a claim leaves the invoice untouched', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/claims/${claimId}/reject`)
      .set('Authorization', auth(school.accessToken))
      .send({ reason: 'No matching transfer found' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');

    const invoiceRes = await request(app)
      .get(`/api/v1/fees/invoices/${invoiceId}`)
      .set('Authorization', auth(school.accessToken));
    expect(invoiceRes.body.data.status).toBe('unpaid');
  });

  it('cannot confirm the same claim twice', async () => {
    await request(app)
      .post(`/api/v1/fees/claims/${claimId}/confirm`)
      .set('Authorization', auth(school.accessToken));

    const res = await request(app)
      .post(`/api/v1/fees/claims/${claimId}/confirm`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(400);
  });

  it('blocks a parent from reviewing claims (admin-only endpoint)', async () => {
    const res = await request(app)
      .get('/api/v1/fees/claims')
      .set('Authorization', auth(parentToken));

    expect(res.status).toBe(403);
  });

  it('keeps claims isolated between schools', async () => {
    const otherSchool = await setupTenant({ schoolName: 'Other School' });
    const res = await request(app)
      .get('/api/v1/fees/claims')
      .set('Authorization', auth(otherSchool.accessToken));

    expect(res.body.data).toHaveLength(0);
  });
});
