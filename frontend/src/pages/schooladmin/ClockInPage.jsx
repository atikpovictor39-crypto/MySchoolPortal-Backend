import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyStatus, clockIn, clockOut, listClockIns } from '../../features/teacherClockIn/api';
import { listTeachers } from '../../features/teachers/api';

function formatDateTime(dt) {
  return dt ? new Date(dt).toLocaleString() : '—';
}

export default function ClockInPage() {
  const { user } = useAuth();
  const isTeacher = user.role === 'TEACHER';
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [status, setStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherFilter, setTeacherFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setIsLoading(true);
    try {
      if (isTeacher) {
        setStatus(await getMyStatus());
      }
      if (isAdmin) {
        setTeachers(await listTeachers());
      }
      setRecords(await listClockIns(teacherFilter ? { teacherId: teacherFilter } : {}));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load clock-in data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherFilter]);

  async function handleClockIn() {
    setError('');
    setIsBusy(true);
    try {
      await clockIn();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock in');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClockOut() {
    setError('');
    setIsBusy(true);
    try {
      await clockOut();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clock out');
    } finally {
      setIsBusy(false);
    }
  }

  const teacherNameById = Object.fromEntries(teachers.map((t) => [t.id, t.name]));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Teacher Clock-In</h1>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isTeacher && status && (
        <div className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <p className="text-sm text-slate-600 mb-3">
            {status.clockedIn ? `Clocked in at ${formatDateTime(status.clockInAt)}` : 'Not clocked in'}
          </p>
          {status.clockedIn ? (
            <button
              onClick={handleClockOut}
              disabled={isBusy}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isBusy ? 'Working…' : 'Clock out'}
            </button>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={isBusy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isBusy ? 'Working…' : 'Clock in'}
            </button>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Filter by teacher</label>
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
      )}

      <h2 className="text-sm font-semibold text-slate-900 mb-2">{isTeacher ? 'My history' : 'Records'}</h2>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-slate-500">No clock-in records yet.</p>
      ) : (
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {isAdmin && <th className="px-4 py-2">Teacher</th>}
              <th className="px-4 py-2">Clock in</th>
              <th className="px-4 py-2">Clock out</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {isAdmin && <td className="px-4 py-2">{r.teacher_name || teacherNameById[r.teacher_id]}</td>}
                <td className="px-4 py-2">{formatDateTime(r.clock_in_at)}</td>
                <td className="px-4 py-2">{r.clock_out_at ? formatDateTime(r.clock_out_at) : 'Still clocked in'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
