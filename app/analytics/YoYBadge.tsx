import { ArrowUp, ArrowDown } from 'lucide-react'

export function YoYBadge({ current, previous }: { current: number, previous: number }) {
    if (previous === 0) return null;
    const diff = current - previous
    const percent = (diff / previous) * 100
    const isUp = percent > 0
    const isNeutral = percent === 0
    if (current === 0) return <span className="text-[9px] text-slate-300">-</span>

    return (
        <div className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0 rounded-full border shadow-sm ${isNeutral ? 'bg-slate-100 text-slate-500 border-slate-200' : ''} ${isUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''} ${!isUp && !isNeutral ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}`}>
            {isUp ? <ArrowUp size={8} /> : (!isNeutral && <ArrowDown size={8} />)}
            <span>{Math.abs(percent).toFixed(1)}%</span>
        </div>
    )
}