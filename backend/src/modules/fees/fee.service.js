const db = require('../../config/db');

const INVOICE_STATUSES = ['unpaid', 'partial', 'paid', 'overdue', 'waived'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'mobile_money', 'other'];

async function classBelongsToSchool(schoolId, classId) {
  const [rows] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ? LIMIT 1', [
    classId,
    schoolId,
  ]);
  return rows.length > 0;
}

async function academicYearBelongsToSchool(schoolId, academicYearId) {
  const [rows] = await db.query('SELECT id FROM academic_years WHERE id = ? AND school_id = ? LIMIT 1', [
    academicYearId,
    schoolId,
  ]);
  return rows.length > 0;
}

// ---- Fee Structures (templates, e.g. "Term 1 Tuition - Grade 5") ----

async function listFeeStructures(schoolId) {
  const [rows] = await db.query(
    `SELECT id, academic_year_id, class_id, name, amount_cents, due_date, created_at
     FROM fee_structures WHERE school_id = ? ORDER BY created_at DESC`,
    [schoolId]
  );
  return rows;
}

async function getFeeStructureById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT id, academic_year_id, class_id, name, amount_cents, due_date, created_at
     FROM fee_structures WHERE id = ? AND school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  return rows[0] || null;
}

async function createFeeStructure(schoolId, { academicYearId, classId, name, amountCents, dueDate }) {
  if (!(await academicYearBelongsToSchool(schoolId, academicYearId))) {
    const err = new Error('academicYearId does not belong to this school');
    err.status = 400;
    throw err;
  }
  if (classId && !(await classBelongsToSchool(schoolId, classId))) {
    const err = new Error('classId does not belong to this school');
    err.status = 400;
    throw err;
  }

  const [result] = await db.query(
    'INSERT INTO fee_structures (school_id, academic_year_id, class_id, name, amount_cents, due_date) VALUES (?, ?, ?, ?, ?, ?)',
    [schoolId, academicYearId, classId || null, name, amountCents, dueDate || null]
  );
  return getFeeStructureById(schoolId, result.insertId);
}

// Generates one invoice per matching active student (all students if the
// structure has no class_id, otherwise just that class). Idempotent —
// students who already have an invoice for this structure are skipped, so
// clicking "Generate" twice never double-bills anyone.
async function generateInvoices(schoolId, structureId) {
  const structure = await getFeeStructureById(schoolId, structureId);
  if (!structure) {
    const err = new Error('Fee structure not found');
    err.status = 404;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const studentSql = structure.class_id
      ? "SELECT id FROM students WHERE school_id = ? AND class_id = ? AND status = 'active'"
      : "SELECT id FROM students WHERE school_id = ? AND status = 'active'";
    const studentParams = structure.class_id ? [schoolId, structure.class_id] : [schoolId];
    const [students] = await conn.query(studentSql, studentParams);

    const [existing] = await conn.query(
      'SELECT student_id FROM fee_invoices WHERE fee_structure_id = ? AND school_id = ?',
      [structureId, schoolId]
    );
    const alreadyInvoiced = new Set(existing.map((r) => r.student_id));

    let created = 0;
    for (const student of students) {
      if (alreadyInvoiced.has(student.id)) continue;
      await conn.query(
        `INSERT INTO fee_invoices (school_id, student_id, fee_structure_id, amount_due_cents, amount_paid_cents, status, due_date)
         VALUES (?, ?, ?, ?, 0, 'unpaid', ?)`,
        [schoolId, student.id, structureId, structure.amount_cents, structure.due_date]
      );
      created += 1;
    }

    await conn.commit();
    return { totalStudents: students.length, invoicesCreated: created, alreadyInvoiced: students.length - created };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---- Invoices ----

const INVOICE_COLUMNS = `fi.id, fi.student_id, fi.fee_structure_id, fi.amount_due_cents, fi.amount_paid_cents,
  fi.status, fi.due_date, fi.created_at, s.first_name, s.last_name, s.admission_no, s.class_id, fs.name AS fee_name`;

async function listInvoices(schoolId, { studentId, classId, status } = {}) {
  const conditions = ['fi.school_id = ?'];
  const params = [schoolId];
  if (studentId) {
    conditions.push('fi.student_id = ?');
    params.push(studentId);
  }
  if (classId) {
    conditions.push('s.class_id = ?');
    params.push(classId);
  }
  if (status) {
    conditions.push('fi.status = ?');
    params.push(status);
  }

  const [rows] = await db.query(
    `SELECT ${INVOICE_COLUMNS}
     FROM fee_invoices fi
     JOIN students s ON s.id = fi.student_id
     JOIN fee_structures fs ON fs.id = fi.fee_structure_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY fi.created_at DESC`,
    params
  );
  return rows;
}

async function getInvoiceById(schoolId, id) {
  const [rows] = await db.query(
    `SELECT ${INVOICE_COLUMNS}
     FROM fee_invoices fi
     JOIN students s ON s.id = fi.student_id
     JOIN fee_structures fs ON fs.id = fi.fee_structure_id
     WHERE fi.id = ? AND fi.school_id = ? LIMIT 1`,
    [id, schoolId]
  );
  const invoice = rows[0];
  if (!invoice) return null;

  const [payments] = await db.query(
    `SELECT id, amount_cents, payment_method, payment_ref, paid_at, recorded_by
     FROM fee_payments WHERE invoice_id = ? AND school_id = ? ORDER BY paid_at ASC`,
    [id, schoolId]
  );

  return { ...invoice, payments };
}

// ---- Payments ----

// FOR UPDATE row-locks the invoice for the duration of the transaction so
// two concurrent payments against the same invoice can't both read the same
// "remaining balance" and jointly overpay it.
async function recordPayment(schoolId, invoiceId, { amountCents, paymentMethod, paymentRef, paidAt, recordedBy }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, student_id, amount_due_cents, amount_paid_cents, status FROM fee_invoices WHERE id = ? AND school_id = ? FOR UPDATE',
      [invoiceId, schoolId]
    );
    const invoice = rows[0];
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.status = 404;
      throw err;
    }
    if (invoice.status === 'paid' || invoice.status === 'waived') {
      const err = new Error(`Invoice is already ${invoice.status}`);
      err.status = 400;
      throw err;
    }

    const remaining = invoice.amount_due_cents - invoice.amount_paid_cents;
    if (amountCents > remaining) {
      const err = new Error(`Payment of ${amountCents} exceeds remaining balance of ${remaining}`);
      err.status = 400;
      throw err;
    }

    await conn.query(
      `INSERT INTO fee_payments (school_id, invoice_id, student_id, amount_cents, payment_method, payment_ref, paid_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolId,
        invoiceId,
        invoice.student_id,
        amountCents,
        paymentMethod || 'cash',
        paymentRef || null,
        paidAt || new Date(),
        recordedBy,
      ]
    );

    const newPaid = invoice.amount_paid_cents + amountCents;
    const newStatus = newPaid >= invoice.amount_due_cents ? 'paid' : 'partial';

    await conn.query('UPDATE fee_invoices SET amount_paid_cents = ?, status = ? WHERE id = ?', [
      newPaid,
      newStatus,
      invoiceId,
    ]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getInvoiceById(schoolId, invoiceId);
}

// ---- Debtors ----

async function listDebtors(schoolId) {
  const [rows] = await db.query(
    `SELECT s.id AS student_id, s.admission_no, s.first_name, s.last_name, s.class_id,
       SUM(fi.amount_due_cents) AS total_due_cents,
       SUM(fi.amount_paid_cents) AS total_paid_cents,
       SUM(fi.amount_due_cents - fi.amount_paid_cents) AS balance_cents
     FROM fee_invoices fi
     JOIN students s ON s.id = fi.student_id
     WHERE fi.school_id = ? AND fi.status IN ('unpaid', 'partial', 'overdue')
     GROUP BY s.id, s.admission_no, s.first_name, s.last_name, s.class_id
     HAVING balance_cents > 0
     ORDER BY balance_cents DESC`,
    [schoolId]
  );
  return rows;
}

module.exports = {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  listFeeStructures,
  getFeeStructureById,
  createFeeStructure,
  generateInvoices,
  listInvoices,
  getInvoiceById,
  recordPayment,
  listDebtors,
};
