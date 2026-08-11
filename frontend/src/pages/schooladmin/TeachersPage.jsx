import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUndoToast } from '../../context/UndoToastContext';
import { listTeachers, createTeacher, updateTeacher, deleteTeacher } from '../../features/teachers/api';
import PasswordInput from '../../components/common/PasswordInput';

const emptyForm = { name: '', email: '', password: '', employeeNo: '' };

export default function TeachersPage() {
  const { user } = useAuth();
  const { deleteWithUndo } = useUndoToast();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function refresh() {
    setIsLoading(true);
    try {
      setTeachers(await listTeachers());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teachers');
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
      await createTeacher(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add teacher');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditForm({ name: t.name, email: t.email, employeeNo: t.employee_no || '' });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateTeacher(id, editForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update teacher');
    }
  }

  // Deleting a teacher also removes their clock-in and leave-request
  // history (see teacher.service.js) — the undo window is the safety net
  // for a misclick, not a soft-delete, so this is genuinely permanent once
  // it commits.
  function handleDelete(t) {
    setError('');
    setTeachers((prev) => prev.filter((row) => row.id !== t.id));
    deleteWithUndo({
      message: `"${t.name}" removed.`,
      onUndo: () => setTeachers((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name))),
      onCommit: async () => {
        try {
          await deleteTeacher(t.id);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to remove teacher');
          setTeachers((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Teachers</h1>

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
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <PasswordInput
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee No.</label>
            <input
              value={form.employeeNo}
              onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
              placeholder="Auto-generated"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-32"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add teacher'}
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
      ) : teachers.length === 0 ? (
        <p className="text-sm text-slate-500">No teachers yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Employee No.</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) =>
              editingId === t.id ? (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={editForm.employeeNo}
                      onChange={(e) => setEditForm({ ...editForm, employeeNo: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-24"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => saveEdit(t.id)} className="text-blue-600 text-xs font-medium">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t.name}</td>
                  <td className="px-4 py-2">{t.email}</td>
                  <td className="px-4 py-2">{t.employee_no || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => startEdit(t)} className="text-blue-600 text-xs font-medium">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(t)} className="text-red-600 text-xs font-medium">
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
