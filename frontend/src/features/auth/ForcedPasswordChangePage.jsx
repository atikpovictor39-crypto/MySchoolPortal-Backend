import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';

// Shown instead of the normal app shell whenever user.must_change_password
// is true (accounts an admin set a temp password for — teachers,
// guardians). No skip option by design: the backend blocks every tenant
// route until this completes (see requirePasswordChange.middleware.js), so
// hiding this screen would just leave the user stuck on 403s.
export default function ForcedPasswordChangePage() {
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
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
          <h1 className="text-xl font-semibold text-blue-800">Set a new password</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            {user?.name ? `Welcome, ${user.name}.` : 'Welcome.'} For security, please replace your temporary password
            before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Temporary password
            </label>
            <PasswordInput
              id="currentPassword"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">
              New password
            </label>
            <PasswordInput
              id="newPassword"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm new password
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {isSubmitting ? 'Saving…' : 'Set password and continue'}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="w-full text-sm text-slate-400 hover:text-slate-600 hover:underline text-center mt-6"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
