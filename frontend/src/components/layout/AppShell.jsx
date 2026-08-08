import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ParentProvider } from '../../context/ParentContext';
import PushNotificationButton from '../common/PushNotificationButton';

const STAFF_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/academic-years', label: 'Academic Years' },
  { to: '/classes', label: 'Classes' },
  { to: '/students', label: 'Students' },
  { to: '/teachers', label: 'Teachers' },
  { to: '/clock-in', label: 'Clock-In' },
  { to: '/leave-requests', label: 'Leave Requests' },
  { to: '/subjects', label: 'Subjects' },
  { to: '/timetable', label: 'Timetable' },
  { to: '/homework', label: 'Homework' },
  { to: '/results', label: 'Results & Report Cards' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/fees', label: 'Fees & Accounts' },
  { to: '/announcements', label: 'Announcements' },
];

// The backend only lets a Parent read their own linked children (see
// parent.routes.js) — showing them links to the staff pages above would
// just dead-end in a 403, so the nav itself must be role-aware too.
const PARENT_LINKS = [
  { to: '/overview', label: 'Overview' },
  { to: '/parent-results', label: 'Results' },
  { to: '/parent-attendance', label: 'Attendance' },
  { to: '/parent-fees', label: 'Fees & Payments' },
  { to: '/parent-timetable', label: 'Timetable' },
  { to: '/parent-announcements', label: 'Announcements' },
];

// SuperAdmin operates at the platform level, not inside one school — it
// only ever gets the Schools onboarding page, not the tenant-scoped staff nav.
const SUPERADMIN_LINKS = [{ to: '/schools', label: 'Schools' }];

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const links = user.role === 'PARENT' ? PARENT_LINKS : user.role === 'SUPERADMIN' ? SUPERADMIN_LINKS : STAFF_LINKS;
  const roleLabel = user.role.replace('_', ' ');
  const brandName = user.role === 'SUPERADMIN' ? 'Platform Admin' : user.school_name || 'School SaaS';

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 flex flex-col print:hidden">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {initials(brandName) || 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{brandName}</p>
            <p className="text-[11px] text-slate-400">Management Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 capitalize">{roleLabel.toLowerCase()}</p>
            </div>
          </div>

          {/* Only Parents have a notification type wired up so far (absence
              alerts) — showing this to staff would just be a dead button. */}
          {user.role === 'PARENT' && <PushNotificationButton />}

          <button
            onClick={logout}
            className="w-full text-left text-sm text-slate-400 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {user.role === 'PARENT' ? (
          <ParentProvider>
            <Outlet />
          </ParentProvider>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
