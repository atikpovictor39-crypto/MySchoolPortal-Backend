const db = require('../src/config/db');
const { resetDatabase } = require('./helpers/resetDb');
const { app, request, auth, registerSchool, login, createSuperAdmin } = require('./helpers/fixtures');
const subscriptionService = require('../src/modules/subscriptions/subscription.service');

afterAll(async () => {
  await db.end();
});

async function setSubscription(schoolId, { status, currentPeriodEnd, reminderSentAt }) {
  await db.query(
    `UPDATE subscriptions SET status = ?, current_period_end = ?, reminder_sent_at = ? WHERE school_id = ?`,
    [status, currentPeriodEnd, reminderSentAt || null, schoolId]
  );
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('Subscription lifecycle cron logic', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('sends a reminder and marks reminder_sent_at when the period ends within 3 days', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'active', currentPeriodEnd: daysFromNow(2) });

    const results = await subscriptionService.processSubscriptionLifecycle();
    expect(results.remindersSent).toBe(1);

    const sub = await subscriptionService.getMySubscription(school.user.school_id);
    expect(sub.status).toBe('active');
  });

  it('does not resend a reminder that already went out', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, {
      status: 'active',
      currentPeriodEnd: daysFromNow(2),
      reminderSentAt: new Date(),
    });

    const results = await subscriptionService.processSubscriptionLifecycle();
    expect(results.remindersSent).toBe(0);
  });

  it('marks a lapsed active subscription past_due', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'active', currentPeriodEnd: daysFromNow(-1) });

    const results = await subscriptionService.processSubscriptionLifecycle();
    expect(results.markedPastDue).toBe(1);

    const sub = await subscriptionService.getMySubscription(school.user.school_id);
    expect(sub.status).toBe('past_due');
  });

  it('leaves a freshly past_due subscription alone until the 7-day grace period passes', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'past_due', currentPeriodEnd: daysFromNow(-2) });

    const results = await subscriptionService.processSubscriptionLifecycle();
    expect(results.markedExpired).toBe(0);

    const sub = await subscriptionService.getMySubscription(school.user.school_id);
    expect(sub.status).toBe('past_due');
  });

  it('marks past_due subscriptions expired once the grace period has passed', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'past_due', currentPeriodEnd: daysFromNow(-8) });

    const results = await subscriptionService.processSubscriptionLifecycle();
    expect(results.markedExpired).toBe(1);

    const sub = await subscriptionService.getMySubscription(school.user.school_id);
    expect(sub.status).toBe('expired');
  });

  it('leaves subscriptions with plenty of time left untouched', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'active', currentPeriodEnd: daysFromNow(20) });

    const results = await subscriptionService.processSubscriptionLifecycle();
    expect(results.remindersSent).toBe(0);
    expect(results.markedPastDue).toBe(0);
    expect(results.markedExpired).toBe(0);
  });
});

describe('Login blocking on subscription status', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('blocks login once the subscription is expired', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'expired', currentPeriodEnd: daysFromNow(-10) });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/subscription has expired/i);
  });

  it('still allows login while only past_due (inside the grace period)', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, { status: 'past_due', currentPeriodEnd: daysFromNow(-2) });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    expect(res.status).toBe(200);
  });
});

describe('SuperAdmin renews a subscription', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('resets an expired subscription back to active with a fresh period', async () => {
    const school = await registerSchool();
    await setSubscription(school.user.school_id, {
      status: 'expired',
      currentPeriodEnd: daysFromNow(-10),
      reminderSentAt: new Date(),
    });
    const superAdmin = await createSuperAdmin();

    const res = await request(app)
      .post(`/api/v1/subscriptions/${school.user.school_id}/renew`)
      .set('Authorization', auth(superAdmin.accessToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: school.credentials.adminEmail, password: school.credentials.adminPassword });
    expect(loginRes.status).toBe(200);
  });

  it('blocks a non-SuperAdmin from renewing', async () => {
    const school = await registerSchool();
    const res = await request(app)
      .post(`/api/v1/subscriptions/${school.user.school_id}/renew`)
      .set('Authorization', auth(school.accessToken))
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('Cron endpoint auth', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/internal/cron/subscriptions');
    expect(res.status).toBe(401);
  });

  it('rejects the wrong secret', async () => {
    const res = await request(app)
      .get('/api/v1/internal/cron/subscriptions')
      .set('Authorization', 'Bearer wrong-secret');
    expect(res.status).toBe(401);
  });

  it('accepts the correct secret (matches .env.test CRON_SECRET)', async () => {
    const res = await request(app)
      .get('/api/v1/internal/cron/subscriptions')
      .set('Authorization', 'Bearer test_cron_secret_do_not_use_in_prod');
    expect(res.status).toBe(200);
  });
});
