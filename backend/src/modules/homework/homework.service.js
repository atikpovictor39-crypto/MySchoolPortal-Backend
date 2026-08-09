const db = require('../../config/db');

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function subjectBelongsToSchool(schoolId, subjectId) {
  const [rows] = await db.query('SELECT id FROM subjects WHERE id = ? AND school_id = ? LIMIT 1', [
    subjectId,
    schoolId,
  ]);
  return rows.length > 0;
}

const COLUMNS = `h.id, h.class_id, h.subject_id, sub.name AS subject_name, h.title, h.description,
  h.due_date, h.created_by, u.name AS created_by_name, h.created_at`;

async function listHomework(schoolId, { classId, subjectId } = {}) {
  const conditions = ['h.school_id = ?'];
  const params = [schoolId];
  if (classId) {
    conditions.push('h.class_id = ?');
    params.push(classId);
  }
  if (subjectId) {
    conditions.push('h.subject_id = ?');
    params.push(subjectId);
  }

  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM homework h
     JOIN subjects sub ON sub.id = h.subject_id
     JOIN users u ON u.id = h.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY h.due_date DESC`,
    params
  );
  return rows;
}

async function getHomeworkById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM homework h
     JOIN subjects sub ON sub.id = h.subject_id
     JOIN users u ON u.id = h.created_by
     WHERE h.id = ? AND h.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

async function createHomework(schoolId, createdBy, { classId, subjectId, title, description, dueDate }) {
  if (!(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (!(await subjectBelongsToSchool(schoolId, subjectId))) {
    const err = new Error('subjectId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    'INSERT INTO homework (school_id, class_id, subject_id, title, description, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [schoolId, classId, subjectId, title, description || null, dueDate, createdBy]
  );
  return getHomeworkById(schoolId, result[0].id);
}

async function updateHomework(schoolId, id, { classId, subjectId, title, description, dueDate }) {
  const existing = await getHomeworkById(schoolId, id);
  if (!existing) return null;

  if (classId !== undefined && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (subjectId !== undefined && !(await subjectBelongsToSchool(schoolId, subjectId))) {
    const err = new Error('subjectId does not belong to this school');
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
  set('class_id', classId);
  set('subject_id', subjectId);
  set('title', title);
  set('description', description);
  set('due_date', dueDate);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE homework SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getHomeworkById(schoolId, id);
}

async function deleteHomework(schoolId, id) {
  const [result] = await db.query('DELETE FROM homework WHERE id = ? AND school_id = ?', [id, schoolId]);
  return result.affectedRows > 0;
}

// Parent-visible: homework for whichever class a specific child of theirs is in.
// Ownership of the studentId is checked by the caller (parent.controller.js),
// same split of responsibility as every other parent-facing endpoint.
async function listForClass(schoolId, classId) {
  return listHomework(schoolId, { classId });
}

module.exports = {
  listHomework,
  getHomeworkById,
  createHomework,
  updateHomework,
  deleteHomework,
  listForClass,
};
