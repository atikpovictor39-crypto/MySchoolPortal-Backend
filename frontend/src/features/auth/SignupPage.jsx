import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ schoolName: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm bg-[#722F37] rounded-xl shadow-lg border border-[#5c2830] p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.svg" alt="MySchoolPortal" className="w-12 h-12 rounded-xl mb-3" />
          <h1 className="text-xl font-semibold text-white">Start your free trial</h1>
          <p className="text-sm text-rose-100/70 mt-1 text-center">Sets up your school and its first admin account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="schoolName" className="block text-sm font-medium text-rose-50/90 mb-1">
              School name
            </label>
            <input
              id="schoolName"
              required
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="w-full rounded-md border border-white/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="Greenwood Academy"
            />
          </div>

          <div>
            <label htmlFor="adminName" className="block text-sm font-medium text-rose-50/90 mb-1">
              Your name
            </label>
            <input
              id="adminName"
              required
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              className="w-full rounded-md border border-white/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label htmlFor="adminEmail" className="block text-sm font-medium text-rose-50/90 mb-1">
              Email
            </label>
            <input
              id="adminEmail"
              type="email"
              required
              autoComplete="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              className="w-full rounded-md border border-white/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="you@school.com"
            />
          </div>

          <div>
            <label htmlFor="adminPassword" className="block text-sm font-medium text-rose-50/90 mb-1">
              Password
            </label>
            <PasswordInput
              id="adminPassword"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="w-full rounded-md border border-white/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-200 font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-white text-[#722F37] py-2 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating your school…' : 'Create school'}
          </button>
        </form>

        <p className="text-sm text-rose-100/70 text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-white font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
