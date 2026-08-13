import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listClasses } from '../../features/classes/api';
import { listSubjects } from '../../features/subjects/api';
import { listTeachers } from '../../features/teachers/api';
import {
  listTimetable,
  listForTeacher,
  createSlot,
  updateSlot,
  deleteSlot,
  listSubstitutions,
  createSubstitution,
  deleteSubstitution,
  generateTimetable,
} from '../../features/timetable/api';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_TYPE_LABELS = { subject: 'Subject', assembly: 'Assembly', break: 'Break' };
const emptyForm = { slotType: 'subject', dayOfWeek: '1', startTime: '', endTime: '', subjectId: '', teacherId: '' };
const emptyGenForm = {
  days: [1, 2, 3, 4, 5],
  dayStartTime: '07:30',
  periodLengthMinutes: '40',
  periodsPerDay: '6',
  break1Start: '',
  break1Duration: '20',
  break2Start: '',
  break2Duration: '20',
  assemblyStart: '',
  assemblyDuration: '20',
  assemblyDays: [1],
};

function toggleDay(list, day) {
  return list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort((a, b) => a - b);
}

// A different light color per subject so the grid is scannable at a
// glance — assigned by subject id, so it stays stable across reloads
// without needing to store a color anywhere.
const SUBJECT_COLORS = [
  'bg-blue-50 border-blue-100',
  'bg-emerald-50 border-emerald-100',
  'bg-amber-50 border-amber-100',
  'bg-purple-50 border-purple-100',
  'bg-pink-50 border-pink-100',
  'bg-cyan-50 border-cyan-100',
  'bg-orange-50 border-orange-100',
  'bg-lime-50 border-lime-100',
  'bg-indigo-50 border-indigo-100',
  'bg-rose-50 border-rose-100',
];
function colorForSubject(subjectId) {
  if (!subjectId) return '';
  return SUBJECT_COLORS[subjectId % SUBJECT_COLORS.length];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Backend day_of_week is 1=Monday...7=Sunday; JS's Date#getDay is
// 0=Sunday...6=Saturday.
function jsDayToDayOfWeek(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// Parsed as a local date (not `new Date(dateStr)`, which reads 'YYYY-MM-DD'
// as UTC midnight and can land on the wrong day depending on timezone).
function isoDateToDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return jsDayToDayOfWeek(new Date(y, m - 1, d));
}

// Assembly/break periods have no subject_id — this is what a cell/edit form
// actually displays for them instead.
function slotLabel(slot, subjectNameById) {
  if (slot.slot_type === 'subject') return subjectNameById[slot.subject_id] || slot.subject_name;
  return SLOT_TYPE_LABELS[slot.slot_type] || slot.slot_type;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');

  // ---- View by Class vs. View by Teacher ----
  const [viewMode, setViewMode] = useState('class'); // 'class' | 'teacher'
  const [classId, setClassId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ---- Day filter ----
  const [selectedDay, setSelectedDay] = useState(null); // null = whole week

  // ---- Add/Edit period (class view, admin only) ----
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ---- Auto-generate (class view, admin only) ----
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [genForm, setGenForm] = useState(emptyGenForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genWarnings, setGenWarnings] = useState([]);

  // ---- Substitute teachers (class view only — tied to a specific slot,
  // managed from wherever that slot's regular schedule lives) ----
  const [subDate, setSubDate] = useState(todayIso());
  const [substitutions, setSubstitutions] = useState([]);
  const [assigningSubForSlotId, setAssigningSubForSlotId] = useState(null);
  const [subAssignForm, setSubAssignForm] = useState({ substituteTeacherId: '', reason: '' });

  // ---- Current-period highlight — re-ticks every minute so it doesn't go
  // stale on a page left open, without needing a full data refetch. ----
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  const todayDow = jsDayToDayOfWeek(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  function isCurrentPeriod(slot) {
    if (slot.day_of_week !== todayDow) return false;
    const [sh, sm] = slot.start_time.slice(0, 5).split(':').map(Number);
    const [eh, em] = slot.end_time.slice(0, 5).split(':').map(Number);
    return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
  }

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
    if (viewMode === 'class') {
      if (!classId) return;
      setIsLoading(true);
      try {
        setSlots(await listTimetable(classId));
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load timetable');
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!filterTeacherId) return;
      setIsLoading(true);
      try {
        setSlots(await listForTeacher(filterTeacherId));
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load timetable');
      } finally {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, classId, filterTeacherId]);

  async function refreshSubstitutions() {
    if (viewMode !== 'class' || !classId) {
      setSubstitutions([]);
      return;
    }
    try {
      setSubstitutions(await listSubstitutions({ classId, date: subDate }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load substitutions');
    }
  }

  useEffect(() => {
    refreshSubstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, classId, subDate]);

  const subjectNameById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  const teacherNameById = Object.fromEntries(teachers.map((t) => [t.id, t.name]));
  const subBySlotId = Object.fromEntries(substitutions.map((s) => [s.timetable_slot_id, s]));
  // A substitute can only be assigned to a slot that actually falls on
  // subDate's weekday (e.g. a Monday slot needs a Monday date) — the
  // backend enforces this too, this just keeps the "+ Substitute" button
  // from showing up on days it'd only get rejected.
  const subDateDow = subDate ? isoDateToDayOfWeek(subDate) : null;

  // Column headers: every distinct period (start–end time) that appears
  // anywhere in the week, sorted chronologically — not just one day's
  // periods, since a period that only meets on Wednesday still needs its
  // own column so Wednesday has somewhere to show it. Narrowed down to just
  // the selected day's periods when a day filter is active.
  const periodKey = (start, end) => `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  const periodsByKey = new Map();
  for (const slot of slots) {
    if (selectedDay && slot.day_of_week !== selectedDay) continue;
    const key = periodKey(slot.start_time, slot.end_time);
    if (!periodsByKey.has(key)) {
      periodsByKey.set(key, { key, startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5) });
    }
  }
  const periods = [...periodsByKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  // Purely a visual grouping header — periods before noon under "Morning
  // Classes", the rest under "Evening Classes". Either group is skipped
  // entirely if nothing falls in it.
  const morningPeriods = periods.filter((p) => p.startTime < '12:00');
  const eveningPeriods = periods.filter((p) => p.startTime >= '12:00');

  // Monday–Friday always shown (the standard school week); Saturday/Sunday
  // only appear as rows if something is actually scheduled on them. Narrowed
  // to just the selected day when a day filter is active.
  const daysWithSlots = new Set(slots.map((s) => s.day_of_week));
  const daysToShow = selectedDay
    ? [selectedDay]
    : [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || daysWithSlots.has(d));

  const slotGrid = {}; // slotGrid[day][periodKey] = slot
  for (const slot of slots) {
    const day = slot.day_of_week;
    const key = periodKey(slot.start_time, slot.end_time);
    slotGrid[day] = slotGrid[day] || {};
    slotGrid[day][key] = slot;
  }

  const currentSlot = slots.find(isCurrentPeriod);

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
        slotType: form.slotType,
        subjectId: form.slotType === 'subject' ? form.subjectId : undefined,
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

  async function handleGenerate(e) {
    e.preventDefault();
    setError('');
    if (
      !window.confirm(
        `This will replace ${selectedClassName || 'this class'}'s current timetable with a freshly generated one. Continue?`
      )
    ) {
      return;
    }
    setIsGenerating(true);
    setGenWarnings([]);
    try {
      const breaks = [];
      if (genForm.break1Start) breaks.push({ startTime: genForm.break1Start, durationMinutes: Number(genForm.break1Duration) });
      if (genForm.break2Start) breaks.push({ startTime: genForm.break2Start, durationMinutes: Number(genForm.break2Duration) });
      const assembly = genForm.assemblyStart
        ? { startTime: genForm.assemblyStart, durationMinutes: Number(genForm.assemblyDuration), days: genForm.assemblyDays }
        : undefined;

      const result = await generateTimetable({
        classId,
        days: genForm.days,
        dayStartTime: genForm.dayStartTime,
        periodLengthMinutes: Number(genForm.periodLengthMinutes),
        periodsPerDay: Number(genForm.periodsPerDay),
        breaks,
        assembly,
      });
      setGenWarnings(result.warnings || []);
      setShowGenerateForm(false);
      await refreshSlots();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate timetable');
    } finally {
      setIsGenerating(false);
    }
  }

  function startEdit(slot) {
    setEditingId(slot.id);
    setEditForm({
      slotType: slot.slot_type,
      dayOfWeek: String(slot.day_of_week),
      startTime: slot.start_time.slice(0, 5),
      endTime: slot.end_time.slice(0, 5),
      subjectId: slot.subject_id ? String(slot.subject_id) : '',
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
        slotType: editForm.slotType,
        subjectId: editForm.slotType === 'subject' ? editForm.subjectId : null,
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
    setShowAddForm(true);
    setForm({ ...emptyForm, dayOfWeek: String(day), startTime: period.startTime, endTime: period.endTime });
  }

  function startAssignSub(slot) {
    setAssigningSubForSlotId(slot.id);
    setSubAssignForm({ substituteTeacherId: '', reason: '' });
  }

  async function saveAssignSub(slot) {
    setError('');
    try {
      await createSubstitution({
        timetableSlotId: slot.id,
        date: subDate,
        substituteTeacherId: subAssignForm.substituteTeacherId,
        reason: subAssignForm.reason || undefined,
      });
      setAssigningSubForSlotId(null);
      await refreshSubstitutions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign substitute');
    }
  }

  async function handleRemoveSub(id) {
    setError('');
    try {
      await deleteSubstitution(id);
      await refreshSubstitutions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove substitute');
    }
  }

  const selectedClassName = (() => {
    const c = classes.find((c) => String(c.id) === String(classId));
    return c ? `${c.name}${c.section ? ` ${c.section}` : ''}` : '';
  })();
  const selectedTeacherName = teacherNameById[filterTeacherId] || '';
  const printTitle =
    viewMode === 'class' ? selectedClassName && `Timetable — ${selectedClassName}` : selectedTeacherName && `Timetable — ${selectedTeacherName}`;

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Timetable</h1>

      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">View by</label>
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
              {[
                { key: 'class', label: 'Class' },
                { key: 'teacher', label: 'Teacher' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setViewMode(opt.key)}
                  className={`px-3 py-1.5 ${
                    viewMode === opt.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'class' ? (
            <div>
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
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Teacher</label>
              <select
                value={filterTeacherId}
                onChange={(e) => setFilterTeacherId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">Select…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(classId || filterTeacherId) && (
            <button
              onClick={() => window.print()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Print / Download PDF
            </button>
          )}

          {viewMode === 'class' && classId && isAdmin && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showAddForm ? 'Hide add period form' : '+ Add / Edit Timetable'}
            </button>
          )}

          {viewMode === 'class' && classId && isAdmin && (
            <button
              onClick={() => {
                setShowGenerateForm((v) => !v);
                setGenWarnings([]);
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showGenerateForm ? 'Hide generator' : 'Generate timetable'}
            </button>
          )}
        </div>

        {(classId || filterTeacherId) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Day:</span>
            <button
              onClick={() => setSelectedDay(null)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                !selectedDay ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Whole week
            </button>
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                  selectedDay === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {DAY_NAMES[d].slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {viewMode === 'class' && classId && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Substitutes for</label>
            <input
              type="date"
              value={subDate}
              onChange={(e) => setSubDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4 print:hidden">
          {error}
        </p>
      )}

      {currentSlot && (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 mb-4">
          You are in {slotLabel(currentSlot, subjectNameById)} now (
          {currentSlot.start_time.slice(0, 5)}–{currentSlot.end_time.slice(0, 5)})
        </p>
      )}

      {viewMode === 'class' && classId && isAdmin && showAddForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end print:hidden"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Period type</label>
            <select
              value={form.slotType}
              onChange={(e) => setForm({ ...form, slotType: e.target.value, subjectId: '' })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {Object.entries(SLOT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
              lang="en-GB"
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
              lang="en-GB"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          {form.slotType === 'subject' && (
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
          )}
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

      {viewMode === 'class' && classId && isAdmin && showGenerateForm && (
        <form
          onSubmit={handleGenerate}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3 print:hidden"
        >
          <p className="text-xs text-slate-500">
            Fills this class's timetable from the subjects assigned to it (set up via Classes → Subjects) — a fast
            starting point, still fully editable afterward. This replaces whatever is currently on this class's
            timetable.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">School days</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <label key={d} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={genForm.days.includes(d)}
                    onChange={() => setGenForm({ ...genForm, days: toggleDay(genForm.days, d) })}
                  />
                  {DAY_NAMES[d].slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Day starts at</label>
              <input
                required
                type="time"
                lang="en-GB"
                value={genForm.dayStartTime}
                onChange={(e) => setGenForm({ ...genForm, dayStartTime: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period length (min)</label>
              <input
                required
                type="number"
                min="10"
                max="180"
                value={genForm.periodLengthMinutes}
                onChange={(e) => setGenForm({ ...genForm, periodLengthMinutes: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Periods per day</label>
              <input
                required
                type="number"
                min="1"
                max="15"
                value={genForm.periodsPerDay}
                onChange={(e) => setGenForm({ ...genForm, periodsPerDay: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Break 1 (optional)</label>
              <div className="flex gap-1">
                <input
                  type="time"
                  lang="en-GB"
                  value={genForm.break1Start}
                  onChange={(e) => setGenForm({ ...genForm, break1Start: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={genForm.break1Duration}
                  onChange={(e) => setGenForm({ ...genForm, break1Duration: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-16"
                  title="Minutes"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Break 2 (optional)</label>
              <div className="flex gap-1">
                <input
                  type="time"
                  lang="en-GB"
                  value={genForm.break2Start}
                  onChange={(e) => setGenForm({ ...genForm, break2Start: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={genForm.break2Duration}
                  onChange={(e) => setGenForm({ ...genForm, break2Duration: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-16"
                  title="Minutes"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assembly (optional)</label>
              <div className="flex gap-1">
                <input
                  type="time"
                  lang="en-GB"
                  value={genForm.assemblyStart}
                  onChange={(e) => setGenForm({ ...genForm, assemblyStart: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min="5"
                  max="90"
                  value={genForm.assemblyDuration}
                  onChange={(e) => setGenForm({ ...genForm, assemblyDuration: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-16"
                  title="Minutes"
                />
              </div>
            </div>
            {genForm.assemblyStart && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assembly on</label>
                <div className="flex flex-wrap gap-2">
                  {genForm.days.map((d) => (
                    <label key={d} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={genForm.assemblyDays.includes(d)}
                        onChange={() => setGenForm({ ...genForm, assemblyDays: toggleDay(genForm.assemblyDays, d) })}
                      />
                      {DAY_NAMES[d].slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Generating…' : 'Generate'}
          </button>
        </form>
      )}

      {genWarnings.length > 0 && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4 print:hidden">
          {genWarnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {printTitle && <p className="hidden print:block text-base font-semibold mb-4">{printTitle}</p>}

      {!classId && !filterTeacherId ? (
        <p className="text-sm text-slate-500">
          {viewMode === 'class' ? 'Select a class to view its timetable.' : 'Select a teacher to view their timetable.'}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-slate-500">No periods scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm border-separate border-spacing-0">
            <thead className="bg-slate-50 text-slate-600">
              {(morningPeriods.length > 0 || eveningPeriods.length > 0) && (
                <tr>
                  <th className="sticky left-0 bg-slate-50 border-b border-r border-slate-200" />
                  {morningPeriods.length > 0 && (
                    <th
                      colSpan={morningPeriods.length}
                      className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-l border-slate-200"
                    >
                      Morning Classes
                    </th>
                  )}
                  {eveningPeriods.length > 0 && (
                    <th
                      colSpan={eveningPeriods.length}
                      className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-l border-slate-200"
                    >
                      Evening Classes
                    </th>
                  )}
                </tr>
              )}
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
                              value={editForm.slotType}
                              onChange={(e) => setEditForm({ ...editForm, slotType: e.target.value })}
                              className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                            >
                              {Object.entries(SLOT_TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
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
                                lang="en-GB"
                                value={editForm.startTime}
                                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                className="rounded border border-slate-300 px-1 py-1 text-xs w-full"
                              />
                              <input
                                type="time"
                                lang="en-GB"
                                value={editForm.endTime}
                                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                className="rounded border border-slate-300 px-1 py-1 text-xs w-full"
                              />
                            </div>
                            {editForm.slotType === 'subject' && (
                              <select
                                value={editForm.subjectId}
                                onChange={(e) => setEditForm({ ...editForm, subjectId: e.target.value })}
                                className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                              >
                                <option value="" disabled>
                                  Select subject…
                                </option>
                                {subjects.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            )}
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
                          onClick={viewMode === 'class' && isAdmin ? () => prefillEmptyCell(day, p) : undefined}
                          className={`px-3 py-2 min-w-[140px] ${
                            viewMode === 'class' && isAdmin ? 'cursor-pointer hover:bg-slate-50' : ''
                          }`}
                        />
                      );
                    }

                    const substitution = subBySlotId[slot.id];
                    const isAssigningSub = assigningSubForSlotId === slot.id;

                    return (
                      <td
                        key={p.key}
                        className={`px-3 py-2 align-top min-w-[140px] group border ${
                          slot.slot_type !== 'subject' ? 'bg-slate-50 border-transparent' : colorForSubject(slot.subject_id) || 'border-transparent'
                        } ${isCurrentPeriod(slot) ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                      >
                        <p className={`font-medium ${slot.slot_type === 'subject' ? 'text-slate-900' : 'text-slate-600 italic'}`}>
                          {slotLabel(slot, subjectNameById)}
                        </p>
                        {viewMode === 'teacher' && slot.class_name && (
                          <p className="text-xs text-slate-500">
                            {slot.class_name}
                            {slot.section ? ` ${slot.section}` : ''}
                          </p>
                        )}
                        {viewMode === 'class' && (slot.teacher_name || slot.teacher_id) && (
                          <p className="text-xs text-slate-500">{slot.teacher_name || teacherNameById[slot.teacher_id]}</p>
                        )}

                        {viewMode === 'class' && substitution && (
                          <p className="text-xs text-amber-700 font-medium mt-1">
                            {substitution.substitute_teacher_name} is covering
                            {isAdmin && (
                              <button
                                onClick={() => handleRemoveSub(substitution.id)}
                                className="ml-1 text-red-600 font-normal print:hidden"
                              >
                                (remove)
                              </button>
                            )}
                          </p>
                        )}

                        {viewMode === 'class' && isAdmin && slot.slot_type === 'subject' && !substitution && isAssigningSub && (
                          <div className="mt-1 flex flex-col gap-1 print:hidden">
                            <select
                              value={subAssignForm.substituteTeacherId}
                              onChange={(e) => setSubAssignForm({ ...subAssignForm, substituteTeacherId: e.target.value })}
                              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                            >
                              <option value="" disabled>
                                Substitute…
                              </option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <input
                              value={subAssignForm.reason}
                              onChange={(e) => setSubAssignForm({ ...subAssignForm, reason: e.target.value })}
                              placeholder="Reason (optional)"
                              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveAssignSub(slot)}
                                disabled={!subAssignForm.substituteTeacherId}
                                className="text-blue-600 text-xs font-medium disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button onClick={() => setAssigningSubForSlotId(null)} className="text-slate-500 text-xs">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {viewMode === 'class' && isAdmin && (
                          <div className="flex flex-wrap gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                            <button onClick={() => startEdit(slot)} className="text-blue-600 text-xs font-medium">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(slot.id)} className="text-red-600 text-xs font-medium">
                              Delete
                            </button>
                            {slot.slot_type === 'subject' &&
                              !substitution &&
                              !isAssigningSub &&
                              slot.day_of_week === subDateDow && (
                                <button onClick={() => startAssignSub(slot)} className="text-amber-700 text-xs font-medium">
                                  + Substitute
                                </button>
                              )}
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
