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

module.exports = { listSubjects, getSubjectById, createSubject, updateSubject };
