const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const env = require('../../config/env');
const pushService = require('./push.service');

exports.getPublicKey = asyncHandler(async (req, res) => {
  if (!pushService.isConfigured) {
    return fail(res, 'Push notifications are not configured on this server', 503);
  }
  return ok(res, { publicKey: env.vapid.publicKey });
});

exports.subscribe = asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return fail(res, 'A valid PushSubscription (endpoint + keys.p256dh + keys.auth) is required', 400);
  }

  await pushService.saveSubscription(req.schoolId, req.user.id, { endpoint, keys });
  return ok(res, null, 201);
});

exports.unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return fail(res, 'endpoint is required', 400);
  }

  await pushService.deleteSubscription(req.user.id, endpoint);
  return ok(res, null);
});
