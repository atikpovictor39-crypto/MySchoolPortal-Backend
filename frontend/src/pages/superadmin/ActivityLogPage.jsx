import { useEffect, useState } from 'react';
import { listPlatformAuditLogs } from '../../features/platform/api';
import { listSchools } from '../../features/schools/api';

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listSchools()
      .then(setSchools)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    listPlatformAuditLogs(schoolId || undefined)
      .then(setLogs)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load activity log'))
      .finally(() => setIsLoading(false));
  }, [schoolId]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Activity Log</h1>
      <p className="text-sm text-slate-500 mb-6">Key actions across every school — the most recent 200.</p>

      <div className="mb-4">
        <select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Who</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatWhen(log.created_at)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {log.school_name || <span className="text-slate-400 italic">Platform</span>}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.user_name || '—'}</td>
                  <td className="px-4 py-2">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
