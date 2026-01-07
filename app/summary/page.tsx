'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft, Search, Trash2, LayoutList, CheckCircle2, Loader2, User, Edit3, X, Save, Mail, Users } from 'lucide-react'

// --- INTERFACE ---
interface Issue {
  id: number
  created_at: string
  customer_name: string
  cust_group: string | null // 1. Field Baru
  issue_type: string
  description: string
  priority: string
  status: string
  user_id: string
  
  // Field Tracking & Respon
  admin_response: string | null
  admin_name: string | null
  first_response_at: string | null
  resolved_at: string | null
  
  // Data Profil Pembuat
  profiles: {
    full_name: string | null
    email: string | null
    phone_number: string | null
  } | null
}

export default function IssueSummaryPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  
  // State Role Admin
  const [isAdmin, setIsAdmin] = useState(false)

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [editForm, setEditForm] = useState({ status: '', admin_response: '' })
  const [saving, setSaving] = useState(false)

  // Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')

  // --- HELPER DURASI ---
  const calculateDuration = (startStr: string, endStr: string | null) => {
    if (!startStr || !endStr) return '-'
    const start = new Date(startStr).getTime()
    const end = new Date(endStr).getTime()
    const diffMs = end - start
    if (diffMs < 0) return '-'

    const diffHrs = Math.floor(diffMs / 3600000)
    const diffMins = Math.floor((diffMs % 3600000) / 60000)
    
    if (diffHrs > 24) return `${Math.floor(diffHrs / 24)} hari ${diffHrs % 24} jam`
    if (diffHrs > 0) return `${diffHrs} jam ${diffMins} mnt`
    return `${diffMins} menit`
  }

  // --- FETCH DATA ---
  const fetchIssues = useCallback(async () => {
      setLoading(prev => prev || issues.length === 0)
      try {
        const { data, error } = await supabase
            .from('sales_issues')
            // Select all columns (termasuk cust_group yang baru ditambah)
            .select(`*, profiles (full_name, email, phone_number)`)
            .order('created_at', { ascending: false })
        
        if (error) throw error
        setIssues(data || [])
      } catch (err: any) { 
          console.error('Error:', err.message) 
      } finally { 
          setLoading(false) 
      }
  }, [supabase, issues.length])

  // --- CEK AUTH & ROLE ---
  useEffect(() => {
    const init = async () => {
        setAuthChecking(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) { 
            router.replace('/login')
            return 
        }

        const email = user.email || ''
        const isTraknus = email.endsWith('@traknus.co.id')
        const isSuperAdmin = email === 'dyentadwian@gmail.com'
        
        setIsAdmin(isTraknus || isSuperAdmin)
        setAuthChecking(false)
        fetchIssues()
    }
    init()
  }, []) 

  // --- ACTIONS ---
  const handleDelete = async (id: number) => {
    if(!confirm('Hapus data ini?')) return
    try {
        const { error } = await supabase.from('sales_issues').delete().eq('id', id)
        if (error) throw error
        setIssues(prev => prev.filter(item => item.id !== id))
    } catch (err: any) { alert('Gagal hapus: ' + err.message) }
  }

  const handleOpenEdit = (issue: Issue) => {
      setSelectedIssue(issue)
      setEditForm({
          status: issue.status,
          admin_response: issue.admin_response || ''
      })
      setIsModalOpen(true)
  }

  const handleSaveResponse = async () => {
      if (!selectedIssue) return
      setSaving(true)
      
      try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Sesi habis, silakan login ulang')

          let currentAdminName = 'Admin'
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
            
          if (profileData?.full_name) {
              currentAdminName = profileData.full_name
          }

          const now = new Date().toISOString()
          const updates: any = {
              status: editForm.status,
              admin_response: editForm.admin_response,
              admin_name: currentAdminName 
          }

          if (!selectedIssue.first_response_at) {
              updates.first_response_at = now
          }
          if (editForm.status === 'Closed' && selectedIssue.status !== 'Closed') {
              updates.resolved_at = now
          }
          if (editForm.status !== 'Closed' && selectedIssue.status === 'Closed') {
              updates.resolved_at = null
          }

          const { error } = await supabase
              .from('sales_issues')
              .update(updates)
              .eq('id', selectedIssue.id)

          if (error) throw error

          setIssues(prev => prev.map(item => item.id === selectedIssue.id ? { ...item, ...updates } : item))
          setIsModalOpen(false)

      } catch (err: any) {
          alert('Gagal simpan: ' + err.message)
      } finally {
          setSaving(false)
      }
  }

  // --- FILTERING ---
  const filteredData = useMemo(() => {
    return issues.filter(item => {
        const s = searchTerm.toLowerCase()
        const matchSearch = item.customer_name?.toLowerCase().includes(s) || 
                            item.profiles?.full_name?.toLowerCase().includes(s)
        const matchStatus = filterStatus === 'All' || item.status === filterStatus
        return matchSearch && matchStatus
    })
  }, [issues, searchTerm, filterStatus])

  const stats = useMemo(() => ({
    total: issues.length,
    open: issues.filter(i => i.status === 'Open').length,
    closed: issues.filter(i => i.status === 'Closed').length
  }), [issues])

  const getStatusColor = (st: string) => {
    if (st === 'Closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (st === 'In Progress') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  if (authChecking) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 2. Header dengan Tombol Back */}
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => router.back()} 
                    className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <LayoutList className="text-indigo-500"/> Summary Keluhan
                </h1>
            </div>
            
            <button onClick={() => router.push('/sales-issues')} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 text-sm">
                + Input Baru
            </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                <div className="text-slate-500 text-xs uppercase font-bold">Total Tiket</div>
                <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                <div className="text-slate-500 text-xs uppercase font-bold">Open</div>
                <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                <div className="text-slate-500 text-xs uppercase font-bold">Selesai</div>
                <div className="text-2xl font-bold text-emerald-600">{stats.closed}</div>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                <input type="text" placeholder="Cari..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm"/>
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-white px-4 py-2 rounded-lg border text-sm">
                <option value="All">Semua Status</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
            </select>
        </div>

        {/* Tabel Utama */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-xs font-bold border-b">
                        <tr>
                            <th className="p-4">Tanggal Input</th>
                            <th className="p-4">Customer & Sales</th>
                            <th className="p-4 w-1/3">Detail Masalah</th>
                            {isAdmin && <th className="p-4 bg-slate-100 dark:bg-slate-800/50">KPI Waktu</th>}
                            <th className="p-4">Status</th>
                            <th className="p-4 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                
                                {/* 1. Tanggal */}
                                <td className="p-4 align-top whitespace-nowrap">
                                    <div className="font-bold">{new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                                    <div className="text-xs text-slate-400">{new Date(item.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                                </td>

                                {/* 2. Customer & Sales (Updated dengan Cust Group) */}
                                <td className="p-4 align-top">
                                    <div className="font-bold text-slate-800 dark:text-slate-100">{item.customer_name}</div>
                                    
                                    {/* 3. Tampilkan Customer Group jika ada */}
                                    {item.cust_group && (
                                        <div className="mt-1 mb-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                            <Users size={10} /> {item.cust_group}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-0.5 border-l-2 border-slate-200 pl-2 mt-1">
                                        <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                            <User size={12}/> {item.profiles?.full_name || 'Tanpa Nama'}
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] text-slate-500 break-all">
                                            <Mail size={10}/> {item.profiles?.email || '-'}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {item.profiles?.phone_number || '-'}
                                        </div>
                                    </div>
                                </td>

                                {/* 3. Masalah & Respon */}
                                <td className="p-4 align-top space-y-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                                            Keluhan : {item.issue_type}
                                        </div>
                                        <div className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-normal wrap-break-word text-sm">
                                            {item.description}
                                        </div>
                                    </div>
                                    
                                    {item.admin_response && (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                                                <CheckCircle2 size={12}/> 
                                                Respon oleh {item.admin_name || 'Admin'}:
                                            </div>
                                            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-normal wrap-break-word italic">
                                                "{item.admin_response}"
                                            </div>
                                        </div>
                                    )}
                                </td>

                                {/* 4. KPI Waktu */}
                                {isAdmin && (
                                    <td className="p-4 align-top whitespace-nowrap bg-slate-50/50 dark:bg-slate-800/20">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-[10px] uppercase text-slate-400 font-bold">Durasi Respon</div>
                                                <span className={`text-xs font-mono font-medium ${item.first_response_at ? 'text-amber-600' : 'text-slate-400 italic'}`}>
                                                    {item.first_response_at ? calculateDuration(item.created_at, item.first_response_at) : 'Belum'}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-slate-400 font-bold">Total Selesai</div>
                                                <span className={`text-xs font-mono font-bold ${item.resolved_at ? 'text-emerald-600' : 'text-slate-400 italic'}`}>
                                                    {item.resolved_at ? calculateDuration(item.created_at, item.resolved_at) : 'Berjalan...'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                )}

                                {/* 5. Status */}
                                <td className="p-4 align-top">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>

                                {/* 6. Aksi */}
                                <td className="p-4 align-top text-center space-y-2">
                                    <button 
                                        onClick={() => handleOpenEdit(item)} 
                                        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded text-xs font-bold transition-colors border border-indigo-200"
                                    >
                                        <Edit3 size={14}/> Respon
                                    </button>
                                    
                                    <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500 transition-colors pt-1 block mx-auto" title="Hapus">
                                        <Trash2 size={16}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL EDIT */}
        {isModalOpen && selectedIssue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-lg">Respon Masalah</h3>
                        <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 border mb-2">
                            <span className="font-bold">{selectedIssue.customer_name}</span><br/>
                            {selectedIssue.description}
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-1">Jawaban / Tindakan Anda</label>
                            <textarea 
                                rows={5}
                                className="w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Tulis solusi..."
                                value={editForm.admin_response}
                                onChange={e => setEditForm({...editForm, admin_response: e.target.value})}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-1">Status</label>
                            <select 
                                value={editForm.status}
                                onChange={e => setEditForm({...editForm, status: e.target.value})}
                                className="w-full p-2 rounded-lg border bg-white"
                            >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Closed">Closed (Selesai)</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded text-sm">Batal</button>
                        <button 
                            onClick={handleSaveResponse} 
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded text-sm hover:bg-blue-700 flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Simpan
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </main>
  )
}