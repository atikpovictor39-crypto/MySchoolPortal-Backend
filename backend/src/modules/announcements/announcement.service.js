const db = require('../../config/db');

const TARGET_ROLES = ['all', 'teachers', 'parents', 'students'];

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

const COLUMNS = `a.id, a.title, a.content, a.target_role, a.class_id, a.created_by, u.name AS created_by_name,
  a.published_at, a.created_at`;

async function listAnnouncements(schoolId, { targetRole, classId } = {}) {
  const conditions = ['a.school_id = ?'];
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
     WHERE a.school_id = ?
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

module.exports = {
  TARGET_ROLES,
  listAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  listForParent,
};
