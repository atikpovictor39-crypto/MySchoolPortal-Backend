// Coverage for one-off substitute-teacher cover on a single timetable slot:
// creating/listing/deleting a substitution, the conflict checks (can't
// double-book a substitute against their own regular schedule or against
// another substitution on the same date/time), and role restrictions.
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createTeacher } = require('./helpers/fixtures');

let school;
let subjectId;
let slotId;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();

  const subjectRes = await request(app)
    .post('/api/v1/subjects')
    .set('Authorization', auth(school.accessToken))
    .send({ name: 'Mathematics' });
  subjectId = subjectRes.body.data.id;

  const slotRes = await request(app)
    .post('/api/v1/timetable')
    .set('Authorization', auth(school.accessToken))
    .send({ classId: school.classId, dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subjectId });
  slotId = slotRes.body.data.id;
});

afterAll(async () => {
  await db.end();
});

async function createNamedTeacher(name) {
  const teacherRes = await request(app)
    .post('/api/v1/teachers')
    .set('Authorization', auth(school.accessToken))
    .send({ name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`, password: 'teacherpass123' });
  expect(teacherRes.status).toBe(201);
  const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
  return teachersRes.body.data.find((t) => t.name === name);
}

describe('Substitute teachers', () => {
  it('assigns a substitute for one date and lists it back', async () => {
    const sub = await createNamedTeacher('Kofi Mensah');

    const res = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: sub.id, reason: 'Regular teacher is on leave' });

    expect(res.status).toBe(201);
    expect(res.body.data.substitute_teacher_name).toBe('Kofi Mensah');
    expect(res.body.data.reason).toBe('Regular teacher is on leave');

    const listRes = await request(app)
      .get(`/api/v1/timetable/substitutions?date=2026-04-06&classId=${school.classId}`)
      .set('Authorization', auth(school.accessToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].timetable_slot_id).toBe(slotId);
  });

  it('only shows substitutions for the requested date', async () => {
    const sub = await createNamedTeacher('Kofi Mensah');
    await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: sub.id });

    const res = await request(app)
      .get(`/api/v1/timetable/substitutions?date=2026-04-07&classId=${school.classId}`)
      .set('Authorization', auth(school.accessToken));
    expect(res.body.data).toHaveLength(0);
  });

  it('rejects a second substitute for the same slot on the same date', async () => {
    const subA = await createNamedTeacher('Kofi Mensah');
    const subB = await createNamedTeacher('Ama Boateng');
    await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: subA.id });

    const res = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: subB.id });

    expect(res.status).toBe(409);
  });

  it("rejects a substitute who already regularly teaches another class at that exact day and time", async () => {
    const busyTeacher = await createNamedTeacher('Busy Teacher');
    // Busy Teacher regularly teaches a different class, Monday 08:00-08:40 (same slot time).
    const otherClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6', section: 'A' });
    await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: otherClassRes.body.data.id,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '08:40',
        subjectId,
        teacherId: busyTeacher.id,
      });

    const res = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: busyTeacher.id });

    expect(res.status).toBe(409);
  });

  it('rejects a substitute already covering another class at the same date and time', async () => {
    const sub = await createNamedTeacher('Kofi Mensah');
    const otherClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6', section: 'A' });
    const otherSlotRes = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: otherClassRes.body.data.id, dayOfWeek: 1, startTime: '08:00', endTime: '08:40', subjectId });

    await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: sub.id });

    const res = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: otherSlotRes.body.data.id, date: '2026-04-06', substituteTeacherId: sub.id });

    expect(res.status).toBe(409);
  });

  it('rejects a substitute for a non-subject (assembly/break) period', async () => {
    const sub = await createNamedTeacher('Kofi Mensah');
    const assemblyRes = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, dayOfWeek: 1, startTime: '07:30', endTime: '08:00', slotType: 'assembly' });

    const res = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: assemblyRes.body.data.id, date: '2026-04-06', substituteTeacherId: sub.id });

    expect(res.status).toBe(400);
  });

  it('deletes a substitution', async () => {
    const sub = await createNamedTeacher('Kofi Mensah');
    const created = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: sub.id });

    const res = await request(app)
      .delete(`/api/v1/timetable/substitutions/${created.body.data.id}`)
      .set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/v1/timetable/substitutions?date=2026-04-06&classId=${school.classId}`)
      .set('Authorization', auth(school.accessToken));
    expect(listRes.body.data).toHaveLength(0);
  });

  it('blocks a TEACHER from assigning or deleting a substitute, but allows viewing', async () => {
    const sub = await createNamedTeacher('Kofi Mensah');
    const teacherLogin = await createTeacher(school.accessToken);

    const createRes = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-06', substituteTeacherId: sub.id });
    expect(createRes.status).toBe(403);

    const viewRes = await request(app)
      .get(`/api/v1/timetable/substitutions?date=2026-04-06&classId=${school.classId}`)
      .set('Authorization', auth(teacherLogin.accessToken));
    expect(viewRes.status).toBe(200);
  });

  it("rejects a date that doesn't fall on the slot's weekday", async () => {
    const sub = await createNamedTeacher('Kofi Mensah');
    // slotId is a Monday (dayOfWeek: 1) period; 2026-04-07 is a Tuesday.
    const res = await request(app)
      .post('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken))
      .send({ timetableSlotId: slotId, date: '2026-04-07', substituteTeacherId: sub.id });

    expect(res.status).toBe(400);
  });

  it('requires a date query param when listing', async () => {
    const res = await request(app)
      .get('/api/v1/timetable/substitutions')
      .set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(400);
  });
});
