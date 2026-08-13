// Coverage for the timetable auto-generator: it reads class_subjects
// (subject + teacher + periods/week), lays out Assembly/Break at their given
// times, round-robins the subjects into the remaining periods, respects
// existing teacher commitments in OTHER classes, and reports a warning
// rather than silently dropping periods it couldn't fit.
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createTeacher } = require('./helpers/fixtures');

let school;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
});

afterAll(async () => {
  await db.end();
});

async function addSubject(name) {
  const res = await request(app).post('/api/v1/subjects').set('Authorization', auth(school.accessToken)).send({ name });
  return res.body.data.id;
}

async function assignSubject(classId, subjectId, periodsPerWeek, teacherId) {
  const res = await request(app)
    .post(`/api/v1/classes/${classId}/subjects`)
    .set('Authorization', auth(school.accessToken))
    .send({ subjectId, periodsPerWeek, teacherId });
  expect(res.status).toBe(201);
}

describe('Timetable generator', () => {
  it('requires the class to have subjects assigned first', async () => {
    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        dayStartTime: '08:00',
        periodLengthMinutes: 40,
        periodsPerDay: 6,
      });

    expect(res.status).toBe(400);
  });

  it('fills a week of periods across Monday-Friday from the class subject list', async () => {
    const mathId = await addSubject('Mathematics');
    const englishId = await addSubject('English');
    await assignSubject(school.classId, mathId, 5);
    await assignSubject(school.classId, englishId, 5);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        dayStartTime: '08:00',
        periodLengthMinutes: 40,
        periodsPerDay: 2,
      });

    expect(res.status).toBe(200);
    const subjectSlots = res.body.data.slots.filter((s) => s.slot_type === 'subject');
    expect(subjectSlots).toHaveLength(10); // 2 periods/day x 5 days
    const mathCount = subjectSlots.filter((s) => s.subject_id === mathId).length;
    const englishCount = subjectSlots.filter((s) => s.subject_id === englishId).length;
    expect(mathCount).toBe(5);
    expect(englishCount).toBe(5);
    expect(res.body.data.warnings).toHaveLength(0);
  });

  it('places assembly and break at the given times', async () => {
    const mathId = await addSubject('Mathematics');
    await assignSubject(school.classId, mathId, 10);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        days: [1],
        dayStartTime: '07:30',
        periodLengthMinutes: 40,
        periodsPerDay: 2,
        assembly: { startTime: '07:30', durationMinutes: 20, days: [1] },
        breaks: [{ startTime: '09:00', durationMinutes: 15 }],
      });

    expect(res.status).toBe(200);
    const slots = res.body.data.slots;
    const assembly = slots.find((s) => s.slot_type === 'assembly');
    expect(assembly.start_time.slice(0, 5)).toBe('07:30');
    expect(assembly.end_time.slice(0, 5)).toBe('07:50');
    const brk = slots.find((s) => s.slot_type === 'break');
    expect(brk).toBeTruthy();
  });

  it("still places Break 1 and Break 2 when Assembly's time is earlier than the day's start time", async () => {
    // Regression test: Assembly at 06:45 with the day starting at 07:30 used
    // to permanently block the generator from ever reaching Break 1/Break 2,
    // since it got stuck checking an Assembly window it could never reach.
    const mathId = await addSubject('Mathematics');
    await assignSubject(school.classId, mathId, 6);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        days: [1],
        dayStartTime: '07:30',
        periodLengthMinutes: 60,
        periodsPerDay: 6,
        assembly: { startTime: '06:45', durationMinutes: 15, days: [1] },
        breaks: [
          { startTime: '10:00', durationMinutes: 30 },
          { startTime: '12:00', durationMinutes: 60 },
        ],
      });

    expect(res.status).toBe(200);
    const slots = res.body.data.slots;
    expect(slots.filter((s) => s.slot_type === 'break')).toHaveLength(2);
    expect(slots.some((s) => s.slot_type === 'assembly')).toBe(false); // 06:45 is before the day even starts — correctly unreachable
    expect(slots.filter((s) => s.slot_type === 'subject')).toHaveLength(6);
  });

  it("skips a subject's teacher when they're already teaching another class at that day and time", async () => {
    const mathId = await addSubject('Mathematics');
    const scienceId = await addSubject('Science');
    await createTeacher(school.accessToken, { name: 'Busy Teacher' });
    const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
    const busyTeacherId = teachersRes.body.data.find((t) => t.name === 'Busy Teacher').id;

    // Busy Teacher already teaches a different class Monday 08:00-08:40.
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
        subjectId: mathId,
        teacherId: busyTeacherId,
      });

    // Math (taught by Busy Teacher) and Science (no teacher) both assigned to our class.
    await assignSubject(school.classId, mathId, 1, busyTeacherId);
    await assignSubject(school.classId, scienceId, 1);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        days: [1],
        dayStartTime: '08:00',
        periodLengthMinutes: 40,
        periodsPerDay: 1,
      });

    expect(res.status).toBe(200);
    const subjectSlots = res.body.data.slots.filter((s) => s.slot_type === 'subject');
    // Only one subject period was available Monday 08:00, and Busy Teacher
    // was unavailable then, so Science (no teacher conflict) got it instead.
    expect(subjectSlots).toHaveLength(1);
    expect(subjectSlots[0].subject_id).toBe(scienceId);
  });

  it("reports a warning when more periods were requested than fit in the week", async () => {
    const mathId = await addSubject('Mathematics');
    await assignSubject(school.classId, mathId, 20);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        days: [1],
        dayStartTime: '08:00',
        periodLengthMinutes: 40,
        periodsPerDay: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.warnings.length).toBeGreaterThan(0);
    const subjectSlots = res.body.data.slots.filter((s) => s.slot_type === 'subject');
    expect(subjectSlots).toHaveLength(2); // capped to what actually fit
  });

  it('wipes and replaces the class\'s existing timetable on regenerate', async () => {
    await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, dayOfWeek: 3, startTime: '11:00', endTime: '11:40', slotType: 'break' });

    const mathId = await addSubject('Mathematics');
    await assignSubject(school.classId, mathId, 3);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        days: [1],
        dayStartTime: '08:00',
        periodLengthMinutes: 40,
        periodsPerDay: 1,
      });

    expect(res.status).toBe(200);
    const listRes = await request(app)
      .get(`/api/v1/timetable?classId=${school.classId}`)
      .set('Authorization', auth(school.accessToken));
    // The old Wednesday 11:00 break is gone — only what the generator just made remains.
    expect(listRes.body.data.some((s) => s.day_of_week === 3 && s.start_time.slice(0, 5) === '11:00')).toBe(false);
  });

  it('blocks a TEACHER from generating', async () => {
    const mathId = await addSubject('Mathematics');
    await assignSubject(school.classId, mathId, 3);
    const teacherLogin = await createTeacher(school.accessToken);

    const res = await request(app)
      .post('/api/v1/timetable/generate')
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ classId: school.classId, dayStartTime: '08:00', periodLengthMinutes: 40, periodsPerDay: 2 });

    expect(res.status).toBe(403);
  });
});
