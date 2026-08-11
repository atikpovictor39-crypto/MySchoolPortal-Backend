import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import TimetableGrid from '../../components/common/TimetableGrid';
import { getChildTimetable } from '../../features/parent/api';

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
    <div className="max-w-4xl">
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
            <TimetableGrid slots={slots} />
          )}
        </>
      )}
    </div>
  );
}
