import { useParent } from '../../context/ParentContext';

function initials(first, last) {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
}

// Shown at the top of every parent page — switching child here persists
// across Overview/Results/Attendance/Fees/Timetable via ParentContext.
export default function ChildTabs() {
  const { childList, selectedChildId, setSelectedChildId } = useParent();

  if (childList.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {childList.map((child) => {
        const isActive = child.id === selectedChildId;
        return (
          <button
            key={child.id}
            onClick={() => setSelectedChildId(child.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {initials(child.first_name, child.last_name)}
            </span>
            {child.first_name} {child.last_name} · {child.class_name}
            {child.section ? ` ${child.section}` : ''}
          </button>
        );
      })}
    </div>
  );
}
