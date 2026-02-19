'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { 
  RefreshCw, Filter, ChevronDown, Check,
  Search, X, LogOut, Sun, Moon, Laptop, Loader2, 
  MoreVertical, FileWarning, LayoutList, LayoutGrid,
  Database, BarChart3, Target, Clock, AlertTriangle, TrendingUp, Download
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Cell,
  LineChart, Line, PieChart, Pie
} from 'recharts'
import { useTheme } from '../components/ThemeProvider'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// ==========================================
// TYPES & CONSTANTS
// ==========================================

interface OtifRow {
  id: number
  sheet_source: string
  plant: string
  pss_name: string
  customer_code: string
  customer_name: string
  customer_group: string
  product: string
  fill_rate: string
  year_sap: string
  year: string
  month: string
  month_invoice: string
  categori_rank: string
  performance: string
  otif: string
  lt_po_ke_sap: string
  sap_ke_sourching: string
  sourching_to_allocated: string
  allocated_ke_dn: string
  dn_ke_shipment: string
  shipment_ke_billing: string
  billing_ke_delivery: string
  delivery_ke_receive: string
  remaks_aging_po: string
  adjustment_outstanding: string
  material_no: string
}

const MONTH_ORDER: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
}

const MONTH_SHORT: Record<string, string> = {
  January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr',
  May: 'May', June: 'Jun', July: 'Jul', August: 'Aug',
  September: 'Sep', October: 'Oct', November: 'Nov', December: 'Dec'
}

const COLORS = {
  onTime: '#15803d',
  delay: '#dc2626',
  onTimeDark: '#16a34a',
  delayDark: '#ef4444',
  bar: '#0369a1',
  barDark: '#38bdf8',
}

const LEAD_TIME_LABELS: Record<string, string> = {
  lt_po_ke_sap: '1. PO TO SAP - [PSS]',
  sap_ke_sourching: '2. SO TO SOURCING - [COUNTER]',
  sourching_to_allocated: '3. SOURCING TO ALLOCATED - [COUNTER]',
  allocated_ke_dn: '4. ALLOCATED TO DN - [COUNTER]',
  dn_ke_shipment: '5. DN TO SHIPMENT - [WHS]',
  shipment_ke_billing: '6. SHIPMENT TO BILLING - [COUNTER]',
  billing_ke_delivery: '7. BILLING TO DELIVERY - [WHS]',
  delivery_ke_receive: '8. DELIVERY TO RECEIVE - [WHS]',
}

// Helpers
const sortByMonth = <T extends { month: string }>(arr: T[]) =>
  [...arr].sort((a, b) => (MONTH_ORDER[a.month] || 99) - (MONTH_ORDER[b.month] || 99))

/** month_invoice untuk semua sheet kecuali PAMA, PAMA pakai month (= MONTH PERIODE PAMA) */
const getMonthInv = (r: OtifRow) => {
  const raw = r.sheet_source === 'PAMA' ? (r.month || '') : (r.month_invoice || '')
  if (!raw) return ''
  const t = raw.trim()
  // Normalize: "JANUARY" / "january" → "January"
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** year_sap jika valid, fallback ke year */
const getYear = (r: OtifRow) => {
  const ys = (r.year_sap || '').trim()
  if (ys && /^\d{4}$/.test(ys) && +ys > 2000 && +ys < 2100) return ys
  const y = (r.year || '').trim()
  if (y && /^\d{4}$/.test(y) && +y > 2000 && +y < 2100) return y
  return ''
}

// ==========================================
// HELPER COMPONENTS
// ==========================================

const MultiSelect = ({ label, options, rawOptions, selectedValues, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [temporarySelected, setTemporarySelected] = useState<string[]>([])
  const [baseSelectionSnapshot, setBaseSelectionSnapshot] = useState<string[]>([])
  const [isAddToSelectionMode, setIsAddToSelectionMode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const finalOptions = useMemo(() => (
    rawOptions || (options || []).map((option: any) => ({ 
      label: !option || String(option).trim() === '' ? `No ${label}` : String(option), 
      value: !option || String(option).trim() === '' ? "" : String(option) 
    }))
  ), [options, rawOptions, label])
  
  const filteredOptions = finalOptions.filter((option: any) => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      let initialSelection: string[] = []
      if (selectedValues.includes('All')) initialSelection = finalOptions.map((o: any) => o.value)
      else initialSelection = selectedValues
      setTemporarySelected(initialSelection)
      setBaseSelectionSnapshot(initialSelection)
      setSearchTerm("")
      setIsAddToSelectionMode(false)
    }
  }, [isOpen, selectedValues, finalOptions])

  useEffect(() => {
    if (isOpen && searchTerm) {
      const visibleValues = filteredOptions.map((o: any) => o.value)
      if (isAddToSelectionMode) {
        const newSet = new Set([...baseSelectionSnapshot, ...visibleValues])
        setTemporarySelected(Array.from(newSet))
      } else {
        setTemporarySelected(visibleValues)
      }
    }
  }, [searchTerm, isAddToSelectionMode, finalOptions, isOpen, baseSelectionSnapshot])

  useEffect(() => { 
    const handleClickOutside = (e: MouseEvent) => { 
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleApply = () => {
    if (temporarySelected.length === finalOptions.length && finalOptions.length > 0) onChange(['All'])
    else onChange(temporarySelected)
    setIsOpen(false)
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value && searchTerm === "") setBaseSelectionSnapshot(temporarySelected)
    setSearchTerm(value)
  }

  const toggleOption = (value: string) => {
    let n = [...temporarySelected]
    // Jika SEMUA tercentang dan user klik 1 item → pilih HANYA item itu (uncheck sisanya)
    if (n.length === finalOptions.length && n.length > 1) {
      setTemporarySelected([value])
      return
    }
    if (n.includes(value)) n = n.filter(i => i !== value); else n.push(value)
    setTemporarySelected(n)
  }

  const handleSelectAllClick = () => {
    if (!searchTerm) {
      if (temporarySelected.length === finalOptions.length) setTemporarySelected([])
      else setTemporarySelected(finalOptions.map((o: any) => o.value))
      return
    }
    const visibleValues = filteredOptions.map((o: any) => o.value)
    const isAllVisibleSelected = visibleValues.every((v: any) => temporarySelected.includes(v))
    if (isAllVisibleSelected) {
      setTemporarySelected(temporarySelected.filter((v: string) => !visibleValues.includes(v)))
    } else {
      if (isAddToSelectionMode) setTemporarySelected(Array.from(new Set([...temporarySelected, ...visibleValues])))
      else setTemporarySelected([...visibleValues])
    }
  }

  const isSelectAllChecked = useMemo(() => {
    if (!searchTerm) return temporarySelected.length === finalOptions.length && finalOptions.length > 0
    if (filteredOptions.length === 0) return false
    return filteredOptions.every((o: any) => temporarySelected.includes(o.value))
  }, [temporarySelected, searchTerm, filteredOptions, finalOptions])

  const getButtonLabel = () => {
    if (selectedValues.includes('All')) return 'All'
    if (!selectedValues.length) return 'None'
    const names = selectedValues.map((val: string) => finalOptions.find((o: any) => o.value === val)?.label).filter(Boolean)
    return names.length > 2 ? `${names[0]}, ${names[1]} +${names.length - 2}` : names.join(', ')
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-col">
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 mb-0.5 uppercase">{label}</label>
        <button onClick={() => setIsOpen(!isOpen)} 
          className={`flex items-center justify-between gap-2 w-full md:w-auto md:min-w-32 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-md shadow-sm transition-colors 
            ${isOpen ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
          <span className="truncate font-medium text-slate-700 dark:text-slate-200 max-w-25 text-left">{getButtonLabel()}</span>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 md:bg-transparent md:p-0 md:absolute md:inset-auto md:top-full md:left-0 md:block md:mt-1">
          <div className="absolute inset-0 md:hidden" onClick={() => setIsOpen(false)}></div>
          <div className="relative w-full max-w-xs md:w-64 max-h-[70vh] md:max-h-96 flex flex-col bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="shrink-0 p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input type="text" placeholder="Cari... (Enter utk Terapkan)" 
                  className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500" 
                  value={searchTerm} onChange={handleSearchInput} 
                  onKeyDown={(e) => { if(e.key === 'Enter') handleApply() }} autoFocus />
                {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={12}/></button>}
              </div>
              {searchTerm && (
                <div onClick={() => setIsAddToSelectionMode(!isAddToSelectionMode)} className="flex items-center gap-2 px-1 cursor-pointer select-none">
                  <div className={`w-3 h-3 rounded border flex items-center justify-center ${isAddToSelectionMode ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                    {isAddToSelectionMode && <Check size={8} className="text-white"/>}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Tambahkan ke pilihan saat ini</span>
                </div>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-1">
              <div onClick={handleSelectAllClick} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-bold text-blue-600 dark:text-blue-400 select-none">
                <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelectAllChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                  {isSelectAllChecked && <Check size={8} className="text-white"/>}
                </div>
                {searchTerm ? '(Pilih Hasil Pencarian)' : '(Pilih Semua)'}
              </div>
              {filteredOptions.length ? filteredOptions.map((option: any) => { 
                const isSelected = temporarySelected.includes(option.value)
                return (
                  <div key={option.value || 'empty'} onClick={() => toggleOption(option.value)} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs transition-colors select-none">
                    <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <Check size={8} className="text-white"/>}
                    </div>
                    <span className={`${isSelected ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'} ${option.value === "" ? 'italic text-red-500 dark:text-red-400' : ''}`}>{option.label}</span>
                  </div>
                )
              }) : <div className="px-3 py-4 text-center text-xs text-slate-400 italic">Nihil</div>}
            </div>
            <div className="shrink-0 p-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-slate-400">{temporarySelected.length} terpilih</span>
              <div className="flex gap-2">
                <button onClick={() => setIsOpen(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Batal</button>
                <button onClick={handleApply} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors">Terapkan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// CHART COMPONENTS
// ==========================================

const DONUT_COLORS = ['#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#eab308', '#ec4899']
const DONUT_COLORS_DARK = ['#38bdf8', '#fb923c', '#34d399', '#a78bfa', '#f87171', '#facc15', '#f472b6']

const DonutChart = ({ data, title, isDark }: { data: { name: string; value: number }[]; title: string; isDark: boolean }) => {
  const colors = isDark ? DONUT_COLORS_DARK : DONUT_COLORS
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>
  }
  return (
    <div className="flex flex-col items-center">
      <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</h4>
      <div className="w-28 h-28">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={48} labelLine={false} label={renderLabel} strokeWidth={1} stroke={isDark ? '#1e293b' : '#fff'}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString('id-ID') : String(v ?? '')} contentStyle={{ fontSize: 10, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1 text-[9px] text-slate-600 dark:text-slate-400">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const LeadTimeCard = ({ title, data, isDark }: { title: string; data: { month: string; on_time: number; delay: number }[]; isDark: boolean }) => {
  const totalOnTime = data.reduce((s, d) => s + d.on_time, 0)
  const totalDelay = data.reduce((s, d) => s + d.delay, 0)
  const total = totalOnTime + totalDelay
  const onTimePct = total > 0 ? Math.round((totalOnTime / total) * 100) : 0
  const delayPct = total > 0 ? 100 - onTimePct : 0
  const chartData = data.map(d => {
    const t = d.on_time + d.delay
    return { month: MONTH_SHORT[d.month] || d.month, on_time_pct: t > 0 ? +((d.on_time / t) * 100).toFixed(1) : 0, delay_pct: t > 0 ? +((d.delay / t) * 100).toFixed(1) : 0, on_time: d.on_time, delay: d.delay }
  })
  const donutData = [{ name: 'On Time', value: totalOnTime }, { name: 'Delay', value: totalDelay }]
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-col">
      <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2 truncate">{title}</h4>
      <div className="flex gap-2 flex-1">
        <div className="flex-1 h-36">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
              <XAxis dataKey="month" tick={{ fontSize: 8, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={30} />
              <YAxis tick={{ fontSize: 8, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null; const row = payload[0]?.payload
                return (<div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-700 rounded shadow-lg text-[10px]"><div className="font-bold mb-1">{label}</div><div className="text-green-800">On Time: {row?.on_time} ({row?.on_time_pct}%)</div><div className="text-red-700">Delay: {row?.delay} ({row?.delay_pct}%)</div></div>)
              }} />
              <Bar dataKey="on_time_pct" stackId="a" fill={isDark ? COLORS.onTimeDark : COLORS.onTime} />
              <Bar dataKey="delay_pct" stackId="a" fill={isDark ? COLORS.delayDark : COLORS.delay} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-20 h-36 flex flex-col items-center justify-center">
          <div className="w-16 h-16">
            <ResponsiveContainer><PieChart><Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={14} outerRadius={28} strokeWidth={1} stroke={isDark ? '#1e293b' : '#fff'}><Cell fill={isDark ? COLORS.onTimeDark : COLORS.onTime} /><Cell fill={isDark ? COLORS.delayDark : COLORS.delay} /></Pie></PieChart></ResponsiveContainer>
          </div>
          <div className="text-center mt-1 space-y-0.5">
            <div className="text-[8px] text-green-800 dark:text-green-500 font-bold">{onTimePct}% On Time</div>
            <div className="text-[8px] text-red-700 dark:text-red-500 font-bold">{delayPct}% Delay</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

export default function OtifDashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  ), [])
  const { theme, setTheme } = useTheme()
  
  // STATE
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [userBaAccess, setUserBaAccess] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  // RAW DATA
  const [rawData, setRawData] = useState<OtifRow[]>([])
  const initialOptionsLoaded = useRef(false)

  const [allFilterOptions, setAllFilterOptions] = useState<{
    sheetSources: any[], plants: any[], pssNames: any[], customerGroups: any[],
    customerNames: any[], products: any[], monthInvoices: any[], fillRates: any[], categoriRanks: any[], years: any[]
  }>({
    sheetSources: [], plants: [], pssNames: [], customerGroups: [],
    customerNames: [], products: [], monthInvoices: [], fillRates: [], categoriRanks: [], years: []
  })

  // FILTERS
  const [selectedSheetSources, setSelectedSheetSources] = useState(['All'])
  const [selectedPlants, setSelectedPlants] = useState(['All'])
  const [selectedPSSNames, setSelectedPSSNames] = useState(['All'])
  const [selectedCustomerGroups, setSelectedCustomerGroups] = useState(['All'])
  const [selectedCustomerNames, setSelectedCustomerNames] = useState(['All'])
  const [selectedProducts, setSelectedProducts] = useState(['All'])
  const [selectedMonthInvoices, setSelectedMonthInvoices] = useState(['All'])
  const [selectedFillRates, setSelectedFillRates] = useState(['All'])
  const [selectedCategoriRanks, setSelectedCategoriRanks] = useState(['All'])
  const [selectedYears, setSelectedYears] = useState(['All'])

  // COMPUTED
  const isDarkMode = isMounted && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))

  // AUTH CHECK
  useEffect(() => {
    const checkAuth = async () => {
      setIsAuthChecking(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('akses').eq('user_id', user.id).single()
      if (profile) setUserRole(profile.akses)
      if (profile?.akses === 'CUSTOMER') { router.push('/'); return }
      const superRoles = ['ADMIN', 'HO', 'MANAGEMENT', 'PUSAT']
      if (profile?.akses && !superRoles.includes(profile.akses)) setUserBaAccess(profile.akses)
      setIsAuthChecking(false)
      setIsMounted(true)
    }
    checkAuth()
    const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false) }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ==========================================
  // FETCH DATA (client-side, no RPC)
  // ==========================================
  const fetchData = useCallback(async () => {
    if (isAuthChecking) return
    setIsLoading(true)
    try {
      // === 1. Jika belum pernah load options, fetch ALL data tanpa filter untuk opsi dropdown ===
      if (!initialOptionsLoaded.current) {
        const { data: allData, error: allErr } = await supabase.from('otif_data').select('*').limit(200000)
        if (!allErr && allData) {
          const us = (key: string) => [...new Set(allData.map((d: any) => d[key]))].filter(v => v != null && String(v).trim() !== '').sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true }))
          const yearSet = [...new Set(allData.map((d: any) => getYear(d as OtifRow)))].filter(v => v !== '').sort()
          setAllFilterOptions({
            sheetSources: us('sheet_source'),
            plants: us('plant'),
            pssNames: us('pss_name'),
            customerGroups: us('customer_group'),
            customerNames: us('customer_name'),
            products: us('product'),
            monthInvoices: us('month_invoice').sort((a: any, b: any) => (MONTH_ORDER[String(a)] || 99) - (MONTH_ORDER[String(b)] || 99)),
            fillRates: us('fill_rate'),
            categoriRanks: us('categori_rank'),
            years: yearSet,
          })
          initialOptionsLoaded.current = true
        }
      }

      // === 2. Fetch data DENGAN filter untuk dashboard ===
      let query = supabase.from('otif_data').select('*')
      if (!selectedSheetSources.includes('All') && selectedSheetSources.length > 0) query = query.in('sheet_source', selectedSheetSources)
      if (!selectedPlants.includes('All') && selectedPlants.length > 0) query = query.in('plant', selectedPlants)
      if (!selectedPSSNames.includes('All') && selectedPSSNames.length > 0) query = query.in('pss_name', selectedPSSNames)
      if (!selectedCustomerGroups.includes('All') && selectedCustomerGroups.length > 0) query = query.in('customer_group', selectedCustomerGroups)
      if (!selectedCustomerNames.includes('All') && selectedCustomerNames.length > 0) query = query.in('customer_name', selectedCustomerNames)
      if (!selectedProducts.includes('All') && selectedProducts.length > 0) query = query.in('product', selectedProducts)
      if (!selectedMonthInvoices.includes('All') && selectedMonthInvoices.length > 0) query = query.in('month_invoice', selectedMonthInvoices)
      if (!selectedFillRates.includes('All') && selectedFillRates.length > 0) query = query.in('fill_rate', selectedFillRates)
      if (!selectedCategoriRanks.includes('All') && selectedCategoriRanks.length > 0) query = query.in('categori_rank', selectedCategoriRanks)

      const { data: fd, error } = await query.limit(200000)
      if (error || !fd) { console.error(error); return }

      // Year filter client-side (computed from year_sap / year)
      let filtered = fd as OtifRow[]
      if (!selectedYears.includes('All') && selectedYears.length > 0) {
        filtered = filtered.filter(r => selectedYears.includes(getYear(r)))
      }
      setRawData(filtered)
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }, [selectedSheetSources, selectedPlants, selectedPSSNames, selectedCustomerGroups, selectedCustomerNames, selectedProducts, selectedMonthInvoices, selectedFillRates, selectedCategoriRanks, selectedYears, supabase, isAuthChecking])

  useEffect(() => { if (!isAuthChecking) fetchData() }, [fetchData, isAuthChecking])

  // ==========================================
  // CASCADED FILTER OPTIONS (from filtered rawData)
  // ==========================================
  const cascadedFilterOptions = useMemo(() => {
    if (rawData.length === 0) return allFilterOptions
    const us = (key: string) => [...new Set(rawData.map((d: any) => d[key]))].filter(v => v != null && String(v).trim() !== '').sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    const yearSet = [...new Set(rawData.map(d => getYear(d)))].filter(v => v !== '').sort()
    return {
      sheetSources: us('sheet_source'),
      plants: us('plant'),
      pssNames: us('pss_name'),
      customerGroups: us('customer_group'),
      customerNames: us('customer_name'),
      products: us('product'),
      monthInvoices: us('month_invoice').sort((a: any, b: any) => (MONTH_ORDER[String(a)] || 99) - (MONTH_ORDER[String(b)] || 99)),
      fillRates: us('fill_rate'),
      categoriRanks: us('categori_rank'),
      years: yearSet,
    }
  }, [rawData, allFilterOptions])

  // Per-filter: jika filter aktif (non-All) → tampilkan SEMUA opsi (allFilterOptions)
  //             jika filter All → tampilkan hanya opsi dari data terfilter (cascaded)
  const displayFilterOptions = useMemo(() => ({
    sheetSources:   !selectedSheetSources.includes('All')   ? allFilterOptions.sheetSources   : cascadedFilterOptions.sheetSources,
    plants:         !selectedPlants.includes('All')         ? allFilterOptions.plants         : cascadedFilterOptions.plants,
    pssNames:       !selectedPSSNames.includes('All')       ? allFilterOptions.pssNames       : cascadedFilterOptions.pssNames,
    customerGroups: !selectedCustomerGroups.includes('All') ? allFilterOptions.customerGroups : cascadedFilterOptions.customerGroups,
    customerNames:  !selectedCustomerNames.includes('All')  ? allFilterOptions.customerNames  : cascadedFilterOptions.customerNames,
    products:       !selectedProducts.includes('All')       ? allFilterOptions.products       : cascadedFilterOptions.products,
    monthInvoices:  !selectedMonthInvoices.includes('All')  ? allFilterOptions.monthInvoices  : cascadedFilterOptions.monthInvoices,
    fillRates:      !selectedFillRates.includes('All')      ? allFilterOptions.fillRates      : cascadedFilterOptions.fillRates,
    categoriRanks:  !selectedCategoriRanks.includes('All')  ? allFilterOptions.categoriRanks  : cascadedFilterOptions.categoriRanks,
    years:          !selectedYears.includes('All')          ? allFilterOptions.years          : cascadedFilterOptions.years,
  }), [allFilterOptions, cascadedFilterOptions, selectedSheetSources, selectedPlants, selectedPSSNames, selectedCustomerGroups, selectedCustomerNames, selectedProducts, selectedMonthInvoices, selectedFillRates, selectedCategoriRanks, selectedYears])

  // ==========================================
  // DERIVED DATA
  // ==========================================

  /** OTIF-related charts: Full Supply (case-insensitive) + PAMA rows dgn adj kosong */
  const otifData = useMemo(() => rawData.filter(r => {
    const adj = (r.adjustment_outstanding || '').trim().toLowerCase()
    if (adj === 'full supply') return true
    // PAMA sering tidak punya adjustment_outstanding → tetap masuk otifData
    if (r.sheet_source === 'PAMA' && adj === '') return true
    return false
  }), [rawData])

  /** Aging PO detail: yang OS (bukan Full Supply, bukan kosong) */
  const agingDetailData = useMemo(() => rawData.filter(r => {
    const adj = (r.adjustment_outstanding || '').trim()
    return adj !== '' && adj.toLowerCase() !== 'full supply'
  }), [rawData])

  // 1. TOTAL PO — pakai field `month`
  const totalPOData = useMemo(() => {
    const map: Record<string, number> = {}
    rawData.forEach(r => { const m = r.month; if (m) map[m] = (map[m] || 0) + 1 })
    return sortByMonth(Object.entries(map).map(([month, total]) => ({ month, name: MONTH_SHORT[month] || month, total })))
  }, [rawData])

  // 2. OTIF Summary donut — dari otifData
  const otifDonut = useMemo(() => {
    const map: Record<string, number> = {}
    otifData.forEach(r => { const s = r.otif || 'N/A'; map[s] = (map[s] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [otifData])

  // 3. Fill Rate donut — dari semua data (tidak filter Full Supply)
  const fillRateDonut = useMemo(() => {
    const map: Record<string, number> = {}
    rawData.forEach(r => { const s = r.fill_rate || 'N/A'; map[s] = (map[s] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [rawData])

  // 4. Rank Product donut — dari semua data (tidak filter Full Supply)
  const rankProductDonut = useMemo(() => {
    const map: Record<string, number> = {}
    rawData.forEach(r => { const s = r.categori_rank || 'N/A'; map[s] = (map[s] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [rawData])

  // 5. OTIF Monthly — pakai month_invoice (PAMA pakai month)
  const otifMonthly = useMemo(() => {
    const map: Record<string, { on_time: number; delay: number }> = {}
    otifData.forEach(r => {
      const m = getMonthInv(r); if (!m) return
      if (!map[m]) map[m] = { on_time: 0, delay: 0 }
      const v = (r.otif || '').trim().toLowerCase()
      if (v === 'on time') map[m].on_time++; else if (v === 'delay') map[m].delay++
    })
    return sortByMonth(Object.entries(map).map(([month, d]) => {
      const total = d.on_time + d.delay
      return { month, name: MONTH_SHORT[month] || month, on_time_pct: total > 0 ? +((d.on_time / total) * 100).toFixed(1) : 0, delay_pct: total > 0 ? +((d.delay / total) * 100).toFixed(1) : 0, on_time_raw: d.on_time, delay_raw: d.delay }
    }))
  }, [otifData])

  // 6. Lead Time — pakai month_invoice (PAMA pakai month) — semua data, tidak filter Full Supply
  const leadTimeData = useMemo(() => {
    const result: Record<string, { month: string; on_time: number; delay: number }[]> = {}
    Object.keys(LEAD_TIME_LABELS).forEach(key => {
      const map: Record<string, { on_time: number; delay: number }> = {}
      rawData.forEach(r => {
        const m = getMonthInv(r); if (!m) return
        if (!map[m]) map[m] = { on_time: 0, delay: 0 }
        const v = ((r as any)[key] || '').trim().toUpperCase()
        if (v === 'ON TIME') map[m].on_time++; else if (v === 'DELAY') map[m].delay++
      })
      result[key] = sortByMonth(Object.entries(map).map(([month, d]) => ({ month, ...d })))
    })
    return result
  }, [rawData])

  // 7. Performance Monthly — pakai field `month` — semua data, tidak filter Full Supply
  const performanceMonthly = useMemo(() => {
    const map: Record<string, { on_time: number; delay: number }> = {}
    rawData.forEach(r => {
      const raw = (r.month || '').trim()
      const m = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : ''
      if (!m) return
      if (!map[m]) map[m] = { on_time: 0, delay: 0 }
      const v = (r.performance || '').trim().toLowerCase()
      if (v === 'on time') map[m].on_time++; else if (v === 'delay') map[m].delay++
    })
    return sortByMonth(Object.entries(map).map(([month, d]) => {
      const total = d.on_time + d.delay
      return { month, name: MONTH_SHORT[month] || month, on_time_pct: total > 0 ? +((d.on_time / total) * 100).toFixed(1) : 0, delay_pct: total > 0 ? +((d.delay / total) * 100).toFixed(1) : 0, on_time_raw: d.on_time, delay_raw: d.delay }
    }))
  }, [rawData])

  // 7b. Performance Donut — total On Time vs Delay — semua data
  const performanceDonut = useMemo(() => {
    let on_time = 0, delay = 0
    rawData.forEach(r => {
      const v = (r.performance || '').trim().toLowerCase()
      if (v === 'on time') on_time++; else if (v === 'delay') delay++
    })
    const total = on_time + delay
    const onTimePct = total > 0 ? Math.round((on_time / total) * 100) : 0
    return { data: [{ name: 'On Time', value: on_time }, { name: 'Delay', value: delay }], on_time, delay, onTimePct, delayPct: total > 0 ? 100 - onTimePct : 0 }
  }, [rawData])

  // 8. Aging PO summary chart
  const agingData = useMemo(() => {
    const map: Record<string, number> = {}
    rawData.forEach(r => { const s = (r.remaks_aging_po || '').trim(); if (s) map[s] = (map[s] || 0) + 1 })
    const entries = Object.entries(map).map(([name, total]) => ({ name, total, value: total }))
    return { bar: entries, donut: entries }
  }, [rawData])

  const grandTotalPO = totalPOData.reduce((s, d) => s + d.total, 0)

  // DEBUG PAMA: buka F12 → Console, filter "[OTIF]" — hapus setelah fix
  useEffect(() => {
    const pamaAll = rawData.filter(r => r.sheet_source === 'PAMA')
    if (pamaAll.length > 0) {
      const adjVals = [...new Set(pamaAll.map(r => `"${r.adjustment_outstanding}"`))].slice(0, 15)
      const otifVals = [...new Set(pamaAll.map(r => `"${r.otif}"`))].slice(0, 10)
      const monthVals = [...new Set(pamaAll.map(r => `"${r.month}"`))].slice(0, 15)
      const monthInvVals = [...new Set(pamaAll.map(r => `"${r.month_invoice}"`))].slice(0, 10)
      const perfVals = [...new Set(pamaAll.map(r => `"${r.performance}"`))].slice(0, 10)
      const pamaInOtif = otifData.filter(r => r.sheet_source === 'PAMA').length
      console.log(`[OTIF] PAMA: ${pamaAll.length} rows total, ${pamaInOtif} masuk otifData`)
      console.log('[OTIF] PAMA adjustment_outstanding:', adjVals.join(', '))
      console.log('[OTIF] PAMA otif:', otifVals.join(', '))
      console.log('[OTIF] PAMA month:', monthVals.join(', '))
      console.log('[OTIF] PAMA month_invoice:', monthInvVals.join(', '))
      console.log('[OTIF] PAMA performance:', perfVals.join(', '))
    }
  }, [rawData, otifData])

  // ==========================================
  // EXPORT AGING DETAIL → Excel
  // ==========================================
  const handleExportAgingDetail = async () => {
    if (agingDetailData.length === 0) return
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Aging PO Detail')
    ws.columns = [
      { header: 'Customer Name', key: 'customer_name', width: 35 },
      { header: 'Customer Code', key: 'customer_code', width: 15 },
      { header: 'Customer Group', key: 'customer_group', width: 20 },
      { header: 'Sheet Source', key: 'sheet_source', width: 14 },
      { header: 'Product', key: 'product', width: 18 },
      { header: 'Material No', key: 'material_no', width: 22 },
      { header: 'Plant', key: 'plant', width: 8 },
      { header: 'PSS Name', key: 'pss_name', width: 28 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Month Invoice', key: 'month_invoice', width: 14 },
      { header: 'Year', key: 'year_display', width: 8 },
      { header: 'Fill Rate', key: 'fill_rate', width: 15 },
      { header: 'Categori Rank', key: 'categori_rank', width: 16 },
      { header: 'Performance', key: 'performance', width: 13 },
      { header: 'OTIF', key: 'otif', width: 10 },
      { header: 'Adj Outstanding', key: 'adjustment_outstanding', width: 18 },
      { header: 'Remaks Aging PO', key: 'remaks_aging_po', width: 20 },
    ]
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    agingDetailData.forEach(r => ws.addRow({ ...r, year_display: getYear(r) }))
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Aging_PO_Detail_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ========== RENDER ==========

  if (isAuthChecking) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-slate-500 text-xs">Memeriksa Hak Akses...</span>
      </div>
    </div>
  )

  const renderLoadingOverlay = (msg: string) => (
    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl">
      {isRefreshing
        ? <><RefreshCw className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500">Updating Database...</span></>
        : <><Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-500">{msg}</span></>
      }
    </div>
  )

  const selectedTitle = selectedSheetSources.includes('All') 
    ? 'ALL CUSTOMER GROUP' 
    : selectedSheetSources.join(', ')

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-2 md:p-6 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-400 mx-auto space-y-4">

        {/* ============================================ */}
        {/* HEADER & FILTERS                            */}
        {/* ============================================ */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 relative z-50 transition-colors">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/> OTIF Dashboard
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                On Time In Full — Monitoring Lead Time, Performance & Delivery
              </p>
            </div>
            
            <div className="flex items-center gap-2 relative">
              <button onClick={fetchData} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800" title="Refresh Data">
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/>
              </button>
              
              <div className="relative" ref={menuRef}>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-full transition-colors ${isMenuOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <MoreVertical size={20} className="text-slate-600 dark:text-slate-300"/>
                </button>
                {isMenuOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm md:absolute md:inset-auto md:top-full md:right-0 md:p-0 md:bg-transparent md:backdrop-blur-none md:block md:mt-2">
                    <div className="absolute inset-0 md:hidden" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="relative w-full max-w-xs md:w-64 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 md:hidden bg-slate-50 dark:bg-slate-800/50">
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Menu Opsi</span>
                        <button onClick={() => setIsMenuOpen(false)} className="p-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 hover:text-red-500"><X size={16}/></button>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 p-2 flex justify-between bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center h-full">Tema</div>
                        <div className="flex bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-0.5">
                          {['light', 'dark', 'system'].map((m: any) => (
                            <button key={m} onClick={() => setTheme(m)} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${theme === m ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400'}`}>
                              {m === 'light' ? <Sun size={12}/> : m === 'dark' ? <Moon size={12}/> : <Laptop size={12}/>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Navigasi</div>
                        <button onClick={() => router.push('/sales-issues')} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                          <FileWarning size={14} className="text-red-400"/> <span>Input Keluhan Baru</span>
                        </button>
                        <button onClick={() => router.push('/summary')} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors">
                          <LayoutList size={14} className="text-emerald-500"/> <span>Lihat Summary</span>
                        </button>
                        <button onClick={() => router.push('/sales')} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors">
                          <LayoutGrid size={14} className="text-blue-500"/> <span>Sales Analytics</span>
                        </button>
                        <button onClick={() => router.push('/actual-vs-plan')} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors mb-0.5">
                          <BarChart3 size={14} className="text-orange-500"/> <span>Actual vs Plan</span>
                        </button>
                      </div>
                      <div className="p-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">System</div>
                        <button onClick={() => router.push('/')} className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded transition-colors">
                          <LogOut size={14} className="text-blue-500"/> <span>Menu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* FILTER SECTION */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full max-w-3xl">
              <MultiSelect label="Customer Group" options={displayFilterOptions.sheetSources} selectedValues={selectedSheetSources} onChange={setSelectedSheetSources} />
              <MultiSelect label="Plant" options={displayFilterOptions.plants} selectedValues={selectedPlants} onChange={setSelectedPlants} />
              <MultiSelect label="PSS Name" options={displayFilterOptions.pssNames} selectedValues={selectedPSSNames} onChange={setSelectedPSSNames} />
              <MultiSelect label="Customer Name" options={displayFilterOptions.customerNames} selectedValues={selectedCustomerNames} onChange={setSelectedCustomerNames} />
              <MultiSelect label="Product" options={displayFilterOptions.products} selectedValues={selectedProducts} onChange={setSelectedProducts} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full max-w-3xl">
              <MultiSelect label="Year" options={displayFilterOptions.years} selectedValues={selectedYears} onChange={setSelectedYears} />
              <MultiSelect label="Month Invoice" options={displayFilterOptions.monthInvoices} selectedValues={selectedMonthInvoices} onChange={setSelectedMonthInvoices} />
              <MultiSelect label="Fill Rate" options={displayFilterOptions.fillRates} selectedValues={selectedFillRates} onChange={setSelectedFillRates} />
              <MultiSelect label="Categori Rank" options={displayFilterOptions.categoriRanks} selectedValues={selectedCategoriRanks} onChange={setSelectedCategoriRanks} />
              <MultiSelect label="Cust. Group (DB)" options={displayFilterOptions.customerGroups} selectedValues={selectedCustomerGroups} onChange={setSelectedCustomerGroups} />
            </div>
          </div>
        </div>

        {/* TITLE BANNER */}
        <div className="bg-linear-to-r from-sky-700 to-sky-900 dark:from-sky-800 dark:to-slate-900 rounded-xl p-4 text-center shadow-md">
          <h2 className="text-xl md:text-2xl font-black text-white tracking-wider uppercase">{selectedTitle}</h2>
        </div>

        {/* ============================================ */}
        {/* ROW 1: TOTAL PO | OTIF | FILL RATE | RANK  */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative min-h-52">
            {isLoading && renderLoadingOverlay('')}
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-sky-600 dark:text-sky-400"/>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Total PO</span>
              <span className="ml-auto text-xs font-bold text-sky-600 dark:text-sky-400">{grandTotalPO.toLocaleString('id-ID')}</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer>
                <BarChart data={totalPOData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Bar dataKey="total" fill={isDarkMode ? COLORS.barDark : COLORS.bar} radius={[3, 3, 0, 0]} barSize={20}>
                    {totalPOData.map((_, i) => <Cell key={i} fill={isDarkMode ? COLORS.barDark : COLORS.bar} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="md:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative min-h-52">
            {isLoading && renderLoadingOverlay('')}
            <div className="grid grid-cols-3 gap-4 h-full items-center">
              <DonutChart data={otifDonut} title="OTIF" isDark={isDarkMode} />
              <DonutChart data={fillRateDonut} title="Fill Rate" isDark={isDarkMode} />
              <DonutChart data={rankProductDonut} title="Rank Product" isDark={isDarkMode} />
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* ROW 2: OTIF MONTHLY LINE CHART              */}
        {/* ============================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative min-h-72">
          {isLoading && renderLoadingOverlay('Memuat Chart...')}
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-sky-600 dark:text-sky-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">OTIF - Monthly Trend</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={otifMonthly} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0]?.payload
                  return (
                    <div className="bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg text-xs">
                      <div className="font-bold mb-1.5 text-slate-700 dark:text-slate-200">{label}</div>
                      <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isDarkMode ? COLORS.onTimeDark : COLORS.onTime }} />
                        On Time: {row?.on_time_pct}% <span className="text-slate-400">({row?.on_time_raw})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mt-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isDarkMode ? COLORS.delayDark : COLORS.delay }} />
                        Delay: {row?.delay_pct}% <span className="text-slate-400">({row?.delay_raw})</span>
                      </div>
                    </div>
                  )
                }} />
                <Legend verticalAlign="top" height={30} iconType="line" wrapperStyle={{ fontSize: 11 }} formatter={(value) => value === 'on_time_pct' ? 'On Time (%)' : 'Delay (%)'} />
                <Line type="monotone" dataKey="on_time_pct" name="on_time_pct" stroke={isDarkMode ? COLORS.onTimeDark : COLORS.onTime} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="delay_pct" name="delay_pct" stroke={isDarkMode ? COLORS.delayDark : COLORS.delay} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============================================ */}
        {/* ROW 3: LEAD TIME (8 charts in 4x2 grid)    */}
        {/* ============================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative">
          {isLoading && renderLoadingOverlay('Memuat Lead Time...')}
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-sky-600 dark:text-sky-400"/>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Lead Time</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {Object.entries(LEAD_TIME_LABELS).map(([key, label]) => (
              <LeadTimeCard key={key} title={label} data={leadTimeData[key] || []} isDark={isDarkMode} />
            ))}
          </div>
        </div>

        {/* ============================================ */}
        {/* ROW 4: PERFORMANCE (Bar Chart + Donut)      */}
        {/* ============================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative min-h-72">
          {isLoading && renderLoadingOverlay('Memuat Performance...')}
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-sky-600 dark:text-sky-400"/>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Performance - Monthly Trend</span>
          </div>
          <div className="flex gap-4">
            {/* Bar Chart */}
            <div className="flex-1 h-64">
              <ResponsiveContainer>
                <BarChart data={performanceMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload
                    return (
                      <div className="bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg text-xs">
                        <div className="font-bold mb-1.5 text-slate-700 dark:text-slate-200">{label}</div>
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isDarkMode ? COLORS.onTimeDark : COLORS.onTime }} />
                          On Time: {row?.on_time_pct}% <span className="text-slate-400">({row?.on_time_raw})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mt-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isDarkMode ? COLORS.delayDark : COLORS.delay }} />
                          Delay: {row?.delay_pct}% <span className="text-slate-400">({row?.delay_raw})</span>
                        </div>
                      </div>
                    )
                  }} />
                  <Legend verticalAlign="top" height={30} iconType="rect" wrapperStyle={{ fontSize: 11 }} formatter={(value) => value === 'on_time_pct' ? 'On Time (%)' : 'Delay (%)'} />
                  <Bar dataKey="on_time_pct" name="on_time_pct" fill={isDarkMode ? COLORS.onTimeDark : COLORS.onTime} barSize={28} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="delay_pct" name="delay_pct" fill={isDarkMode ? COLORS.delayDark : COLORS.delay} barSize={28} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Donut */}
            <div className="w-40 flex flex-col items-center justify-center shrink-0">
              <div className="w-28 h-28">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={performanceDonut.data} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={50} strokeWidth={1} stroke={isDarkMode ? '#1e293b' : '#fff'}>
                      <Cell fill={isDarkMode ? COLORS.onTimeDark : COLORS.onTime} />
                      <Cell fill={isDarkMode ? COLORS.delayDark : COLORS.delay} />
                    </Pie>
                    <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString('id-ID') : String(v ?? '')} contentStyle={{ fontSize: 10, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-2 space-y-1">
                <div className="text-xs text-green-700 dark:text-green-400 font-bold">{performanceDonut.onTimePct}% On Time</div>
                <div className="text-xs text-red-600 dark:text-red-400 font-bold">{performanceDonut.delayPct}% Delay</div>
                <div className="text-[10px] text-slate-400 mt-1">Total: {(performanceDonut.on_time + performanceDonut.delay).toLocaleString('id-ID')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* ROW 5: AGING PO CHART + OS SUMMARY          */}
        {/* ============================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AGING PO CHART */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative min-h-64">
            {isLoading && renderLoadingOverlay('')}
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500"/>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Aging PO</span>
            </div>
            <div className="flex gap-4 h-52">
              <div className="flex-1">
                <ResponsiveContainer>
                  <BarChart data={agingData.bar} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                    <Bar dataKey="total" fill={isDarkMode ? COLORS.barDark : COLORS.bar} radius={[3, 3, 0, 0]} barSize={32}>
                      {agingData.bar.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="w-36">
                <DonutChart data={agingData.donut} title="" isDark={isDarkMode} />
              </div>
            </div>
          </div>

          {/* OS SUMMARY CARD (replaces Overdue PO) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 relative min-h-64 flex flex-col items-center justify-center">
            {isLoading && renderLoadingOverlay('')}
            <div className="text-center space-y-3">
              <AlertTriangle size={36} className="text-orange-500 mx-auto"/>
              <div className="text-4xl font-black text-slate-800 dark:text-white">{agingDetailData.length.toLocaleString('id-ID')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Outstanding PO (OS)</div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-52 mx-auto leading-relaxed">Data yang belum Full Supply. Lihat detail tabel di bawah untuk info lengkap.</p>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* ROW 6: DETAIL REMAKS AGING PO TABLE          */}
        {/* Scrollable 4-arah, independent, downloadable */}
        {/* ============================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[55vh] md:h-[65vh] relative z-20 transition-colors">
          {isLoading && renderLoadingOverlay('Memuat Detail Aging PO...')}

          {/* Table Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-orange-500"/>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Detail Remaks Aging PO (Outstanding)</span>
              <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-bold">{agingDetailData.length.toLocaleString('id-ID')} rows</span>
            </div>
            <button onClick={handleExportAgingDetail} disabled={agingDetailData.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-md shadow-sm transition-colors active:scale-95" title="Download Excel">
              <Download size={14}/> Download Excel
            </button>
          </div>

          {/* Scrollable Table — drag all 4 directions */}
          <div className="overflow-auto flex-1 relative w-full">
            <div className="min-w-full inline-block align-top">
              <table className="w-full border-collapse text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 z-20 shadow-sm">
                  <tr>
                    {['#', 'Customer Name', 'Cust Code', 'Cust Group', 'Product', 'Material No', 'Plant', 'PSS Name', 'Sheet Source', 'Month', 'Month Inv', 'Year', 'Fill Rate', 'Categori Rank', 'Performance', 'OTIF', 'Adj Outstanding', 'Remaks Aging PO'].map(h => (
                      <th key={h} className="p-2 text-left font-bold border-b border-slate-300 dark:border-slate-600 whitespace-nowrap bg-slate-100 dark:bg-slate-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {agingDetailData.length > 0 ? agingDetailData.slice(0, 5000).map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <td className="p-1.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                      <td className="p-1.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{r.customer_name}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.customer_code}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.customer_group}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.product}</td>
                      <td className="p-1.5 whitespace-nowrap font-mono">{r.material_no}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.plant}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.pss_name}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.sheet_source}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.month}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.month_invoice}</td>
                      <td className="p-1.5 whitespace-nowrap">{getYear(r)}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.fill_rate}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.categori_rank}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.performance}</td>
                      <td className="p-1.5 whitespace-nowrap">{r.otif}</td>
                      <td className="p-1.5 whitespace-nowrap text-orange-600 dark:text-orange-400 font-medium">{r.adjustment_outstanding}</td>
                      <td className="p-1.5 whitespace-nowrap font-medium">{r.remaks_aging_po}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={18} className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Filter size={24} className="mx-auto mb-2"/>Data tidak ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}