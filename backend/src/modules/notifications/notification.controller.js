const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const notificationService = require('./notification.service');

exports.list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.list(req.schoolId);
  return ok(res, notifications);
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.countUnread(req.schoolId);
  return ok(res, { count });
});

exports.markRead = asyncHandler(async (req, res) => {
  const found = await notificationService.markRead(req.schoolId, req.params.id);
  if (!found) return fail(res, 'Notification not found', 404);
  return ok(res, { id: Number(req.params.id), is_read: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.schoolId);
  return ok(res, null);
});
