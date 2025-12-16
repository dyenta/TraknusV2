export function ControlBox({ label, value, onChange, options, color }: any) {
    return (
        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2 w-full md:w-auto hover:border-blue-400 transition-colors">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-${color}-50 text-${color}-700 whitespace-nowrap`}>{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 w-full focus:outline-none cursor-pointer py-1">
                {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    )
}