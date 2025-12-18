'use client'

// ============================================================================
// SECTION 1: IMPORTS (TIDAK BERUBAH)
// ============================================================================
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { 
  LayoutGrid, RefreshCcw, Filter, MinusSquare, PlusSquare, Database, 
  ArrowUp, ArrowDown, ChevronDown, Check, Layers, ZoomIn, ZoomOut, 
  Maximize, Search, X, BarChart3, 
  Calendar, CalendarRange 
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts'

// ============================================================================
// SECTION 2: TYPES & INTERFACES (TIDAK BERUBAH)
// ============================================================================
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

// ============================================================================
// SECTION 3: CONSTANTS (TIDAK BERUBAH)
// ============================================================================
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

// ============================================================================
// SECTION 4: UI SUB-COMPONENTS
// ============================================================================

// --- 4.1 YoYBadge (TIDAK BERUBAH) ---
export function YoYBadge({ current, previous }: { current: number, previous: number }) {
    if (previous === 0) return null;
    const diff = current - previous
    const percent = (diff / previous) * 100
    const isUp = percent > 0
    const isNeutral = percent === 0
    if (current === 0) return <span className="text-[9px] text-slate-300">-</span>

    return (
        <div className={`flex items-center gap-[0.2em] text-[0.7em] font-bold px-[0.5em] py-0 rounded-full border shadow-sm ${isNeutral ? 'bg-slate-100 text-slate-500 border-slate-200' : ''} ${isUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''} ${!isUp && !isNeutral ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}`}>
            {isUp ? <ArrowUp style={{ width: '0.8em', height: '0.8em'}} /> : (!isNeutral && <ArrowDown style={{ width: '0.8em', height: '0.8em'}} />)}
            <span>{Math.abs(percent).toFixed(1)}%</span>
        </div>
    )
}

// --- 4.2 ControlBox (TIDAK BERUBAH) ---
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

// --- 4.3 MultiSelect (DIUPDATE SEDIKIT) ---
interface MultiSelectProps {
    label: string;
    options?: (string | null | number)[];
    optionsRaw?: { label: string, value: string }[];
    selected: string[];
    onChange: (val: string[]) => void;
}

export function MultiSelect({ label, options, optionsRaw, selected, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("") 
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const finalOptions = useMemo(() => {
    if (optionsRaw) return optionsRaw;
    if (options) {
        return options.map(o => {
            // Logic: Data null/kosong/undefined akan dianggap sebagai kategori "No [Nama Filter]"
            // Value-nya diset menjadi string kosong "" agar bisa difilter di DB
            const isNullOrEmpty = o === null || o === undefined || String(o).trim() === '';
            const displayLabel = isNullOrEmpty ? `No ${label}` : String(o);
            
            return { 
                label: displayLabel, 
                value: isNullOrEmpty ? "" : String(o)         
            }
        })
    }
    return []
  }, [options, optionsRaw, label]) 
  
  // ... (Sisa kode MultiSelect logika filtering dan click outside sama seperti sebelumnya)
  const filteredOptions = finalOptions.filter(opt => {
    const labelText = opt.label || ""; 
    return labelText.toLowerCase().includes(searchTerm.toLowerCase())
  })
  
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm("") 
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  
  const isAllSelected = selected.includes('All') || (finalOptions.length > 0 && selected.length === finalOptions.length)
  
  const toggleOption = (val: string) => {
    if (val === 'All') {
        onChange(isAllSelected ? [] : ['All'])
    } else {
      let newSelected = [...selected]
      // Jika sebelumnya All, maka anggap semua value terpilih, lalu kurangi yang di-klik
      if (newSelected.includes('All')) newSelected = finalOptions.map(o => o.value)
      
      if (newSelected.includes(val)) {
          newSelected = newSelected.filter(item => item !== val)
      } else {
          newSelected.push(val)
      }
      
      if (newSelected.length === finalOptions.length && finalOptions.length > 0) onChange(['All'])
      else onChange(newSelected)
    }
  }

  const getDisplayLabel = () => {
      if (selected.includes('All')) return 'All'
      if (selected.length === 0) return 'None'
      
      const isNumeric = finalOptions.every(opt => !isNaN(parseInt(opt.value)) && opt.value !== "")

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
          if (startLabel) ranges.push(start === prev ? `${startLabel}` : `${startLabel}-${endLabel}`)
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
            <span className="truncate font-medium text-slate-700 block max-w-25 md:max-w-35 text-left">{getDisplayLabel()}</span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
         </button>
       </div>
       
       {isOpen && (
         <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1 flex flex-col">
            <div className="sticky top-0 bg-white z-20 pb-1 border-b border-slate-100 p-2">
                <div className="relative flex items-center">
                    <Search size={12} className="absolute left-2 text-slate-400" />
                    <input 
                        type="text" placeholder={`Cari ${label}...`}
                        className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-blue-500 transition-colors"
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm("")} className="absolute right-2 text-slate-400 hover:text-slate-600"><X size={12} /></button>
                    )}
                </div>
            </div>

            <div className="overflow-y-auto max-h-60 pt-1">
                {!searchTerm && (
                    <div onClick={() => toggleOption('All')} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded text-xs font-bold border-b border-slate-100 mb-1">
                        <div className={`w-3 h-3 rounded border flex items-center justify-center ${isAllSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                            {isAllSelected && <Check size={8} className="text-white" />}
                        </div>
                        Select All
                    </div>
                )}
                {filteredOptions.length > 0 ? (
                    filteredOptions.map(opt => {
                        const isSelected = selected.includes(opt.value) || selected.includes('All')
                        const isNone = opt.value === "" 
                        return (
                            <div key={opt.value || 'empty-key'} onClick={() => toggleOption(opt.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 rounded text-xs">
                                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                    {isSelected && <Check size={8} className="text-white" />}
                                </div>
                                <span className={`${isSelected ? 'font-semibold text-slate-800' : 'text-slate-600'} ${isNone ? 'italic text-red-500 font-medium' : ''}`}>
                                    {opt.label}
                                </span>
                            </div>
                        )
                    })
                ) : (
                    <div className="px-3 py-4 text-center text-xs text-slate-400 italic">Tidak ada hasil "{searchTerm}"</div>
                )}
            </div>
         </div>
       )}
    </div>
  )
}

// ============================================================================
// SECTION 5: CUSTOM HOOKS (UPDATED LOGIC)
// ============================================================================
interface UsePivotLogicProps {
  data: AggregatedRecord[];
  expandedCols: Record<string, boolean>;
  expandedRows: Record<string, boolean>;
  activeLevels: string[]; // [lvl1, lvl2, lvl3, lvl4] yang tidak kosong
}

export function usePivotLogic({ data, expandedCols, expandedRows, activeLevels }: UsePivotLogicProps) {
  
  const pivotData = useMemo(() => {
    const uniqueYearsSet = new Set<string>()
    data.forEach(d => uniqueYearsSet.add(String(d.year)))
    const sortedYears = Array.from(uniqueYearsSet).sort()

    // A. Columns Logic (Sama seperti sebelumnya)
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

    // B. Tree Logic (DIUBAH DISINI)
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

      // PERBAIKAN LOGIKA DISINI:
      // Kita tidak lagi memfilter data kosong secara membabi buta.
      // Kita cek berdasarkan 'activeLevels'. Jika user memilih Level 'PSS',
      // tapi data PSS kosong, kita beri label 'No PSS' agar node-nya terbentuk.
      
      const cleanLevels: string[] = []
      
      activeLevels.forEach((lvlName, idx) => {
          // Ambil value dari col_label_1, col_label_2 dst
          // Note: AggregatedRecord punya key fix col_label_1..4
          const rawVal = (item as any)[`col_label_${idx + 1}`]

          if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
             // Jika data kosong, buat label deskriptif, misal "No PSS"
             // Format teks lvlName (misal 'business_area' -> 'Business Area')
             const friendlyName = lvlName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
             cleanLevels.push(`No ${friendlyName}`)
          } else {
             cleanLevels.push(String(rawVal))
          }
      })

      // Jika tidak ada level yang dipilih sama sekali, skip row ini (seharusnya tidak terjadi)
      if (cleanLevels.length === 0) continue

      let currentMap = rootMap
      let currentIdPath = ""

      cleanLevels.forEach((lvlLabel, idx) => {
        const isLastLevel = idx === cleanLevels.length - 1
        currentIdPath = currentIdPath ? `${currentIdPath}|${lvlLabel}` : lvlLabel
        
        if (!currentMap[lvlLabel]) {
            currentMap[lvlLabel] = {
                id: currentIdPath, label: lvlLabel, level: idx, isLeaf: isLastLevel, values: {}, rowTotal: 0,
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
            .sort((a, b) => {
                // Opsional: Taruh yang berawalan "No " di paling bawah atau atas
                if(a.label.startsWith("No ") && !b.label.startsWith("No ")) return 1;
                if(!a.label.startsWith("No ") && b.label.startsWith("No ")) return -1;
                return a.label.localeCompare(b.label)
            })
            .map(node => {
                if ((node as any).childrenMap) {
                    node.children = processChildren((node as any).childrenMap)
                    delete (node as any).childrenMap
                }
                return node
            })
    }

    return { roots: processChildren(rootMap), colKeys: finalColKeys, colTotals, grandTotal }
  }, [data, expandedCols, activeLevels]) // Dependency ditambah activeLevels

  const visibleRows = useMemo(() => {
    const rows: PivotNode[] = []
    const traverse = (nodes: PivotNode[]) => {
        nodes.forEach(node => {
            rows.push(node)
            if (node.children && expandedRows[node.id]) traverse(node.children)
        })
    }
    traverse(pivotData.roots)
    return rows
  }, [pivotData.roots, expandedRows])

  const getHeaderInfo = (colKey: string) => {
      if (colKey.includes('-Total')) {
          const yearLabel = colKey.split('-')[0]
          return { type: 'subtotal', label: yearLabel, parent: yearLabel } 
      }
      if (colKey.includes('-')) {
          const [y, m] = colKey.split('-')
          const mInt = parseInt(m)
          const foundMonth = MONTH_OPTIONS.find(opt => opt.value === String(mInt))
          const monthLabel = foundMonth ? foundMonth.label : String(mInt)
          return { type: 'month', label: monthLabel, parent: y }
      }
      return { type: 'year', label: colKey, parent: colKey }
  }

  return { pivotData, visibleRows, getHeaderInfo }
}

export function useChartLogic(data: AggregatedRecord[]) {
  return useMemo(() => {
    const trendMap: Record<string, any> = {}
    
    data.forEach(item => {
      // PERUBAHAN: Key sekarang hanya tahun (string), bukan tahun-bulan
      const key = String(item.year)
      
      if (!trendMap[key]) {
        trendMap[key] = { 
            name: key, // Label di sumbu X hanya Tahun (misal: "2023")
            year: item.year, 
            total: 0 
        }
      }
      // Akumulasi total amount ke dalam tahun tersebut
      trendMap[key].total += item.total_amount
    })

    // Sort berdasarkan tahun (asc)
    const trendData = Object.values(trendMap).sort((a: any, b: any) => a.year - b.year)

    return { trendData }
  }, [data])
}

// ============================================================================
// SECTION 6: MAIN COMPONENT & STATE
// ============================================================================
export default function PivotPage() {
  const [data, setData] = useState<AggregatedRecord[]>([])           
  const [chartData, setChartData] = useState<AggregatedRecord[]>([]) 
  
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Filter State
  const [lvl1, setLvl1] = useState<string>('business_area')
  const [lvl2, setLvl2] = useState<string>('product')
  const [lvl3, setLvl3] = useState<string>('') 
  const [lvl4, setLvl4] = useState<string>('') 

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({})

  // Selected Filter Values
  const [selectedYears, setSelectedYears] = useState<string[]>(['All'])
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['All']) 
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['All'])
  const [selectedBusinessAreas, setSelectedBusinessAreas] = useState<string[]>(['All'])
  const [selectedPSS, setSelectedPSS] = useState<string[]>(['All'])
  const [selectedKAT, setSelectedKAT] = useState<string[]>(['All'])
  const [selectedCustGroups, setSelectedCustGroups] = useState<string[]>(['All'])
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['All'])

  // Dynamic Options
  const [filterOptions, setFilterOptions] = useState({
    months: [] as string[],
    areas: [] as string[],
    business_areas: [] as string[],
    pss: [] as string[],
    key_account_types: [] as string[],
    products: [] as string[],
    cust_groups: [] as string[],
  })
  
  const [optionYears, setOptionYears] = useState<string[]>([])
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  // -- UPDATE DISINI: Define active levels untuk diteruskan ke hook --
  const activeLevels = useMemo(() => {
     return [lvl1, lvl2, lvl3, lvl4].filter(l => l !== '')
  }, [lvl1, lvl2, lvl3, lvl4])

  // 1. Logic Pivot (Pass activeLevels)
  const { pivotData, visibleRows, getHeaderInfo } = usePivotLogic({ 
      data, expandedCols, expandedRows, activeLevels 
  })
  
  // 2. Logic Chart
  const { trendData } = useChartLogic(chartData, 'product')

// ============================================================================
// SECTION 7: DATA FETCHING & EFFECTS
// ============================================================================
  
  // 7.1 Fetch Initial Years (Static)
  useEffect(() => {
    const fetchYears = async () => {
       const { data } = await supabase.from('filter_cache').select('value').eq('type', 'year')
       if(data) setOptionYears(data.map(d => d.value).sort())
    }
    fetchYears()
  }, [])

  // 7.2 Fetch Dynamic Filters & Main Data
  useEffect(() => {
    const fetchDynamicOptions = async () => {
      try {
        // Logic getParam: Jika [''] (user pilih empty), return '' agar dikirim ke RPC sebagai empty string
        const getParam = (arr: string[]) => {
            if (arr.includes('All')) return null;
            if (arr.length === 0) return null; // Harusnya tidak kejadian karena MultiSelect handle empty
            // Jika single selection, kirim string-nya. Jika multiple, logic RPC mungkin beda, 
            // tapi asumsi disini dynamic option based on single dominant filter usually, 
            // atau array. Jika array, sesuaikan dengan RPC definition Anda.
            // Asumsi get_dynamic_filter_options menerima array text[] atau text.
            // Disini kita kirim array[0] untuk simplicity seperti kode asli, 
            // tapi pastikan UI MultiSelect kirim array yang benar.
            return arr[0]; 
        }

        const { data, error } = await supabase.rpc('get_dynamic_filter_options', {
            p_year: getParam(selectedYears),
            p_month: getParam(selectedMonths),
            p_area: getParam(selectedAreas),
            p_ba: getParam(selectedBusinessAreas),
            p_pss: getParam(selectedPSS),
            p_kat: getParam(selectedKAT),
            p_cust_group: getParam(selectedCustGroups),
            p_product: getParam(selectedProducts),
        })

        if (error) throw error
        if (data) {
           setFilterOptions({
             months: data.month || [],
             areas: data.area || [],
             business_areas: data.business_area || [],
             pss: data.pss || [],
             key_account_types: data.key_account_type || [],
             products: data.product || [],
             cust_groups: data.cust_group || [],
           })
        }
      } catch (err) { console.error("Dynamic Filter Error:", err) }
    }

    fetchDynamicOptions()
    fetchAggregatedData() 
  }, [
    selectedYears, selectedMonths, selectedAreas, selectedBusinessAreas, 
    selectedPSS, selectedKAT, selectedCustGroups, selectedProducts,
    lvl1, lvl2, lvl3, lvl4 
  ]) 

  // 7.3 Fetch Table & Chart Data Function
  const fetchAggregatedData = async () => {
    setLoading(true)
    try {
      let monthInts: number[] = []
      if (!selectedMonths.includes('All')) monthInts = selectedMonths.map(m => parseInt(m))

      const pivotPromise = supabase.rpc('get_sales_analytics', {
        lvl1_field: lvl1, lvl2_field: lvl2, lvl3_field: lvl3, lvl4_field: lvl4, 
        filter_years: selectedYears,
        filter_areas: selectedAreas,
        filter_months: monthInts,
        filter_business_areas: selectedBusinessAreas,
        filter_pss: selectedPSS,
        filter_key_account_types: selectedKAT,
        filter_cust_groups: selectedCustGroups,
        filter_products: selectedProducts
      })

      const chartPromise = supabase.rpc('get_sales_analytics', {
        lvl1_field: 'product', 
        lvl2_field: '', 
        lvl3_field: '', 
        lvl4_field: '', 
        filter_years: selectedYears,
        filter_areas: selectedAreas,
        filter_months: monthInts,
        filter_business_areas: selectedBusinessAreas,
        filter_pss: selectedPSS,
        filter_key_account_types: selectedKAT,
        filter_cust_groups: selectedCustGroups,
        filter_products: selectedProducts
      })

      const [pivotRes, chartRes] = await Promise.all([pivotPromise, chartPromise])

      if (pivotRes.error) throw pivotRes.error
      if (chartRes.error) throw chartRes.error

      if (pivotRes.data) setData(pivotRes.data as AggregatedRecord[])
      if (chartRes.data) setChartData(chartRes.data as AggregatedRecord[])
      
    } catch (err: any) { console.error('Data Error:', err.message) } 
    finally { setLoading(false) }
  }

  // Reset Row Expand when level changes
  useEffect(() => { setExpandedRows({}) }, [lvl1, lvl2, lvl3, lvl4])

// ============================================================================
// SECTION 8: EVENT HANDLERS (Sama seperti sebelumnya)
// ============================================================================

  const handleRefreshDatabase = async () => {
    if(!confirm("Update Data dari Master? \n\nPERINGATAN: Proses ini mungkin memakan waktu lama (30-60+ detik).\nMohon jangan tutup browser sampai selesai.")) return;
    setIsRefreshing(true)
    try {
      const { error } = await supabase.rpc('refresh_sales_data')
      if (error) throw error
      await fetchAggregatedData()
      alert('✅ Sukses! Data berhasil diperbarui dari Master.')
    } catch (err: any) {
      console.error('Refresh DB Error:', err)
      if (err.message?.includes('timeout') || err.status === 504) {
        alert('⚠️ Waktu Habis (Timeout Browser).\n\nDatabase mungkin masih memproses di latar belakang.')
      } else {
        alert('❌ Gagal: ' + (err.message || 'Terjadi kesalahan saat update.'))
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleCol = (year: string) => setExpandedCols(prev => ({ ...prev, [year]: !prev[year] }))
  const fmt = (n: number) => n ? n.toLocaleString('id-ID') : '-'

// ============================================================================
// SECTION 9: JSX RENDER (TIDAK BERUBAH)
// ============================================================================
  return (
    <main className="min-h-screen bg-slate-50 p-2 md:p-6 font-sans text-slate-800">
      <div className="max-w-400 mx-auto space-y-4">
        
        {/* 1. HEADER & FILTERS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 z-50 relative">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-col">
                <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800"><LayoutGrid className="text-blue-600" size={24} /> Sales Analytics</h1>
                <p className="text-xs text-slate-400 mt-1 ml-8">Dynamic Pivot & Searchable Filters</p>
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={fetchAggregatedData} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-100 shadow-sm flex justify-center"><RefreshCcw size={16} className={loading ? "animate-spin" : ""} /></button>
                <button onClick={handleRefreshDatabase} disabled={isRefreshing} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                    <Database size={14} className={isRefreshing ? "animate-pulse" : ""} /> {isRefreshing ? 'Updating DB...' : 'Update DB'}
                </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
             <div className="flex flex-wrap gap-2">
                <MultiSelect label="Tahun" options={optionYears} selected={selectedYears} onChange={setSelectedYears} />
                <MultiSelect label="Bulan" optionsRaw={MONTH_OPTIONS} selected={selectedMonths} onChange={setSelectedMonths} />
                <MultiSelect label="Area" options={filterOptions.areas} selected={selectedAreas} onChange={setSelectedAreas} />
                <MultiSelect label="Biz Area" options={filterOptions.business_areas} selected={selectedBusinessAreas} onChange={setSelectedBusinessAreas} />
             </div>
             <div className="flex flex-wrap gap-2">
                <MultiSelect label="Key Acc." options={filterOptions.key_account_types} selected={selectedKAT} onChange={setSelectedKAT} />
                <MultiSelect label="Product" options={filterOptions.products} selected={selectedProducts} onChange={setSelectedProducts} />
                <MultiSelect label="PSS" options={filterOptions.pss} selected={selectedPSS} onChange={setSelectedPSS} />
                <MultiSelect label="Cust Group" options={filterOptions.cust_groups} selected={selectedCustGroups} onChange={setSelectedCustGroups} />
             </div>
          </div>
        </div>

        {/* 2. CHARTS SECTION (Sama) */}
        {chartData.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-80 relative z-0">
                
                {/* TAMBAHAN: Overlay Loading untuk Grafik (Konsisten dengan Tabel) */}
                {(loading || isRefreshing) && (
                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl transition-all duration-200">
                        {/* Spinner kecil opsional agar user tahu sedang proses */}
                        <div className="bg-white px-3 py-2 rounded-lg shadow-md border border-slate-100 flex items-center gap-2">
                            <RefreshCcw className="animate-spin text-blue-600" size={16} />
                    <span className="text-xs font-semibold text-slate-600">{isRefreshing ? 'Memproses Database...' : 'Memuat Data...'}</span>
                        </div>
                     </div>
                )}

                <div className="flex items-center gap-2 mb-2 border-b border-slate-50 pb-2">
                    <div className="p-1.5 bg-indigo-50 rounded text-indigo-600"><BarChart3 size={18}/></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sales Performance</h3>
                        <p className="text-[11px] text-slate-400">Total penjualan per Tahun (Yearly Trend)</p>
                    </div>
                </div>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="name" 
                                tick={{fontSize: 11, fill: '#64748b'}} 
                                axisLine={false} 
                                tickLine={false} 
                                tickMargin={10}
                            />
                            <YAxis 
                                tickFormatter={(val) => val >= 1000000000 ? (val/1000000000).toFixed(1)+'M' : (val/1000000).toFixed(0)+'jt'} 
                                tick={{fontSize: 10, fill: '#64748b'}} 
                                axisLine={false} 
                                tickLine={false} 
                                width={40} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}} 
                                content={({ active, payload, label }) => active && payload && payload.length ? (
                                    <div className="bg-white p-2.5 border border-slate-100 shadow-xl rounded-lg text-xs z-50">
                                        <div className="font-bold text-slate-800 mb-1">{label}</div>
                                        <div className="text-indigo-600 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                                            Rp {payload[0].value.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                ) : null} 
                            />
                            <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {/* 3. CONTROLS (HIERARCHY & ZOOM) (Sama) */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center gap-3 relative z-40">
           {/* Zoom Control */}
           <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider"><Maximize size={16} /><span>Zoom View</span></div>
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                  <ZoomOut size={14} className="text-slate-400" />
                  <input type="range" min="0.4" max="1.5" step="0.1" value={zoomLevel} onChange={(e) => setZoomLevel(parseFloat(e.target.value))} className="w-24 md:w-32 cursor-pointer h-1 bg-slate-300 rounded-lg appearance-none accent-blue-600"/>
                  <ZoomIn size={14} className="text-slate-400" />
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{(zoomLevel * 100).toFixed(0)}%</span>
              </div>
           </div>

           {/* Hierarchy Control */}
           <div className="w-full flex flex-col md:flex-row items-center gap-3">
               <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mr-2 shrink-0 self-start md:self-center pt-2 md:pt-0"><Layers size={16} /><span>Hierarki:</span></div>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                 <ControlBox label="Lvl 1" value={lvl1} onChange={setLvl1} options={DIMENSION_OPTIONS} color="indigo" />
                 <ControlBox label="Lvl 2" value={lvl2} onChange={setLvl2} options={DIMENSION_OPTIONS} color="indigo" />
                 <ControlBox label="Lvl 3" value={lvl3} onChange={setLvl3} options={DIMENSION_OPTIONS} color="indigo" />
                 <ControlBox label="Lvl 4" value={lvl4} onChange={setLvl4} options={DIMENSION_OPTIONS} color="indigo" />
               </div>
           </div>
        </div>

        {/* 4. TABLE DISPLAY (Sama) */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col h-[65vh] md:h-[70vh] relative z-0">
          {(loading || isRefreshing) && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-100 flex flex-col items-center gap-2">
                    <RefreshCcw className="animate-spin text-blue-600" size={24} />
                    <span className="text-xs font-semibold text-slate-600">{isRefreshing ? 'Memproses Database...' : 'Memuat Data...'}</span>
                </div>
             </div>
          )}

          <div className="overflow-auto flex-1 relative w-full">
            <div style={{ fontSize: `${14 * zoomLevel}px` }} className="min-w-full inline-block align-top transition-all duration-200"> 
            <table className="w-full border-collapse leading-normal">
              <thead className="bg-slate-50 text-slate-700 sticky top-0 z-20 shadow-sm text-[inherit]">
                <tr>
                  <th className="p-3 text-left font-bold border-b border-r border-slate-300 bg-slate-100 whitespace-nowrap sticky left-0 z-30 min-w-[8em]">HIERARKI</th>
                  {pivotData.colKeys.map(colKey => {
                    const info = getHeaderInfo(colKey)
                    const isExpanded = expandedCols[info.parent]
                    const showToggle = info.type === 'year' || info.type === 'subtotal'
                    return (
                        <th key={colKey} className={`p-2 text-center font-bold border-b border-slate-300 whitespace-nowrap min-w-[6em] ${info.type === 'year' ? 'bg-slate-100' : ''} ${info.type === 'subtotal' ? 'bg-slate-200 border-l border-slate-300' : ''} ${info.type === 'month' ? 'bg-white font-normal text-[0.9em] text-slate-500' : ''}`}>
                            <div className="flex items-center justify-center gap-[0.5em]">
                                {showToggle && (
                                    <button onClick={() => toggleCol(info.parent)} className="hover:text-blue-600 transition focus:outline-none">
                                        {isExpanded ? <MinusSquare style={{ width: '1.2em', height: '1.2em' }} className="text-red-500" /> : <PlusSquare style={{ width: '1.2em', height: '1.2em' }} className="text-blue-600" />}
                                    </button>
                                )}
                                <span>{info.label}</span>
                            </div>
                        </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 text-[inherit]">
                {visibleRows.length > 0 ? visibleRows.map(node => (
                    <tr key={node.id} className="hover:bg-blue-50 transition-colors group">
                      <td className="p-2 font-medium text-slate-800 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 whitespace-nowrap">
                        <div className="flex items-center gap-[0.5em]" style={{ paddingLeft: `${node.level * 1.5}em` }}>
                            {!node.isLeaf ? (
                                <button onClick={() => toggleRow(node.id)} className="text-slate-400 hover:text-blue-600 focus:outline-none">
                                    {expandedRows[node.id] ? <MinusSquare style={{ width: '1.2em', height: '1.2em' }} /> : <PlusSquare style={{ width: '1.2em', height: '1.2em' }} />}
                                </button>
                            ) : <span style={{ width: '1.2em' }} />}
                            {/* Visual tweak: Jika label dimulai dengan No (No PSS), beri warna merah/italic supaya beda */}
                            <span className={`${node.isLeaf ? "text-slate-600" : "font-bold text-slate-800"} ${node.label.startsWith('No ') ? 'text-red-500 italic' : ''}`}>{node.label}</span>
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
                            <td key={colKey} className={`p-2 text-right border-r border-slate-100 align-top cursor-default whitespace-nowrap ${isSubtotal ? 'bg-slate-50 font-bold border-l border-slate-200' : ''}`}>
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className={`font-mono text-[0.95em] ${currentVal ? 'text-slate-900' : 'text-slate-300'}`}>{fmt(currentVal)}</span>
                                    {prevVal > 0 && <YoYBadge current={currentVal} previous={prevVal} />}
                                </div>
                            </td>
                         )
                      })}
                    </tr>
                )) : (
                   <tr><td colSpan={20} className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2"><Filter size={24} /><span>Data tidak ditemukan untuk kombinasi filter ini.</span></td></tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-800 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] text-[inherit]">
                <tr>
                    <td className="p-3 sticky left-0 z-30 bg-slate-100 border-t border-r border-slate-300 whitespace-nowrap align-top"><div className="mt-[0.2em]">GRAND TOTAL</div></td>
                    {pivotData.colKeys.map(colKey => {
                        const info = getHeaderInfo(colKey)
                        const currentTotal = pivotData.colTotals[colKey] || 0
                        let prevKey = ''
                        const prevYear = (parseInt(info.parent) - 1).toString()
                        if (info.type === 'year') prevKey = prevYear
                        else if (info.type === 'month') prevKey = `${prevYear}-${colKey.split('-')[1]}`
                        else if (info.type === 'subtotal') prevKey = `${prevYear}-Total`

                        let prevTotal = pivotData.colTotals[prevKey] || 0
                        if (info.type === 'subtotal' && prevTotal === 0) prevTotal = pivotData.colTotals[prevYear] || 0

                        return (
                            <td key={colKey} className={`p-3 text-right border-t border-r border-slate-200 align-top whitespace-nowrap ${info.type === 'subtotal' ? 'bg-slate-200' : 'bg-slate-100'}`}>
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="font-mono text-[0.95em]">{fmt(currentTotal)}</span>
                                    {prevTotal > 0 && <YoYBadge current={currentTotal} previous={prevTotal} />}
                                </div>
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