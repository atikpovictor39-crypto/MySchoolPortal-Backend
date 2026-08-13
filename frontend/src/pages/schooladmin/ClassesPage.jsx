import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUndoToast } from '../../context/UndoToastContext';
import {
  createClass,
  updateClass,
  deleteClass,
  listClassSubjects,
  addClassSubject,
  updateClassSubject,
  removeClassSubject,
  listClassesWithStats,
  bulkAssignSubjects,
  promoteStudents,
} from '../../features/classes/api';
import { listAcademicYears } from '../../features/academicYears/api';
import { listSubjects } from '../../features/subjects/api';
import { listTeachers } from '../../features/teachers/api';
import { listStudents } from '../../features/students/api';

const emptyForm = { academicYearId: '', name: '', section: '' };
const emptyCsForm = { subjectId: '', teacherId: '', periodsPerWeek: '1' };
const STATUS_STYLE = {
  active: 'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function ClassesPage() {
  const { user } = useAuth();
  const { deleteWithUndo } = useUndoToast();
  const navigate = useNavigate();
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

  // ---- Filters ----
  const [yearFilter, setYearFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  // ---- Subjects for a class (feeds the timetable auto-generator) ----
  const [managingClassId, setManagingClassId] = useState(null);
  const [classSubjects, setClassSubjects] = useState([]);
  const [csForm, setCsForm] = useState(emptyCsForm);
  const [isAddingCs, setIsAddingCs] = useState(false);
  const [editingCsId, setEditingCsId] = useState(null);
  const [editCsForm, setEditCsForm] = useState({});

  // ---- Bulk assign subjects to several classes ----
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkClassIds, setBulkClassIds] = useState([]);
  const [bulkSubjectRows, setBulkSubjectRows] = useState([{ subjectId: '', periodsPerWeek: '3' }]);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkAssignMessage, setBulkAssignMessage] = useState('');

  // ---- Promote students (end of year) ----
  const [showPromote, setShowPromote] = useState(false);
  const [promoteSourceClassId, setPromoteSourceClassId] = useState('');
  const [promoteCandidates, setPromoteCandidates] = useState([]);
  const [promoteSelectedIds, setPromoteSelectedIds] = useState([]);
  const [promoteTargetMode, setPromoteTargetMode] = useState('existing'); // 'existing' | 'new'
  const [promoteTargetClassId, setPromoteTargetClassId] = useState('');
  const [promoteNewClass, setPromoteNewClass] = useState({ academicYearId: '', name: '', section: '' });
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState('');

  async function refresh() {
    setIsLoading(true);
    try {
      const [classList, yearList, subjectList, teacherList] = await Promise.all([
        listClassesWithStats({ academicYearId: yearFilter || undefined, classTeacherId: teacherFilter || undefined }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, teacherFilter]);

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
      await refresh(); // subject count on the row is now stale
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
      await refresh();
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
          setError(err.response?.data?.message || 'Failed to remove class');
          setClasses((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
    });
  }

  // ---- Bulk assign subjects ----

  function toggleBulkClass(id) {
    setBulkClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function updateBulkSubjectRow(index, field, value) {
    setBulkSubjectRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleBulkAssign() {
    setError('');
    setBulkAssignMessage('');
    const validRows = bulkSubjectRows.filter((r) => r.subjectId);
    if (bulkClassIds.length === 0 || validRows.length === 0) {
      setError('Pick at least one class and one subject to bulk-assign.');
      return;
    }
    setIsBulkAssigning(true);
    try {
      const result = await bulkAssignSubjects(
        bulkClassIds.map(Number),
        validRows.map((r) => ({ subjectId: Number(r.subjectId), periodsPerWeek: Number(r.periodsPerWeek) || 1 }))
      );
      setBulkAssignMessage(
        `Assigned ${validRows.length} subject(s) to ${bulkClassIds.length} class(es) (${result.assignedCount} total).`
      );
      setBulkClassIds([]);
      setBulkSubjectRows([{ subjectId: '', periodsPerWeek: '3' }]);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to bulk-assign subjects');
    } finally {
      setIsBulkAssigning(false);
    }
  }

  // ---- Promote students ----

  async function openPromote() {
    setShowPromote(true);
    setPromoteMessage('');
    setError('');
    setPromoteSourceClassId('');
    setPromoteCandidates([]);
    setPromoteSelectedIds([]);
    setPromoteTargetMode('existing');
    setPromoteTargetClassId('');
    setPromoteNewClass({ academicYearId: '', name: '', section: '' });
  }

  async function handlePromoteSourceChange(classId) {
    setPromoteSourceClassId(classId);
    setPromoteCandidates([]);
    setPromoteSelectedIds([]);
    if (!classId) return;
    try {
      const result = await listStudents({ classId, pageSize: 200 });
      const active = result.items.filter((s) => s.status === 'active');
      setPromoteCandidates(active);
      setPromoteSelectedIds(active.map((s) => s.id)); // everyone selected by default; admin unchecks repeaters
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students for this class');
    }
  }

  function toggleStudentSelected(id) {
    setPromoteSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handlePromote() {
    setError('');
    setPromoteMessage('');
    if (promoteSelectedIds.length === 0) {
      setError('Select at least one student to promote.');
      return;
    }
    const targetLabel =
      promoteTargetMode === 'existing'
        ? classes.find((c) => String(c.id) === promoteTargetClassId)?.name || 'the selected class'
        : `${promoteNewClass.name}${promoteNewClass.section ? ` ${promoteNewClass.section}` : ''} (new class)`;
    if (
      !window.confirm(
        `Move ${promoteSelectedIds.length} student(s) to ${targetLabel}? This changes their class immediately.`
      )
    ) {
      return;
    }

    setIsPromoting(true);
    try {
      const payload =
        promoteTargetMode === 'existing'
          ? { studentIds: promoteSelectedIds, targetClassId: Number(promoteTargetClassId) }
          : {
              studentIds: promoteSelectedIds,
              targetNewClass: {
                academicYearId: Number(promoteNewClass.academicYearId),
                name: promoteNewClass.name,
                section: promoteNewClass.section || undefined,
              },
            };
      const result = await promoteStudents(promoteSourceClassId, payload);
      setPromoteMessage(`Promoted ${result.promotedCount} student(s) to ${targetLabel}.`);
      await handlePromoteSourceChange(promoteSourceClassId); // refresh the checklist (promoted students drop off)
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to promote students');
    } finally {
      setIsPromoting(false);
    }
  }

  const yearNameById = Object.fromEntries(years.map((y) => [y.id, y.name]));

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Classes</h1>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
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

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Academic year</label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Class teacher</label>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <>
            <button
              onClick={() => setShowBulkAssign((v) => !v)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showBulkAssign ? 'Hide bulk assign' : 'Bulk assign subjects'}
            </button>
            <button
              onClick={() => (showPromote ? setShowPromote(false) : openPromote())}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showPromote ? 'Hide promote students' : 'Promote students'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="text-sm text-slate-500">No classes match.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Section</th>
              <th className="px-4 py-2">Academic year</th>
              <th className="px-4 py-2">Class Teacher</th>
              <th className="px-4 py-2">Students</th>
              <th className="px-4 py-2">Subjects</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
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
                  <td className="px-4 py-2 text-slate-400" colSpan={3}>
                    —
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
                  <td className="px-4 py-2">{c.class_teacher_name || '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => navigate(`/students?classId=${c.id}`)}
                      className="text-blue-600 hover:underline"
                    >
                      {c.student_count} student{c.student_count === 1 ? '' : 's'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => openManageSubjects(c.id)} className="text-blue-600 hover:underline">
                      {c.subject_count} subject{c.subject_count === 1 ? '' : 's'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[c.status]}`}
                    >
                      {c.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button onClick={() => navigate(`/attendance?classId=${c.id}`)} className="text-blue-600 text-xs font-medium">
                        Attendance
                      </button>
                      <button onClick={() => navigate(`/results?classId=${c.id}`)} className="text-blue-600 text-xs font-medium">
                        Results
                      </button>
                      <button onClick={() => navigate(`/timetable?classId=${c.id}`)} className="text-blue-600 text-xs font-medium">
                        Timetable
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => startEdit(c)} className="text-blue-600 text-xs font-medium">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(c)} className="text-red-600 text-xs font-medium">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
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

      {showBulkAssign && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Bulk assign subjects</h3>
          <p className="text-xs text-slate-400 mb-3">
            e.g. assign Math, English and Science to every Grade 5 class at once. No teacher is set here (a shared
            teacher across different classes is rarely right) — set each class's teacher afterward from its own
            Subjects panel above.
          </p>

          <p className="text-xs font-medium text-slate-600 mb-1">Classes</p>
          <div className="flex flex-wrap gap-3 mb-3 max-h-32 overflow-y-auto border border-slate-200 rounded-md p-2">
            {classes.map((c) => (
              <label key={c.id} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={bulkClassIds.includes(c.id)}
                  onChange={() => toggleBulkClass(c.id)}
                />
                {c.name}
                {c.section ? ` ${c.section}` : ''}
              </label>
            ))}
          </div>

          <p className="text-xs font-medium text-slate-600 mb-1">Subjects</p>
          <div className="space-y-2 mb-3">
            {bulkSubjectRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-end">
                <select
                  value={row.subjectId}
                  onChange={(e) => updateBulkSubjectRow(i, 'subjectId', e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={row.periodsPerWeek}
                  onChange={(e) => updateBulkSubjectRow(i, 'periodsPerWeek', e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
                  title="Periods/week"
                />
                <button
                  onClick={() => setBulkSubjectRows((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => setBulkSubjectRows((prev) => [...prev, { subjectId: '', periodsPerWeek: '3' }])}
              className="text-blue-600 text-xs font-medium"
            >
              + Add another subject
            </button>
          </div>

          {bulkAssignMessage && <p className="text-sm text-green-600 mb-3">{bulkAssignMessage}</p>}

          <button
            onClick={handleBulkAssign}
            disabled={isBulkAssigning}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isBulkAssigning ? 'Assigning…' : `Assign to ${bulkClassIds.length} class(es)`}
          </button>
        </div>
      )}

      {showPromote && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Promote students</h3>
          <p className="text-xs text-slate-400 mb-3">
            End-of-year move: pick a class, uncheck anyone repeating the grade, then move everyone else to the next
            class — an existing one or a brand new one.
          </p>

          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">From class</label>
            <select
              value={promoteSourceClassId}
              onChange={(e) => handlePromoteSourceChange(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.section ? ` ${c.section}` : ''} ({c.student_count} students)
                </option>
              ))}
            </select>
          </div>

          {promoteSourceClassId && (
            <>
              {promoteCandidates.length === 0 ? (
                <p className="text-sm text-slate-500 mb-3">No active students in this class.</p>
              ) : (
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-medium text-slate-600">
                      Students ({promoteSelectedIds.length} of {promoteCandidates.length} selected)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPromoteSelectedIds(promoteCandidates.map((s) => s.id))}
                        className="text-xs text-blue-600 font-medium"
                      >
                        Select all
                      </button>
                      <button onClick={() => setPromoteSelectedIds([])} className="text-xs text-slate-500">
                        Select none
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1">
                    {promoteCandidates.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={promoteSelectedIds.includes(s.id)}
                          onChange={() => toggleStudentSelected(s.id)}
                        />
                        {s.first_name} {s.last_name} ({s.admission_no})
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1">To</p>
                <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs mb-2">
                  {[
                    { key: 'existing', label: 'Existing class' },
                    { key: 'new', label: 'Create new class' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setPromoteTargetMode(opt.key)}
                      className={`px-3 py-1.5 ${
                        promoteTargetMode === opt.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {promoteTargetMode === 'existing' ? (
                  <select
                    value={promoteTargetClassId}
                    onChange={(e) => setPromoteTargetClassId(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm block"
                  >
                    <option value="">Select…</option>
                    {classes
                      .filter((c) => String(c.id) !== String(promoteSourceClassId))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.section ? ` ${c.section}` : ''} ({yearNameById[c.academic_year_id]})
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={promoteNewClass.academicYearId}
                      onChange={(e) => setPromoteNewClass({ ...promoteNewClass, academicYearId: e.target.value })}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      <option value="">Academic year…</option>
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={promoteNewClass.name}
                      onChange={(e) => setPromoteNewClass({ ...promoteNewClass, name: e.target.value })}
                      placeholder="Grade 6"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
                    />
                    <input
                      value={promoteNewClass.section}
                      onChange={(e) => setPromoteNewClass({ ...promoteNewClass, section: e.target.value })}
                      placeholder="A"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-20"
                    />
                  </div>
                )}
              </div>

              {promoteMessage && <p className="text-sm text-green-600 mb-3">{promoteMessage}</p>}

              <button
                onClick={handlePromote}
                disabled={
                  isPromoting ||
                  promoteSelectedIds.length === 0 ||
                  (promoteTargetMode === 'existing' ? !promoteTargetClassId : !promoteNewClass.academicYearId || !promoteNewClass.name)
                }
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPromoting ? 'Promoting…' : `Promote ${promoteSelectedIds.length} student(s)`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
