import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUndoToast } from '../../context/UndoToastContext';
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  listClassSubjects,
  addClassSubject,
  updateClassSubject,
  removeClassSubject,
} from '../../features/classes/api';
import { listAcademicYears } from '../../features/academicYears/api';
import { listSubjects } from '../../features/subjects/api';
import { listTeachers } from '../../features/teachers/api';

const emptyForm = { academicYearId: '', name: '', section: '' };
const emptyCsForm = { subjectId: '', teacherId: '', periodsPerWeek: '1' };

export default function ClassesPage() {
  const { user } = useAuth();
  const { deleteWithUndo } = useUndoToast();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ---- Subjects for a class (feeds the timetable auto-generator) ----
  const [managingClassId, setManagingClassId] = useState(null);
  const [classSubjects, setClassSubjects] = useState([]);
  const [csForm, setCsForm] = useState(emptyCsForm);
  const [isAddingCs, setIsAddingCs] = useState(false);
  const [editingCsId, setEditingCsId] = useState(null);
  const [editCsForm, setEditCsForm] = useState({});

  async function refresh() {
    setIsLoading(true);
    try {
      const [classList, yearList, subjectList, teacherList] = await Promise.all([
        listClasses(),
        listAcademicYears(),
        listSubjects(),
        listTeachers(),
      ]);
      setClasses(classList);
      setYears(yearList);
      setSubjects(subjectList);
      setTeachers(teacherList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load classes');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Defaults the create-class form to the current academic year once years
  // have loaded — only when the field is still empty, so it never clobbers
  // an admin who's deliberately picked a different year.
  useEffect(() => {
    if (years.length === 0) return;
    const current = years.find((y) => y.is_current);
    if (!current) return;
    setForm((prev) => (prev.academicYearId ? prev : { ...prev, academicYearId: String(current.id) }));
  }, [years]);

  async function openManageSubjects(classId) {
    setError('');
    setManagingClassId(classId);
    setEditingCsId(null);
    try {
      setClassSubjects(await listClassSubjects(classId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subjects for this class');
    }
  }

  async function handleAddClassSubject(e) {
    e.preventDefault();
    setError('');
    setIsAddingCs(true);
    try {
      await addClassSubject(managingClassId, {
        subjectId: Number(csForm.subjectId),
        teacherId: csForm.teacherId ? Number(csForm.teacherId) : undefined,
        periodsPerWeek: Number(csForm.periodsPerWeek),
      });
      setCsForm(emptyCsForm);
      setClassSubjects(await listClassSubjects(managingClassId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add subject');
    } finally {
      setIsAddingCs(false);
    }
  }

  function startEditCs(cs) {
    setEditingCsId(cs.id);
    setEditCsForm({ teacherId: cs.teacher_id ? String(cs.teacher_id) : '', periodsPerWeek: String(cs.periods_per_week) });
  }

  async function saveEditCs(id) {
    setError('');
    try {
      await updateClassSubject(managingClassId, id, {
        teacherId: editCsForm.teacherId ? Number(editCsForm.teacherId) : null,
        periodsPerWeek: Number(editCsForm.periodsPerWeek),
      });
      setEditingCsId(null);
      setClassSubjects(await listClassSubjects(managingClassId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subject');
    }
  }

  async function handleRemoveClassSubject(id) {
    setError('');
    try {
      await removeClassSubject(managingClassId, id);
      setClassSubjects(await listClassSubjects(managingClassId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove subject');
    }
  }

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
                        <button onClick={() => openManageSubjects(c.id)} className="text-blue-600 text-xs font-medium">
                          Subjects
                        </button>
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

      {managingClassId && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 max-w-lg">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Subjects for {classes.find((c) => c.id === managingClassId)?.name}
            </h3>
            <button
              onClick={() => {
                setManagingClassId(null);
                setClassSubjects([]);
              }}
              className="text-slate-400 text-xs"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Which subjects this class takes, who teaches each, and how many periods a week — feeds the "Generate
            timetable" tool on the Timetable page. Optional if you only ever build the timetable by hand.
          </p>

          {classSubjects.length === 0 ? (
            <p className="text-sm text-slate-500 mb-3">No subjects assigned yet.</p>
          ) : (
            <ul className="text-sm mb-3 space-y-1">
              {classSubjects.map((cs) =>
                editingCsId === cs.id ? (
                  <li key={cs.id} className="flex flex-wrap gap-2 items-center border-b border-slate-100 pb-2">
                    <span className="font-medium">{cs.subject_name}</span>
                    <select
                      value={editCsForm.teacherId}
                      onChange={(e) => setEditCsForm({ ...editCsForm, teacherId: e.target.value })}
                      className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                    >
                      <option value="">No teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={editCsForm.periodsPerWeek}
                      onChange={(e) => setEditCsForm({ ...editCsForm, periodsPerWeek: e.target.value })}
                      className="rounded border border-slate-300 px-1.5 py-1 text-xs w-16"
                    />
                    <span className="text-xs text-slate-400">periods/week</span>
                    <button onClick={() => saveEditCs(cs.id)} className="text-blue-600 text-xs font-medium">
                      Save
                    </button>
                    <button onClick={() => setEditingCsId(null)} className="text-slate-500 text-xs">
                      Cancel
                    </button>
                  </li>
                ) : (
                  <li key={cs.id} className="flex justify-between items-center text-slate-700">
                    <span>
                      {cs.subject_name}
                      {cs.teacher_name ? ` — ${cs.teacher_name}` : ''}
                      <span className="text-slate-400"> · {cs.periods_per_week}/wk</span>
                    </span>
                    <span className="flex gap-3 shrink-0">
                      <button onClick={() => startEditCs(cs)} className="text-blue-600 text-xs font-medium">
                        Edit
                      </button>
                      <button onClick={() => handleRemoveClassSubject(cs.id)} className="text-red-600 text-xs font-medium">
                        Remove
                      </button>
                    </span>
                  </li>
                )
              )}
            </ul>
          )}

          <form onSubmit={handleAddClassSubject} className="flex flex-wrap gap-2 items-end border-t border-slate-200 pt-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <select
                required
                value={csForm.subjectId}
                onChange={(e) => setCsForm({ ...csForm, subjectId: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="" disabled>
                  Select…
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Teacher (optional)</label>
              <select
                value={csForm.teacherId}
                onChange={(e) => setCsForm({ ...csForm, teacherId: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">—</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Periods/week</label>
              <input
                type="number"
                min="1"
                max="20"
                value={csForm.periodsPerWeek}
                onChange={(e) => setCsForm({ ...csForm, periodsPerWeek: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-20"
              />
            </div>
            <button
              type="submit"
              disabled={isAddingCs}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
