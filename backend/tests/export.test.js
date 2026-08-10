const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent, createTeacher } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('CSV data export', () => {
  it('exports students as CSV with the right headers and a data row', async () => {
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Ama', lastName: 'Owusu' });

    const res = await request(app).get('/api/v1/export/students').set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="students\.csv"/);
    expect(res.text).toMatch(/^Admission No,First Name,Last Name/);
    expect(res.text).toMatch(/Ama,Owusu/);
  });

  it('exports teachers as CSV with a data row', async () => {
    const tenant = await setupTenant();
    await createTeacher(tenant.accessToken, { name: 'Kwame Mensah' });

    const res = await request(app).get('/api/v1/export/teachers').set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^Name,Email,Phone,Employee No,Hire Date/);
    expect(res.text).toMatch(/Kwame Mensah/);
  });

  it('exports fee invoices as CSV with a data row', async () => {
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Kojo', lastName: 'Asante' });

    const structureRes = await request(app)
      .post('/api/v1/fees/structures')
      .set('Authorization', auth(tenant.accessToken))
      .send({ academicYearId: tenant.academicYearId, name: 'Term 1 Tuition', amountCents: 50000 });
    await request(app)
      .post(`/api/v1/fees/structures/${structureRes.body.data.id}/generate-invoices`)
      .set('Authorization', auth(tenant.accessToken));

    const res = await request(app).get('/api/v1/export/fees').set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^Admission No,Student,Fee,Amount Due,Amount Paid,Status,Due Date,Invoiced On/);
    expect(res.text).toMatch(/Kojo Asante,Term 1 Tuition,500\.00,0\.00/);
  });

  it('exports attendance as CSV with a data row', async () => {
    const tenant = await setupTenant();
    const student = await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Abena', lastName: 'Boateng' });

    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(tenant.accessToken))
      .send({
        classId: tenant.classId,
        date: '2026-08-10',
        records: [{ studentId: student.id, status: 'present' }],
      });

    const res = await request(app).get('/api/v1/export/attendance').set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^Date,Admission No,Student,Class,Section,Status/);
    expect(res.text).toMatch(/Abena Boateng.*present/);
  });

  it('exports results as CSV with a data row', async () => {
    const tenant = await setupTenant();
    const student = await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Yaw', lastName: 'Darko' });

    const subjectRes = await request(app)
      .post('/api/v1/subjects')
      .set('Authorization', auth(tenant.accessToken))
      .send({ name: 'Mathematics' });

    const examRes = await request(app)
      .post('/api/v1/results/exams')
      .set('Authorization', auth(tenant.accessToken))
      .send({ academicYearId: tenant.academicYearId, classId: tenant.classId, name: 'Term 1 Exam', term: 'Term 1' });

    const examSubjectsRes = await request(app)
      .post(`/api/v1/results/exams/${examRes.body.data.id}/subjects`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ subjects: [{ subjectId: subjectRes.body.data.id, maxMarks: 100, passingMarks: 40 }] });
    const examSubjectId = examSubjectsRes.body.data.subjects[0].exam_subject_id;

    await request(app)
      .post(`/api/v1/results/exam-subjects/${examSubjectId}`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ records: [{ studentId: student.id, marksObtained: 88 }] });

    const res = await request(app).get('/api/v1/export/results').set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^Exam,Term,Admission No,Student,Subject,Marks,Grade/);
    expect(res.text).toMatch(/Term 1 Exam,Term 1.*Yaw Darko,Mathematics,88/);
  });

  it('rejects an unknown export type', async () => {
    const tenant = await setupTenant();
    const res = await request(app).get('/api/v1/export/not-a-real-type').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(400);
  });

  it('blocks a TEACHER from exporting', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    const res = await request(app).get('/api/v1/export/students').set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(403);
  });
});
