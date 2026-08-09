const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createSuperAdmin } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

describe('SuperAdmin manages subscription plans', () => {
  let superAdmin;

  beforeEach(async () => {
    await resetDatabase();
    superAdmin = await createSuperAdmin();
  });

  it('lists the seeded default plans', async () => {
    const res = await request(app).get('/api/v1/subscriptions/plans').set('Authorization', auth(superAdmin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('creates a new plan', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/plans')
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ name: 'Enterprise', priceCents: 29900, billingCycle: 'monthly', maxStudents: null });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Enterprise');
    expect(res.body.data.max_students).toBeNull();
    expect(res.body.data.is_active).toBe(true);
  });

  it('rejects a negative price', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/plans')
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ name: 'Bad Plan', priceCents: -100 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid billing cycle', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/plans')
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ name: 'Bad Plan', priceCents: 1000, billingCycle: 'weekly' });
    expect(res.status).toBe(400);
  });

  it('updates a plan, e.g. deactivating it, without needing every field resent', async () => {
    const createRes = await request(app)
      .post('/api/v1/subscriptions/plans')
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ name: 'Trial Plan', priceCents: 0 });
    const planId = createRes.body.data.id;

    const updateRes = await request(app)
      .put(`/api/v1/subscriptions/plans/${planId}`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ isActive: false });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.is_active).toBe(false);
    expect(updateRes.body.data.name).toBe('Trial Plan');
  });

  it('404s updating a plan that does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/subscriptions/plans/999999')
      .set('Authorization', auth(superAdmin.accessToken))
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it('blocks a non-SuperAdmin from managing plans', async () => {
    const school = await setupTenant();
    const listRes = await request(app).get('/api/v1/subscriptions/plans').set('Authorization', auth(school.accessToken));
    expect(listRes.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/subscriptions/plans')
      .set('Authorization', auth(school.accessToken))
      .send({ name: 'x', priceCents: 100 });
    expect(createRes.status).toBe(403);
  });
});

describe('SchoolAdmin views their own subscription', () => {
  it('returns the plan the school was signed up on', async () => {
    const school = await setupTenant();
    const res = await request(app).get('/api/v1/subscriptions/mine').set('Authorization', auth(school.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.plan_name).toBeTruthy();
    expect(res.body.data.status).toBe('trialing');
  });
});
