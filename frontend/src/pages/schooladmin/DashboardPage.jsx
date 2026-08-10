import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import { UsersIcon, BriefcaseIcon, GridIcon, ClockIcon, DollarIcon, AttendanceIcon } from '../../components/common/icons';
import { listStudents } from '../../features/students/api';
import { listTeachers } from '../../features/teachers/api';
import { listClasses } from '../../features/classes/api';
import { listLeaveRequests } from '../../features/teacherClockIn/leaveApi';
import { listDebtors, getFeesSummary } from '../../features/fees/api';
import { getAttendanceSummary } from '../../features/attendance/api';
import { formatMoney } from '../../utils/money';

const ADMIN_LINKS = [
  { to: '/students', label: 'Students' },
  { to: '/classes', label: 'Classes' },
  { to: '/fees', label: 'Fees & Accounts' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/academic-years', label: 'Create Academic Year' },
];

const TEACHER_LINKS = [
  { to: '/students', label: 'Students' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/homework', label: 'Homework' },
  { to: '/results', label: 'Results & Report Cards' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // SuperAdmin has no school_id — the stat endpoints below are all
    // tenant-scoped and would 403 for it, so skip fetching entirely.
    if (user.role === 'PARENT' || user.role === 'SUPERADMIN') return;

    setIsLoading(true);
    setError('');
    const requests = [
      listStudents({ pageSize: 1 }),
      listTeachers(),
      listClasses(),
      isAdmin ? listLeaveRequests({ status: 'pending' }) : Promise.resolve(null),
      isAdmin ? listDebtors() : Promise.resolve(null),
      isAdmin ? getFeesSummary() : Promise.resolve(null),
      isAdmin ? getAttendanceSummary() : Promise.resolve(null),
    ];

    Promise.all(requests)
      .then(([students, teachers, classes, pendingLeave, debtors, feesSummary, attendanceSummary]) => {
        setStats({
          studentCount: students.pagination.total,
          teacherCount: teachers.length,
          classCount: classes.length,
          pendingLeaveCount: pendingLeave?.length ?? null,
          debtorCount: debtors?.length ?? null,
          outstandingCents: debtors ? debtors.reduce((sum, d) => sum + d.balance_cents, 0) : null,
          collectedCents: feesSummary?.totalPaidCents ?? null,
          attendanceRate: attendanceSummary?.rate ?? null,
        });
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, [user.role, isAdmin]);

  // Parents/SuperAdmin land elsewhere by default (see LoginPage) — this only
  // catches someone typing /dashboard directly in the URL bar.
  if (user.role === 'PARENT') {
    return <Navigate to="/overview" replace />;
  }
  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/schools" replace />;
  }

  const links = isAdmin ? ADMIN_LINKS : TEACHER_LINKS;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user.school_name ? `Here's what's happening at ${user.school_name} today.` : "Here's what's happening today."}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<UsersIcon />} iconBg="bg-sky-500" label="Students" value={stats.studentCount} />
            <StatCard icon={<BriefcaseIcon />} iconBg="bg-violet-500" label="Teachers" value={stats.teacherCount} />
            <StatCard icon={<GridIcon />} iconBg="bg-blue-500" label="Classes" value={stats.classCount} />
            {isAdmin && (
              <StatCard
                icon={<ClockIcon />}
                iconBg="bg-amber-500"
                label="Pending Leave"
                value={stats.pendingLeaveCount}
              />
            )}
            {isAdmin && (
              <StatCard
                icon={<DollarIcon />}
                iconBg="bg-green-600"
                label="Fees Collected"
                value={formatMoney(stats.collectedCents)}
                sublabel="all-time"
              />
            )}
            {isAdmin && (
              <StatCard
                icon={<DollarIcon />}
                iconBg="bg-emerald-500"
                label="Outstanding Fees"
                value={formatMoney(stats.outstandingCents)}
                sublabel={stats.debtorCount ? `across ${stats.debtorCount} student${stats.debtorCount === 1 ? '' : 's'}` : 'all settled'}
              />
            )}
            {isAdmin && (
              <StatCard
                icon={<AttendanceIcon />}
                iconBg="bg-cyan-500"
                label="Attendance Today"
                value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
                sublabel={stats.attendanceRate === null ? 'not marked yet' : 'of students marked present'}
              />
            )}
          </div>
        )
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors shadow-sm"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
