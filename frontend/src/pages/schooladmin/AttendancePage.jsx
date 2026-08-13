import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listClasses } from '../../features/classes/api';
import { listSubjects } from '../../features/subjects/api';
import {
  getAttendanceSheet,
  markAttendance,
  getAttendanceReport,
  downloadAttendanceReport,
} from '../../features/attendance/api';

const STATUSES = ['present', 'absent', 'late', 'excused'];
const STATUS_STYLE = {
  present: 'bg-green-600 text-white border-green-600',
  absent: 'bg-red-600 text-white border-red-600',
  late: 'bg-yellow-500 text-white border-yellow-500',
  excused: 'bg-slate-600 text-white border-slate-600',
};
const ATTENDANCE_TYPES = [
  { key: 'whole_day', label: 'Whole day' },
  { key: 'morning', label: 'Morning' },
  { key: 'after_break', label: 'After Break' },
  { key: 'subject', label: 'Subject-based' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { user } = useAuth();
  const canMark = user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER';

  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('take'); // 'take' | 'reports'
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  // Lets the Classes page's "Attendance" quick action land here with that
  // class pre-selected, ready to take attendance immediately.
  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // ---- Take Attendance ----
  const [date, setDate] = useState(todayISO());
  const [attendanceType, setAttendanceType] = useState('whole_day');
  const [attendanceSubjectId, setAttendanceSubjectId] = useState('');
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ---- View Reports ----
  const [reportFrom, setReportFrom] = useState(firstOfMonthISO());
  const [reportTo, setReportTo] = useState(todayISO());
  const [report, setReport] = useState([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    Promise.all([listClasses(), listSubjects()])
      .then(([c, s]) => {
        setClasses(c);
        setSubjects(s);
      })
      .catch(() => setError('Failed to load classes'));
  }, []);

  useEffect(() => {
    if (viewMode !== 'take' || !classId || !date) {
      if (viewMode === 'take') setStudents([]);
      return;
    }
    setIsLoading(true);
    setError('');
    getAttendanceSheet(classId, date)
      .then((sheet) => {
        // Default unmarked students to "present" so a teacher only has to
        // tap the exceptions (absent/late) instead of marking everyone.
        setStudents(sheet.students.map((s) => ({ ...s, status: s.status || 'present' })));
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load attendance'))
      .finally(() => setIsLoading(false));
  }, [viewMode, classId, date]);

  useEffect(() => {
    if (viewMode !== 'reports' || !classId || !reportFrom || !reportTo) {
      if (viewMode === 'reports') setReport([]);
      return;
    }
    setIsLoadingReport(true);
    setError('');
    getAttendanceReport(classId, reportFrom, reportTo)
      .then(setReport)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load attendance report'))
      .finally(() => setIsLoadingReport(false));
  }, [viewMode, classId, reportFrom, reportTo]);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }

  function setStatus(studentId, status) {
    setStudents((prev) => prev.map((s) => (s.student_id === studentId ? { ...s, status } : s)));
  }

  function markAll(status) {
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
  }

  const sessionLabel =
    attendanceType === 'subject'
      ? subjects.find((s) => String(s.id) === attendanceSubjectId)?.name || 'Subject'
      : ATTENDANCE_TYPES.find((t) => t.key === attendanceType)?.label || 'Whole day';

  const selectedClassLabel = (() => {
    const c = classes.find((c) => String(c.id) === String(classId));
    return c ? `${c.name}${c.section ? ` ${c.section}` : ''}` : '';
  })();

  async function handleSave() {
    setIsSaving(true);
    setError('');
    try {
      const records = students.map((s) => ({ studentId: s.student_id, status: s.status }));
      await markAttendance(classId, date, records);
      showToast(`${sessionLabel} attendance saved for ${selectedClassLabel}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setError('');
    try {
      await downloadAttendanceReport(classId, reportFrom, reportTo);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export attendance report');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6 print:hidden">Attendance</h1>

      <div className="mb-4 print:hidden">
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
          {[
            { key: 'take', label: 'Take Attendance' },
            { key: 'reports', label: 'View Reports' },
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

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4 print:hidden">
          {error}
        </p>
      )}

      {viewMode === 'take' ? (
        <>
          <div className="flex flex-wrap gap-3 items-end mb-4 bg-white border border-slate-200 rounded-xl shadow-sm p-4 print:hidden">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Attendance type</label>
              <select
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                {ATTENDANCE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {attendanceType === 'subject' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <select
                  value={attendanceSubjectId}
                  onChange={(e) => setAttendanceSubjectId(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Select…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {attendanceType !== 'whole_day' && (
            <p className="text-xs text-slate-400 mb-4 print:hidden">
              "{sessionLabel}" is just a label for this save — the school only keeps one attendance record per
              student per day, so saving again later today will overwrite this one rather than add a second record.
            </p>
          )}

          {!classId ? (
            <p className="text-sm text-slate-500">Select a class to mark attendance.</p>
          ) : isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-500">No active students in this class.</p>
          ) : (
            <>
              {canMark && (
                <div className="flex gap-2 mb-3 print:hidden">
                  <button
                    onClick={() => markAll('present')}
                    className="rounded-md border border-green-300 bg-green-50 text-green-700 px-3 py-1.5 text-xs font-medium hover:bg-green-100"
                  >
                    Mark all present
                  </button>
                  <button
                    onClick={() => markAll('absent')}
                    className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
                  >
                    Mark all absent
                  </button>
                </div>
              )}

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
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save attendance'}
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 items-end mb-4 bg-white border border-slate-200 rounded-xl shadow-sm p-4 print:hidden">
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
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            {classId && (
              <>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isExporting ? 'Exporting…' : 'Export to Excel (CSV)'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Print / Download PDF
                </button>
              </>
            )}
          </div>

          {classId && (
            <p className="hidden print:block text-base font-semibold mb-4">
              Attendance report — {selectedClassLabel} ({reportFrom} to {reportTo})
            </p>
          )}

          {!classId ? (
            <p className="text-sm text-slate-500">Select a class to view its attendance report.</p>
          ) : isLoadingReport ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : report.length === 0 ? (
            <p className="text-sm text-slate-500">No active students in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Admission No.</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Present</th>
                    <th className="px-4 py-2">Absent</th>
                    <th className="px-4 py-2">Late</th>
                    <th className="px-4 py-2">Excused</th>
                    <th className="px-4 py-2">Total Marked</th>
                    <th className="px-4 py-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.student_id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{r.admission_no}</td>
                      <td className="px-4 py-2">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="px-4 py-2 text-green-700">{r.present_count}</td>
                      <td className="px-4 py-2 text-red-700">{r.absent_count}</td>
                      <td className="px-4 py-2 text-yellow-700">{r.late_count}</td>
                      <td className="px-4 py-2 text-slate-600">{r.excused_count}</td>
                      <td className="px-4 py-2">{r.total_marked}</td>
                      <td className="px-4 py-2">{r.rate === null ? '—' : `${r.rate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm rounded-lg shadow-xl px-4 py-3 print:hidden">
          {toast}
        </div>
      )}
    </div>
  );
}
