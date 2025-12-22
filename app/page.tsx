'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { 
  LayoutGrid, RefreshCcw, Filter, MinusSquare, PlusSquare, Database, 
  ArrowUp, ArrowDown, ChevronDown, Check, Layers, ZoomIn, ZoomOut, 
  Maximize, Search, X, BarChart3, LogOut
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'

// ============================================================================
// SECTION 2: TYPES
// ============================================================================
export interface AggregatedRecord {
  year: number; month: number;
  col_label_1: string; col_label_2: string; col_label_3: string; col_label_4: string; 
  total_amount: number;
}

export interface PivotNode {
  id: string; label: string; level: number; isLeaf: boolean;     
  values: Record<string, number>; rowTotal: number; children?: PivotNode[]; 
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================
export const DIMENSION_OPTIONS = [
  { label: '(None)', value: '' }, { label: 'Business Area', value: 'business_area' },
  { label: 'PSS', value: 'pss' }, { label: 'Key Account Type', value: 'key_account_type' },
  { label: 'Customer Group', value: 'cust_group' }, { label: 'Product', value: 'product' },
  { label: 'Area', value: 'area' }
]

export const MONTH_OPTIONS = [
    { label: 'Jan', value: '1' }, { label: 'Feb', value: '2' }, { label: 'Mar', value: '3' },
    { label: 'Apr', value: '4' }, { label: 'Mei', value: '5' }, { label: 'Jun', value: '6' },
    { label: 'Jul', value: '7' }, { label: 'Agu', value: '8' }, { label: 'Sep', value: '9' },
    { label: 'Okt', value: '10' }, { label: 'Nov', value: '11' }, { label: 'Des', value: '12' }
]

const MONTH_COLORS = ["#4338ca", "#4f46e5", "#5156cf", "#5a5ee0", "#6366f1", "#6d78e9", "#7782f0", "#818cf8", "#8795f3", "#919ff6", "#9baaf9", "#a5b4fc"]

// ============================================================================
// SECTION 4: SUB-COMPONENTS
// ============================================================================
function YoYBadge({ current, previous }: { current: number, previous: number }) {
    if (previous === 0) return null;
    const diff = current - previous, percent = (diff / previous) * 100
    const isUp = percent > 0, isNeutral = percent === 0
    if (current === 0) return <span className="text-[9px] text-slate-300">-</span>
    return (
        <div className={`flex items-center gap-[0.2em] text-[0.7em] font-bold px-[0.5em] rounded-full border shadow-sm ${isNeutral ? 'bg-slate-100 text-slate-500' : isUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {isUp ? <ArrowUp style={{width:'0.8em',height:'0.8em'}}/> : (!isNeutral && <ArrowDown style={{width:'0.8em',height:'0.8em'}}/>)}
            <span>{Math.abs(percent).toFixed(1)}%</span>
        </div>
    )
}

function ControlBox({ label, value, onChange, options, color }: any) {
    return (
        <div className={`bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 w-full hover:border-${color}-400 transition-colors`}>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-${color}-50 text-${color}-700 shrink-0`}>{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 w-full focus:outline-none cursor-pointer py-1 min-w-12.5 truncate">
                {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    )
}

function MultiSelect({ label, options, optionsRaw, selected, onChange }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const finalOptions = useMemo(() => {
    if (optionsRaw) return optionsRaw;
    return (options || []).map((o: any) => ({ 
        label: !o || String(o).trim() === '' ? `No ${label}` : String(o), 
        value: !o || String(o).trim() === '' ? "" : String(o) 
    }))
  }, [options, optionsRaw, label]);

  const filtered = finalOptions.filter((o:any) => o.label.toLowerCase().includes(searchTerm.toLowerCase()));
  
  useEffect(() => {
    const clickOut = (e: any) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) { setIsOpen(false); setSearchTerm(""); } }
    document.addEventListener("mousedown", clickOut); return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  const toggle = (val: string) => {
    if (val === 'All') onChange(selected.includes('All') ? [] : ['All']);
    else {
      let newSel = selected.includes('All') ? finalOptions.map((o:any)=>o.value) : [...selected];
      newSel = newSel.includes(val) ? newSel.filter((i:string)=>i!==val) : [...newSel, val];
      onChange((newSel.length === finalOptions.length && finalOptions.length > 0) ? ['All'] : newSel);
    }
  };
  
  const display = () => {
    if (selected.includes('All')) return 'All';
    if (!selected.length) return 'None';
    const names = selected.map((v:string) => finalOptions.find((o:any)=>o.value===v)?.label).filter(Boolean);
    return names.length > 2 ? `${names[0]}, ${names[1]} +${names.length-2}` : names.join(', ');
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
       <div className="flex flex-col">
         <label className="text-[10px] font-bold text-slate-400 ml-1 mb-0.5 uppercase">{label}</label>
         <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between gap-2 w-full md:w-auto md:min-w-32 px-3 py-1.5 text-xs bg-white border rounded-md shadow-sm ${isOpen ? 'border-blue-500 ring-1' : 'border-slate-200'}`}>
            <span className="truncate font-medium text-slate-700 max-w-25 text-left">{display()}</span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
         </button>
       </div>
       {isOpen && (
         <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white border rounded-lg shadow-xl z-50 p-1 flex flex-col">
            {/* PERBAIKAN DI SINI: Menghapus 'relative' agar tidak bentrok dengan 'sticky' */}
            <div className="sticky top-0 bg-white z-20 pb-1 border-b border-slate-100 p-2">
                <Search size={12} className="absolute left-4 top-4 text-slate-400" />
                <input type="text" placeholder="Cari..." className="w-full pl-7 pr-6 py-1.5 text-xs border rounded bg-slate-50" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} autoFocus />
                {searchTerm && <button onClick={()=>setSearchTerm("")} className="absolute right-3 top-3.5 text-slate-400"><X size={12}/></button>}
            </div>
            <div className="overflow-y-auto max-h-60 pt-1">
                {!searchTerm && <div onClick={()=>toggle('All')} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded text-xs font-bold border-b border-slate-100"><div className={`w-3 h-3 rounded border flex items-center justify-center ${selected.includes('All')?'bg-blue-600 border-blue-600':'border-slate-300'}`}>{selected.includes('All')&&<Check size={8} className="text-white"/>}</div>Select All</div>}
                {filtered.length ? filtered.map((o:any) => {
                    const isSel = selected.includes(o.value) || selected.includes('All');
                    return (
                        <div key={o.value||'empty'} onClick={()=>toggle(o.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded text-xs">
                            <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSel?'bg-blue-600 border-blue-600':'border-slate-300'}`}>{isSel&&<Check size={8} className="text-white"/>}</div>
                            <span className={`${isSel?'font-semibold text-slate-800':'text-slate-600'} ${o.value===""?'italic text-red-500':''}`}>{o.label}</span>
                        </div>
                    )
                }) : <div className="px-3 py-4 text-center text-xs text-slate-400 italic">Nihil</div>}
            </div>
         </div>
       )}
    </div>
  )
}

// ============================================================================
// SECTION 5: LOGIC HOOKS
// ============================================================================
function usePivotLogic({ data, expandedCols, expandedRows, activeLevels }: any) {
  return useMemo(() => {
    const uniqueYears = Array.from(new Set(data.map((d:any) => String(d.year)))).sort() as string[]
    const finalColKeys: string[] = []
    
    uniqueYears.forEach(year => {
        if (expandedCols[year]) {
            const months = Array.from(new Set(data.filter((d:any)=>String(d.year)===year).map((d:any)=>d.month))).sort((a:any,b:any)=>a-b) as number[]
            months.forEach(m => finalColKeys.push(`${year}-${m<10?'0'+m:m}`))
            finalColKeys.push(`${year}-Total`)
        } else finalColKeys.push(year)
    })

    const colTotals: Record<string, number> = {}, rootMap: Record<string, PivotNode> = {}
    
    for (const item of data) {
      const yearStr = String(item.year), monthStr = item.month<10?`0${item.month}`:String(item.month), val = item.total_amount || 0
      const keys = [yearStr, `${yearStr}-${monthStr}`, `${yearStr}-Total`]
      keys.forEach(k => colTotals[k] = (colTotals[k] || 0) + val)
      
      const levels: string[] = activeLevels.map((l:string, idx:number) => {
          const v = (item as any)[`col_label_${idx+1}`];
          return (!v || String(v).trim()==='') ? `No ${l.replace('_',' ')}` : String(v)
      })
      if (!levels.length) continue

      let map = rootMap, path = ""
      levels.forEach((lvl, idx) => {
        path = path ? `${path}|${lvl}` : lvl
        if (!map[lvl]) map[lvl] = { id: path, label: lvl, level: idx, isLeaf: idx===levels.length-1, values: {}, rowTotal: 0 }
        const node = map[lvl]
        keys.forEach(k => node.values[k] = (node.values[k] || 0) + val)
        node.rowTotal += val
        if (!node.isLeaf) { if (!(node as any).childMap) (node as any).childMap = {}; map = (node as any).childMap }
      })
    }

    const process = (map: any): PivotNode[] => Object.values(map).sort((a:any,b:any) => a.label.localeCompare(b.label)).map((n:any) => {
        if (n.childMap) { n.children = process(n.childMap); delete n.childMap }
        return n
    })

    const visibleRows: PivotNode[] = [];
    const traverse = (nodes: PivotNode[]) => { nodes.forEach(n => { visibleRows.push(n); if(n.children && expandedRows[n.id]) traverse(n.children) }) }
    traverse(process(rootMap))

    const getHeaderInfo = (key: string) => {
      if (key.includes('-Total')) return { type: 'subtotal', label: key.split('-')[0], parent: key.split('-')[0] } 
      if (key.includes('-')) { const [y,m] = key.split('-'); return { type: 'month', label: MONTH_OPTIONS.find(o=>o.value===String(parseInt(m)))?.label, parent: y } }
      return { type: 'year', label: key, parent: key }
    }

    return { pivotData: { colKeys: finalColKeys, colTotals }, visibleRows, getHeaderInfo }
  }, [data, expandedCols, activeLevels])
}

// ============================================================================
// SECTION 6: MAIN COMPONENT & STATE
// ============================================================================
export default function PivotPage() {
  const router = useRouter()
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!)

  const [data, setData] = useState<AggregatedRecord[]>([])           
  const [chartData, setChartData] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true), [isRefreshing, setIsRefreshing] = useState(false)
  
  // Filter States
  const [lvl1, setLvl1] = useState('business_area'), [lvl2, setLvl2] = useState(''), [lvl3, setLvl3] = useState(''), [lvl4, setLvl4] = useState('')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({}), [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({})
  const [zoom, setZoom] = useState(1)

  const [selYears, setSelYears] = useState(['All']), [selMonths, setSelMonths] = useState(['All'])
  const [selAreas, setSelAreas] = useState(['POWER AGCON']), [selBA, setSelBA] = useState(['All'])
  const [selPSS, setSelPSS] = useState(['All']), [selKAT, setSelKAT] = useState(['All'])
  const [selCG, setSelCG] = useState(['All']), [selProd, setSelProd] = useState(['All'])
  
  const [opts, setOpts] = useState({ year:[], months:[], areas:[], ba:[], pss:[], kat:[], products:[], cg:[] })

  const activeLevels = useMemo(() => [lvl1, lvl2, lvl3, lvl4].filter(l => l !== ''), [lvl1, lvl2, lvl3, lvl4])
  const { pivotData, visibleRows, getHeaderInfo } = usePivotLogic({ data, expandedCols, expandedRows, activeLevels })
  
  const trendData = useMemo(() => {
     const map:any = {}; chartData.forEach(i => {
         const k = i.year; if(!map[k]) map[k] = { name: k, total: 0 };
         map[k].total += i.total_amount; map[k][i.month] = (map[k][i.month]||0) + i.total_amount
     }); return Object.values(map).sort((a:any,b:any)=>a.name-b.name)
  }, [chartData])

// ============================================================================
// SECTION 7: DATA FETCHING
// ============================================================================
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const getP = (arr:string[]) => (arr.includes('All') || !arr.length) ? null : arr[0]
      const rpcArgs = { p_year: getP(selYears), p_month: getP(selMonths), p_area: getP(selAreas), p_ba: getP(selBA), p_pss: getP(selPSS), p_kat: getP(selKAT), p_cust_group: getP(selCG), p_product: getP(selProd) }
      
      try {
        const [optRes, dataRes, chartRes] = await Promise.all([
           supabase.rpc('get_dynamic_filter_options', rpcArgs),
           supabase.rpc('get_sales_analytics', { lvl1_field: lvl1, lvl2_field: lvl2, lvl3_field: lvl3, lvl4_field: lvl4, filter_years: selYears, filter_areas: selAreas, filter_months: selMonths.includes('All')?[]:selMonths.map(m=>parseInt(m)), filter_business_areas: selBA, filter_pss: selPSS, filter_key_account_types: selKAT, filter_cust_groups: selCG, filter_products: selProd }),
           supabase.rpc('get_sales_analytics', { lvl1_field: 'product', lvl2_field:'', lvl3_field:'', lvl4_field:'', filter_years: selYears, filter_areas: selAreas, filter_months: selMonths.includes('All')?[]:selMonths.map(m=>parseInt(m)), filter_business_areas: selBA, filter_pss: selPSS, filter_key_account_types: selKAT, filter_cust_groups: selCG, filter_products: selProd })
        ])
        if (optRes.data) setOpts({ year: optRes.data.year, months: optRes.data.month, areas: optRes.data.area, ba: optRes.data.business_area, pss: optRes.data.pss, kat: optRes.data.key_account_type, products: optRes.data.product, cg: optRes.data.cust_group } as any)
        if (dataRes.data) setData(dataRes.data)
        if (chartRes.data) setChartData(chartRes.data)
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetchAll()
  }, [selYears, selMonths, selAreas, selBA, selPSS, selKAT, selCG, selProd, lvl1, lvl2, lvl3, lvl4])

  useEffect(() => setExpandedRows({}), [lvl1, lvl2, lvl3, lvl4])

// ============================================================================
// SECTION 8: EVENT HANDLERS
// ============================================================================
  const handleUpdate = async () => {
    if(!confirm("Update Data dari Master?")) return;
    setIsRefreshing(true)
    const { error } = await supabase.rpc('refresh_sales_data')
    if (!error) { await supabase.auth.refreshSession(); alert('Sukses Update DB'); window.location.reload(); }
    else alert('Gagal: '+error.message)
    setIsRefreshing(false)
  }

  const handleLogout = async () => { 
      await supabase.auth.signOut()
      router.refresh()
      router.push('/login') 
  }
  
  const fmt = (n: number) => n ? n.toLocaleString('id-ID') : '-'

// ============================================================================
// SECTION 9: JSX RENDER
// ============================================================================
  return (
    <main className="min-h-screen bg-slate-50 p-2 md:p-6 font-sans text-slate-800">
      <div className="max-w-400 mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 z-50 relative">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2"><LayoutGrid className="text-blue-600" size={24}/> Sales Analytics</h1>
                <p className="text-xs text-slate-400 mt-1 ml-8">Dynamic Pivot & Filters</p>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => window.location.reload()} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-100"><RefreshCcw size={16} className={loading?"animate-spin":""}/></button>
                <button onClick={handleUpdate} disabled={isRefreshing} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 flex gap-2"><Database size={14}/> {isRefreshing?'Updating...':'Update DB'}</button>
                <div className="h-6 w-px bg-slate-300 mx-1"></div>
                <button onClick={handleLogout} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded hover:bg-red-100 border border-red-100 flex gap-2"><LogOut size={14}/> Logout</button>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
             <div className="flex flex-wrap gap-2">
                <MultiSelect label="Tahun" options={opts.year} selected={selYears} onChange={setSelYears} />
                <MultiSelect label="Bulan" optionsRaw={MONTH_OPTIONS} selected={selMonths} onChange={setSelMonths} />
                <MultiSelect label="Area" options={opts.areas} selected={selAreas} onChange={setSelAreas} />
                <MultiSelect label="Business Area" options={opts.ba} selected={selBA} onChange={setSelBA} />
             </div>
             <div className="flex flex-wrap gap-2">
                <MultiSelect label="Key Account" options={opts.kat} selected={selKAT} onChange={setSelKAT} />
                <MultiSelect label="Product" options={opts.products} selected={selProd} onChange={setSelProd} />
                <MultiSelect label="PSS" options={opts.pss} selected={selPSS} onChange={setSelPSS} />
                <MultiSelect label="Cust Group" options={opts.cg} selected={selCG} onChange={setSelCG} />
             </div>
          </div>
        </div>

        {/* CHART */}
        {chartData.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-80 relative z-45 flex flex-col">
                <div className="flex items-center gap-2 mb-2 border-b border-slate-50 pb-2"><BarChart3 size={18} className="text-indigo-600"/><span className="text-sm font-bold text-slate-700">SALES PERFORMANCE</span></div>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 11, fill:'#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v=>v>=1e9?(v/1e9).toFixed(1)+'M':(v/1e6).toFixed(0)} tick={{fontSize:10, fill:'#64748b'}} axisLine={false} tickLine={false} width={60} />
                        <Tooltip cursor={{fill:'#f8fafc'}} content={({active, payload, label}) => active && payload && payload.length ? (
                             <div className="bg-white p-2 border shadow-lg rounded text-xs z-50">
                                <div className="font-bold mb-1 border-b pb-1">{label}</div>
                                {payload.slice().reverse().map((e:any) => e.value>0 && <div key={e.name} className="flex justify-between gap-3 text-[10px]"><span>{e.name}</span><span className="font-mono">{e.value.toLocaleString('id-ID')}</span></div>)}
                             </div>
                        ) : null} />
                        {MONTH_OPTIONS.map((m, i) => <Bar key={m.value} dataKey={m.value} name={m.label} stackId="a" fill={MONTH_COLORS[i]} barSize={40} />)}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )}

        {/* CONTROLS (COMPACT ZOOM) */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center gap-3 relative z-40">
           <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase"><Maximize size={16}/><span>Zoom View</span></div>
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                  <button onClick={()=>setZoom(p=>Math.max(0.4, Number((p-0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 flex justify-center active:scale-90"><ZoomOut size={14}/></button>
                  <input type="range" min="0.4" max="1.5" step="0.1" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} className="w-24 md:w-32 h-1 bg-slate-300 rounded-lg appearance-none accent-blue-600"/>
                  <button onClick={()=>setZoom(p=>Math.min(1.5, Number((p+0.1).toFixed(1))))} className="text-slate-400 hover:text-blue-600 flex justify-center active:scale-90"><ZoomIn size={14}/></button>
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right font-bold">{(zoom*100).toFixed(0)}%</span>
              </div>
           </div>
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
             {[lvl1, lvl2, lvl3, lvl4].map((v,i) => <ControlBox key={i} label={`Lvl ${i+1}`} value={v} onChange={i===0?setLvl1:i===1?setLvl2:i===2?setLvl3:setLvl4} options={DIMENSION_OPTIONS} color="indigo" />)}
           </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col h-[65vh] md:h-[70vh] relative z-0">
          {(loading || isRefreshing) && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70"><RefreshCcw className="animate-spin text-blue-600" size={24}/></div>}
          <div className="overflow-auto flex-1 relative w-full">
            <div style={{fontSize: `${14*zoom}px`}} className="min-w-full inline-block align-top transition-all duration-200"> 
            <table className="w-full border-collapse leading-normal">
              <thead className="bg-slate-50 text-slate-700 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-3 text-left font-bold border-b border-r border-slate-300 bg-slate-100 sticky left-0 z-30 min-w-[8em]">HIERARKI</th>
                  {pivotData.colKeys.map(k => {
                    const i = getHeaderInfo(k), show = i.type==='year'||i.type==='subtotal'
                    return <th key={k} className={`p-2 text-center font-bold border-b border-slate-300 min-w-[6em] ${i.type==='year'?'bg-slate-100':i.type==='subtotal'?'bg-slate-200 border-l': 'bg-white font-normal text-slate-500'}`}>
                        <div className="flex items-center justify-center gap-1">
                           {show && <button onClick={()=>setExpandedCols(p=>({...p,[i.parent]:!p[i.parent]}))} className="hover:text-blue-600">{expandedCols[i.parent]?<MinusSquare size="1.2em" className="text-red-500"/>:<PlusSquare size="1.2em" className="text-blue-600"/>}</button>}
                           {i.label}
                        </div>
                    </th>
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {visibleRows.length > 0 ? visibleRows.map(n => (
                    <tr key={n.id} className="hover:bg-blue-50 transition-colors">
                      <td className="p-2 font-medium text-slate-800 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 whitespace-nowrap">
                        <div className="flex items-center gap-[0.5em]" style={{paddingLeft:`${n.level*1.5}em`}}>
                            {!n.isLeaf ? <button onClick={()=>setExpandedRows(p=>({...p,[n.id]:!p[n.id]}))} className="text-slate-400 hover:text-blue-600">{expandedRows[n.id]?<MinusSquare size="1.2em"/>:<PlusSquare size="1.2em"/>}</button> : <span style={{width:'1.2em'}}/>}
                            <span className={`${n.isLeaf?"text-slate-600":"font-bold text-slate-800"} ${n.label.startsWith('No ') ? 'text-red-500 italic' : ''}`}>{n.label}</span>
                        </div>
                      </td>
                      {pivotData.colKeys.map(k => {
                         const val = n.values[k] || 0, i = getHeaderInfo(k), isSub = i.type==='subtotal'
                         let prevK = i.type==='year'?(parseInt(i.parent)-1)+'' : i.type==='month'?`${parseInt(i.parent)-1}-${k.split('-')[1]}` : `${parseInt(i.parent)-1}-Total`
                         let prev = n.values[prevK] || 0; if (isSub && prev===0) prev = n.values[(parseInt(i.parent)-1)+''] || 0
                         return <td key={k} className={`p-2 text-right border-r border-slate-100 align-top ${isSub?'bg-slate-50 font-bold border-l border-slate-200':''}`}>
                            <div className="flex flex-col items-end gap-0.5"><span className={val?'text-slate-900':'text-slate-300 font-mono'}>{fmt(val)}</span>{prev>0&&<YoYBadge current={val} previous={prev}/>}</div>
                         </td>
                      })}
                    </tr>
                )) : <tr><td colSpan={20} className="p-12 text-center text-slate-400"><Filter size={24} className="mx-auto mb-2"/>Data tidak ditemukan.</td></tr>}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-800 sticky bottom-0 z-30 shadow-sm">
                <tr>
                    <td className="p-3 sticky left-0 z-30 bg-slate-100 border-t border-r border-slate-300">GRAND TOTAL</td>
                    {pivotData.colKeys.map(k => {
                        const i=getHeaderInfo(k), tot=pivotData.colTotals[k]||0; let prevK = i.type==='year'?(parseInt(i.parent)-1)+'' : i.type==='month'?`${parseInt(i.parent)-1}-${k.split('-')[1]}` : `${parseInt(i.parent)-1}-Total`
                        let prev = pivotData.colTotals[prevK] || 0; if (i.type==='subtotal' && prev===0) prev = pivotData.colTotals[(parseInt(i.parent)-1)+''] || 0
                        return <td key={k} className={`p-3 text-right border-t border-r border-slate-200 ${i.type==='subtotal'?'bg-slate-200':''}`}><div className="flex flex-col items-end gap-0.5"><span className="font-mono">{fmt(tot)}</span>{prev>0&&<YoYBadge current={tot} previous={prev}/>}</div></td>
                    })}
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}