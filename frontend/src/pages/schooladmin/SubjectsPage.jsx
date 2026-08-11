import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUndoToast } from '../../context/UndoToastContext';
import { listSubjects, createSubject, updateSubject, deleteSubject } from '../../features/subjects/api';

const emptyForm = { name: '', code: '' };

export default function SubjectsPage() {
  const { user } = useAuth();
  const { deleteWithUndo } = useUndoToast();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function refresh() {
    setIsLoading(true);
    try {
      setSubjects(await listSubjects());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subjects');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createSubject(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subject');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditForm({ name: s.name, code: s.code || '' });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateSubject(id, editForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subject');
    }
  }

  function handleDelete(s) {
    setError('');
    setSubjects((prev) => prev.filter((row) => row.id !== s.id));
    deleteWithUndo({
      message: `"${s.name}" deleted.`,
      onUndo: () => setSubjects((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name))),
      onCommit: async () => {
        try {
          await deleteSubject(s.id);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to delete subject');
          setSubjects((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Subjects</h1>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Mathematics"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="MTH"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add subject'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-slate-500">No subjects yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) =>
              editingId === s.id ? (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-20"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => saveEdit(s.id)} className="text-blue-600 text-xs font-medium">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.code || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => startEdit(s)} className="text-blue-600 text-xs font-medium">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(s)} className="text-red-600 text-xs font-medium">
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
