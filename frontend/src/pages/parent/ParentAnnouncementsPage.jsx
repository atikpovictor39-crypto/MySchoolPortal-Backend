import { useEffect, useState } from 'react';
import { listAnnouncements, markAnnouncementsSeen } from '../../features/parent/api';

export default function ParentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load announcements'))
      .finally(() => setIsLoading(false));
    // Clears the unread badge next to this nav link (AppShell refetches the
    // count on every route change, after this has already run).
    markAnnouncementsSeen().catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Announcements</h1>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-slate-500">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
                {a.created_by_role === 'SUPERADMIN' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    MySchoolPortal
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
              <p className="text-xs text-slate-400 mt-2">
                by {a.created_by_name} · {a.published_at.slice(0, 10)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
