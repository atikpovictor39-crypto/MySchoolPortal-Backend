import { useEffect, useState } from 'react';
import { getPlatformStatus, setMaintenanceMode, downloadBackup } from '../../features/platform/api';

export default function PlatformPage() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isToggling, setIsToggling] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  async function refresh() {
    try {
      const s = await getPlatformStatus();
      setStatus(s);
      setMessage(s.message || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load platform status');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleToggleMaintenance() {
    const nextEnabled = !status.maintenanceMode;
    if (
      nextEnabled &&
      !window.confirm('Turn maintenance mode ON? Every school, teacher and parent will be locked out until you turn it back off.')
    ) {
      return;
    }
    setError('');
    setIsToggling(true);
    try {
      setStatus(await setMaintenanceMode(nextEnabled, message));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update maintenance mode');
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDownloadBackup() {
    setError('');
    setIsDownloading(true);
    try {
      await downloadBackup();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download backup');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Platform</h1>
      <p className="text-sm text-slate-500 mb-6">Whole-platform operations — these affect every school at once.</p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Maintenance Mode</p>
            <p className="text-sm text-slate-500 mt-1">
              When on, every school, teacher and parent sees a "down for maintenance" page instead of the portal.
              You stay logged in throughout so you can turn it back off.
            </p>
          </div>
          {status && (
            <span
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${
                status.maintenanceMode
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              {status.maintenanceMode ? 'ON' : 'OFF'}
            </span>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Message shown to users (optional)</label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="We're upgrading the system — back in about an hour."
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <button
          onClick={handleToggleMaintenance}
          disabled={!status || isToggling}
          className={`mt-4 rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
            status?.maintenanceMode ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isToggling ? 'Saving…' : status?.maintenanceMode ? 'Turn maintenance mode OFF' : 'Turn maintenance mode ON'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-900">Database Backup</p>
        <p className="text-sm text-slate-500 mt-1">
          Supabase automatically backs up the whole database — this is a supplementary, on-demand export of every
          school's data as a single JSON file, for your own peace of mind or portability.
        </p>
        <button
          onClick={handleDownloadBackup}
          disabled={isDownloading}
          className="mt-4 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isDownloading ? 'Preparing…' : 'Download full backup'}
        </button>
      </div>
    </div>
  );
}
