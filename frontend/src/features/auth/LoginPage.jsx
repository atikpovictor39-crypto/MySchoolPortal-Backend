import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';

// A support-scoped sub-admin has no access to /schools (see AppShell's
// SUPERADMIN_LINKS scoping) — landing them there would just 403. Send each
// scope to the first page it's actually allowed to see.
function defaultRedirectFor(user) {
  if (user.role === 'PARENT') return '/overview';
  if (user.role === 'SUPERADMIN') {
    if (user.superadmin_scope === 'support') return '/tickets';
    return '/schools';
  }
  return '/dashboard';
}

// Public, read-only accounts seeded for the "view a live demo" links on the
// landing page (writes are blocked server-side — see demoReadOnly.middleware.js).
const DEMO_CREDENTIALS = {
  admin: { email: 'demo.admin@myschoolportalgh.com', password: 'Demo1234!' },
  parent: { email: 'demo.parent@myschoolportalgh.com', password: 'Demo1234!' },
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const demoKey = new URLSearchParams(location.search).get('demo');
  const demo = DEMO_CREDENTIALS[demoKey] || null;
  const [email, setEmail] = useState(demo?.email || '');
  const [password, setPassword] = useState(demo?.password || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (demo) {
      setEmail(demo.email);
      setPassword(demo.password);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  const explicitRedirect = location.state?.from?.pathname;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      // Each role has a different natural landing page — send them straight
      // there unless they were bounced here from somewhere specific.
      navigate(explicitRedirect || defaultRedirectFor(loggedInUser), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F5F8FF] to-[#E8EEFB] px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.svg" alt="MySchoolPortal" className="w-12 h-12 rounded-xl mb-3" />
          <h1 className="text-xl font-semibold text-blue-800">Sign in</h1>
          <p className="text-sm text-slate-500 mt-1">Access your school's dashboard</p>
        </div>

        {demo && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 mb-4 text-center">
            Demo {demoKey} credentials filled in — just hit Sign in. Changes are disabled on this account.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@school.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-slate-500 text-center mt-6">
          New school?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">
            Start your free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
