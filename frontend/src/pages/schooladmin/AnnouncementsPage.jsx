import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../features/announcements/api';
import { listClasses } from '../../features/classes/api';

const TARGET_ROLES = ['all', 'teachers', 'parents', 'students'];
const emptyForm = { title: '', content: '', targetRole: 'all', classId: '' };

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function refresh() {
    setIsLoading(true);
    try {
      const [announcementList, classList] = await Promise.all([listAnnouncements(), listClasses()]);
      setAnnouncements(announcementList);
      setClasses(classList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const classNameById = Object.fromEntries(classes.map((c) => [c.id, `${c.name}${c.section ? ` ${c.section}` : ''}`]));

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createAnnouncement({ ...form, classId: form.classId || undefined });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post announcement');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(a) {
    setEditingId(a.id);
    setEditForm({ title: a.title, content: a.content, targetRole: a.target_role, classId: a.class_id || '' });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateAnnouncement(id, { ...editForm, classId: editForm.classId || null });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update announcement');
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteAnnouncement(id);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete announcement');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Announcements</h1>

      {isAdmin && (
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
          <div className="flex gap-3 items-end">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class (optional)</label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">Whole school</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` ${c.section}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Postingâ€¦' : 'Post announcement'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loadingâ€¦</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-slate-500">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) =>
            editingId === a.id ? (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-2">
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
                />
                <textarea
                  rows={3}
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <div className="flex gap-3 items-end">
                  <select
                    value={editForm.targetRole}
                    onChange={(e) => setEditForm({ ...editForm, targetRole: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    {TARGET_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.classId}
                    onChange={(e) => setEditForm({ ...editForm, classId: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Whole school</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.section ? ` ${c.section}` : ''}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => saveEdit(a.id)} className="text-blue-600 text-xs font-medium">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-semibold text-slate-900">{a.title}</h3>
                  {isAdmin && (
                    <div className="flex gap-3 shrink-0">
                      <button onClick={() => startEdit(a)} className="text-blue-600 text-xs font-medium">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-red-600 text-xs font-medium">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {a.target_role}
                  {a.class_id ? ` Â· ${classNameById[a.class_id] || a.class_id}` : ' Â· whole school'} Â· by{' '}
                  {a.created_by_name} Â· {a.published_at.slice(0, 10)}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
