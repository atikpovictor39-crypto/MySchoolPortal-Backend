import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ParentProvider } from '../../context/ParentContext';
import PushNotificationButton from '../common/PushNotificationButton';
import { MenuIcon, CloseIcon } from '../common/icons';
import ForcedPasswordChangePage from '../../features/auth/ForcedPasswordChangePage';

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

// SCHOOL_ADMIN only — Teachers share the staff nav above but these
// endpoints are all requireRole('SCHOOL_ADMIN') on the backend too.
const ADMIN_LINKS = [
  { to: '/admin/school-details', label: 'School Details' },
  { to: '/admin/notifications', label: 'Notifications' },
  { to: '/admin/audit-log', label: 'Audit Log' },
  { to: '/admin/export', label: 'Export Data' },
  { to: '/admin/support', label: 'Support' },
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
// only ever gets platform-wide pages, not the tenant-scoped staff nav.
// Each link is tagged with the sub-admin scopes that can see it (see
// requireScope.middleware.js on the backend for the matching gate); a
// NULL/'full' scope always gets every link regardless of this list.
const SUPERADMIN_LINKS = [
  { to: '/schools', label: 'Schools', scopes: ['developer', 'billing'] },
  { to: '/platform', label: 'Platform', scopes: ['developer'] },
  { to: '/tickets', label: 'Support Tickets', scopes: ['support'] },
  { to: '/activity-log', label: 'Activity Log', scopes: ['support', 'developer'] },
  { to: '/broadcasts', label: 'Announcements', scopes: ['support'] },
];

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Accounts an admin set a temp password for (teachers, guardians) are
  // blocked from every tenant route server-side until they change it — see
  // requirePasswordChange.middleware.js. This is the client-side mirror of
  // that gate: skip the normal shell entirely rather than let someone land
  // on a page that's just going to 403 on every request it makes.
  if (user.must_change_password) {
    return <ForcedPasswordChangePage />;
  }

  const isFullSuperAdmin = user.role === 'SUPERADMIN' && (!user.superadmin_scope || user.superadmin_scope === 'full');
  const superadminLinks = isFullSuperAdmin
    ? SUPERADMIN_LINKS
    : SUPERADMIN_LINKS.filter((link) => link.scopes.includes(user.superadmin_scope));
  const links = user.role === 'PARENT' ? PARENT_LINKS : user.role === 'SUPERADMIN' ? superadminLinks : STAFF_LINKS;
  const roleLabel = user.role.replace('_', ' ');
  const brandName = user.role === 'SUPERADMIN' ? 'Platform Admin' : user.school_name || 'School SaaS';

  return (
    <div className="min-h-screen flex bg-[#F5F8FF]">
      {/* Mobile-only top bar: the sidebar below is an off-canvas drawer on
          small screens (hidden unless isMenuOpen), always visible on md+. */}
      <div className="md:hidden fixed inset-x-0 top-0 h-14 bg-slate-900 flex items-center gap-3 px-4 z-30 print:hidden">
        <button onClick={() => setIsMenuOpen(true)} className="text-slate-300 hover:text-white p-1 shrink-0" aria-label="Open menu">
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials(brandName) || 'S'}
          </div>
          <p className="text-sm font-semibold text-white truncate">{brandName}</p>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40 print:hidden" onClick={() => setIsMenuOpen(false)} />
      )}

      <aside
        className={`w-64 bg-slate-900 flex flex-col print:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials(brandName) || 'S'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{brandName}</p>
              <p className="text-[11px] text-slate-400">Management Portal</p>
            </div>
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 shrink-0"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          {user.role === 'SCHOOL_ADMIN' && (
            <>
              <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Admin</p>
              {ADMIN_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </>
          )}
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
      <main className="flex-1 p-4 md:p-8 overflow-y-auto mt-14 md:mt-0 min-w-0">
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
