const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, createSuperAdmin } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('SuperAdmin sub-admin scopes', () => {
  it('a full-scope SuperAdmin can create a scoped sub-admin account', async () => {
    const superadmin = await createSuperAdmin();
    const res = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'Support Agent', email: 'support-agent@example.com', password: 'supportpass123', scope: 'support' });

    expect(res.status).toBe(201);
    expect(res.body.data.superadmin_scope).toBe('support');
  });

  it('rejects an invalid scope', async () => {
    const superadmin = await createSuperAdmin();
    const res = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(superadmin.accessToken))
      .send({ name: 'x', email: 'bad-scope@example.com', password: 'password123', scope: 'nonsense' });
    expect(res.status).toBe(400);
  });

  it('a support-scoped sub-admin can reach ticket endpoints but not schools or backup', async () => {
    const support = await createSuperAdmin({ scope: 'support' });

    const ticketsRes = await request(app).get('/api/v1/platform/tickets').set('Authorization', auth(support.accessToken));
    expect(ticketsRes.status).toBe(200);

    const schoolsRes = await request(app).get('/api/v1/schools').set('Authorization', auth(support.accessToken));
    expect(schoolsRes.status).toBe(403);

    const backupRes = await request(app).get('/api/v1/platform/backup').set('Authorization', auth(support.accessToken));
    expect(backupRes.status).toBe(403);
  });

  it('a billing-scoped sub-admin can reach plans but not tickets', async () => {
    const billing = await createSuperAdmin({ scope: 'billing' });

    const plansRes = await request(app).get('/api/v1/subscriptions/plans').set('Authorization', auth(billing.accessToken));
    expect(plansRes.status).toBe(200);

    const ticketsRes = await request(app).get('/api/v1/platform/tickets').set('Authorization', auth(billing.accessToken));
    expect(ticketsRes.status).toBe(403);
  });

  it('a developer-scoped sub-admin can reach backup but not plans', async () => {
    const developer = await createSuperAdmin({ scope: 'developer' });

    const backupRes = await request(app).get('/api/v1/platform/backup').set('Authorization', auth(developer.accessToken));
    expect(backupRes.status).toBe(200);

    const plansRes = await request(app)
      .get('/api/v1/subscriptions/plans')
      .set('Authorization', auth(developer.accessToken));
    expect(plansRes.status).toBe(403);
  });

  it('no sub-admin scope can create or list other SuperAdmin accounts, even developer', async () => {
    const developer = await createSuperAdmin({ scope: 'developer' });

    const listRes = await request(app).get('/api/v1/superadmins').set('Authorization', auth(developer.accessToken));
    expect(listRes.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/superadmins')
      .set('Authorization', auth(developer.accessToken))
      .send({ name: 'x', email: 'sneaky@example.com', password: 'password123', scope: 'full' });
    expect(createRes.status).toBe(403);
  });

  it('a full-scope SuperAdmin (NULL scope) can reach every scope-gated endpoint', async () => {
    const superadmin = await createSuperAdmin();

    const ticketsRes = await request(app).get('/api/v1/platform/tickets').set('Authorization', auth(superadmin.accessToken));
    const schoolsRes = await request(app).get('/api/v1/schools').set('Authorization', auth(superadmin.accessToken));
    const plansRes = await request(app)
      .get('/api/v1/subscriptions/plans')
      .set('Authorization', auth(superadmin.accessToken));
    const backupRes = await request(app).get('/api/v1/platform/backup').set('Authorization', auth(superadmin.accessToken));

    expect(ticketsRes.status).toBe(200);
    expect(schoolsRes.status).toBe(200);
    expect(plansRes.status).toBe(200);
    expect(backupRes.status).toBe(200);
  });
});
