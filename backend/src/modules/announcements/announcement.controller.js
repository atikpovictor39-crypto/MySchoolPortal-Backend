const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const announcementService = require('./announcement.service');
const auditService = require('../audit/audit.service');

exports.list = asyncHandler(async (req, res) => {
  const { targetRole, classId } = req.query;
  if (targetRole && !announcementService.TARGET_ROLES.includes(targetRole)) {
    return fail(res, `targetRole must be one of: ${announcementService.TARGET_ROLES.join(', ')}`, 400);
  }

  const announcements = await announcementService.listAnnouncements(req.schoolId, { targetRole, classId });
  return ok(res, announcements);
});

exports.getById = asyncHandler(async (req, res) => {
  const announcement = await announcementService.getAnnouncementById(req.schoolId, req.params.id);
  if (!announcement) return fail(res, 'Announcement not found', 404);
  return ok(res, announcement);
});

exports.create = asyncHandler(async (req, res) => {
  const { title, content, targetRole, classId } = req.body;
  if (!title || !content) {
    return fail(res, 'title and content are required', 400);
  }
  if (targetRole && !announcementService.TARGET_ROLES.includes(targetRole)) {
    return fail(res, `targetRole must be one of: ${announcementService.TARGET_ROLES.join(', ')}`, 400);
  }

  const announcement = await announcementService.createAnnouncement(req.schoolId, req.user.id, {
    title,
    content,
    targetRole,
    classId,
  });

  await auditService.record({
    schoolId: req.schoolId,
    userId: req.user.id,
    action: 'announcement.created',
    description: `Posted announcement "${title}"`,
  });

  return ok(res, announcement, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { title, content, targetRole, classId } = req.body;
  if (targetRole && !announcementService.TARGET_ROLES.includes(targetRole)) {
    return fail(res, `targetRole must be one of: ${announcementService.TARGET_ROLES.join(', ')}`, 400);
  }

  const announcement = await announcementService.updateAnnouncement(req.schoolId, req.params.id, {
    title,
    content,
    targetRole,
    classId,
  });
  if (!announcement) return fail(res, 'Announcement not found', 404);
  return ok(res, announcement);
});

exports.remove = asyncHandler(async (req, res) => {
  const deleted = await announcementService.deleteAnnouncement(req.schoolId, req.params.id);
  if (!deleted) return fail(res, 'Announcement not found', 404);
  return ok(res, null);
});

// Powers the badge next to the Announcements nav link.
exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await announcementService.countUnreadForStaff(req.schoolId, req.user.id);
  return ok(res, { count });
});

// Called when the Announcements page mounts — clears the badge.
exports.markSeen = asyncHandler(async (req, res) => {
  await announcementService.markAnnouncementsSeen(req.user.id);
  return ok(res, null);
});

// ---- SuperAdmin platform-wide broadcasts ----

exports.listPlatform = asyncHandler(async (req, res) => {
  const announcements = await announcementService.listPlatformAnnouncements();
  return ok(res, announcements);
});

exports.createPlatform = asyncHandler(async (req, res) => {
  const { title, content, targetRole } = req.body;
  if (!title || !content) {
    return fail(res, 'title and content are required', 400);
  }
  if (targetRole && !announcementService.TARGET_ROLES.includes(targetRole)) {
    return fail(res, `targetRole must be one of: ${announcementService.TARGET_ROLES.join(', ')}`, 400);
  }

  const announcement = await announcementService.createPlatformAnnouncement(req.user.id, {
    title,
    content,
    targetRole,
  });
  return ok(res, announcement, 201);
});

exports.removePlatform = asyncHandler(async (req, res) => {
  const deleted = await announcementService.deletePlatformAnnouncement(req.params.id);
  if (!deleted) return fail(res, 'Announcement not found', 404);
  return ok(res, null);
});
