const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, createSuperAdmin, setupTenant } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('Support tickets — school side', () => {
  it('lets a SCHOOL_ADMIN create a ticket', async () => {
    const tenant = await setupTenant();
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenant.accessToken))
      .send({ subject: 'Cannot record payment', message: 'The record button does nothing.', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.priority).toBe('high');
  });

  it('lists only the school\'s own tickets', async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenantA.accessToken))
      .send({ subject: 'A issue', message: 'x' });
    await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenantB.accessToken))
      .send({ subject: 'B issue', message: 'y' });

    const res = await request(app).get('/api/v1/tickets').set('Authorization', auth(tenantA.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].subject).toBe('A issue');
  });

  it("blocks a school from viewing another school's ticket by id", async () => {
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenantA.accessToken))
      .send({ subject: 'A issue', message: 'x' });

    const res = await request(app)
      .get(`/api/v1/tickets/${created.body.data.id}`)
      .set('Authorization', auth(tenantB.accessToken));
    expect(res.status).toBe(404);
  });

  it('lets a school reply to its own ticket', async () => {
    const tenant = await setupTenant();
    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenant.accessToken))
      .send({ subject: 'Issue', message: 'x' });

    const res = await request(app)
      .post(`/api/v1/tickets/${created.body.data.id}/replies`)
      .set('Authorization', auth(tenant.accessToken))
      .send({ message: 'Any update?' });

    expect(res.status).toBe(201);
    expect(res.body.data.replies.length).toBe(1);
    expect(res.body.data.replies[0].message).toBe('Any update?');
  });
});

describe('Support tickets — SuperAdmin side', () => {
  it('sees tickets from every school', async () => {
    const superadmin = await createSuperAdmin();
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();
    await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenantA.accessToken))
      .send({ subject: 'A issue', message: 'x' });
    await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenantB.accessToken))
      .send({ subject: 'B issue', message: 'y' });

    const res = await request(app).get('/api/v1/platform/tickets').set('Authorization', auth(superadmin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.some((t) => t.school_name)).toBe(true);
  });

  it('filters by status', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenant.accessToken))
      .send({ subject: 'Issue', message: 'x' });
    await request(app)
      .patch(`/api/v1/platform/tickets/${created.body.data.id}/status`)
      .set('Authorization', auth(superadmin.accessToken))
      .send({ status: 'resolved' });

    const res = await request(app)
      .get('/api/v1/platform/tickets?status=resolved')
      .set('Authorization', auth(superadmin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('replying auto-bumps an open ticket to in_progress', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();
    const created = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth(tenant.accessToken))
      .send({ subject: 'Issue', message: 'x' });

    const replyRes = await request(app)
      .post(`/api/v1/platform/tickets/${created.body.data.id}/replies`)
      .set('Authorization', auth(superadmin.accessToken))
      .send({ message: 'Looking into it.' });

    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.status).toBe('in_progress');
    expect(replyRes.body.data.replies[0].author_role).toBe('SUPERADMIN');
  });

  it('blocks a SCHOOL_ADMIN from the platform-wide ticket endpoints', async () => {
    const tenant = await setupTenant();
    const res = await request(app).get('/api/v1/platform/tickets').set('Authorization', auth(tenant.accessToken));
    expect(res.status).toBe(403);
  });
});
