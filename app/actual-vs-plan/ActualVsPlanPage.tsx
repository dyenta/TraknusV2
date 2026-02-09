'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { 
  RefreshCw, Filter, ArrowUp, ArrowDown, ChevronDown, 
  BarChart3, Download, TrendingUp, AlertCircle, Search
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

// --- TYPES ---
interface PlanData {
  business_area: string
  pss: string
  product: string
  cust_name: string
  month: number
  plan_amount: number
  actual_amount: number
  variance: number
  achievement_percentage: number
}

// --- HELPER FORMATTING ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ActualVsPlanPage() {
  const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    )

  // --- STATE ---
  const [data, setData] = useState<PlanData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters State
  // Default month ke bulan saat ini (0-11) + 1 karena di DB 1-12
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1))
  const [selectedArea, setSelectedArea] = useState('All')
  const [selectedPSS, setSelectedPSS] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  // Unique Options for Dropdowns (bisa di-fetch terpisah atau derived dari data)
  const [areaOptions, setAreaOptions] = useState<string[]>([])
  const [pssOptions, setPssOptions] = useState<string[]>([])

  // --- FETCH DATA VIA RPC ---
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Pastikan konversi tipe data aman
      const monthParam = selectedMonth === 'All' ? null : parseInt(selectedMonth);
      
      const params = {
        p_month: isNaN(monthParam!) ? null : monthParam, // Handle jika parseInt gagal
        p_business_area: selectedArea === 'All' ? null : selectedArea,
        p_pss: selectedPSS === 'All' ? null : selectedPSS,
        p_search_text: !searchTerm ? null : searchTerm // Handle empty string
      }

      // console.log("Fetching RPC with params:", params) // Uncomment untuk debug params

      const { data: result, error } = await supabase.rpc('get_actual_vs_plan', params)

      if (error) {
        // Tampilkan error lengkap ke console
        console.error('Supabase RPC Error:', JSON.stringify(error, null, 2))
        throw error
      }

      if (result) {
        setData(result)
        
        if (selectedArea === 'All' && selectedPSS === 'All' && result.length > 0) {
            const uniqueAreas = Array.from(new Set(result.map((item: any) => item.business_area))).filter(Boolean) as string[]
            const uniquePSS = Array.from(new Set(result.map((item: any) => item.pss))).filter(Boolean) as string[]
            setAreaOptions(uniqueAreas.sort())
            setPssOptions(uniquePSS.sort())
        }
      }
    } catch (err: any) {
      // Fallback error logging
      console.error('Error fetching plan vs actual:', err.message || err)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedArea, selectedPSS, searchTerm, supabase])

  // Initial Fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- CALCULATIONS FOR SUMMARY CARDS ---
  const summary = React.useMemo(() => {
    const totalPlan = data.reduce((sum, item) => sum + (item.plan_amount || 0), 0)
    const totalActual = data.reduce((sum, item) => sum + (item.actual_amount || 0), 0)
    const variance = totalActual - totalPlan
    const ach = totalPlan === 0 ? 0 : (totalActual / totalPlan) * 100

    return { totalPlan, totalActual, variance, ach }
  }, [data])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Actual vs Plan Analysis (2026)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Membandingkan performa aktual penjualan terhadap target yang ditetapkan.
            </p>
          </div>
          <div className="flex gap-2">
             <button 
              onClick={fetchData}
              className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Month Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Bulan</label>
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="All">All Months</option>
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Business Area Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Business Area</label>
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                >
                  <option value="All">All Areas</option>
                  {areaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* PSS Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">PSS</label>
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedPSS}
                  onChange={(e) => setSelectedPSS(e.target.value)}
                >
                  <option value="All">All PSS</option>
                  {pssOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Search */}
             <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Search</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Cust Name / Product..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500 mb-2">Total Plan</h3>
            <p className="text-2xl font-bold">{formatNumber(summary.totalPlan)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <h3 className="text-sm font-medium text-slate-500 mb-2">Total Actual</h3>
             <p className={`text-2xl font-bold ${summary.totalActual >= summary.totalPlan ? 'text-green-600' : 'text-slate-900 dark:text-slate-100'}`}>
                {formatNumber(summary.totalActual)}
             </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <h3 className="text-sm font-medium text-slate-500 mb-2">Variance</h3>
             <div className="flex items-end gap-2">
                <p className={`text-2xl font-bold ${summary.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.variance > 0 ? '+' : ''}{formatNumber(summary.variance)}
                </p>
             </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <h3 className="text-sm font-medium text-slate-500 mb-2">Achievement</h3>
             <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${summary.ach >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.ach.toFixed(1)}%
                </p>
                {summary.ach >= 100 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
             </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-3 font-medium">Month</th>
                            <th className="px-6 py-3 font-medium">Area / PSS</th>
                            <th className="px-6 py-3 font-medium">Customer / Product</th>
                            <th className="px-6 py-3 font-medium text-right">Plan</th>
                            <th className="px-6 py-3 font-medium text-right">Actual</th>
                            <th className="px-6 py-3 font-medium text-right">Var</th>
                            <th className="px-6 py-3 font-medium text-center">% Ach</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex justify-center items-center gap-2">
                                        <RefreshCw className="animate-spin w-5 h-5" />
                                        <span>Loading data...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length > 0 ? (
                            data.slice(0, 100).map((row, idx) => { // Limit 100 untuk render cepat
                                const isPositive = row.variance >= 0;
                                return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium whitespace-nowrap">
                                            {MONTH_NAMES[row.month - 1]}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-100">{row.business_area}</div>
                                            <div className="text-xs text-slate-500">{row.pss}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={row.cust_name}>
                                                {row.cust_name}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate max-w-[200px]" title={row.product}>
                                                {row.product}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">
                                            {formatNumber(row.plan_amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-medium">
                                            {formatNumber(row.actual_amount)}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                            {isPositive ? '+' : ''}{formatNumber(row.variance)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                                ${row.achievement_percentage >= 100 
                                                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                                                }`}>
                                                {row.achievement_percentage.toFixed(0)}%
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Filter className="w-8 h-8 text-slate-300" />
                                        <p>Tidak ada data yang cocok dengan filter.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex justify-between">
                <span>Total Data: {data.length} baris</span>
                <span>{data.length > 100 ? 'Menampilkan 100 data teratas' : 'Semua data ditampilkan'}</span>
            </div>
        </div>

      </div>
    </main>
  )
}