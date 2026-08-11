import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUndoToast } from '../../context/UndoToastContext';
import { listClasses, createClass, updateClass, deleteClass } from '../../features/classes/api';
import { listAcademicYears } from '../../features/academicYears/api';

const emptyForm = { academicYearId: '', name: '', section: '' };

export default function ClassesPage() {
  const { user } = useAuth();
  const { deleteWithUndo } = useUndoToast();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function refresh() {
    setIsLoading(true);
    try {
      const [classList, yearList] = await Promise.all([listClasses(), listAcademicYears()]);
      setClasses(classList);
      setYears(yearList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load classes');
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
      await createClass(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create class');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditForm({ academicYearId: c.academic_year_id, name: c.name, section: c.section || '' });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateClass(id, editForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update class');
    }
  }

  // Optimistically removes the row and only actually deletes it server-side
  // once the undo window closes — see UndoToastContext for why.
  function handleDelete(c) {
    setError('');
    setClasses((prev) => prev.filter((row) => row.id !== c.id));
    deleteWithUndo({
      message: `"${c.name}${c.section ? ` ${c.section}` : ''}" deleted.`,
      onUndo: () => setClasses((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name))),
      onCommit: async () => {
        try {
          await deleteClass(c.id);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to delete class');
          setClasses((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
    });
  }

  const yearNameById = Object.fromEntries(years.map((y) => [y.id, y.name]));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Classes</h1>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Academic year</label>
            <select
              required
              value={form.academicYearId}
              onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Select…
              </option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Grade 5"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
            <input
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              placeholder="A"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-20"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || years.length === 0}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add class'}
          </button>
        </form>
      )}

      {years.length === 0 && !isLoading && (
        <p className="text-sm text-amber-600 mb-4">Create an academic year first before adding classes.</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="text-sm text-slate-500">No classes yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Section</th>
              <th className="px-4 py-2">Academic year</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {classes.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-28"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editForm.section}
                      onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-16"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editForm.academicYearId}
                      onChange={(e) => setEditForm({ ...editForm, academicYearId: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => saveEdit(c.id)} className="text-blue-600 text-xs font-medium">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">{c.section || '—'}</td>
                  <td className="px-4 py-2">{yearNameById[c.academic_year_id] || c.academic_year_id}</td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => startEdit(c)} className="text-blue-600 text-xs font-medium">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(c)} className="text-red-600 text-xs font-medium">
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
