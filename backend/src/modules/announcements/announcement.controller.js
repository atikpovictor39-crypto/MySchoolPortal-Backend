const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/apiResponse');
const announcementService = require('./announcement.service');

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
