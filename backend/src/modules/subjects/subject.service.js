const db = require('../../config/db');

async function listSubjects(schoolId) {
  const [rows] = await db.query('SELECT id, name, code FROM subjects WHERE school_id = ? ORDER BY name', [schoolId]);
  return rows;
}

async function getSubjectById(schoolId, id) {
  const [rows] = await db.query('SELECT id, name, code FROM subjects WHERE id = ? AND school_id = ? LIMIT 1', [
    id,
    schoolId,
  ]);
  return rows[0] || null;
}

async function createSubject(schoolId, { name, code }) {
  const [result] = await db.query('INSERT INTO subjects (school_id, name, code) VALUES (?, ?, ?) RETURNING id', [
    schoolId,
    name,
    code || null,
  ]);
  return getSubjectById(schoolId, result[0].id);
}

async function updateSubject(schoolId, id, { name, code }) {
  const existing = await getSubjectById(schoolId, id);
  if (!existing) return null;

  const fields = [];
  const params = [];
  const set = (column, value) => {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  };
  set('name', name);
  set('code', code);

  if (fields.length === 0) return existing;

  params.push(id, schoolId);
  await db.query(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
  return getSubjectById(schoolId, id);
}

// class_subjects.subject_id cascades on delete, which would silently wipe
// every class's assignment of this subject (and, transitively, its
// timetable slots) — checked up front instead so that's a deliberate,
// visible step ("unassign it from classes first") rather than a silent
// side effect of deleting the subject record.
async function deleteSubject(schoolId, id) {
  const existing = await getSubjectById(schoolId, id);
  if (!existing) return null;

  const [rows] = await db.query('SELECT COUNT(*) AS count FROM class_subjects WHERE subject_id = ? AND school_id = ?', [
    id,
    schoolId,
  ]);
  if (Number(rows[0].count) > 0) {
    const err = new Error('This subject is still assigned to one or more classes — remove it from those first');
    err.status = 400;
    throw err;
  }

  await db.query('DELETE FROM subjects WHERE id = ? AND school_id = ?', [id, schoolId]);
  return true;
}

module.exports = { listSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
