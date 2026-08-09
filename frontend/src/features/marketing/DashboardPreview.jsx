const STATS = [
  ['Students', '18'],
  ['Fees collected', 'GHS 3,600'],
  ['Outstanding', 'GHS 3,000'],
  ['Attendance', '92%'],
];

const ATTENDANCE_BARS = [70, 85, 60, 90, 95];

// A hand-built mockup, not a real screenshot — it stays accurate as the app
// evolves and never leaks real school data on the public landing page.
export default function DashboardPreview() {
  return (
    <div className="rounded-xl border border-slate-200 shadow-xl overflow-hidden bg-white">
      <div className="h-9 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 px-4">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-[11px] text-slate-400 truncate">myschoolportalgh.com/dashboard</span>
      </div>
      <div className="p-6 bg-[#F5F8FF]">
        <p className="text-xs font-semibold text-blue-800 mb-3">Dashboard</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {STATS.map(([label, value]) => (
            <div key={label} className="bg-white rounded-lg border border-slate-100 shadow-sm p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4">
          <p className="text-[11px] font-medium text-slate-700 mb-2">Attendance this week</p>
          <div className="flex items-end gap-2 h-16">
            {ATTENDANCE_BARS.map((height, i) => (
              <div key={i} className="flex-1 bg-blue-500/80 rounded-t" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
