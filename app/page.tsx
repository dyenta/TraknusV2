'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { LayoutGrid, RefreshCcw, Filter, MinusSquare, PlusSquare, Database, ArrowUp, ArrowDown, ChevronDown, Check, ZoomIn, ZoomOut, Maximize, Search, X, BarChart3, LogOut, Sun, Moon, Laptop, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from './components/ThemeProvider'

// --- TYPES & CONSTANTS ---
export interface AggregatedRecord { year: number; month: number; col_label_1: string; col_label_2: string; col_label_3: string; col_label_4: string; total_amount: number; }
export interface PivotNode { id: string; label: string; level: number; isLeaf: boolean; values: Record<string, number>; rowTotal: number; children?: PivotNode[]; }

export const DIMENSION_OPTIONS = [ { label: '(None)', value: '' }, { label: 'Business Area', value: 'business_area' }, { label: 'PSS', value: 'pss' }, { label: 'Key Account Type', value: 'key_account_type' }, { label: 'Customer Group', value: 'cust_group' }, { label: 'Product', value: 'product' }, { label: 'Area', value: 'area' } ]
export const MONTH_OPTIONS = [ { label: 'Jan', value: '1' }, { label: 'Feb', value: '2' }, { label: 'Mar', value: '3' }, { label: 'Apr', value: '4' }, { label: 'Mei', value: '5' }, { label: 'Jun', value: '6' }, { label: 'Jul', value: '7' }, { label: 'Agu', value: '8' }, { label: 'Sep', value: '9' }, { label: 'Okt', value: '10' }, { label: 'Nov', value: '11' }, { label: 'Des', value: '12' } ]
const MONTH_COLORS = ["#4338ca", "#4f46e5", "#5156cf", "#5a5ee0", "#6366f1", "#6d78e9", "#7782f0", "#818cf8", "#8795f3", "#919ff6", "#9baaf9", "#a5b4fc"]

// --- HELPER COMPONENTS ---
const YoYBadge = ({ current, previous }: { current: number, previous: number }) => {
    if (previous === 0) return null;
    const diff = current - previous, percent = (diff / previous) * 100, isUp = percent > 0
    if (current === 0) return <span className="text-[9px] text-slate-300 dark:text-slate-600">-</span>
    return <div className={`flex items-center gap-[0.2em] text-[0.7em] font-bold px-[0.5em] rounded-full border shadow-sm ${percent===0 ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' : isUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'}`}>{isUp ? <ArrowUp style={{width:'0.8em',height:'0.8em'}}/> : (percent!==0 && <ArrowDown style={{width:'0.8em',height:'0.8em'}}/>)}<span>{Math.abs(percent).toFixed(1)}%</span></div>
}

// Updated ControlBox: Custom Dropdown Style (Single Select)
const ControlBox = ({ label, value, onChange, options }: any) => {
    const [isOpen, setIsOpen] = useState(false), containerRef = useRef<HTMLDivElement>(null)
    // Close on outside click
    useEffect(() => {
        const handleDown = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false) }
        if (isOpen) document.addEventListener('mousedown', handleDown); return () => document.removeEventListener('mousedown', handleDown)
    }, [isOpen])

    const selectedLabel = options.find((o:any) => o.value === value)?.label || "Select..."

    return (
        <div className="flex flex-col w-full relative" ref={containerRef}>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase">{label}</label>
            <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between gap-2 w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-md shadow-sm transition-colors text-left ${isOpen ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{selectedLabel}</span>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
            {isOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 md:bg-transparent md:p-0 md:absolute md:inset-auto md:top-full md:left-0 md:block md:mt-1">
                    <div className="absolute inset-0 md:hidden" onClick={()=>setIsOpen(false)}></div>
                    <div className="relative w-full max-w-xs md:w-full min-w-37.5 max-h-[50vh] overflow-y-auto bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-xl z-10 animate-in fade-in zoom-in-95 duration-200 py-1 flex flex-col">
                         {options.map((opt:any) => (
                             <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors ${value === opt.value ? 'text-blue-600 dark:text-blue-400 font-bold bg-slate-50 dark:bg-slate-800/50' : 'text-slate-700 dark:text-slate-200'}`}>
                                 <span>{opt.label}</span>
                                 {value === opt.value && <Check size={12}/>}
                             </button>
                         ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// Updated MultiSelect: Hapus autoFocus agar keyboard tidak auto-popup di Mobile
const MultiSelect = ({ label, options, optionsRaw, selected, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false), [searchTerm, setSearchTerm] = useState(""), containerRef = useRef<HTMLDivElement>(null)
  const finalOptions = useMemo(() => (optionsRaw || (options || []).map((o: any) => ({ label: !o || String(o).trim() === '' ? `No ${label}` : String(o), value: !o || String(o).trim() === '' ? "" : String(o) }))), [options, optionsRaw, label])
  const filtered = finalOptions.filter((o:any) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
  
  useEffect(() => { 
      const handleDown = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false) }
      const handleEsc = (e: KeyboardEvent) => { if(e.key==='Escape') setIsOpen(false) }
      if (isOpen) { document.addEventListener('mousedown', handleDown); window.addEventListener('keydown', handleEsc) }
      return () => { document.removeEventListener('mousedown', handleDown); window.removeEventListener('keydown', handleEsc) }
  }, [isOpen])
  
  const toggle = (val: string) => { if (val === 'All') onChange(selected.includes('All') ? [] : ['All']); else { let newSel = selected.includes('All') ? finalOptions.map((o:any)=>o.value) : [...selected]; newSel = newSel.includes(val) ? newSel.filter((i:string)=>i!==val) : [...newSel, val]; onChange((newSel.length === finalOptions.length && finalOptions.length > 0) ? ['All'] : newSel) } }
  const display = () => { if (selected.includes('All')) return 'All'; if (!selected.length) return 'None'; const names = selected.map((v:string) => finalOptions.find((o:any)=>o.value===v)?.label).filter(Boolean); return names.length > 2 ? `${names[0]}, ${names[1]} +${names.length-2}` : names.join(', ') }
  
  return (
    <div className="relative" ref={containerRef}>
       <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase">{label}</label><button onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between gap-2 w-full md:w-auto md:min-w-32 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-md shadow-sm transition-colors ${isOpen ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}><span className="truncate font-medium text-slate-700 dark:text-slate-200 max-w-25 text-left">{display()}</span><ChevronDown size={14} className="text-slate-400 shrink-0" /></button></div>
       {isOpen && (
         <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 md:bg-transparent md:p-0 md:absolute md:inset-auto md:top-full md:left-0 md:block md:mt-1">
            <div className="absolute inset-0 md:hidden" onClick={()=>setIsOpen(false)}></div>
            <div className="relative w-full max-w-xs md:w-64 max-h-[70vh] md:max-h-80 flex flex-col bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className="shrink-0 p-2 border-b border-slate-100 dark:border-slate-800 flex gap-2">
                    {/* PERUBAHAN DI SINI: autoFocus dihapus */}
                    <div className="relative flex-1"><Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" /><input type="text" placeholder="Cari..." className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />{searchTerm && <button onClick={()=>setSearchTerm("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={12}/></button>}</div>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                    {!searchTerm && <div onClick={()=>toggle('All')} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-bold border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200"><div className={`w-3 h-3 rounded border flex items-center justify-center ${selected.includes('All')?'bg-blue-600 border-blue-600':'border-slate-300 dark:border-slate-600'}`}>{selected.includes('All')&&<Check size={8} className="text-white"/>}</div>Select All</div>}
                    {filtered.length ? filtered.map((o:any) => { const isSel = selected.includes(o.value) || selected.includes('All'); return (<div key={o.value||'empty'} onClick={()=>toggle(o.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs transition-colors"><div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSel?'bg-blue-600 border-blue-600':'border-slate-300 dark:border-slate-600'}`}>{isSel&&<Check size={8} className="text-white"/>}</div><span className={`${isSel?'font-semibold text-slate-800 dark:text-slate-100':'text-slate-600 dark:text-slate-400'} ${o.value===""?'italic text-red-500 dark:text-red-400':''}`}>{o.label}</span></div>) }) : <div className="px-3 py-4 text-center text-xs text-slate-400 italic">Nihil</div>}
                </div>
            </div>
         </div>
       )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalYear = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
      return (
        <div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg text-[10px] z-50 min-w-35">
          <div className="font-bold text-slate-700 dark:text-slate-200 mb-1.5 border-b border-slate-100 dark:border-slate-800 pb-1">{label}</div>
          <div className="flex flex-col gap-0.5 mb-2">{payload.slice().reverse().map((entry: any, index: number) => (entry.value > 0 && (<div key={index} className="flex items-center justify-between gap-3"><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div><span className="text-slate-500 dark:text-slate-400 text-[10px]">{entry.name}</span></div><span className="font-mono text-slate-700 dark:text-slate-300 font-medium text-[10px]">{entry.value.toLocaleString('id-ID')}</span></div>)))}</div>
           <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded"><span className="text-slate-500 dark:text-slate-400 font-bold text-[10px]">TOTAL</span><span className="font-mono font-bold text-slate-800 dark:text-white text-[10px]">{totalYear.toLocaleString('id-ID')}</span></div>
        </div>
      );
    }
    return null;
}

const ThemeToggle = () => {
    const { theme, setTheme } = useTheme(); const [isOpen, setIsOpen] = useState(false);
    const icons: any = { light: <Sun size={14}/>, dark: <Moon size={14}/>, system: <Laptop size={14}/> }
    return (
      <div className="relative">
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Ubah Tema">{icons[theme as string] || <Laptop size={14}/>}</button>
        {isOpen && (
            <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/50 md:bg-transparent md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:block">
                 <div className="absolute inset-0 md:hidden" onClick={() => setIsOpen(false)}></div>
                 <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1 w-48 md:w-32 animate-in fade-in zoom-in-95 duration-150">
                    {['light', 'dark', 'system'].map((m: any) => (<button key={m} onClick={() => { setTheme(m); setIsOpen(false); }} className={`flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${theme === m ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{icons[m]} <span className="capitalize">{m}</span></button>))}
                 </div>
            </div>
        )}
      </div>
    )
}

function usePivotLogic({ data, expandedCols, expandedRows, activeLevels }: any) {
  return useMemo(() => {
    const uniqueYears = Array.from(new Set(data.map((d:any) => String(d.year)))).sort() as string[]
    const finalColKeys: string[] = []
    uniqueYears.forEach(year => { if (expandedCols[year]) { const months = Array.from(new Set(data.filter((d:any)=>String(d.year)===year).map((d:any)=>d.month))).sort((a:any,b:any)=>a-b) as number[]; months.forEach(m => finalColKeys.push(`${year}-${m<10?'0'+m:m}`)); finalColKeys.push(`${year}-Total`) } else finalColKeys.push(year) })
    const colTotals: Record<string, number> = {}, rootMap: Record<string, PivotNode> = {}
    for (const item of data) {
      const yearStr = String(item.year), monthStr = item.month<10?`0${item.month}`:String(item.month), val = item.total_amount || 0; const keys = [yearStr, `${yearStr}-${monthStr}`, `${yearStr}-Total`]
      keys.forEach(k => colTotals[k] = (colTotals[k] || 0) + val); const levels: string[] = activeLevels.map((l:string, idx:number) => { const v = (item as any)[`col_label_${idx+1}`]; return (!v || String(v).trim()==='') ? `No ${l.replace('_',' ')}` : String(v) })
      if (!levels.length) continue; let map = rootMap, path = ""; levels.forEach((lvl, idx) => { path = path ? `${path}|${lvl}` : lvl; if (!map[lvl]) map[lvl] = { id: path, label: lvl, level: idx, isLeaf: idx===levels.length-1, values: {}, rowTotal: 0 }; const node = map[lvl]; keys.forEach(k => node.values[k] = (node.values[k] || 0) + val); node.rowTotal += val; if (!node.isLeaf) { if (!(node as any).childMap) (node as any).childMap = {}; map = (node as any).childMap } })
    }
    const process = (map: any): PivotNode[] => Object.values(map).sort((a:any,b:any) => a.label.localeCompare(b.label)).map((n:any) => { if (n.childMap) { n.children = process(n.childMap); delete n.childMap } return n })
    const visibleRows: PivotNode[] = []; const traverse = (nodes: PivotNode[]) => { nodes.forEach(n => { visibleRows.push(n); if(n.children && expandedRows[n.id]) traverse(n.children) }) }; traverse(process(rootMap))
    const getHeaderInfo = (key: string) => { if (key.includes('-Total')) return { type: 'subtotal', label: key.split('-')[0], parent: key.split('-')[0] }; if (key.includes('-')) { const [y,m] = key.split('-'); return { type: 'month', label: MONTH_OPTIONS.find(o=>o.value===String(parseInt(m)))?.label, parent: y } } return { type: 'year', label: key, parent: key } }
    return { pivotData: { colKeys: finalColKeys, colTotals }, visibleRows, getHeaderInfo }
  }, [data, expandedCols, expandedRows, activeLevels])
}

// --- MAIN PAGE ---
export default function PivotPage() {
  const router = useRouter(), supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!)
  const [data, setData] = useState<AggregatedRecord[]>([]), [chartData, setChartData] = useState<any[]>([]), [loading, setLoading] = useState(true), [isRefreshing, setIsRefreshing] = useState(false)
  const { theme } = useTheme(), [mounted, setMounted] = useState(false)
  const [lvl1, setLvl1] = useState('business_area'), [lvl2, setLvl2] = useState(''), [lvl3, setLvl3] = useState(''), [lvl4, setLvl4] = useState('')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({}), [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({})
  const [zoom, setZoom] = useState(1), [selYears, setSelYears] = useState(['All']), [selMonths, setSelMonths] = useState(['All'])
  const [selAreas, setSelAreas] = useState(['POWER AGCON']), [selBA, setSelBA] = useState(['All']), [selPSS, setSelPSS] = useState(['All']), [selKAT, setSelKAT] = useState(['All']), [selCG, setSelCG] = useState(['All']), [selProd, setSelProd] = useState(['All'])
  const [opts, setOpts] = useState({ year:[], months:[], areas:[], ba:[], pss:[], kat:[], products:[], cg:[] })

  useEffect(() => setMounted(true), []); const isDark = mounted && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const activeLevels = useMemo(() => [lvl1, lvl2, lvl3, lvl4].filter(l => l !== ''), [lvl1, lvl2, lvl3, lvl4])
  const { pivotData, visibleRows, getHeaderInfo } = usePivotLogic({ data, expandedCols, expandedRows, activeLevels })
  
  const trendData = useMemo(() => { const map:any = {}; chartData.forEach(i => { const k = i.year; if(!map[k]) map[k] = { name: k, total: 0 }; map[k].total += i.total_amount; map[k][i.month] = (map[k][i.month]||0) + i.total_amount }); return Object.values(map).sort((a:any,b:any)=>a.name-b.name) }, [chartData])

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true); const getP = (arr:string[]) => (arr.includes('All') || !arr.length) ? null : arr[0]; const rpcArgs = { p_year: getP(selYears), p_month: getP(selMonths), p_area: getP(selAreas), p_ba: getP(selBA), p_pss: getP(selPSS), p_kat: getP(selKAT), p_cust_group: getP(selCG), p_product: getP(selProd) }
      try {
        const [optRes, dataRes, chartRes] = await Promise.all([ supabase.rpc('get_dynamic_filter_options', rpcArgs), supabase.rpc('get_sales_analytics', { lvl1_field: lvl1, lvl2_field: lvl2, lvl3_field: lvl3, lvl4_field: lvl4, filter_years: selYears, filter_areas: selAreas, filter_months: selMonths.includes('All')?[]:selMonths.map(m=>parseInt(m)), filter_business_areas: selBA, filter_pss: selPSS, filter_key_account_types: selKAT, filter_cust_groups: selCG, filter_products: selProd }), supabase.rpc('get_sales_analytics', { lvl1_field: 'product', lvl2_field:'', lvl3_field:'', lvl4_field:'', filter_years: selYears, filter_areas: selAreas, filter_months: selMonths.includes('All')?[]:selMonths.map(m=>parseInt(m)), filter_business_areas: selBA, filter_pss: selPSS, filter_key_account_types: selKAT, filter_cust_groups: selCG, filter_products: selProd }) ])
        if (optRes.data) setOpts({ year: optRes.data.year, months: optRes.data.month, areas: optRes.data.area, ba: optRes.data.business_area, pss: optRes.data.pss, kat: optRes.data.key_account_type, products: optRes.data.product, cg: optRes.data.cust_group } as any)
        if (dataRes.data) setData(dataRes.data); if (chartRes.data) setChartData(chartRes.data)
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetchAll()
  }, [selYears, selMonths, selAreas, selBA, selPSS, selKAT, selCG, selProd, lvl1, lvl2, lvl3, lvl4]); useEffect(() => setExpandedRows({}), [lvl1, lvl2, lvl3, lvl4])

  const handleUpdate = async () => { if(!confirm("Update Data dari Master?")) return; setIsRefreshing(true); const { error } = await supabase.rpc('refresh_sales_data'); if (!error) { await supabase.auth.refreshSession(); alert('Sukses Update DB'); window.location.reload() } else alert('Gagal: '+error.message); setIsRefreshing(false) }
  const handleLogout = async () => { await supabase.auth.signOut(); router.refresh(); router.push('/login') }
  const fmt = (n: number) => n ? n.toLocaleString('id-ID') : '-'
  const yAxisFormatter = (value: number) => { if (value >= 1000000000) return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'M'; if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M'; return value.toString() }

return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-2 md:p-6 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-400 mx-auto space-y-4">
        
        {/* 1. TOP CONTROLS (Z-50) - Paling atas agar Dropdown tidak tertutup elemen bawahnya */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 z-50 relative transition-colors">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div><h1 className="text-xl font-bold flex items-center gap-2"><LayoutGrid className="text-blue-600 dark:text-blue-500" size={24}/> Sales Analytics</h1><p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-8">Dynamic Pivot & Filters</p></div>
            <div className="flex items-center gap-2"><ThemeToggle /><div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div><button onClick={() => window.location.reload()} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800"><RefreshCcw size={16} className={loading?"animate-spin":""}/></button><button onClick={handleUpdate} disabled={isRefreshing} className="px-3 py-1.5 bg-emerald-600 dark:bg-emerald-700 text-white text-xs font-bold rounded hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 flex gap-2 border border-emerald-600 dark:border-emerald-800"><Database size={14}/> {isRefreshing?'Updating...':'Update DB'}</button><div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div><button onClick={handleLogout} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-900/50 flex gap-2"><LogOut size={14}/> Logout</button></div>
          </div>
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
             <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2"><MultiSelect label="Tahun" options={opts.year} selected={selYears} onChange={setSelYears} /><MultiSelect label="Bulan" optionsRaw={MONTH_OPTIONS} selected={selMonths} onChange={setSelMonths} /><MultiSelect label="Area" options={opts.areas} selected={selAreas} onChange={setSelAreas} /><MultiSelect label="Business Area" options={opts.ba} selected={selBA} onChange={setSelBA} /></div>
             <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2"><MultiSelect label="Key Account" options={opts.kat} selected={selKAT} onChange={setSelKAT} /><MultiSelect label="Product" options={opts.products} selected={selProd} onChange={setSelProd} /><MultiSelect label="PSS" options={opts.pss} selected={selPSS} onChange={setSelPSS} /><MultiSelect label="Cust Group" options={opts.cg} selected={selCG} onChange={setSelCG} /></div>
          </div>
        </div>

        {/* 2. CHART (Z-30) - Posisi dikembalikan ke atas Hierarki */}
        {/* Menggunakan kondisi (loading || isRefreshing) untuk memicu Blur Overlay */}
        {(chartData.length > 0 || loading || isRefreshing) && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-20 flex flex-col transition-colors min-h-87.5">
                {(loading || isRefreshing) && (
                  <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl transition-all">
                    {isRefreshing ? (
                       <><RefreshCcw className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Updating Database...</span></>
                    ) : (
                       <><Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Memuat Data...</span></>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mb-2 border-b border-slate-50 dark:border-slate-800 pb-2"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400"/><span className="text-sm font-bold text-slate-700 dark:text-slate-200">SALES PERFORMANCE</span></div></div>
                <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} /><XAxis dataKey="name" tick={{fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} /><YAxis tickFormatter={yAxisFormatter} tick={{fontSize:10, fill: isDark ? '#94a3b8' : '#64748b'}} axisLine={false} tickLine={false} width={40} /><Tooltip cursor={{fill: isDark ? '#1e293b' : '#f8fafc'}} content={<CustomTooltip />} />{MONTH_OPTIONS.map((m, i) => <Bar key={m.value} dataKey={m.value} name={m.label} stackId="a" fill={MONTH_COLORS[i]} barSize={40} />)}</BarChart></ResponsiveContainer></div>
            </div>
        )}

        {/* 3. HIERARKI CONTROLS (Z-20) - Posisi di bawah Chart */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center gap-3 relative z-30 transition-colors">
           <div className="w-full flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase"><Maximize size={16}/><span>Zoom View</span></div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700"><button onClick={()=>setZoom(p=>Math.max(0.4, Number((p-0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex justify-center active:scale-90"><ZoomOut size={14}/></button><input type="range" min="0.4" max="1.5" step="0.1" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} className="w-24 md:w-32 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none accent-blue-600"/><button onClick={()=>setZoom(p=>Math.min(1.5, Number((p+0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex justify-center active:scale-90"><ZoomIn size={14}/></button><span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 w-8 text-right font-bold">{(zoom*100).toFixed(0)}%</span></div>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">{[lvl1, lvl2, lvl3, lvl4].map((v,i) => <ControlBox key={i} label={`Level ${i+1}`} value={v} onChange={i===0?setLvl1:i===1?setLvl2:i===2?setLvl3:setLvl4} options={DIMENSION_OPTIONS} />)}</div>
        </div>

        {/* 4. TABLE (Z-10) - Paling Bawah */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[65vh] md:h-[70vh] relative z-10 transition-colors">
          {(loading || isRefreshing) && (<div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all">{isRefreshing ? (<><RefreshCcw className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Updating Database...</span></>) : (<><Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Memuat Data Pivot...</span></>)}</div>)}
          <div className="overflow-auto flex-1 relative w-full"><div style={{fontSize: `${14*zoom}px`}} className="min-w-full inline-block align-top transition-all duration-200"><table className="w-full border-collapse leading-normal text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 z-20 shadow-sm"><tr>
              <th className="p-3 text-left font-bold border-b border-r border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 sticky left-0 z-30 min-w-[8em]">HIERARKI</th>
              {pivotData.colKeys.map(k => { const i = getHeaderInfo(k), show = i.type==='year'||i.type==='subtotal', bgClass = i.type==='year' ? 'bg-slate-100 dark:bg-slate-800' : i.type==='subtotal' ? 'bg-slate-200 dark:bg-slate-700 border-l dark:border-l-slate-600' : 'bg-white dark:bg-slate-900 font-normal text-slate-500 dark:text-slate-500'; return <th key={k} className={`p-2 text-center font-bold border-b border-slate-300 dark:border-slate-600 min-w-[6em] ${bgClass}`}><div className="flex items-center justify-center gap-1">{show && <button onClick={()=>setExpandedCols(p=>({...p,[i.parent]:!p[i.parent]}))} className="hover:text-blue-600 dark:hover:text-blue-400">{expandedCols[i.parent]?<MinusSquare size="1.2em" className="text-red-500 dark:text-red-400"/>:<PlusSquare size="1.2em" className="text-blue-600 dark:text-blue-400"/>}</button>}{i.label}</div></th> })}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleRows.length > 0 ? visibleRows.map(n => (<tr key={n.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
              <td className="p-2 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 sticky left-0 z-10 whitespace-nowrap"><div className="flex items-center gap-[0.5em]" style={{paddingLeft:`${n.level*1.5}em`}}>{!n.isLeaf ? <button onClick={()=>setExpandedRows(p=>({...p,[n.id]:!p[n.id]}))} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">{expandedRows[n.id]?<MinusSquare size="1.2em"/>:<PlusSquare size="1.2em"/>}</button> : <span style={{width:'1.2em'}}/>}<span className={`${n.isLeaf?"text-slate-600 dark:text-slate-400":"font-bold text-slate-800 dark:text-slate-200"} ${n.label.startsWith('No ') ? 'text-red-500 dark:text-red-400 italic' : ''}`}>{n.label}</span></div></td>
              {pivotData.colKeys.map(k => { const val = n.values[k] || 0, i = getHeaderInfo(k), isSub = i.type==='subtotal'; let prevK = i.type==='year'?(parseInt(i.parent)-1)+'' : i.type==='month'?`${parseInt(i.parent)-1}-${k.split('-')[1]}` : `${parseInt(i.parent)-1}-Total`; let prev = n.values[prevK] || 0; if (isSub && prev===0) prev = n.values[(parseInt(i.parent)-1)+''] || 0; const cellBg = isSub ? 'bg-slate-50 dark:bg-slate-800/50 font-bold border-l border-slate-200 dark:border-slate-700' : ''; return <td key={k} className={`p-2 text-right border-r border-slate-100 dark:border-slate-800 align-top ${cellBg}`}><div className="flex flex-col items-end gap-0.5"><span className={val?'text-slate-900 dark:text-slate-200':'text-slate-300 dark:text-slate-700 font-mono'}>{fmt(val)}</span>{prev>0&&<YoYBadge current={val} previous={prev}/>}</div></td> })}
            </tr>)) : <tr><td colSpan={20} className="p-12 text-center text-slate-400 dark:text-slate-500"><Filter size={24} className="mx-auto mb-2"/>Data tidak ditemukan.</td></tr>}</tbody>
            <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 sticky bottom-0 z-30 shadow-sm"><tr>
              <td className="p-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-t border-r border-slate-300 dark:border-slate-600">GRAND TOTAL</td>
              {pivotData.colKeys.map(k => { const i=getHeaderInfo(k), tot=pivotData.colTotals[k]||0; let prevK = i.type==='year'?(parseInt(i.parent)-1)+'' : i.type==='month'?`${parseInt(i.parent)-1}-${k.split('-')[1]}` : `${parseInt(i.parent)-1}-Total`; let prev = pivotData.colTotals[prevK] || 0; if (i.type==='subtotal' && prev===0) prev = pivotData.colTotals[(parseInt(i.parent)-1)+''] || 0; return <td key={k} className={`p-3 text-right border-t border-r border-slate-200 dark:border-slate-700 ${i.type==='subtotal'?'bg-slate-200 dark:bg-slate-700':''}`}><div className="flex flex-col items-end justify-between h-full gap-0.5 min-h-[2.5em]"><span className="font-mono">{fmt(tot)}</span>{prev>0 ? <YoYBadge current={tot} previous={prev}/> : <div className="h-[1em]"></div>}</div></td> })}
            </tr></tfoot>
          </table></div></div>
        </div>
      </div>
    </main>
  )
}