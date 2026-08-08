import { createContext, useContext, useEffect, useState } from 'react';
import { listChildren } from '../features/parent/api';

const ParentContext = createContext(null);

// Shared across every parent page (Overview, Results, Attendance, Fees,
// Timetable) so the selected child stays the same as you navigate between
// them, instead of each page re-fetching the list and resetting to "first child".
export function ParentProvider({ children }) {
  const [childList, setChildList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listChildren()
      .then((list) => {
        setChildList(list);
        if (list.length > 0) setSelectedChildId(list[0].id);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load children'))
      .finally(() => setIsLoading(false));
  }, []);

  const selectedChild = childList.find((c) => c.id === selectedChildId) || null;

  const value = { childList, selectedChildId, setSelectedChildId, selectedChild, isLoading, error };
  return <ParentContext.Provider value={value}>{children}</ParentContext.Provider>;
}

export function useParent() {
  return useContext(ParentContext);
}
