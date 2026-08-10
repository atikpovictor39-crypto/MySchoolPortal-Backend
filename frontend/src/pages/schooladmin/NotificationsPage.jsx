import { useEffect, useState } from 'react';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../../features/notifications/api';

const TYPE_LABELS = {
  payment_claim: 'Payment',
  leave_request: 'Leave',
  billing: 'Billing',
};

const TYPE_STYLES = {
  payment_claim: 'bg-green-50 text-green-700',
  leave_request: 'bg-amber-50 text-amber-700',
  billing: 'bg-blue-50 text-blue-700',
};

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setIsLoading(true);
    try {
      setNotifications(await listNotifications());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notification');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notifications');
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="text-sm text-blue-600 font-medium hover:underline">
            Mark all as read
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-6">Payment claims, leave requests and billing updates.</p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing to show yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && handleMarkRead(n.id)}
              className={`w-full text-left bg-white border rounded-xl shadow-sm p-4 transition-colors ${
                n.is_read ? 'border-slate-200' : 'border-blue-200 bg-blue-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${TYPE_STYLES[n.type] || 'bg-slate-100 text-slate-600'}`}>
                      {TYPE_LABELS[n.type] || n.type}
                    </span>
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                  </div>
                  <p className="text-sm font-medium text-slate-900 mt-1.5">{n.title}</p>
                  {n.message && <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>}
                </div>
                <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{formatWhen(n.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
