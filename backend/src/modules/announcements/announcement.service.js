const db = require('../../config/db');

const TARGET_ROLES = ['all', 'teachers', 'parents', 'students'];

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

const COLUMNS = `a.id, a.school_id, a.title, a.content, a.target_role, a.class_id, a.created_by, u.name AS created_by_name,
  a.published_at, a.created_at`;

// Every school's own announcements plus every platform-wide broadcast
// (school_id IS NULL, posted by a SuperAdmin) — the latter shown to all schools.
async function listAnnouncements(schoolId, { targetRole, classId } = {}) {
  const conditions = ['(a.school_id = ? OR a.school_id IS NULL)'];
  const params = [schoolId];
  if (targetRole) {
    conditions.push('a.target_role = ?');
    params.push(targetRole);
  }
  if (classId) {
    conditions.push('a.class_id = ?');
    params.push(classId);
  }

  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM announcements a
     JOIN users u ON u.id = a.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.published_at DESC`,
    params
  );
  return rows;
}

async function getAnnouncementById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM announcements a
     JOIN users u ON u.id = a.created_by
     WHERE a.id = ? AND a.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

// No draft/scheduling state for MVP — an announcement is published the
// moment it's created.
async function createAnnouncement(schoolId, createdBy, { title, content, targetRole, classId }) {
  if (classId && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO announcements (school_id, title, content, target_role, class_id, created_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW()) RETURNING id`,
    [schoolId, title, content, targetRole || 'all', classId || null, createdBy]
  );
  return getAnnouncementById(schoolId, result[0].id);
}

async function updateAnnouncement(schoolId, id, { title, content, targetRole, classId }) {
  const existing = await getAnnouncementById(schoolId, id);
  if (!existing) return null;

  if (classId !== undefined && classId !== null && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const fields = [];
  const params = [];
  const set = (column, value) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  };
  set('title', title);
  set('content', content);
  set('target_role', targetRole);
  set('class_id', classId);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE announcements SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getAnnouncementById(schoolId, id);
}

async function deleteAnnouncement(schoolId, id) {
  const [result] = await db.query('DELETE FROM announcements WHERE id = ? AND school_id = ?', [id, schoolId]);
  return result.affectedRows > 0;
}

// Parent-visible subset: broadcasts targeted at 'all' or 'parents', and
// either whole-school (class_id IS NULL) or scoped to one of THIS parent's
// own linked children's classes — never another family's class.
async function listForParent(schoolId, parentUserId) {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM announcements a
     JOIN users u ON u.id = a.created_by
     WHERE (a.school_id = ? OR a.school_id IS NULL)
       AND a.target_role IN ('all', 'parents')
       AND (
         a.class_id IS NULL
         OR a.class_id IN (
           SELECT s.class_id FROM student_guardians sg
           JOIN students s ON s.id = sg.student_id
           WHERE sg.school_id = ? AND sg.parent_user_id = ?
         )
       )
     ORDER BY a.published_at DESC`,
    [schoolId, schoolId, parentUserId]
  );
  return rows;
}

// SuperAdmin side — platform-wide broadcasts only (school_id IS NULL),
// always whole-audience (no per-class targeting; that only makes sense
// within a single school).
async function listPlatformAnnouncements() {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM announcements a
     JOIN users u ON u.id = a.created_by
     WHERE a.school_id IS NULL
     ORDER BY a.published_at DESC`
  );
  return rows;
}

async function createPlatformAnnouncement(createdBy, { title, content, targetRole }) {
  const [result] = await db.query(
    `INSERT INTO announcements (school_id, title, content, target_role, class_id, created_by, published_at)
     VALUES (NULL, ?, ?, ?, NULL, ?, NOW()) RETURNING id`,
    [title, content, targetRole || 'all', createdBy]
  );
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM announcements a JOIN users u ON u.id = a.created_by WHERE a.id = ?`,
    [result[0].id]
  );
  return rows[0];
}

async function deletePlatformAnnouncement(id) {
  const [result] = await db.query('DELETE FROM announcements WHERE id = ? AND school_id IS NULL', [id]);
  return result.affectedRows > 0;
}

// Epoch, not NULL — a user who's never visited the Announcements page yet
// should have every visible announcement count as unread, and comparing
// against a fixed old date is simpler than pushing a NULL-handling
// COALESCE into every caller.
const NEVER_SEEN = new Date(0);

async function getLastSeenAnnouncementsAt(userId) {
  const [rows] = await db.query('SELECT last_seen_announcements_at FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0]?.last_seen_announcements_at || NEVER_SEEN;
}

// Marking "seen" is a per-user, cross-role concept (the same users row for
// staff and parents alike), so one function covers both call sites below.
async function markAnnouncementsSeen(userId) {
  await db.query('UPDATE users SET last_seen_announcements_at = NOW() WHERE id = ?', [userId]);
}

// Mirrors listAnnouncements' visibility rules exactly (own school +
// platform-wide, no target_role/class filtering — staff sees everything),
// just counting instead of returning rows.
async function countUnreadForStaff(schoolId, userId) {
  const since = await getLastSeenAnnouncementsAt(userId);
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM announcements a
     WHERE (a.school_id = ? OR a.school_id IS NULL) AND a.published_at > ?`,
    [schoolId, since]
  );
  return Number(rows[0].count);
}

// Mirrors listForParent's visibility rules exactly (own school +
// platform-wide, target_role in ('all','parents'), class-scoped to this
// parent's own linked children).
async function countUnreadForParent(schoolId, parentUserId) {
  const since = await getLastSeenAnnouncementsAt(parentUserId);
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM announcements a
     WHERE (a.school_id = ? OR a.school_id IS NULL)
       AND a.target_role IN ('all', 'parents')
       AND (
         a.class_id IS NULL
         OR a.class_id IN (
           SELECT s.class_id FROM student_guardians sg
           JOIN students s ON s.id = sg.student_id
           WHERE sg.school_id = ? AND sg.parent_user_id = ?
         )
       )
       AND a.published_at > ?`,
    [schoolId, schoolId, parentUserId, since]
  );
  return Number(rows[0].count);
}

module.exports = {
  TARGET_ROLES,
  listAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  listForParent,
  listPlatformAnnouncements,
  createPlatformAnnouncement,
  deletePlatformAnnouncement,
  markAnnouncementsSeen,
  countUnreadForStaff,
  countUnreadForParent,
};
