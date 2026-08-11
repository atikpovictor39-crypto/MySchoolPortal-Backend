const db = require('../../config/db');

const COLUMNS = 'id, name, start_date, end_date, is_current';

async function listAcademicYears(schoolId) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM academic_years WHERE school_id = ? ORDER BY start_date DESC`, [
    schoolId,
  ]);
  return rows;
}

async function getAcademicYearById(schoolId, id) {
  const [rows] = await db.query(`SELECT ${COLUMNS} FROM academic_years WHERE id = ? AND school_id = ? LIMIT 1`, [
    id,
    schoolId,
  ]);
  return rows[0] || null;
}

// Only one academic year can be "current" per school — setting a new one
// current always clears the previous holder in the same transaction.
async function createAcademicYear(schoolId, { name, startDate, endDate, isCurrent }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (isCurrent) {
      await conn.query('UPDATE academic_years SET is_current = FALSE WHERE school_id = ?', [schoolId]);
    }

    const [result] = await conn.query(
      'INSERT INTO academic_years (school_id, name, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [schoolId, name, startDate, endDate, Boolean(isCurrent)]
    );

    await conn.commit();
    return getAcademicYearById(schoolId, result[0].id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateAcademicYear(schoolId, id, { name, startDate, endDate, isCurrent }) {
  const existing = await getAcademicYearById(schoolId, id);
  if (!existing) return null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (isCurrent) {
      await conn.query('UPDATE academic_years SET is_current = FALSE WHERE school_id = ?', [schoolId]);
    }

    const fields = [];
    const params = [];
    const set = (column, value) => {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    };
    set('name', name);
    set('start_date', startDate);
    set('end_date', endDate);
    if (isCurrent !== undefined) set('is_current', Boolean(isCurrent));

    if (fields.length > 0) {
      params.push(id, schoolId);
      await conn.query(`UPDATE academic_years SET ${fields.join(', ')} WHERE id = ? AND school_id = ?`, params);
    }

    await conn.commit();
    return getAcademicYearById(schoolId, id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// classes.academic_year_id cascades on delete, which would silently wipe
// every class under this year (and, transitively, their students would hit
// the RESTRICT on students.class_id and block the whole delete anyway —
// but a class with no students yet would just vanish along with its
// timetable/homework/results). Checked up front so removing a year's
// classes is a deliberate step, not a surprise side effect.
async function deleteAcademicYear(schoolId, id) {
  const existing = await getAcademicYearById(schoolId, id);
  if (!existing) return null;

  const [rows] = await db.query('SELECT COUNT(*) AS count FROM classes WHERE academic_year_id = ? AND school_id = ?', [
    id,
    schoolId,
  ]);
  if (Number(rows[0].count) > 0) {
    const err = new Error('This academic year still has classes under it — delete those first');
    err.status = 400;
    throw err;
  }

  await db.query('DELETE FROM academic_years WHERE id = ? AND school_id = ?', [id, schoolId]);
  return true;
}

module.exports = {
  listAcademicYears,
  getAcademicYearById,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
};
