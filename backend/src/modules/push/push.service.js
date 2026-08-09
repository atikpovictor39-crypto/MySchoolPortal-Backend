const webpush = require('web-push');
const db = require('../../config/db');
const env = require('../../config/env');

const isConfigured = Boolean(env.vapid.publicKey && env.vapid.privateKey);

if (isConfigured) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

async function saveSubscription(schoolId, userId, { endpoint, keys }) {
  await db.query(
    `INSERT INTO push_subscriptions (school_id, user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT ON CONSTRAINT uq_user_endpoint
     DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [schoolId, userId, endpoint, keys.p256dh, keys.auth]
  );
}

async function deleteSubscription(userId, endpoint) {
  await db.query('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, endpoint]);
}

// Sends to every device a user has subscribed on. A subscription that the
// push service reports as gone (410) or not found (404) is stale — likely
// the user uninstalled the app or cleared browser data — so it's deleted
// rather than retried forever.
async function sendToUser(schoolId, userId, payload) {
  if (!isConfigured) return;

  const [rows] = await db.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE school_id = ? AND user_id = ?',
    [schoolId, userId]
  );

  await Promise.all(
    rows.map(async (row) => {
      const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await deleteSubscription(userId, row.endpoint);
        } else {
          console.error('Push send failed:', err.message);
        }
      }
    })
  );
}

async function sendToUsers(schoolId, userIds, payload) {
  await Promise.all(userIds.map((userId) => sendToUser(schoolId, userId, payload)));
}

module.exports = { isConfigured, saveSubscription, deleteSubscription, sendToUser, sendToUsers };
