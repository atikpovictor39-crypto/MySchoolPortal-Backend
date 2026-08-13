import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listStudents, createStudent, updateStudent, listGuardians, addGuardian } from '../../features/students/api';
import { listClasses } from '../../features/classes/api';
import { getMyTeacherProfile } from '../../features/teachers/api';
import PasswordInput from '../../components/common/PasswordInput';

const emptyForm = { classId: '', admissionNo: '', firstName: '', lastName: '', gender: '' };
const emptyGuardianForm = { name: '', email: '', password: '', relationship: '', isPrimary: false };
const STATUSES = ['active', 'graduated', 'transferred', 'withdrawn'];

export default function StudentsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';
  const isTeacher = user.role === 'TEACHER';

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myTeacherId, setMyTeacherId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [managingGuardiansFor, setManagingGuardiansFor] = useState(null);
  const [guardians, setGuardians] = useState([]);
  const [guardianForm, setGuardianForm] = useState(emptyGuardianForm);
  const [isAddingGuardian, setIsAddingGuardian] = useState(false);
  const [searchParams] = useSearchParams();
  // Lets the Classes page's "Students" quick action land here pre-filtered
  // to that class instead of the admin having to reselect it.
  const [classFilter, setClassFilter] = useState(searchParams.get('classId') || '');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  async function refresh() {
    setIsLoading(true);
    try {
      // pageSize well above any realistic single-school roster so nothing
      // is silently hidden behind pagination the UI doesn't expose yet.
      const [studentResult, classList] = await Promise.all([
        listStudents({ classId: classFilter || undefined, search: search || undefined, pageSize: 100 }),
        listClasses(),
      ]);
      setStudents(studentResult.items);
      setClasses(classList);
      if (isTeacher) {
        setMyTeacherId((await getMyTeacherProfile()).teacherId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter, search]);

  // Debounced so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // A Teacher can manage guardians only for students in a class they're the
  // assigned class teacher of — mirrors the ownership check the backend
  // enforces regardless (see student.controller.js), this just decides
  // whether to show the button at all.
  function canManageGuardians(student) {
    if (isAdmin) return true;
    if (!isTeacher || !myTeacherId) return false;
    const studentClass = classes.find((c) => c.id === student.class_id);
    return studentClass?.class_teacher_id === myTeacherId;
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createStudent({ ...form, gender: form.gender || undefined });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add student');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(student) {
    setEditingId(student.id);
    setEditForm({
      firstName: student.first_name,
      lastName: student.last_name,
      classId: student.class_id,
      status: student.status,
    });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateStudent(id, editForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update student');
    }
  }

  const classNameById = Object.fromEntries(classes.map((c) => [c.id, `${c.name}${c.section ? ` ${c.section}` : ''}`]));

  async function openGuardians(student) {
    setError('');
    setManagingGuardiansFor(student);
    setGuardianForm(emptyGuardianForm);
    try {
      setGuardians(await listGuardians(student.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load guardians');
    }
  }

  async function handleAddGuardian(e) {
    e.preventDefault();
    setError('');
    setIsAddingGuardian(true);
    try {
      const updated = await addGuardian(managingGuardiansFor.id, guardianForm);
      setGuardians(updated);
      setGuardianForm(emptyGuardianForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add guardian');
    } finally {
      setIsAddingGuardian(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Students</h1>

      {isAdmin && (
        <form
          onSubmit={handleCreate}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
            <select
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Select…
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.section ? ` ${c.section}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Admission No.</label>
            <input
              value={form.admissionNo}
              onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
              placeholder="Auto-generated"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First name</label>
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last name</label>
            <input
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || classes.length === 0}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add student'}
          </button>
        </form>
      )}

      {classes.length === 0 && !isLoading && (
        <p className="text-sm text-amber-600 mb-4">Create a class first before adding students.</p>
      )}

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Search by name or admission no.</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="e.g. Kwame"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-56"
          />
        </div>
        {(classFilter || search) && (
          <button
            onClick={() => {
              setClassFilter('');
              setSearchInput('');
            }}
            className="text-xs text-slate-500 hover:text-slate-700 pb-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-slate-500">
          {classFilter || search ? 'No students match.' : 'No students yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Admission No.</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">Status</th>
              {(isAdmin || isTeacher) && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {students.map((s) =>
              editingId === s.id ? (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{s.admission_no}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <input
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
                      />
                      <input
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-sm w-24"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editForm.classId}
                      onChange={(e) => setEditForm({ ...editForm, classId: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.section ? ` ${c.section}` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      {STATUSES.map((s2) => (
                        <option key={s2} value={s2}>
                          {s2}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
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
                  <td className="px-4 py-2">{s.admission_no}</td>
                  <td className="px-4 py-2">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-4 py-2">{classNameById[s.class_id] || s.class_id}</td>
                  <td className="px-4 py-2">{s.status}</td>
                  {(isAdmin || isTeacher) && (
                    <td className="px-4 py-2">
                      <div className="flex gap-3">
                        {isAdmin && (
                          <button onClick={() => startEdit(s)} className="text-blue-600 text-xs font-medium">
                            Edit
                          </button>
                        )}
                        {canManageGuardians(s) && (
                          <button onClick={() => openGuardians(s)} className="text-blue-600 text-xs font-medium">
                            Guardians
                          </button>
                        )}
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

      {managingGuardiansFor && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4 max-w-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Guardians for {managingGuardiansFor.first_name} {managingGuardiansFor.last_name}
            </h3>
            <button
              onClick={() => {
                setManagingGuardiansFor(null);
                setGuardians([]);
              }}
              className="text-slate-400 text-xs"
            >
              Close
            </button>
          </div>

          {guardians.length === 0 ? (
            <p className="text-sm text-slate-500 mb-3">No guardians linked yet.</p>
          ) : (
            <ul className="text-sm mb-3 space-y-1">
              {guardians.map((g) => (
                <li key={g.parent_user_id} className="flex justify-between text-slate-700">
                  <span>
                    {g.name} <span className="text-slate-400">({g.email})</span>
                  </span>
                  <span className="text-slate-500">
                    {g.relationship || ''}
                    {g.is_primary ? ' · primary' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddGuardian} className="flex flex-wrap gap-2 items-end border-t border-slate-200 pt-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                required
                value={guardianForm.name}
                onChange={(e) => setGuardianForm({ ...guardianForm, name: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                required
                type="email"
                value={guardianForm.email}
                onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <PasswordInput
                placeholder="if new account"
                value={guardianForm.password}
                onChange={(e) => setGuardianForm({ ...guardianForm, password: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Relationship</label>
              <input
                value={guardianForm.relationship}
                onChange={(e) => setGuardianForm({ ...guardianForm, relationship: e.target.value })}
                placeholder="Mother"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-slate-700 pb-1.5">
              <input
                type="checkbox"
                checked={guardianForm.isPrimary}
                onChange={(e) => setGuardianForm({ ...guardianForm, isPrimary: e.target.checked })}
              />
              Primary
            </label>
            <button
              type="submit"
              disabled={isAddingGuardian}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isAddingGuardian ? 'Adding…' : 'Add guardian'}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">
            If the email already belongs to an existing guardian, they'll just be linked to this student too — leave
            password blank in that case.
          </p>
        </div>
      )}
    </div>
  );
}
