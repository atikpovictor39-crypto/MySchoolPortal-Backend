const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const schoolRoutes = require('../modules/schools/school.routes');
const userRoutes = require('../modules/users/user.routes');
const subscriptionRoutes = require('../modules/subscriptions/subscription.routes');
const academicYearRoutes = require('../modules/academicYears/academicYear.routes');
const classRoutes = require('../modules/classes/class.routes');
const subjectRoutes = require('../modules/subjects/subject.routes');
const teacherRoutes = require('../modules/teachers/teacher.routes');
const studentRoutes = require('../modules/students/student.routes');
const feeRoutes = require('../modules/fees/fee.routes');
const resultRoutes = require('../modules/results/result.routes');
const attendanceRoutes = require('../modules/attendance/attendance.routes');
const announcementRoutes = require('../modules/announcements/announcement.routes');
const parentRoutes = require('../modules/parent/parent.routes');
const timetableRoutes = require('../modules/timetable/timetable.routes');
const pushRoutes = require('../modules/push/push.routes');
const homeworkRoutes = require('../modules/homework/homework.routes');
const cronRoutes = require('../modules/subscriptions/cron.routes');

// Public: no school_id scoping needed (login itself establishes identity)
router.use('/auth', authRoutes);

// SuperAdmin only: school onboarding + plan/subscription management
router.use('/schools', schoolRoutes);
router.use('/subscriptions', subscriptionRoutes);

// Tenant-scoped: every route below expects requireAuth + tenantScope middleware
router.use('/users', userRoutes);
router.use('/academic-years', academicYearRoutes);
router.use('/classes', classRoutes);
router.use('/subjects', subjectRoutes);
router.use('/teachers', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/fees', feeRoutes);
router.use('/results', resultRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/announcements', announcementRoutes);
router.use('/timetable', timetableRoutes);
router.use('/push', pushRoutes);
router.use('/homework', homeworkRoutes);

// Parent-only, ownership-scoped: every handler re-verifies the caller is
// actually linked to the requested student before returning anything.
router.use('/parent', parentRoutes);

// Not user-facing at all — see cronAuth.middleware.js. Triggered by Vercel
// Cron (vercel.json), authenticated via CRON_SECRET instead of a JWT.
router.use('/internal/cron', cronRoutes);

module.exports = router;
