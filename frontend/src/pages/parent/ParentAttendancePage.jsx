import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import { getChildAttendance } from '../../features/parent/api';

const STATUS_STYLE = {
  present: 'bg-green-50 text-green-700 border-green-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  excused: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function ParentAttendancePage() {
  const { childList, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [attendance, setAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) return;
    setIsLoading(true);
    setError('');
    getChildAttendance(selectedChildId)
      .then(setAttendance)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load attendance'))
      .finally(() => setIsLoading(false));
  }, [selectedChildId]);

  if (isLoadingChildren) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Attendance</h1>

      {(childrenError || error) && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {childrenError || error}
        </p>
      )}

      {childList.length === 0 ? (
        <p className="text-sm text-slate-500">No children linked to your account yet.</p>
      ) : (
        <>
          <ChildTabs />

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : attendance.length === 0 ? (
            <p className="text-sm text-slate-500">No attendance recorded yet.</p>
          ) : (
            <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.date} className="border-t border-slate-100">
                    <td className="px-4 py-2">{a.date.slice(0, 10)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
