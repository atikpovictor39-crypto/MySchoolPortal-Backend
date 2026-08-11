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

  // Column headers: every distinct period (start–end time) that appears
  // anywhere in the week, sorted chronologically — not just one day's
  // periods, since a period that only meets on Wednesday still needs its
  // own column so Wednesday has somewhere to show it.
  const periodKey = (start, end) => `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  const periodsByKey = new Map();
  for (const slot of slots) {
    const key = periodKey(slot.start_time, slot.end_time);
    if (!periodsByKey.has(key)) {
      periodsByKey.set(key, { key, startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5) });
    }
  }
  const periods = [...periodsByKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Monday–Friday always shown (the standard school week); Saturday/Sunday
  // only appear as rows if something is actually scheduled on them.
  const daysWithSlots = new Set(slots.map((s) => s.day_of_week));
  const daysToShow = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || daysWithSlots.has(d));

  const slotGrid = {}; // slotGrid[day][periodKey] = slot
  for (const slot of slots) {
    const day = slot.day_of_week;
    const key = periodKey(slot.start_time, slot.end_time);
    slotGrid[day] = slotGrid[day] || {};
    slotGrid[day][key] = slot;
  }

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

  // Clicking an empty grid cell pre-fills the Add period form with that
  // day + time instead of making the admin retype them.
  function prefillEmptyCell(day, period) {
    setEditingId(null);
    setForm({ dayOfWeek: String(day), startTime: period.startTime, endTime: period.endTime, subjectId: '', teacherId: '' });
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
          <option value="">Select…</option>
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
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add period'}
          </button>
        </form>
      )}

      {!classId ? (
        <p className="text-sm text-slate-500">Select a class to view its timetable.</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-slate-500">No periods scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm border-separate border-spacing-0">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 border-b border-r border-slate-200">Day</th>
                {periods.map((p) => (
                  <th key={p.key} className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-200">
                    {p.startTime} – {p.endTime}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daysToShow.map((day) => (
                <tr key={day} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white border-r border-slate-200">
                    {DAY_NAMES[day]}
                  </td>
                  {periods.map((p) => {
                    const slot = slotGrid[day]?.[p.key];

                    if (slot && editingId === slot.id) {
                      return (
                        <td key={p.key} className="px-2 py-2 align-top min-w-[160px]">
                          <div className="flex flex-col gap-1">
                            <select
                              value={editForm.dayOfWeek}
                              onChange={(e) => setEditForm({ ...editForm, dayOfWeek: e.target.value })}
                              className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                            >
                              {DAY_NAMES.slice(1).map((name, i) => (
                                <option key={name} value={i + 1}>
                                  {name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1 items-center">
                              <input
                                type="time"
                                value={editForm.startTime}
                                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                className="rounded border border-slate-300 px-1 py-1 text-xs w-full"
                              />
                              <input
                                type="time"
                                value={editForm.endTime}
                                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                className="rounded border border-slate-300 px-1 py-1 text-xs w-full"
                              />
                            </div>
                            <select
                              value={editForm.subjectId}
                              onChange={(e) => setEditForm({ ...editForm, subjectId: e.target.value })}
                              className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                            >
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editForm.teacherId}
                              onChange={(e) => setEditForm({ ...editForm, teacherId: e.target.value })}
                              className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                            >
                              <option value="">No teacher</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(slot.id)} className="text-blue-600 text-xs font-medium">
                                Save
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    if (!slot) {
                      return (
                        <td
                          key={p.key}
                          onClick={isAdmin ? () => prefillEmptyCell(day, p) : undefined}
                          className={`px-3 py-2 min-w-[140px] ${isAdmin ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                        />
                      );
                    }

                    return (
                      <td key={p.key} className="px-3 py-2 align-top min-w-[140px] group">
                        <p className="font-medium text-slate-900">{subjectNameById[slot.subject_id] || slot.subject_name}</p>
                        <p className="text-xs text-slate-500">{slot.teacher_name || teacherNameById[slot.teacher_id] || '—'}</p>
                        {isAdmin && (
                          <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(slot)} className="text-blue-600 text-xs font-medium">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(slot.id)} className="text-red-600 text-xs font-medium">
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
