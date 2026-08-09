// Shared underline-style tab bar (Fees, Results, Schools all use this).
// `touch-manipulation` + `select-none` remove the ~300ms double-tap-to-zoom
// delay mobile browsers impose by default, which is what made tabs need two
// taps before the content actually switched.
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-6 border-b border-slate-200 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`shrink-0 select-none touch-manipulation whitespace-nowrap border-b-2 -mb-px px-4 py-2.5 text-sm font-medium transition-colors ${
              active === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
