jest.mock('../src/modules/moolre/moolre.client', () => ({
  isConfigured: true,
  generatePaymentLink: jest.fn(),
  checkPaymentStatus: jest.fn(),
  centsToAmountString: (cents) => (cents / 100).toFixed(2),
}));

const db = require('../src/config/db');
const moolreClient = require('../src/modules/moolre/moolre.client');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, setupTenant, createSuperAdmin, login } = require('./helpers/fixtures');

afterAll(async () => {
  await db.end();
});

beforeEach(async () => {
  await resetDatabase();
  jest.clearAllMocks();
  moolreClient.isConfigured = true;
  moolreClient.generatePaymentLink.mockResolvedValue({
    authorizationUrl: 'https://pos.moolre.com/fake-checkout',
    reference: 'moolre-ref-123',
  });
});

async function createActivePlan(superadminToken, overrides = {}) {
  const res = await request(app)
    .post('/api/v1/subscriptions/plans')
    .set('Authorization', auth(superadminToken))
    .send({
      name: overrides.name || 'Checkout Test Plan',
      priceCents: overrides.priceCents ?? 5000,
      billingCycle: overrides.billingCycle || 'monthly',
    });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('School subscription checkout via MoolRe', () => {
  it('starts a checkout and stores a pending payment', async () => {
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken);
    const tenant = await setupTenant();

    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(tenant.accessToken))
      .send({ planId: plan.id });

    expect(res.status).toBe(201);
    expect(res.body.data.authorizationUrl).toBe('https://pos.moolre.com/fake-checkout');
    expect(res.body.data.externalRef).toBeTruthy();
    expect(moolreClient.generatePaymentLink).toHaveBeenCalledTimes(1);
    const callArgs = moolreClient.generatePaymentLink.mock.calls[0][0];
    expect(callArgs.amountCents).toBe(5000);
  });

  it('returns 503 when MoolRe is not configured', async () => {
    moolreClient.isConfigured = false;
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken);
    const tenant = await setupTenant();

    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(tenant.accessToken))
      .send({ planId: plan.id });

    expect(res.status).toBe(503);
  });

  it('blocks checkout for a demo school', async () => {
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken);
    const tenant = await setupTenant();
    await db.query('UPDATE schools SET is_demo = TRUE WHERE id = ?', [tenant.user.school_id]);
    const relogged = await login(tenant.credentials.adminEmail, tenant.credentials.adminPassword);

    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(relogged.accessToken))
      .send({ planId: plan.id });

    expect(res.status).toBe(403);
  });

  it('activates the subscription once the status check confirms success', async () => {
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken, { priceCents: 10000, billingCycle: 'yearly' });
    const tenant = await setupTenant();

    const checkoutRes = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(tenant.accessToken))
      .send({ planId: plan.id });
    const { externalRef } = checkoutRes.body.data;

    moolreClient.checkPaymentStatus.mockResolvedValue({ succeeded: true, raw: { status: 1 } });

    const statusRes = await request(app)
      .get(`/api/v1/subscriptions/checkout/${externalRef}`)
      .set('Authorization', auth(tenant.accessToken));

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('success');

    const mineRes = await request(app).get('/api/v1/subscriptions/mine').set('Authorization', auth(tenant.accessToken));
    expect(mineRes.body.data.status).toBe('active');
    expect(mineRes.body.data.plan_id).toBe(plan.id);

    const [events] = await db.query("SELECT * FROM billing_events WHERE event_type = 'moolre.payment_confirmed'");
    expect(events.length).toBe(1);
  });

  it('does not extend the period twice when checked again after already succeeding', async () => {
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken);
    const tenant = await setupTenant();

    const checkoutRes = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(tenant.accessToken))
      .send({ planId: plan.id });
    const { externalRef } = checkoutRes.body.data;

    moolreClient.checkPaymentStatus.mockResolvedValue({ succeeded: true, raw: { status: 1 } });
    await request(app).get(`/api/v1/subscriptions/checkout/${externalRef}`).set('Authorization', auth(tenant.accessToken));

    // Second poll — since the payment is already 'success', this must not
    // call MoolRe again or touch the subscription a second time.
    const secondRes = await request(app)
      .get(`/api/v1/subscriptions/checkout/${externalRef}`)
      .set('Authorization', auth(tenant.accessToken));

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.data.status).toBe('success');
    expect(moolreClient.checkPaymentStatus).toHaveBeenCalledTimes(1);

    const [events] = await db.query("SELECT * FROM billing_events WHERE event_type = 'moolre.payment_confirmed'");
    expect(events.length).toBe(1);
  });

  it("404s when checking a payment that belongs to another school", async () => {
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken);
    const tenantA = await setupTenant();
    const tenantB = await setupTenant();

    const checkoutRes = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(tenantA.accessToken))
      .send({ planId: plan.id });
    const { externalRef } = checkoutRes.body.data;

    const res = await request(app)
      .get(`/api/v1/subscriptions/checkout/${externalRef}`)
      .set('Authorization', auth(tenantB.accessToken));

    expect(res.status).toBe(404);
  });

  it('activates the subscription when the webhook triggers a successful re-check', async () => {
    const superadmin = await createSuperAdmin();
    const plan = await createActivePlan(superadmin.accessToken);
    const tenant = await setupTenant();

    const checkoutRes = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', auth(tenant.accessToken))
      .send({ planId: plan.id });
    const { externalRef } = checkoutRes.body.data;

    moolreClient.checkPaymentStatus.mockResolvedValue({ succeeded: true, raw: { status: 1 } });

    const webhookRes = await request(app)
      .post('/api/v1/subscriptions/webhook/moolre')
      .send({ status: 1, code: 'SS01', message: 'ok', data: { externalref: externalRef } });

    expect(webhookRes.status).toBe(200);

    const mineRes = await request(app).get('/api/v1/subscriptions/mine').set('Authorization', auth(tenant.accessToken));
    expect(mineRes.body.data.status).toBe('active');
  });

  it('does not error on a webhook with a garbled or missing externalref', async () => {
    const res = await request(app).post('/api/v1/subscriptions/webhook/moolre').send({ nonsense: true });
    expect(res.status).toBe(200);
    expect(moolreClient.checkPaymentStatus).not.toHaveBeenCalled();
  });
});

describe('School-facing list of plans to pay for', () => {
  // Regression test: the Subscription page originally called the
  // SuperAdmin-only GET /subscriptions/plans and 403'd for every real
  // school admin — GET /subscriptions/plans/active is the fix.
  it('a SCHOOL_ADMIN can list active plans but is blocked from the SuperAdmin plans endpoint', async () => {
    const tenant = await setupTenant();

    const activeRes = await request(app)
      .get('/api/v1/subscriptions/plans/active')
      .set('Authorization', auth(tenant.accessToken));
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.length).toBeGreaterThan(0);
    expect(activeRes.body.data.every((p) => p.is_active === undefined)).toBe(true); // trimmed response shape

    const superadminOnlyRes = await request(app)
      .get('/api/v1/subscriptions/plans')
      .set('Authorization', auth(tenant.accessToken));
    expect(superadminOnlyRes.status).toBe(403);
  });

  it('excludes inactive plans from the active list', async () => {
    const superadmin = await createSuperAdmin();
    const tenant = await setupTenant();

    const inactivePlan = await createActivePlan(superadmin.accessToken, { name: 'Retired Plan' });
    await request(app)
      .put(`/api/v1/subscriptions/plans/${inactivePlan.id}`)
      .set('Authorization', auth(superadmin.accessToken))
      .send({ isActive: false });

    const res = await request(app)
      .get('/api/v1/subscriptions/plans/active')
      .set('Authorization', auth(tenant.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p.name === 'Retired Plan')).toBe(false);
  });
});
