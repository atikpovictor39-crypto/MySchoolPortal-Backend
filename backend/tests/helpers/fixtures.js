const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { hashPassword } = require('../../src/utils/password');

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerSchool(overrides = {}) {
  const payload = {
    schoolName: overrides.schoolName || 'Test School',
    adminName: overrides.adminName || 'Test Admin',
    adminEmail: overrides.adminEmail || uniqueEmail('admin'),
    adminPassword: overrides.adminPassword || 'testpassword123',
  };
  const res = await request(app).post('/api/v1/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`registerSchool failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { accessToken: res.body.data.accessToken, user: res.body.data.user, credentials: payload };
}

async function login(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { accessToken: res.body.data.accessToken, user: res.body.data.user };
}

function auth(token) {
  return `Bearer ${token}`;
}

// Builds a fully working tenant — school + admin + academic year + class —
// ready for any test that needs somewhere to attach students/exams/fees.
async function setupTenant(overrides = {}) {
  const school = await registerSchool(overrides);

  const yearRes = await request(app)
    .post('/api/v1/academic-years')
    .set('Authorization', auth(school.accessToken))
    .send({ name: '2025/2026', startDate: '2025-09-01', endDate: '2026-07-31', isCurrent: true });
  if (yearRes.status !== 201) {
    throw new Error(`academic year setup failed (${yearRes.status}): ${JSON.stringify(yearRes.body)}`);
  }
  const academicYearId = yearRes.body.data.id;

  const classRes = await request(app)
    .post('/api/v1/classes')
    .set('Authorization', auth(school.accessToken))
    .send({ academicYearId, name: 'Grade 5', section: 'A' });
  if (classRes.status !== 201) {
    throw new Error(`class setup failed (${classRes.status}): ${JSON.stringify(classRes.body)}`);
  }
  const classId = classRes.body.data.id;

  return { ...school, academicYearId, classId };
}

// SuperAdmin accounts have no self-service signup (by design), so tests seed
// one directly rather than going through an API that intentionally doesn't exist.
async function createSuperAdmin(overrides = {}) {
  const email = overrides.email || uniqueEmail('superadmin');
  const password = overrides.password || 'superadminpass123';
  const passwordHash = await hashPassword(password);
  await db.query(
    "INSERT INTO users (school_id, role, name, email, password_hash, status) VALUES (NULL, 'SUPERADMIN', ?, ?, ?, 'active')",
    [overrides.name || 'Platform Admin', email, passwordHash]
  );
  return login(email, password);
}

async function createStudent(accessToken, classId, overrides = {}) {
  const res = await request(app)
    .post('/api/v1/students')
    .set('Authorization', auth(accessToken))
    .send({
      classId,
      admissionNo: overrides.admissionNo || `ADM-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'Student',
    });
  if (res.status !== 201) {
    throw new Error(`createStudent failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

module.exports = { app, request, auth, uniqueEmail, registerSchool, login, setupTenant, createStudent, createSuperAdmin };
