'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft, Search, Trash2, Filter, AlertCircle, CheckCircle2, Clock, LayoutList, Loader2, Flag } from 'lucide-react'

export default function IssueSummaryPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  
  // --- STATE FILTER ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All') // State Filter Baru

  // --- 1. DEFINISI FUNGSI FETCH DATA ---
  const fetchIssues = useCallback(async () => {
      setLoading(prev => prev || issues.length === 0)
      try {
        const { data, error } = await supabase
            .from('sales_issues')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (error) throw error
        setIssues(data || [])
      } catch (err: any) { 
          console.error('Error fetching issues:', err.message) 
      } finally { 
          setLoading(false) 
      }
  }, [supabase, issues.length])

  // --- 2. CEK HAK AKSES & LOAD DATA ---
  useEffect(() => {
    const checkUserAndFetch = async () => {
        setAuthChecking(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) { 
            router.replace('/login')
            return 
        }

        const email = user.email || ''
        const isAllowed = email.endsWith('@traknus.co.id') || email === 'dyentadwian@gmail.com'

        if (!isAllowed) {
            router.replace('/sales-issues')
        } else {
            setAuthChecking(false)
            fetchIssues()
        }
    }
    checkUserAndFetch()
  }, []) 

  // --- 3. ACTIONS (UPDATE & DELETE) ---
  const handleDelete = async (id: number) => {
    if(!confirm('Hapus data keluhan ini?')) return
    try {
        const { error } = await supabase.from('sales_issues').delete().eq('id', id)
        if (error) throw error
        setIssues(prev => prev.filter(item => item.id !== id))
    } catch (err: any) { 
        alert('Gagal menghapus: ' + err.message) 
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    setUpdatingId(id)
    try {
        const { error } = await supabase
            .from('sales_issues')
            .update({ status: newStatus })
            .eq('id', id)
            
        if (error) throw error
        
        setIssues(prev => prev.map(item => 
            item.id === id ? { ...item, status: newStatus } : item
        ))
    } catch (err: any) { 
        alert('Gagal update status: ' + err.message) 
    } finally { 
        setUpdatingId(null) 
    }
  }

  // --- 4. LOGIC FILTERING (UPDATED) ---
  const filteredData = useMemo(() => {
    return issues.filter(item => {
        // Filter Search
        const matchesSearch = item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        
        // Filter Status
        const matchesStatus = filterStatus === 'All' || item.status === filterStatus
        
        // Filter Priority (BARU)
        const matchesPriority = filterPriority === 'All' || item.priority === filterPriority

        return matchesSearch && matchesStatus && matchesPriority
    })
  }, [issues, searchTerm, filterStatus, filterPriority])

  const stats = useMemo(() => {
    return {
        total: issues.length,
        open: issues.filter(i => i.status === 'Open').length,
        urgent: issues.filter(i => i.priority === 'Urgent' && i.status !== 'Closed').length,
        closed: issues.filter(i => i.status === 'Closed').length
    }
  }, [issues])

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Open': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700'
        case 'In Progress': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700'
        case 'Closed': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700'
        default: return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const getPriorityColor = (prio: string) => {
    return prio === 'Urgent' ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded' : prio === 'High' ? 'text-orange-600 font-semibold' : 'text-slate-600 dark:text-slate-400'
  }

  const optionStyle = "bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200"

  if (authChecking) {
      return (
        <div className="min-h-screen flex justify-center items-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <span className="text-slate-500 text-xs">Memeriksa Hak Akses...</span>
            </div>
        </div>
      )
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-blue-600 transition-colors shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <LayoutList className="text-indigo-500" size={28}/> Summary Keluhan
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Monitoring status dan prioritas masalah customer.</p>
                </div>
            </div>
            <button onClick={() => router.push('/sales-issues')} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">
                + Input Baru
            </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: 'Total Keluhan', val: stats.total, icon: LayoutList, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                { label: 'Status Open', val: stats.open, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Urgent Pending', val: stats.urgent, icon: Clock, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                { label: 'Selesai (Closed)', val: stats.closed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            ].map((s, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${s.bg}`}><s.icon className={s.color} size={24}/></div>
                    <div><div className="text-2xl font-bold font-mono">{s.val}</div><div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">{s.label}</div></div>
                </div>
            ))}
        </div>

        {/* Filters & Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-125">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/50 dark:bg-slate-800/20">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                    <input type="text" placeholder="Cari Customer / Isu..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none transition-colors" />
                </div>
                
                {/* FILTER GROUP */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5">
                        <Filter size={14} className="text-slate-400"/>
                        {/* Status Filter */}
                        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none cursor-pointer text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 pr-2 mr-2">
                            <option className={optionStyle} value="All">Semua Status</option>
                            <option className={optionStyle} value="Open">Open</option>
                            <option className={optionStyle} value="In Progress">In Progress</option>
                            <option className={optionStyle} value="Closed">Closed</option>
                        </select>
                        
                        {/* Priority Filter (BARU) */}
                        <Flag size={14} className="text-slate-400"/>
                        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} className="py-1.5 text-sm bg-transparent outline-none cursor-pointer text-slate-700 dark:text-slate-200">
                            <option className={optionStyle} value="All">Semua Prioritas</option>
                            <option className={optionStyle} value="Low">Low</option>
                            <option className={optionStyle} value="Normal">Normal</option>
                            <option className={optionStyle} value="High">High</option>
                            <option className={optionStyle} value="Urgent">Urgent</option>
                        </select>
                    </div>
                </div>

            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-xs font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="p-4 w-12">#</th>
                            <th className="p-4 w-32">Tanggal</th>
                            <th className="p-4 w-48">Customer</th>
                            <th className="p-4 min-w-75">Masalah</th>
                            <th className="p-4 w-24">Prioritas</th>
                            <th className="p-4 w-40">Status (Edit)</th>
                            <th className="p-4 w-20 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading && issues.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center"><div className="flex justify-center items-center gap-2"><Loader2 className="animate-spin text-blue-500"/><span className="text-slate-500">Loading Data...</span></div></td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">Tidak ada data ditemukan.</td></tr>
                        ) : (
                            filteredData.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-4 font-mono text-xs text-slate-400 align-top">{idx+1}</td>
                                    <td className="p-4 whitespace-nowrap align-top">
                                        <div className="font-semibold text-xs">{new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                                        <div className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                                    </td>
                                    <td className="p-4 font-medium text-slate-800 dark:text-white align-top">
                                        {item.customer_name}
                                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><span className="opacity-50">By:</span> {item.created_by || '-'}</div>
                                    </td>
                                    
                                    {/* Deskripsi dengan Wrap Text */}
                                    <td className="p-4 align-top min-w-75 max-w-lg whitespace-normal wrap-break-word">
                                        <div className="font-bold text-[10px] uppercase tracking-wider mb-1 text-slate-500 border border-slate-200 dark:border-slate-700 inline-block px-1.5 rounded">{item.issue_type}</div>
                                        <div className="text-sm mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
                                            {item.description}
                                        </div>
                                    </td>

                                    <td className="p-4 align-top"><span className={`text-xs ${getPriorityColor(item.priority)}`}>{item.priority}</span></td>
                                    <td className="p-4 align-top">
                                        <div className="relative">
                                            {updatingId === item.id && (
                                                <div className="absolute right-2 top-2 z-10"><Loader2 size={14} className="animate-spin text-slate-500"/></div>
                                            )}
                                            <select 
                                                value={item.status}
                                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                disabled={updatingId === item.id}
                                                className={`w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border cursor-pointer focus:ring-2 focus:ring-offset-1 focus:outline-none transition-all ${getStatusColor(item.status)} focus:ring-blue-400 disabled:opacity-70`}
                                            >
                                                <option className={optionStyle} value="Open">Open</option>
                                                <option className={optionStyle} value="In Progress">In Progress</option>
                                                <option className={optionStyle} value="Closed">Closed</option>
                                            </select>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center align-top">
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Hapus Data">
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </main>
  )
}