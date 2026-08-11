const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant } = require('./helpers/fixtures');

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

describe('Assembly and break periods on the timetable', () => {
  it('creates a subject period as before (slotType defaults to subject)', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);

    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subjectId: subject.id });

    expect(res.status).toBe(201);
    expect(res.body.data.slot_type).toBe('subject');
    expect(res.body.data.subject_name).toBe('Mathematics');
  });

  it('creates an assembly period with no subject needed', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '07:30', endTime: '08:00', slotType: 'assembly' });

    expect(res.status).toBe(201);
    expect(res.body.data.slot_type).toBe('assembly');
    expect(res.body.data.subject_id).toBeNull();
    expect(res.body.data.subject_name).toBeNull();
  });

  it('creates two break periods at different times on the same day', async () => {
    const tenant = await setupTenant();
    const res1 = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '10:00', endTime: '10:20', slotType: 'break' });
    const res2 = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '12:30', endTime: '13:00', slotType: 'break' });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.slot_type).toBe('break');
    expect(res2.body.data.slot_type).toBe('break');
  });

  it('rejects a subject period with no subjectId', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '08:00', endTime: '08:40' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid slotType', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '08:00', endTime: '08:40', slotType: 'lunch' });

    expect(res.status).toBe(400);
  });

  it('ignores a subjectId sent alongside a non-subject slotType', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);

    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({
        classId: tenant.classId,
        dayOfWeek: 1,
        startTime: '07:30',
        endTime: '08:00',
        slotType: 'assembly',
        subjectId: subject.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.subject_id).toBeNull();
  });

  it('switches a subject period to assembly on update, clearing subject_id', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);
    const created = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subjectId: subject.id });

    const res = await request(app)
      .put(`/api/v1/timetable/${created.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ slotType: 'assembly' });

    expect(res.status).toBe(200);
    expect(res.body.data.slot_type).toBe('assembly');
    expect(res.body.data.subject_id).toBeNull();
  });

  it('requires a subjectId when switching a break period to subject on update', async () => {
    const tenant = await setupTenant();
    const created = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '10:00', endTime: '10:20', slotType: 'break' });

    const res = await request(app)
      .put(`/api/v1/timetable/${created.body.data.id}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ slotType: 'subject' });

    expect(res.status).toBe(400);
  });

  it('lists assembly/break alongside subject periods with school_name null for the non-subject ones', async () => {
    const tenant = await setupTenant();
    const subject = await createSubject(tenant.accessToken);
    await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subjectId: subject.id });
    await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(tenant.accessToken))
      .send({ classId: tenant.classId, dayOfWeek: 1, startTime: '07:30', endTime: '08:00', slotType: 'assembly' });

    const res = await request(app)
      .get(`/api/v1/timetable?classId=${tenant.classId}`)
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    const assembly = res.body.data.find((s) => s.slot_type === 'assembly');
    const mathSlot = res.body.data.find((s) => s.slot_type === 'subject');
    expect(assembly.subject_name).toBeNull();
    expect(mathSlot.subject_name).toBe('Mathematics');
  });
});
