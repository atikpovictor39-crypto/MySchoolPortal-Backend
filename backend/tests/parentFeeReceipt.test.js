const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, login } = require('./helpers/fixtures');

let school;
let ownChild;
let otherChild;
let ownInvoiceId;
let otherInvoiceId;
let parentEmail;
let parentPassword;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  ownChild = await createStudent(school.accessToken, school.classId, { firstName: 'Amara' });
  otherChild = await createStudent(school.accessToken, school.classId, { firstName: 'Ben' });

  parentEmail = 'parent-receipt@example.com';
  parentPassword = 'parentpass123';
  await request(app)
    .post(`/api/v1/students/${ownChild.id}/guardians`)
    .set('Authorization', auth(school.accessToken))
    .send({ name: 'Test Parent', email: parentEmail, password: parentPassword, relationship: 'Mother' });
  await db.query('UPDATE users SET must_change_password = FALSE WHERE email = ?', [parentEmail]);

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
  ownInvoiceId = invoicesRes.body.data.find((inv) => inv.student_id === ownChild.id).id;
  otherInvoiceId = invoicesRes.body.data.find((inv) => inv.student_id === otherChild.id).id;

  await request(app)
    .post(`/api/v1/fees/invoices/${ownInvoiceId}/payments`)
    .set('Authorization', auth(school.accessToken))
    .send({ amountCents: 20000, paymentMethod: 'cash', paymentRef: 'REC-1' });
});

afterAll(async () => {
  await db.end();
});

describe('Parent fee receipt drill-down', () => {
  it("returns the invoice with its payments for the parent's own child", async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app)
      .get(`/api/v1/parent/children/${ownChild.id}/fees/${ownInvoiceId}`)
      .set('Authorization', auth(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Amara');
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0].amount_cents).toBe(20000);
    expect(res.body.data.payments[0].payment_ref).toBe('REC-1');
  });

  it('is blocked entirely from a child that is not theirs', async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app)
      .get(`/api/v1/parent/children/${otherChild.id}/fees/${otherInvoiceId}`)
      .set('Authorization', auth(accessToken));

    expect(res.status).toBe(403);
  });

  it("404s when the invoiceId doesn't belong to the studentId in the URL, even for their own child", async () => {
    const { accessToken } = await login(parentEmail, parentPassword);
    const res = await request(app)
      .get(`/api/v1/parent/children/${ownChild.id}/fees/${otherInvoiceId}`)
      .set('Authorization', auth(accessToken));

    expect(res.status).toBe(404);
  });
});
