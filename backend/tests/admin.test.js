const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, registerSchool, setupTenant, createStudent, createTeacher, login } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

async function markSchoolDemo(schoolId) {
  await db.query('UPDATE schools SET is_demo = TRUE WHERE id = ?', [schoolId]);
}

describe('School profile (Admin > School Details)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns the current profile', async () => {
    const school = await registerSchool({ schoolName: 'Profile Test School' });
    const res = await request(app).get('/api/v1/schools/me').set('Authorization', auth(school.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Profile Test School');
  });

  it('defaults show_grades_on_report_card to true for a new school', async () => {
    const school = await registerSchool();
    const res = await request(app).get('/api/v1/schools/me').set('Authorization', auth(school.accessToken));
    expect(res.body.data.show_grades_on_report_card).toBe(true);
  });

  it('lets an admin turn off show_grades_on_report_card', async () => {
    const school = await registerSchool();
    const res = await request(app)
      .put('/api/v1/schools/me')
      .set('Authorization', auth(school.accessToken))
      .send({ showGradesOnReportCard: false });

    expect(res.status).toBe(200);
    expect(res.body.data.show_grades_on_report_card).toBe(false);

    const getRes = await request(app).get('/api/v1/schools/me').set('Authorization', auth(school.accessToken));
    expect(getRes.body.data.show_grades_on_report_card).toBe(false);
  });

  it('rejects a non-boolean showGradesOnReportCard', async () => {
    const school = await registerSchool();
    const res = await request(app)
      .put('/api/v1/schools/me')
      .set('Authorization', auth(school.accessToken))
      .send({ showGradesOnReportCard: 'yes' });

    expect(res.status).toBe(400);
  });

  it('updates the profile and writes an audit log entry', async () => {
    const school = await registerSchool();
    const res = await request(app)
      .put('/api/v1/schools/me')
      .set('Authorization', auth(school.accessToken))
      .send({ phone: '+233 24 000 0000', address: '1 Main St', logoUrl: 'https://example.com/logo.png' });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+233 24 000 0000');

    const logRes = await request(app).get('/api/v1/audit-logs').set('Authorization', auth(school.accessToken));
    expect(logRes.status).toBe(200);
    expect(logRes.body.data.some((l) => l.action === 'school.profile_updated')).toBe(true);
  });

  it('rejects an empty name', async () => {
    const school = await registerSchool();
    const res = await request(app)
      .put('/api/v1/schools/me')
      .set('Authorization', auth(school.accessToken))
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('blocks a demo school from updating its profile', async () => {
    const school = await registerSchool();
    await markSchoolDemo(school.user.school_id);
    const relogged = await login(school.credentials.adminEmail, school.credentials.adminPassword);

    const res = await request(app)
      .put('/api/v1/schools/me')
      .set('Authorization', auth(relogged.accessToken))
      .send({ phone: '+233 24 000 0000' });
    expect(res.status).toBe(403);
  });
});

describe('Audit log', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('records a student creation', async () => {
    const tenant = await setupTenant();
    await createStudent(tenant.accessToken, tenant.classId, { firstName: 'Ama', lastName: 'Owusu' });

    const res = await request(app).get('/api/v1/audit-logs').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);
    const entry = res.body.data.find((l) => l.action === 'student.created');
    expect(entry).toBeTruthy();
    expect(entry.description).toMatch(/Ama Owusu/);
    expect(entry.user_name).toBeTruthy();
  });

  it('is only visible to a SCHOOL_ADMIN', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);

    const res = await request(app).get('/api/v1/audit-logs').set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(403);
  });
});

describe('Notifications', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('notifies the admin when a teacher submits a leave request', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);

    await request(app)
      .post('/api/v1/teachers/leave-requests')
      .set('Authorization', auth(teacher.accessToken))
      .send({ startDate: '2026-09-01', endDate: '2026-09-03', reason: 'Family event' });

    const res = await request(app).get('/api/v1/notifications').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(200);
    const notif = res.body.data.find((n) => n.type === 'leave_request');
    expect(notif).toBeTruthy();
    expect(notif.is_read).toBe(false);
  });

  it('marks a notification read and reflects it in the unread count', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    await request(app)
      .post('/api/v1/teachers/leave-requests')
      .set('Authorization', auth(teacher.accessToken))
      .send({ startDate: '2026-09-01', endDate: '2026-09-03' });

    const before = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(before.body.data.count).toBe(1);

    const list = await request(app).get('/api/v1/notifications').set('Authorization', auth(tenant.accessToken));
    const notifId = list.body.data[0].id;

    const markRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', auth(tenant.accessToken));
    expect(markRes.status).toBe(200);

    const after = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(after.body.data.count).toBe(0);
  });

  it('mark-all-read clears every unread notification', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);
    await request(app)
      .post('/api/v1/teachers/leave-requests')
      .set('Authorization', auth(teacher.accessToken))
      .send({ startDate: '2026-09-01', endDate: '2026-09-02' });
    await request(app)
      .post('/api/v1/teachers/leave-requests')
      .set('Authorization', auth(teacher.accessToken))
      .send({ startDate: '2026-10-01', endDate: '2026-10-02' });

    await request(app)
      .post('/api/v1/notifications/mark-all-read')
      .set('Authorization', auth(tenant.accessToken))
      .send({});

    const after = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', auth(tenant.accessToken));
    expect(after.body.data.count).toBe(0);
  });

  it('is only visible to a SCHOOL_ADMIN, not a TEACHER', async () => {
    const tenant = await setupTenant();
    const teacher = await createTeacher(tenant.accessToken);

    const res = await request(app).get('/api/v1/notifications').set('Authorization', auth(teacher.accessToken));
    expect(res.status).toBe(403);
  });
});
