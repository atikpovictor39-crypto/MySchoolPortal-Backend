import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import { getChildTimetable } from '../../features/parent/api';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ParentTimetablePage() {
  const { childList, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) return;
    setIsLoading(true);
    setError('');
    getChildTimetable(selectedChildId)
      .then(setSlots)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load timetable'))
      .finally(() => setIsLoading(false));
  }, [selectedChildId]);

  if (isLoadingChildren) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Timetable</h1>

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
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500">No periods scheduled yet.</p>
          ) : (
            <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Teacher</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{DAY_NAMES[slot.day_of_week]}</td>
                    <td className="px-4 py-2">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-2">{slot.subject_name}</td>
                    <td className="px-4 py-2">{slot.teacher_name || '—'}</td>
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
