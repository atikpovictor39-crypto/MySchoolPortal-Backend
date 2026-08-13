// Coverage for the Classes page's new backend surfaces: the enriched
// listClassesWithStats (teacher name, roll count, subject count, derived
// active/archived status), bulk-assigning subjects to several classes at
// once, and end-of-year student promotion between classes.
const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, createTeacher } = require('./helpers/fixtures');

let school;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
});

afterAll(async () => {
  await db.end();
});

describe('listClassesWithStats', () => {
  it('reports teacher name, roll count, subject count and active status', async () => {
    await createStudent(school.accessToken, school.classId);
    await createStudent(school.accessToken, school.classId);
    const subjectRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Mathematics' });
    await request(app)
      .post(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken))
      .send({ subjectId: subjectRes.body.data.id });

    await createTeacher(school.accessToken, { name: 'Mrs. Owusu' });
    const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
    const teacherId = teachersRes.body.data.find((t) => t.name === 'Mrs. Owusu').id;
    await request(app)
      .put(`/api/v1/classes/${school.classId}`)
      .set('Authorization', auth(school.accessToken))
      .send({ classTeacherId: teacherId });

    const res = await request(app)
      .get('/api/v1/classes?withStats=true')
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    const row = res.body.data.find((c) => c.id === school.classId);
    expect(row.class_teacher_name).toBe('Mrs. Owusu');
    expect(row.student_count).toBe(2);
    expect(row.subject_count).toBe(1);
    expect(row.status).toBe('active'); // setupTenant's academic year is created with isCurrent: true
  });

  it('reports archived for a class in a non-current academic year', async () => {
    const oldYearRes = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', auth(school.accessToken))
      .send({ name: '2020/2021', startDate: '2020-09-01', endDate: '2021-07-31', isCurrent: false });
    const oldClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: oldYearRes.body.data.id, name: 'Old Class' });

    const res = await request(app)
      .get('/api/v1/classes?withStats=true')
      .set('Authorization', auth(school.accessToken));

    const row = res.body.data.find((c) => c.id === oldClassRes.body.data.id);
    expect(row.status).toBe('archived');
  });

  it('filters by classTeacherId', async () => {
    await createTeacher(school.accessToken, { name: 'Mrs. Owusu' });
    const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
    const teacherId = teachersRes.body.data.find((t) => t.name === 'Mrs. Owusu').id;
    await request(app)
      .put(`/api/v1/classes/${school.classId}`)
      .set('Authorization', auth(school.accessToken))
      .send({ classTeacherId: teacherId });

    const otherClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Other Class' });

    const res = await request(app)
      .get(`/api/v1/classes?withStats=true&classTeacherId=${teacherId}`)
      .set('Authorization', auth(school.accessToken));

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(school.classId);
    expect(res.body.data.some((c) => c.id === otherClassRes.body.data.id)).toBe(false);
  });

  it('searches by class name, section, or class teacher name', async () => {
    const otherClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Form 3', section: 'B' });

    await createTeacher(school.accessToken, { name: 'Kofi Mensah' });
    const teachersRes = await request(app).get('/api/v1/teachers').set('Authorization', auth(school.accessToken));
    const teacherId = teachersRes.body.data.find((t) => t.name === 'Kofi Mensah').id;
    await request(app)
      .put(`/api/v1/classes/${otherClassRes.body.data.id}`)
      .set('Authorization', auth(school.accessToken))
      .send({ classTeacherId: teacherId });

    const byName = await request(app)
      .get('/api/v1/classes?withStats=true&search=form')
      .set('Authorization', auth(school.accessToken));
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].id).toBe(otherClassRes.body.data.id);

    const byTeacher = await request(app)
      .get('/api/v1/classes?withStats=true&search=Kofi')
      .set('Authorization', auth(school.accessToken));
    expect(byTeacher.body.data).toHaveLength(1);
    expect(byTeacher.body.data[0].id).toBe(otherClassRes.body.data.id);

    const noMatch = await request(app)
      .get('/api/v1/classes?withStats=true&search=zzz-nonexistent')
      .set('Authorization', auth(school.accessToken));
    expect(noMatch.body.data).toHaveLength(0);
  });

  it('the plain (non-stats) list is unaffected — still the lightweight shape', async () => {
    const res = await request(app).get('/api/v1/classes').set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('student_count');
  });
});

describe('Bulk-assigning subjects to several classes', () => {
  it('assigns every subject to every class', async () => {
    const otherClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6' });
    const otherClassId = otherClassRes.body.data.id;

    const mathRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Mathematics' });
    const engRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'English' });

    const res = await request(app)
      .post('/api/v1/classes/bulk-assign-subjects')
      .set('Authorization', auth(school.accessToken))
      .send({
        classIds: [school.classId, otherClassId],
        subjects: [
          { subjectId: mathRes.body.data.id, periodsPerWeek: 5 },
          { subjectId: engRes.body.data.id, periodsPerWeek: 4 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.assignedCount).toBe(4);

    const classAList = await request(app)
      .get(`/api/v1/classes/${school.classId}/subjects`)
      .set('Authorization', auth(school.accessToken));
    expect(classAList.body.data).toHaveLength(2);
    expect(classAList.body.data.find((s) => s.subject_name === 'Mathematics').periods_per_week).toBe(5);

    const classBList = await request(app)
      .get(`/api/v1/classes/${otherClassId}/subjects`)
      .set('Authorization', auth(school.accessToken));
    expect(classBList.body.data).toHaveLength(2);
  });

  it('rejects a subjects array with a missing subjectId', async () => {
    const res = await request(app)
      .post('/api/v1/classes/bulk-assign-subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ classIds: [school.classId], subjects: [{ periodsPerWeek: 3 }] });
    expect(res.status).toBe(400);
  });

  it('blocks a TEACHER from bulk-assigning', async () => {
    const teacherLogin = await createTeacher(school.accessToken);
    const subjectRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'Mathematics' });

    const res = await request(app)
      .post('/api/v1/classes/bulk-assign-subjects')
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ classIds: [school.classId], subjects: [{ subjectId: subjectRes.body.data.id }] });
    expect(res.status).toBe(403);
  });
});

describe('Promoting students to another class', () => {
  it('moves the selected students to an existing target class', async () => {
    const studentA = await createStudent(school.accessToken, school.classId, { firstName: 'Ama' });
    const studentB = await createStudent(school.accessToken, school.classId, { firstName: 'Kwame' });
    const targetClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6' });
    const targetClassId = targetClassRes.body.data.id;

    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/promote`)
      .set('Authorization', auth(school.accessToken))
      .send({ studentIds: [studentA.id, studentB.id], targetClassId });

    expect(res.status).toBe(200);
    expect(res.body.data.promotedCount).toBe(2);

    const studentRes = await request(app)
      .get(`/api/v1/students/${studentA.id}`)
      .set('Authorization', auth(school.accessToken));
    expect(studentRes.body.data.class_id).toBe(targetClassId);
  });

  it('only moves the students actually selected, leaving others behind (repeaters)', async () => {
    const promoted = await createStudent(school.accessToken, school.classId, { firstName: 'Ama' });
    const repeater = await createStudent(school.accessToken, school.classId, { firstName: 'Kwame' });
    const targetClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6' });

    await request(app)
      .post(`/api/v1/classes/${school.classId}/promote`)
      .set('Authorization', auth(school.accessToken))
      .send({ studentIds: [promoted.id], targetClassId: targetClassRes.body.data.id });

    const repeaterRes = await request(app)
      .get(`/api/v1/students/${repeater.id}`)
      .set('Authorization', auth(school.accessToken));
    expect(repeaterRes.body.data.class_id).toBe(school.classId);
  });

  it('creates a new target class on the fly when targetNewClass is given', async () => {
    const student = await createStudent(school.accessToken, school.classId);
    const newYearRes = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', auth(school.accessToken))
      .send({ name: '2027/2028', startDate: '2027-09-01', endDate: '2028-07-31', isCurrent: false });

    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/promote`)
      .set('Authorization', auth(school.accessToken))
      .send({
        studentIds: [student.id],
        targetNewClass: { academicYearId: newYearRes.body.data.id, name: 'Grade 6', section: 'A' },
      });

    expect(res.status).toBe(200);
    const newClassId = res.body.data.targetClassId;
    const classesRes = await request(app)
      .get(`/api/v1/classes?academicYearId=${newYearRes.body.data.id}`)
      .set('Authorization', auth(school.accessToken));
    expect(classesRes.body.data.some((c) => c.id === newClassId && c.name === 'Grade 6')).toBe(true);
  });

  it("rejects a studentId that isn't an active student of the source class", async () => {
    const otherSchool = await setupTenant({ adminEmail: 'other-admin@example.com' });
    const outsider = await createStudent(otherSchool.accessToken, otherSchool.classId);
    const targetClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6' });

    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/promote`)
      .set('Authorization', auth(school.accessToken))
      .send({ studentIds: [outsider.id], targetClassId: targetClassRes.body.data.id });

    expect(res.status).toBe(400);
  });

  it('requires studentIds and a target', async () => {
    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/promote`)
      .set('Authorization', auth(school.accessToken))
      .send({ studentIds: [] });
    expect(res.status).toBe(400);
  });

  it('blocks a TEACHER from promoting', async () => {
    const student = await createStudent(school.accessToken, school.classId);
    const teacherLogin = await createTeacher(school.accessToken);
    const targetClassRes = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', auth(school.accessToken))
      .send({ academicYearId: school.academicYearId, name: 'Grade 6' });

    const res = await request(app)
      .post(`/api/v1/classes/${school.classId}/promote`)
      .set('Authorization', auth(teacherLogin.accessToken))
      .send({ studentIds: [student.id], targetClassId: targetClassRes.body.data.id });
    expect(res.status).toBe(403);
  });
});
