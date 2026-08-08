const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

let school;
let student;
let invoiceId;

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
});

afterAll(async () => {
  await db.end();
});

describe('Recording payments', () => {
  it('a partial payment moves the invoice to partial, not paid', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/invoices/${invoiceId}/payments`)
      .set('Authorization', auth(school.accessToken))
      .send({ amountCents: 20000, paymentMethod: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('partial');
    expect(res.body.data.amount_paid_cents).toBe(20000);
  });

  it('rejects a payment that exceeds the remaining balance', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/invoices/${invoiceId}/payments`)
      .set('Authorization', auth(school.accessToken))
      .send({ amountCents: 999999, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
  });

  it('paying the full balance marks the invoice paid', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/invoices/${invoiceId}/payments`)
      .set('Authorization', auth(school.accessToken))
      .send({ amountCents: 50000, paymentMethod: 'bank_transfer' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('paid');
  });

  it('rejects any further payment once already paid', async () => {
    await request(app)
      .post(`/api/v1/fees/invoices/${invoiceId}/payments`)
      .set('Authorization', auth(school.accessToken))
      .send({ amountCents: 50000, paymentMethod: 'cash' });

    const res = await request(app)
      .post(`/api/v1/fees/invoices/${invoiceId}/payments`)
      .set('Authorization', auth(school.accessToken))
      .send({ amountCents: 1, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
  });
});

describe('Invoice generation idempotency', () => {
  it('re-generating invoices for the same structure does not double-bill', async () => {
    const structuresRes = await request(app)
      .get('/api/v1/fees/structures')
      .set('Authorization', auth(school.accessToken));
    const structureId = structuresRes.body.data[0].id;

    const res = await request(app)
      .post(`/api/v1/fees/structures/${structureId}/generate-invoices`)
      .set('Authorization', auth(school.accessToken));

    expect(res.body.data.invoicesCreated).toBe(0);
    expect(res.body.data.alreadyInvoiced).toBe(1);
  });
});
