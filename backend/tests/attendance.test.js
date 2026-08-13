const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createStudent } = require('./helpers/fixtures');

let school;
let student;

beforeEach(async () => {
  await resetDatabase();
  school = await setupTenant();
  student = await createStudent(school.accessToken, school.classId);
});

afterAll(async () => {
  await db.end();
});

describe('Marking attendance', () => {
  it('marks a student absent', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: student.id, status: 'absent' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.students[0].status).toBe('absent');
  });

  it('re-marking the same day upserts instead of erroring', async () => {
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: student.id, status: 'absent' }] });

    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: student.id, status: 'present' }] });

    expect(res.status).toBe(200);
    expect(res.body.data.students[0].status).toBe('present');

    // Confirm it's genuinely one row updated, not a second row inserted.
    const sheet = await request(app)
      .get(`/api/v1/attendance?class_id=${school.classId}&date=2026-01-15`)
      .set('Authorization', auth(school.accessToken));
    expect(sheet.body.data.students).toHaveLength(1);
  });

  it('rejects a student who is not in the given class', async () => {
    const otherSchool = await setupTenant({ schoolName: 'Other School' });
    const otherStudent = await createStudent(otherSchool.accessToken, otherSchool.classId);

    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-15', records: [{ studentId: otherStudent.id, status: 'present' }] });

    expect(res.status).toBe(400);
  });
});

describe('Attendance summary', () => {
  it('returns a null rate rather than 0% when nothing has been marked for that date', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/summary?date=2026-03-01')
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.totalMarked).toBe(0);
    expect(res.body.data.rate).toBeNull();
  });

  it('computes the percentage present for a given date', async () => {
    const student2 = await createStudent(school.accessToken, school.classId);
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({
        classId: school.classId,
        date: '2026-01-15',
        records: [
          { studentId: student.id, status: 'present' },
          { studentId: student2.id, status: 'absent' },
        ],
      });

    const res = await request(app)
      .get('/api/v1/attendance/summary?date=2026-01-15')
      .set('Authorization', auth(school.accessToken));

    expect(res.body.data.totalMarked).toBe(2);
    expect(res.body.data.presentCount).toBe(1);
    expect(res.body.data.rate).toBe(50);
  });

  it('defaults to today when no date is given', async () => {
    const res = await request(app).get('/api/v1/attendance/summary').set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.date).toBeTruthy();
  });

  it('is isolated per school', async () => {
    const otherSchool = await setupTenant({ schoolName: 'Other School' });
    const otherStudent = await createStudent(otherSchool.accessToken, otherSchool.classId);
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(otherSchool.accessToken))
      .send({ classId: otherSchool.classId, date: '2026-01-15', records: [{ studentId: otherStudent.id, status: 'present' }] });

    const res = await request(app)
      .get('/api/v1/attendance/summary?date=2026-01-15')
      .set('Authorization', auth(school.accessToken));
    expect(res.body.data.totalMarked).toBe(0);
  });
});

describe('Attendance report (date range)', () => {
  it('totals present/absent/late/excused per student over a range', async () => {
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-05', records: [{ studentId: student.id, status: 'present' }] });
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-06', records: [{ studentId: student.id, status: 'late' }] });
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-07', records: [{ studentId: student.id, status: 'absent' }] });

    const res = await request(app)
      .get(`/api/v1/attendance/report?classId=${school.classId}&fromDate=2026-01-01&toDate=2026-01-31`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    const row = res.body.data.find((r) => r.student_id === student.id);
    expect(row.present_count).toBe(1);
    expect(row.late_count).toBe(1);
    expect(row.absent_count).toBe(1);
    expect(row.total_marked).toBe(3);
    expect(row.rate).toBe(33); // 1 of 3 marked days present, rounded
  });

  it('includes a student with zero marked days at 0 counts and a null rate', async () => {
    const res = await request(app)
      .get(`/api/v1/attendance/report?classId=${school.classId}&fromDate=2026-01-01&toDate=2026-01-31`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    const row = res.body.data.find((r) => r.student_id === student.id);
    expect(row.total_marked).toBe(0);
    expect(row.rate).toBeNull();
  });

  it('excludes marks outside the requested date range', async () => {
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-02-01', records: [{ studentId: student.id, status: 'present' }] });

    const res = await request(app)
      .get(`/api/v1/attendance/report?classId=${school.classId}&fromDate=2026-01-01&toDate=2026-01-31`)
      .set('Authorization', auth(school.accessToken));

    const row = res.body.data.find((r) => r.student_id === student.id);
    expect(row.total_marked).toBe(0);
  });

  it('requires classId, fromDate and toDate', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/report')
      .set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(400);
  });

  it('exports the same data as a downloadable CSV', async () => {
    await request(app)
      .post('/api/v1/attendance/mark')
      .set('Authorization', auth(school.accessToken))
      .send({ classId: school.classId, date: '2026-01-05', records: [{ studentId: student.id, status: 'present' }] });

    const res = await request(app)
      .get(`/api/v1/attendance/report/export?classId=${school.classId}&fromDate=2026-01-01&toDate=2026-01-31`)
      .set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain(student.admission_no);
    expect(res.text).toContain('Attendance Rate (%)');
  });
});
