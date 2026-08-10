import { useEffect, useState } from 'react';
import { listAuditLogs } from '../../features/audit/api';

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load audit log'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Audit Log</h1>
      <p className="text-sm text-slate-500 mb-6">A record of key actions taken by staff — the most recent 100.</p>

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
                <th className="px-4 py-2">Who</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatWhen(log.created_at)}</td>
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
