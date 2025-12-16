'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LayoutGrid, RefreshCcw, Filter, MinusSquare, PlusSquare, Database } from 'lucide-react'

// Local Imports (Colocated)
import { AggregatedRecord } from './analytics/types'
import { ROW_OPTIONS, MONTH_OPTIONS } from './analytics/constants'
import { usePivotLogic } from './analytics/usePivotLogic'
import { MultiSelect } from './analytics/MultiSelect'
import { YoYBadge } from './analytics/YoYBadge'
import { ControlBox } from './analytics/ControlBox'

export default function PivotPage() {
  // --- STATE ---
  const [data, setData] = useState<AggregatedRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  const [rowDimension, setRowDimension] = useState<string>('hierarchy_ba_pss')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({})

  const [selectedAreas, setSelectedAreas] = useState<string[]>(['All'])
  const [selectedYears, setSelectedYears] = useState<string[]>(['All'])
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['All']) 

  const [optionAreas, setOptionAreas] = useState<string[]>([])
  const [optionYears, setOptionYears] = useState<string[]>([])

  // --- CUSTOM HOOK LOGIC ---
  const { pivotData, visibleRows, getHeaderInfo } = usePivotLogic({
    data, rowDimension, expandedCols, expandedRows
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
  }, [rowDimension, selectedYears, selectedAreas, selectedMonths]) 

  useEffect(() => {
    setExpandedRows({})
  }, [rowDimension])

  const fetchAggregatedData = async () => {
    setLoading(true)
    try {
      let monthInts: number[] = []
      if (!selectedMonths.includes('All')) {
        monthInts = selectedMonths.map(m => parseInt(m))
      }

      const { data: rpcData, error } = await supabase.rpc('get_sales_analytics', {
        mode_input: rowDimension,
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
    if(!confirm("Apakah Anda yakin ingin memperbarui data? Proses ini akan menghitung ulang data dari Master.")) return;
    setIsRefreshing(true)
    try {
      const { error } = await supabase.rpc('refresh_sales_data')
      if (error) throw error
      await fetchAggregatedData()
      alert('Data berhasil diperbarui!')
    } catch (err: any) {
      console.error('Refresh DB Error:', err.message)
      alert('Gagal memperbarui data database.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleCol = (year: string) => setExpandedCols(prev => ({ ...prev, [year]: !prev[year] }))
  const fmt = (n: number) => n ? n.toLocaleString('id-ID') : '-'

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800">
      <div className="max-w-475 mx-auto space-y-5">
        
        {/* HEADER SECTION */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4 z-50 relative">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <LayoutGrid className="text-blue-600" size={24} /> 
                Sales Analytics
            </h1>
            <p className="text-xs text-slate-400 mt-1 ml-8">Data Actual • Materialized View</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
             <MultiSelect label="Area" options={optionAreas} selected={selectedAreas} onChange={setSelectedAreas} />
             <div className="w-px h-6 bg-slate-200 mx-1"></div>
             <MultiSelect label="Tahun" options={optionYears} selected={selectedYears} onChange={setSelectedYears} />
             <MultiSelect label="Bulan" optionsRaw={MONTH_OPTIONS} selected={selectedMonths} onChange={setSelectedMonths} />

             <button onClick={fetchAggregatedData} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-100 shadow-sm transition-colors" title="Refresh Tampilan">
                <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
             </button>

             <button 
                onClick={handleRefreshDatabase} 
                disabled={isRefreshing || loading}
                className="ml-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
             >
                <Database size={14} className={isRefreshing ? "animate-pulse" : ""} />
                {isRefreshing ? 'Updating DB...' : 'Update Data Baru'}
             </button>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-4 relative z-40">
           <ControlBox label="TAMPILAN BARIS" value={rowDimension} onChange={setRowDimension} options={ROW_OPTIONS} color="blue" />
        </div>

        {/* TABLE CONTAINER */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col h-[70vh] relative z-0">
          
          {(loading || isRefreshing) && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70">
                <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-100 flex flex-col items-center gap-2">
                    <RefreshCcw className="animate-spin text-blue-600" size={24} />
                    <span className="text-xs font-semibold text-slate-600">
                        {isRefreshing ? 'Sedang Memperbarui Database...' : 'Memuat Data...'}
                    </span>
                </div>
             </div>
          )}

          <div className="overflow-auto flex-1 relative">
            <table className="w-full text-sm border-collapse min-w-250">
              <thead className="bg-slate-50 text-slate-700 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-3 text-left font-bold border-b border-r border-slate-300 bg-slate-100 min-w-75 sticky left-0 z-30">
                     HIERARKI
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
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${node.level * 24}px` }}>
                            {!node.isLeaf ? (
                                <button onClick={() => toggleRow(node.id)} className="text-slate-400 hover:text-blue-600 focus:outline-none">
                                    {expandedRows[node.id] ? <MinusSquare size={16} /> : <PlusSquare size={16} />}
                                </button>
                            ) : <span className="w-4 h-4" />}
                            <span className={node.isLeaf ? "text-slate-600" : "font-bold text-slate-800"}>{node.label}</span>
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
    </main>
  )
}