'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { 
  LayoutGrid, 
  RefreshCcw, 
  Filter, 
  MinusSquare, 
  PlusSquare, 
  Database, 
  ArrowUp, 
  ArrowDown, 
  ChevronDown, 
  Check,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

// ==========================================
// 1. TYPES
// ==========================================

export interface AggregatedRecord {
  year: number;
  month: number;
  col_label_1: string;
  col_label_2: string;
  col_label_3: string;
  col_label_4: string; 
  total_amount: number;
}

export interface PivotNode {
  id: string;          
  label: string;       
  level: number;       
  isLeaf: boolean;     
  values: Record<string, number>; 
  rowTotal: number;    
  children?: PivotNode[]; 
}

// ==========================================
// 2. CONSTANTS
// ==========================================

export const DIMENSION_OPTIONS = [
  { label: '(None)', value: '' }, 
  { label: 'Business Area', value: 'business_area' },
  { label: 'PSS', value: 'pss' },
  { label: 'Key Account Type', value: 'key_account_type' },
  { label: 'Customer Group', value: 'cust_group' },
  { label: 'Product', value: 'product' },
  { label: 'Area', value: 'area' }
]

export const MONTH_OPTIONS = [
    { label: 'Jan', value: '1' }, { label: 'Feb', value: '2' }, { label: 'Mar', value: '3' },
    { label: 'Apr', value: '4' }, { label: 'Mei', value: '5' }, { label: 'Jun', value: '6' },
    { label: 'Jul', value: '7' }, { label: 'Agu', value: '8' }, { label: 'Sep', value: '9' },
    { label: 'Okt', value: '10' }, { label: 'Nov', value: '11' }, { label: 'Des', value: '12' }
]

// ==========================================
// 3. UI COMPONENTS
// ==========================================

// --- YoYBadge Component ---
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

// --- ControlBox Component ---
export function ControlBox({ label, value, onChange, options, color }: any) {
    return (
        <div className={`bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 w-full hover:border-${color}-400 transition-colors`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-${color}-50 text-${color}-700 whitespace-nowrap shrink-0`}>{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 w-full focus:outline-none cursor-pointer py-1 min-w-12.5 truncate">
                {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    )
}

// --- MultiSelect Component ---
interface MultiSelectProps {
    label: string;
    options?: string[];
    optionsRaw?: { label: string, value: string }[];
    selected: string[];
    onChange: (val: string[]) => void;
}

export function MultiSelect({ label, options, optionsRaw, selected, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const finalOptions = optionsRaw || (options ? options.map(o => ({ label: o, value: o })) : [])
  
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  
  const isAllSelected = selected.includes('All') || (finalOptions.length > 0 && selected.length === finalOptions.length)
  
  const toggleOption = (val: string) => {
    if (val === 'All') onChange(isAllSelected ? [] : ['All'])
    else {
      let newSelected = [...selected]
      if (newSelected.includes('All')) newSelected = finalOptions.map(o => o.value)
      
      if (newSelected.includes(val)) newSelected = newSelected.filter(item => item !== val)
      else newSelected.push(val)
      
      if (newSelected.length === finalOptions.length) onChange(['All'])
      else onChange(newSelected)
    }
  }

  const getDisplayLabel = () => {
      if (selected.includes('All')) return 'All'
      if (selected.length === 0) return 'None'
      
      const isNumeric = finalOptions.every(opt => !isNaN(parseInt(opt.value)))

      if (isNumeric) {
          const sortedIndices = selected.map(val => parseInt(val)).sort((a, b) => a - b)
          const ranges: string[] = []
          let start = sortedIndices[0], prev = sortedIndices[0]
          for (let i = 1; i < sortedIndices.length; i++) {
              const current = sortedIndices[i]
              if (current === prev + 1) prev = current
              else {
                  const startLabel = finalOptions.find(o => parseInt(o.value) === start)?.label
                  const endLabel = finalOptions.find(o => parseInt(o.value) === prev)?.label
                  ranges.push(start === prev ? `${startLabel}` : `${startLabel}-${endLabel}`)
                  start = current; prev = current
              }
          }
          const startLabel = finalOptions.find(o => parseInt(o.value) === start)?.label
          const endLabel = finalOptions.find(o => parseInt(o.value) === prev)?.label
          ranges.push(start === prev ? `${startLabel}` : `${startLabel}-${endLabel}`)
          return ranges.join(', ')
      } 
      
      const names = selected.map(val => finalOptions.find(o => o.value === val)?.label).filter(Boolean)
      if (names.length > 2) return `${names[0]}, ${names[1]} +${names.length - 2}`
      return names.join(', ')
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
       <div className="flex flex-col">
         <label className="text-[10px] font-bold text-slate-400 ml-1 mb-0.5 uppercase tracking-wider">{label}</label>
         <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between gap-2 w-full md:w-auto md:min-w-32 px-3 py-1.5 text-xs bg-white border rounded-md shadow-sm transition-all ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
            <span className="truncate font-medium text-slate-700 block max-w-25 md:max-w-35">{getDisplayLabel()}</span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
         </button>
       </div>
       
       {isOpen && (
         <div className="absolute top-full left-0 mt-1 w-56 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1">
            <div onClick={() => toggleOption('All')} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded text-xs font-bold border-b border-slate-100 mb-1 sticky top-0 bg-white z-10">
              <div className={`w-3 h-3 rounded border flex items-center justify-center ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                 {isAllSelected && <Check size={8} className="text-white" />}
              </div>
              Select All
            </div>
            {finalOptions.map(opt => {
               const isSelected = selected.includes(opt.value) || selected.includes('All')
               return (
                  <div key={opt.value} onClick={() => toggleOption(opt.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded text-xs">
                    <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                      {isSelected && <Check size={8} className="text-white" />}
                    </div>
                    {opt.label}
                  </div>
               )
            })}
         </div>
       )}
    </div>
  )
}

// ==========================================
// 4. CUSTOM HOOK
// ==========================================

interface UsePivotLogicProps {
  data: AggregatedRecord[];
  expandedCols: Record<string, boolean>;
  expandedRows: Record<string, boolean>;
}

export function usePivotLogic({ data, expandedCols, expandedRows }: UsePivotLogicProps) {
  
  // 1. MEMOIZED PIVOT CALCULATION
  const pivotData = useMemo(() => {
    const uniqueYearsSet = new Set<string>()
    data.forEach(d => uniqueYearsSet.add(String(d.year)))
    const sortedYears = Array.from(uniqueYearsSet).sort()

    // A. Columns Logic
    const finalColKeys: string[] = []
    sortedYears.forEach(year => {
        if (expandedCols[year]) {
            const monthsInYear = new Set<number>()
            data.filter(d => String(d.year) === year).forEach(d => monthsInYear.add(d.month))
            const sortedMonths = Array.from(monthsInYear).sort((a,b) => a - b)
            sortedMonths.forEach(m => finalColKeys.push(`${year}-${m < 10 ? '0'+m : m}`))
            finalColKeys.push(`${year}-Total`)
        } else {
            finalColKeys.push(year)
        }
    })

    // B. Tree Logic
    const colTotals: Record<string, number> = {}
    let grandTotal = 0
    const rootMap: Record<string, PivotNode> = {}

    for (const item of data) {
      const yearStr = String(item.year)
      const monthStr = item.month < 10 ? `0${item.month}` : String(item.month)
      const val = item.total_amount || 0
      
      const keysToUpdate = [yearStr, `${yearStr}-${monthStr}`, `${yearStr}-Total`]

      grandTotal += val
      
      for (const k of keysToUpdate) colTotals[k] = (colTotals[k] || 0) + val

      let levels = [
        item.col_label_1, 
        item.col_label_2, 
        item.col_label_3, 
        item.col_label_4 
      ]
      
      levels = levels.filter(l => l && l !== '-' && l !== 'Others' && l !== '(None)')
      if (levels.length === 0) levels = ['Uncategorized']

      let currentMap = rootMap
      let currentIdPath = ""

      levels.forEach((lvlLabel, idx) => {
        const isLastLevel = idx === levels.length - 1
        currentIdPath = currentIdPath ? `${currentIdPath}|${lvlLabel}` : lvlLabel
        
        if (!currentMap[lvlLabel]) {
            currentMap[lvlLabel] = {
                id: currentIdPath,
                label: lvlLabel,
                level: idx,
                isLeaf: isLastLevel,
                values: {}, 
                rowTotal: 0,
            }
        }
        
        const node = currentMap[lvlLabel]
        for (const k of keysToUpdate) node.values[k] = (node.values[k] || 0) + val
        node.rowTotal += val

        if (!isLastLevel) {
            if (!(node as any).childrenMap) { (node as any).childrenMap = {} }
            currentMap = (node as any).childrenMap
        }
      })
    }

    const processChildren = (map: Record<string, PivotNode>): PivotNode[] => {
        return Object.values(map)
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(node => {
                if ((node as any).childrenMap) {
                    node.children = processChildren((node as any).childrenMap)
                    delete (node as any).childrenMap
                }
                return node
            })
    }

    return { 
        roots: processChildren(rootMap), 
        colKeys: finalColKeys, 
        colTotals, 
        grandTotal
    }
  }, [data, expandedCols])

  // 2. FLATTEN VISIBLE ROWS
  const visibleRows = useMemo(() => {
    const rows: PivotNode[] = []
    const traverse = (nodes: PivotNode[]) => {
        nodes.forEach(node => {
            rows.push(node)
            if (node.children && expandedRows[node.id]) {
                traverse(node.children)
            }
        })
    }
    traverse(pivotData.roots)
    return rows
  }, [pivotData.roots, expandedRows])

  // 3. HELPER HEADER
  const getHeaderInfo = (colKey: string) => {
      if (colKey.includes('-Total')) return { type: 'subtotal', label: 'TOTAL', parent: colKey.split('-')[0] }
      if (colKey.includes('-')) {
          const [y, m] = colKey.split('-')
          const monthLabel = MONTH_OPTIONS.find(o => o.value === String(parseInt(m)))?.label || m
          return { type: 'month', label: monthLabel, parent: y }
      }
      return { type: 'year', label: colKey, parent: colKey }
  }

  return { pivotData, visibleRows, getHeaderInfo }
}

// ==========================================
// 5. MAIN PAGE COMPONENT
// ==========================================

export default function PivotPage() {
  // --- STATE ---
  const [data, setData] = useState<AggregatedRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // FILTER STATE
  const [lvl1, setLvl1] = useState<string>('business_area')
  const [lvl2, setLvl2] = useState<string>('pss')
  const [lvl3, setLvl3] = useState<string>('product') 
  const [lvl4, setLvl4] = useState<string>('') 

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({})

  const [selectedAreas, setSelectedAreas] = useState<string[]>(['All'])
  const [selectedYears, setSelectedYears] = useState<string[]>(['All'])
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['All']) 

  const [optionAreas, setOptionAreas] = useState<string[]>([])
  const [optionYears, setOptionYears] = useState<string[]>([])

  // [BARU] ZOOM STATE
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  // --- CUSTOM HOOK LOGIC ---
  const { pivotData, visibleRows, getHeaderInfo } = usePivotLogic({
    data, expandedCols, expandedRows
  })

  // --- EFFECTS ---
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const { data, error } = await supabase.rpc('get_unique_filters')
        if (error) throw error
        if (data) {
          if (data.areas) setOptionAreas(data.areas.filter((i: any) => i))
          if (data.years) setOptionYears(data.years.map((y: any) => String(y)))
        }
      } catch (err: any) {
        console.error('Filter Error:', err.message)
      }
    }
    fetchFilters()
  }, [])

  useEffect(() => {
    fetchAggregatedData()
  }, [lvl1, lvl2, lvl3, lvl4, selectedYears, selectedAreas, selectedMonths]) 

  useEffect(() => {
    setExpandedRows({})
  }, [lvl1, lvl2, lvl3, lvl4])

  const fetchAggregatedData = async () => {
    setLoading(true)
    try {
      let monthInts: number[] = []
      if (!selectedMonths.includes('All')) {
        monthInts = selectedMonths.map(m => parseInt(m))
      }

      const { data: rpcData, error } = await supabase.rpc('get_sales_analytics', {
        lvl1_field: lvl1,
        lvl2_field: lvl2,
        lvl3_field: lvl3,
        lvl4_field: lvl4, 
        filter_years: selectedYears,
        filter_areas: selectedAreas,
        filter_months: monthInts 
      })

      if (error) throw error
      if (rpcData) setData(rpcData as AggregatedRecord[])
      
    } catch (err: any) {
      console.error('Data Error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshDatabase = async () => {
    if(!confirm("Update Data dari Master?")) return;
    setIsRefreshing(true)
    try {
      const { error } = await supabase.rpc('refresh_sales_data')
      if (error) throw error
      await fetchAggregatedData()
      alert('Data berhasil diperbarui!')
    } catch (err: any) {
      console.error('Refresh DB Error:', err.message)
      alert('Gagal memperbarui data.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleCol = (year: string) => setExpandedCols(prev => ({ ...prev, [year]: !prev[year] }))
  const fmt = (n: number) => n ? n.toLocaleString('id-ID') : '-'

  return (
    <main className="min-h-screen bg-slate-50 p-2 md:p-6 font-sans text-slate-800">
      <div className="max-w-400 mx-auto space-y-4">
        
        {/* HEADER SECTION - RESPONSIVE */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 z-50 relative">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <LayoutGrid className="text-blue-600" size={24} /> 
                Sales Analytics
            </h1>
            <p className="text-xs text-slate-400 mt-1 ml-8">4-Level Dynamic Pivot</p>
          </div>

          <div className="w-full lg:w-auto flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
             <div className="flex gap-2 w-full sm:w-auto">
                <MultiSelect label="Area" options={optionAreas} selected={selectedAreas} onChange={setSelectedAreas} />
                <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1"></div>
                <MultiSelect label="Tahun" options={optionYears} selected={selectedYears} onChange={setSelectedYears} />
             </div>
             <div className="flex gap-2 w-full sm:w-auto">
                <MultiSelect label="Bulan" optionsRaw={MONTH_OPTIONS} selected={selectedMonths} onChange={setSelectedMonths} />

                <button onClick={fetchAggregatedData} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-100 shadow-sm transition-colors grow sm:grow-0 flex justify-center" title="Refresh Tampilan">
                    <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                </button>

                <button 
                    onClick={handleRefreshDatabase} 
                    disabled={isRefreshing || loading}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all grow sm:grow-0"
                >
                    <Database size={14} className={isRefreshing ? "animate-pulse" : ""} />
                    {isRefreshing ? 'Sync' : 'Update'}
                </button>
             </div>
          </div>
        </div>

        {/* CONTROLS SECTION */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center gap-3 relative z-40">
           
           {/* [BARU] ZOOM CONTROL FOR MOBILE */}
           <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <Maximize size={16} />
                  <span>Zoom View</span>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                  <ZoomOut size={14} className="text-slate-400" />
                  <input 
                    type="range" 
                    min="0.4" 
                    max="1.5" 
                    step="0.1" 
                    value={zoomLevel} 
                    onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                    className="w-24 md:w-32 cursor-pointer h-1 bg-slate-300 rounded-lg appearance-none accent-blue-600"
                  />
                  <ZoomIn size={14} className="text-slate-400" />
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{(zoomLevel * 100).toFixed(0)}%</span>
              </div>
           </div>

           {/* HIERARCHY CONTROLS */}
           <div className="w-full flex flex-col md:flex-row items-center gap-3">
               <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mr-2 shrink-0 self-start md:self-center pt-2 md:pt-0">
                  <Layers size={16} />
                  <span>Hierarki:</span>
               </div>
               
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                 <ControlBox label="Lvl 1" value={lvl1} onChange={setLvl1} options={DIMENSION_OPTIONS} color="indigo" />
                 <ControlBox label="Lvl 2" value={lvl2} onChange={setLvl2} options={DIMENSION_OPTIONS} color="indigo" />
                 <ControlBox label="Lvl 3" value={lvl3} onChange={setLvl3} options={DIMENSION_OPTIONS} color="indigo" />
                 <ControlBox label="Lvl 4" value={lvl4} onChange={setLvl4} options={DIMENSION_OPTIONS} color="indigo" />
               </div>
           </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col h-[65vh] md:h-[70vh] relative z-0">
          
          {(loading || isRefreshing) && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-100 flex flex-col items-center gap-2">
                    <RefreshCcw className="animate-spin text-blue-600" size={24} />
                    <span className="text-xs font-semibold text-slate-600">
                        {isRefreshing ? 'Sedang Memperbarui Database...' : 'Memuat Data...'}
                    </span>
                </div>
             </div>
          )}

          {/* [UPDATED] WRAPPER DENGAN STYLE ZOOM */}
          <div className="overflow-auto flex-1 relative w-full">
            <div style={{ zoom: zoomLevel } as any} className="min-w-fit origin-top-left"> 
            
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-700 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-3 text-left font-bold border-b border-r border-slate-300 bg-slate-100 min-w-50 sticky left-0 z-30">
                     STRUKTUR DATA
                  </th>
                  {pivotData.colKeys.map(colKey => {
                    const info = getHeaderInfo(colKey)
                    const isExpanded = expandedCols[info.parent]
                    const showToggle = info.type === 'year' || info.type === 'subtotal'
                    return (
                        <th key={colKey} 
                            className={`
                                p-2 text-center font-bold border-b border-slate-300 min-w-25
                                ${info.type === 'year' ? 'bg-slate-100' : ''}
                                ${info.type === 'subtotal' ? 'bg-slate-200 border-l border-slate-300' : ''}
                                ${info.type === 'month' ? 'bg-white font-normal text-xs text-slate-500' : ''}
                            `}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {showToggle && (
                                    <button onClick={() => toggleCol(info.parent)} className="hover:text-blue-600 transition focus:outline-none">
                                        {isExpanded ? <MinusSquare size={14} className="text-red-500" /> : <PlusSquare size={14} className="text-blue-600" />}
                                    </button>
                                )}
                                <span>{info.label}</span>
                            </div>
                        </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {visibleRows.length > 0 ? visibleRows.map(node => (
                    <tr key={node.id} className="hover:bg-blue-50 transition-colors group">
                      <td className="p-2 font-medium text-slate-800 border-r border-slate-200 bg-slate-50 sticky left-0 z-10">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${node.level * 20}px` }}>
                            {!node.isLeaf ? (
                                <button onClick={() => toggleRow(node.id)} className="text-slate-400 hover:text-blue-600 focus:outline-none">
                                    {expandedRows[node.id] ? <MinusSquare size={16} /> : <PlusSquare size={16} />}
                                </button>
                            ) : <span className="w-4 h-4" />}
                            <span className={`truncate max-w-62.5 block ${node.isLeaf ? "text-slate-600" : "font-bold text-slate-800"}`} title={node.label}>
                                {node.label}
                            </span>
                        </div>
                      </td>
                      {pivotData.colKeys.map(colKey => {
                         const currentVal = node.values[colKey] || 0
                         const info = getHeaderInfo(colKey)
                         const isSubtotal = info.type === 'subtotal'
                         
                         let prevKey = ''
                         const prevYear = (parseInt(info.parent) - 1).toString()
                         if (info.type === 'year') prevKey = prevYear
                         else if (info.type === 'month') prevKey = `${prevYear}-${colKey.split('-')[1]}`
                         else if (info.type === 'subtotal') prevKey = `${prevYear}-Total`

                         let prevVal = node.values[prevKey] || 0
                         if (info.type === 'subtotal' && prevVal === 0) prevVal = node.values[prevYear] || 0

                         return (
                            <td key={colKey} className={`p-2 text-right border-r border-slate-100 align-top cursor-default ${isSubtotal ? 'bg-slate-50 font-bold border-l border-slate-200' : ''}`}>
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className={`font-mono text-[13px] ${currentVal ? 'text-slate-900' : 'text-slate-300'}`}>
                                        {fmt(currentVal)}
                                    </span>
                                    {prevVal > 0 && <YoYBadge current={currentVal} previous={prevVal} />}
                                </div>
                            </td>
                         )
                      })}
                    </tr>
                )) : (
                   <tr>
                     <td colSpan={20} className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <Filter size={24} />
                        <span>Data tidak ditemukan.</span>
                     </td>
                   </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-800 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <tr>
                    <td className="p-3 sticky left-0 z-30 bg-slate-100 border-t border-r border-slate-300">GRAND TOTAL</td>
                    {pivotData.colKeys.map(colKey => {
                        const info = getHeaderInfo(colKey)
                        return (
                            <td key={colKey} className={`p-3 text-right border-t border-r border-slate-200 font-mono text-sm ${info.type === 'subtotal' ? 'bg-slate-200' : 'bg-slate-100'}`}>
                                {fmt(pivotData.colTotals[colKey])}
                            </td>
                        )
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