import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listClasses } from '../../features/classes/api';
import { listSubjects } from '../../features/subjects/api';
import { listTeachers } from '../../features/teachers/api';
import { listTimetable, createSlot, updateSlot, deleteSlot } from '../../features/timetable/api';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const emptyForm = { dayOfWeek: '1', startTime: '', endTime: '', subjectId: '', teacherId: '' };

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classId, setClassId] = useState('');
  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([listClasses(), listSubjects(), listTeachers()])
      .then(([c, s, t]) => {
        setClasses(c);
        setSubjects(s);
        setTeachers(t);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load lookups'));
  }, []);

  async function refreshSlots() {
    if (!classId) return;
    setIsLoading(true);
    try {
      setSlots(await listTimetable(classId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timetable');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const subjectNameById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  const teacherNameById = Object.fromEntries(teachers.map((t) => [t.id, t.name]));

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createSlot({
        classId,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
        subjectId: form.subjectId,
        teacherId: form.teacherId || undefined,
      });
      setForm(emptyForm);
      await refreshSlots();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add period');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(slot) {
    setEditingId(slot.id);
    setEditForm({
      dayOfWeek: String(slot.day_of_week),
      startTime: slot.start_time.slice(0, 5),
      endTime: slot.end_time.slice(0, 5),
      subjectId: String(slot.subject_id),
      teacherId: slot.teacher_id ? String(slot.teacher_id) : '',
    });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateSlot(id, {
        dayOfWeek: Number(editForm.dayOfWeek),
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        subjectId: editForm.subjectId,
        teacherId: editForm.teacherId || null,
      });
      setEditingId(null);
      await refreshSlots();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update period');
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteSlot(id);
      await refreshSlots();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete period');
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Timetable</h1>

      <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Selectâ€¦</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.section ? ` ${c.section}` : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {classId && isAdmin && (
        <form
          onSubmit={handleCreate}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {DAY_NAMES.slice(1).map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
            <input
              required
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
            <input
              required
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <select
              required
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Selectâ€¦
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
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">â€”</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Addingâ€¦' : 'Add period'}
          </button>
        </form>
      )}

      {!classId ? (
        <p className="text-sm text-slate-500">Select a class to view its timetable.</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loadingâ€¦</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-slate-500">No periods scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Day</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">Teacher</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) =>
              editingId === slot.id ? (
                <tr key={slot.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <select
                      value={editForm.dayOfWeek}
                      onChange={(e) => setEditForm({ ...editForm, dayOfWeek: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      {DAY_NAMES.slice(1).map((name, i) => (
                        <option key={name} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 items-center">
                      <input
                        type="time"
                        value={editForm.startTime}
                        onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <span>â€“</span>
                      <input
                        type="time"
                        value={editForm.endTime}
                        onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editForm.subjectId}
                      onChange={(e) => setEditForm({ ...editForm, subjectId: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editForm.teacherId}
                      onChange={(e) => setEditForm({ ...editForm, teacherId: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">â€”</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(slot.id)} className="text-blue-600 text-xs font-medium">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={slot.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{DAY_NAMES[slot.day_of_week]}</td>
                  <td className="px-4 py-2">
                    {slot.start_time.slice(0, 5)} â€“ {slot.end_time.slice(0, 5)}
                  </td>
                  <td className="px-4 py-2">{subjectNameById[slot.subject_id] || slot.subject_name}</td>
                  <td className="px-4 py-2">{slot.teacher_name || teacherNameById[slot.teacher_id] || 'â€”'}</td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <div className="flex gap-3">
                        <button onClick={() => startEdit(slot)} className="text-blue-600 text-xs font-medium">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(slot.id)} className="text-red-600 text-xs font-medium">
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
