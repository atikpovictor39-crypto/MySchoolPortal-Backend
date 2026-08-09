import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listClasses } from '../../features/classes/api';
import { getAttendanceSheet, markAttendance } from '../../features/attendance/api';

const STATUSES = ['present', 'absent', 'late', 'excused'];
const STATUS_STYLE = {
  present: 'bg-green-600 text-white border-green-600',
  absent: 'bg-red-600 text-white border-red-600',
  late: 'bg-amber-500 text-white border-amber-500',
  excused: 'bg-slate-600 text-white border-slate-600',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { user } = useAuth();
  const canMark = user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER';

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch(() => setError('Failed to load classes'));
  }, []);

  useEffect(() => {
    if (!classId || !date) {
      setStudents([]);
      return;
    }
    setIsLoading(true);
    setError('');
    setSavedMessage('');
    getAttendanceSheet(classId, date)
      .then((sheet) => {
        // Default unmarked students to "present" so a teacher only has to
        // tap the exceptions (absent/late) instead of marking everyone.
        setStudents(sheet.students.map((s) => ({ ...s, status: s.status || 'present' })));
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load attendance'))
      .finally(() => setIsLoading(false));
  }, [classId, date]);

  function setStatus(studentId, status) {
    setStudents((prev) => prev.map((s) => (s.student_id === studentId ? { ...s, status } : s)));
  }

  async function handleSave() {
    setIsSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const records = students.map((s) => ({ studentId: s.student_id, status: s.status }));
      await markAttendance(classId, date, records);
      setSavedMessage('Attendance saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Attendance</h1>

      <div className="flex flex-wrap gap-3 items-end mb-6 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}
      {savedMessage && <p className="text-sm text-green-600 mb-4">{savedMessage}</p>}

      {!classId ? (
        <p className="text-sm text-slate-500">Select a class to mark attendance.</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-slate-500">No active students in this class.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2">Admission No.</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{s.admission_no}</td>
                  <td className="px-4 py-2">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-4 py-2">
                    {canMark ? (
                      <div className="flex gap-1">
                        {STATUSES.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setStatus(s.student_id, option)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                              s.status === option ? STATUS_STYLE[option] : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">{s.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {canMark && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save attendance'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
