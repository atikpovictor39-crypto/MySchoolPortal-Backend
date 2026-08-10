import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';

const RESEND_COOLDOWN_SECONDS = 60;

export default function SignupPage() {
  const { register, verifyEmail, resendVerificationCode } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ schoolName: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Once signup succeeds we stay on this page and ask for the code emailed
  // to them instead of navigating straight to the dashboard.
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(form);
      setAwaitingVerification(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function goToDashboard() {
    navigate('/dashboard', { replace: true });
  }

  async function handleVerify(e) {
    e.preventDefault();
    setVerifyError('');
    setIsVerifying(true);
    try {
      await verifyEmail(code);
      goToDashboard();
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setVerifyError('');
    setResendMessage('');
    try {
      await resendVerificationCode();
      setResendMessage('A new code is on its way.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      const timer = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) {
            clearInterval(timer);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  }

  if (awaitingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F5F8FF] to-[#E8EEFB] px-4 py-12">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
          <div className="flex flex-col items-center mb-6">
            <img src="/logo.svg" alt="MySchoolPortal" className="w-12 h-12 rounded-xl mb-3" />
            <h1 className="text-xl font-semibold text-blue-800">Verify your email</h1>
            <p className="text-sm text-slate-500 mt-1 text-center">
              We sent a 6-digit code to <span className="font-medium text-slate-700">{form.adminEmail}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4" noValidate>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1">
                Verification code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="000000"
              />
            </div>

            {verifyError && (
              <p role="alert" className="text-sm text-red-600">
                {verifyError}
              </p>
            )}
            {resendMessage && !verifyError && <p className="text-sm text-green-600">{resendMessage}</p>}

            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isVerifying ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <div className="text-sm text-slate-500 text-center mt-6 space-y-2">
            <p>
              Didn't get it?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-blue-600 font-medium hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
              </button>
            </p>
            <button type="button" onClick={goToDashboard} className="text-slate-400 hover:text-slate-600 hover:underline">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F5F8FF] to-[#E8EEFB] px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.svg" alt="MySchoolPortal" className="w-12 h-12 rounded-xl mb-3" />
          <h1 className="text-xl font-semibold text-blue-800">Start your free trial</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">Sets up your school and its first admin account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="schoolName" className="block text-sm font-medium text-slate-700 mb-1">
              School name
            </label>
            <input
              id="schoolName"
              required
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Greenwood Academy"
            />
          </div>

          <div>
            <label htmlFor="adminName" className="block text-sm font-medium text-slate-700 mb-1">
              Your name
            </label>
            <input
              id="adminName"
              required
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="adminEmail"
              type="email"
              required
              autoComplete="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@school.com"
            />
          </div>

          <div>
            <label htmlFor="adminPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <PasswordInput
              id="adminPassword"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 8 characters"
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
            {isSubmitting ? 'Creating your school…' : 'Create school'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            By creating a school, you agree to our{' '}
            <Link to="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="text-sm text-slate-500 text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
