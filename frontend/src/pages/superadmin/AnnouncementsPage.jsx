import { useEffect, useState } from 'react';
import {
  listPlatformAnnouncements,
  createPlatformAnnouncement,
  deletePlatformAnnouncement,
} from '../../features/platform/api';

const TARGET_ROLES = ['all', 'teachers', 'parents', 'students'];
const emptyForm = { title: '', content: '', targetRole: 'all' };

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      setAnnouncements(await listPlatformAnnouncements());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!window.confirm('This will post to every school on the platform. Continue?')) return;
    setIsSubmitting(true);
    try {
      await createPlatformAnnouncement(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post announcement');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deletePlatformAnnouncement(id);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete announcement');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Announcements</h1>
      <p className="text-sm text-slate-500 mb-6">Broadcast a message to every school on the platform at once.</p>

      <form onSubmit={handleCreate} className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Content</label>
          <textarea
            required
            rows={3}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Audience</label>
            <select
              value={form.targetRole}
              onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {TARGET_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Broadcasting…' : 'Broadcast to all schools'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-slate-500">No broadcasts yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-start">
                <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
                <button onClick={() => handleDelete(a.id)} className="text-red-600 text-xs font-medium shrink-0">
                  Delete
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
              <p className="text-xs text-slate-400 mt-2">
                {a.target_role} · by {a.created_by_name} · {a.published_at.slice(0, 10)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
