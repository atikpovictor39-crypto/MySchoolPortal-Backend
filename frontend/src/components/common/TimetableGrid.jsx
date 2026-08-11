const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Read-only day × period grid — rows are days, columns are every distinct
// period (start–end time) that appears anywhere in the week, so a period
// that only meets on one day still gets its own column rather than being
// squeezed into a mismatched one.
export default function TimetableGrid({ slots }) {
  const periodKey = (start, end) => `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  const periodsByKey = new Map();
  for (const slot of slots) {
    const key = periodKey(slot.start_time, slot.end_time);
    if (!periodsByKey.has(key)) {
      periodsByKey.set(key, { key, startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5) });
    }
  }
  const periods = [...periodsByKey.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const daysWithSlots = new Set(slots.map((s) => s.day_of_week));
  const daysToShow = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || daysWithSlots.has(d));

  const slotGrid = {};
  for (const slot of slots) {
    const key = periodKey(slot.start_time, slot.end_time);
    slotGrid[slot.day_of_week] = slotGrid[slot.day_of_week] || {};
    slotGrid[slot.day_of_week][key] = slot;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm border-separate border-spacing-0">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 border-b border-r border-slate-200">Day</th>
            {periods.map((p) => (
              <th key={p.key} className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-200">
                {p.startTime} – {p.endTime}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daysToShow.map((day) => (
            <tr key={day} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white border-r border-slate-200">
                {DAY_NAMES[day]}
              </td>
              {periods.map((p) => {
                const slot = slotGrid[day]?.[p.key];
                return (
                  <td key={p.key} className="px-3 py-2 align-top min-w-[140px]">
                    {slot && (
                      <>
                        <p className="font-medium text-slate-900">{slot.subject_name}</p>
                        <p className="text-xs text-slate-500">{slot.teacher_name || '—'}</p>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
