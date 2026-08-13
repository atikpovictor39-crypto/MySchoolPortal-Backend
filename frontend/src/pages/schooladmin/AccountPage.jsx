import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';

// Voluntary, anytime password change — distinct from
// ForcedPasswordChangePage, which takes over the whole screen only when
// must_change_password is true (a temp password an admin set). This is the
// normal, always-available version reachable from the nav.
export default function AccountPage() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Account</h1>
      <p className="text-sm text-slate-500 mb-6">
        {user.name} · {user.email}
      </p>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Change password</h2>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Current password
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
          {success && <p className="text-sm text-green-600">Password changed.</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
