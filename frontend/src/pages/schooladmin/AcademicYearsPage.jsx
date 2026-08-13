import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUndoToast } from '../../context/UndoToastContext';
import {
  listAcademicYearsWithStats,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
} from '../../features/academicYears/api';

const emptyForm = { name: '', startDate: '', endDate: '', isCurrent: false };

// Formats digits-only input as "YYYY/YYYY" while typing — strips anything
// that isn't a digit and re-derives the slash position every keystroke, so
// backspace/paste/autofill all just work without extra handling.
function formatYearRange(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length <= 4 ? digits : `${digits.slice(0, 4)}/${digits.slice(4)}`;
}

export default function AcademicYearsPage() {
  const { user } = useAuth();
  const { deleteWithUndo } = useUndoToast();
  const navigate = useNavigate();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [years, setYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [settingCurrentId, setSettingCurrentId] = useState(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setYears(await listAcademicYearsWithStats());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load academic years');
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
      await createAcademicYear(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create academic year');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(y) {
    setEditingId(y.id);
    setEditForm({
      name: y.name,
      startDate: y.start_date?.slice(0, 10) || '',
      endDate: y.end_date?.slice(0, 10) || '',
      isCurrent: y.is_current,
    });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateAcademicYear(id, editForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update academic year');
    }
  }

  async function handleSetCurrent(y) {
    setError('');
    setSettingCurrentId(y.id);
    try {
      await updateAcademicYear(y.id, { isCurrent: true });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set current year');
    } finally {
      setSettingCurrentId(null);
    }
  }

  function handleDelete(y) {
    setError('');
    setYears((prev) => prev.filter((row) => row.id !== y.id));
    deleteWithUndo({
      message: `"${y.name}" deleted.`,
      onUndo: () => setYears((prev) => [...prev, y].sort((a, b) => b.start_date.localeCompare(a.start_date))),
      onCommit: async () => {
        try {
          await deleteAcademicYear(y.id);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to delete academic year');
          setYears((prev) => [...prev, y].sort((a, b) => b.start_date.localeCompare(a.start_date)));
        }
      },
    });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Academic Years</h1>

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
              onChange={(e) => setForm({ ...form, name: formatYearRange(e.target.value) })}
              placeholder="2026/2027"
              inputMode="numeric"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-1.5">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
            />
            Set as current
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add year'}
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
      ) : years.length === 0 ? (
        <p className="text-sm text-slate-500">No academic years yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Start</th>
              <th className="px-4 py-2">End</th>
              <th className="px-4 py-2">Classes</th>
              <th className="px-4 py-2">Students</th>
              <th className="px-4 py-2">Current</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {years.map((y) =>
              editingId === y.id ? (
                <tr key={y.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: formatYearRange(e.target.value) })}
                      inputMode="numeric"
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm w-28"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-slate-400" colSpan={2}>
                    —
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={editForm.isCurrent}
                      onChange={(e) => setEditForm({ ...editForm, isCurrent: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => saveEdit(y.id)} className="text-blue-600 text-xs font-medium">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={y.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{y.name}</td>
                  <td className="px-4 py-2">{y.start_date?.slice(0, 10)}</td>
                  <td className="px-4 py-2">{y.end_date?.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => navigate(`/classes?academicYearId=${y.id}`)}
                      className="text-blue-600 hover:underline"
                    >
                      {y.class_count} class{y.class_count === 1 ? '' : 'es'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    {y.student_count} student{y.student_count === 1 ? '' : 's'}
                  </td>
                  <td className="px-4 py-2">
                    {y.is_current ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                        Current
                      </span>
                    ) : (
                      isAdmin && (
                        <button
                          onClick={() => handleSetCurrent(y)}
                          disabled={settingCurrentId === y.id}
                          className="text-xs text-blue-600 font-medium hover:underline disabled:opacity-50"
                        >
                          {settingCurrentId === y.id ? 'Setting…' : 'Set as current'}
                        </button>
                      )
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => startEdit(y)} className="text-blue-600 text-xs font-medium">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(y)} className="text-red-600 text-xs font-medium">
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
