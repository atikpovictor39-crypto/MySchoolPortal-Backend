export default function StatCard({ icon, iconBg, label, value, valueColor, sublabel, extra }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueColor || 'text-slate-900'}`}>{value}</p>
      {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
      {extra}
    </div>
  );
}
