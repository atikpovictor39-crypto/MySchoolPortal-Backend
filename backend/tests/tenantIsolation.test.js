// This is the core promise of the whole app: School A can never see or
// touch School B's data, no matter what. Every table is filtered by
// school_id — these tests exercise that guarantee across the modules most
// likely to leak (students, fees) if that discipline ever slips.
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

let schoolA;
let schoolB;
let studentA;

beforeEach(async () => {
  await resetDatabase();
  schoolA = await setupTenant({ schoolName: 'Happy Home School' });
  schoolB = await setupTenant({ schoolName: 'Polypet School' });
  studentA = await createStudent(schoolA.accessToken, schoolA.classId, { firstName: 'Alice' });
});

afterAll(async () => {
  await db.end();
});

describe('Student list isolation', () => {
  it("School B's student list never includes School A's students", async () => {
    const res = await request(app).get('/api/v1/students').set('Authorization', auth(schoolB.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("School A's student list only contains its own student", async () => {
    const res = await request(app).get('/api/v1/students').set('Authorization', auth(schoolA.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].first_name).toBe('Alice');
  });
});

describe('Direct-ID access isolation', () => {
  it("School B cannot fetch School A's student by guessing the ID", async () => {
    const res = await request(app)
      .get(`/api/v1/students/${studentA.id}`)
      .set('Authorization', auth(schoolB.accessToken));

    // Not found, not forbidden-with-details — the row simply doesn't exist
    // from School B's point of view, so no information leaks either way.
    expect(res.status).toBe(404);
  });

  it("School B cannot enrol a student into School A's class", async () => {
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', auth(schoolB.accessToken))
      .send({ classId: schoolA.classId, admissionNo: 'SNEAKY-1', firstName: 'Sneaky', lastName: 'Student' });

    expect(res.status).toBe(400);
  });
});

describe('Fees isolation', () => {
  it("School B's debtor list never includes School A's students", async () => {
    // Create + generate an invoice for School A's student, leave it unpaid.
    const structureRes = await request(app)
      .post('/api/v1/fees/structures')
      .set('Authorization', auth(schoolA.accessToken))
      .send({ academicYearId: schoolA.academicYearId, name: 'Term Fee', amountCents: 10000 });
    await request(app)
      .post(`/api/v1/fees/structures/${structureRes.body.data.id}/generate-invoices`)
      .set('Authorization', auth(schoolA.accessToken));

    const debtorsA = await request(app).get('/api/v1/fees/debtors').set('Authorization', auth(schoolA.accessToken));
    expect(debtorsA.body.data).toHaveLength(1);

    const debtorsB = await request(app).get('/api/v1/fees/debtors').set('Authorization', auth(schoolB.accessToken));
    expect(debtorsB.body.data).toHaveLength(0);
  });
});

describe('Login stays scoped to the right school', () => {
  it("logging in as School A's admin never returns School B's school_id", async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: schoolA.credentials.adminEmail, password: schoolA.credentials.adminPassword });

    expect(res.body.data.user.school_id).toBe(schoolA.user.school_id);
    expect(res.body.data.user.school_id).not.toBe(schoolB.user.school_id);
  });
});
