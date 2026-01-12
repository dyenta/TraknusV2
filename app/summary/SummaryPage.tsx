'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { 
  ArrowLeft, Search, Trash2, LayoutList, Loader2, User, 
  X, Send, Mail, Phone, Users, Hash, Paperclip, ExternalLink, 
  MessageSquare, Clock, CheckCircle2, Timer, CheckCircle, XCircle,
  // Icon tambahan untuk Tema
  Sun, Moon, Laptop, ChevronDown
} from 'lucide-react'
// Pastikan path ini sesuai dengan struktur folder Anda (misal: ../components/ThemeProvider)
import { useTheme } from '../components/ThemeProvider' 

// --- INTERFACE ---
interface Issue {
  id: number
  created_at: string
  customer_name: string
  cust_group: string | null
  unit_number: string | null
  issue_type: string
  description: string
  status: string
  attachment_url: string | null 
  
  // Tracking
  first_response_at: string | null
  resolved_at: string | null
  admin_name: string | null
  
  // Data Profil
  profiles: {
    full_name: string | null
    email: string | null
    phone_number: string | null
  } | null
}

interface Comment {
  id: number
  sender_name: string
  message: string
  created_at: string
  is_admin: boolean
}

export default function SummaryPage() {
  const router = useRouter()
  // Hook Tema
  const { theme, setTheme } = useTheme()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  // State Modal Chat
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // State Dropdown Tema
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')

  // --- HELPER UNTUK ICON TEMA ---
  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light': return <Sun size={14} />
      case 'dark': return <Moon size={14} />
      case 'system': return <Laptop size={14} />
      default: return <Sun size={14} />
    }
  }

  // --- HELPER SCROLL ---
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // --- HELPER UNTUK NAMA FILE DARI URL ---
  const getFileNameFromUrl = (url: string) => {
    try {
        const decoded = decodeURIComponent(url)
        return decoded.split('/').pop() || 'Attachment'
    } catch {
        return 'Attachment'
    }
  }

  // --- HELPER RENDER ATTACHMENTS ---
  const renderAttachments = (attachmentUrl: string | null) => {
    if (!attachmentUrl) return null

    let urls: string[] = []
    
    try {
        const parsed = JSON.parse(attachmentUrl)
        if (Array.isArray(parsed)) {
            urls = parsed
        } else {
            urls = [attachmentUrl]
        }
    } catch (e) {
        urls = [attachmentUrl]
    }

    return (
        <div className="mt-2 flex flex-wrap gap-2">
            {urls.map((url, idx) => (
                <a 
                    key={idx} 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title={getFileNameFromUrl(url)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold hover:bg-blue-100 transition-colors max-w-50"
                >
                    <Paperclip size={10} className="shrink-0"/> 
                    <span className="truncate">{getFileNameFromUrl(url)}</span>
                </a>
            ))}
        </div>
    )
  }

  // --- HELPER KPI DURATION ---
  const calculateDuration = (startStr: string, endStr: string | null) => {
    if (!endStr) return '-'
    const start = new Date(startStr).getTime()
    const end = new Date(endStr).getTime()
    const diffMs = end - start
    
    if (diffMs < 0) return '0m'

    const minutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}h ${hours % 24}j`
    if (hours > 0) return `${hours}j ${minutes % 60}m`
    return `${minutes} mnt`
  }

  // --- FETCH ISSUES ---
  const fetchIssues = useCallback(async () => {
      setLoading(prev => prev || issues.length === 0)
      try {
        const { data, error } = await supabase
            .from('sales_issues')
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

  // --- AUTH CHECK ---
  useEffect(() => {
    const init = async () => {
        setAuthChecking(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) { 
            router.replace('/login')
            return 
        }

        const email = user.email || ''
        setCurrentUserEmail(email)
        
        const isTraknus = email.endsWith('@traknus.co.id')
        const isSuperAdmin = email === 'dyentadwian@gmail.com' 
        setIsAdmin(isTraknus || isSuperAdmin)

        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        setCurrentUserName(profile?.full_name || email.split('@')[0])

        setAuthChecking(false)
        fetchIssues()
    }
    init()
  }, []) 

  // --- ACTIONS ---

  // 1. Refresh Komentar
  const refreshComments = async (id: number) => {
    const { data } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: true })
    
    if (data) setComments(data)
    setTimeout(scrollToBottom, 100)
  }

  // 2. Helper Update Status & Send System Message
  const updateStatus = async (id: number, status: string, extraFields: any = {}) => {
      const { error } = await supabase.from('sales_issues').update({ status, ...extraFields }).eq('id', id)
      if (error) {
          alert('Gagal update status: ' + error.message)
          return
      }
      // Update local state
      setIssues(prev => prev.map(i => i.id === id ? { ...i, status, ...extraFields } : i))
      setSelectedIssue(prev => prev ? { ...prev, status, ...extraFields } : null)
  }

  const sendSystemMessage = async (msg: string) => {
      if(!selectedIssue) return
      await supabase.from('issue_comments').insert({
          issue_id: selectedIssue.id,
          message: msg,
          sender_name: 'System',
          is_admin: true
      })
      refreshComments(selectedIssue.id)
  }

  // 3. Delete Issue
  const handleDelete = async (id: number) => {
    if(!confirm('Hapus tiket ini beserta riwayat chatnya?')) return
    try {
        const { error } = await supabase.from('sales_issues').delete().eq('id', id)
        if (error) throw error
        setIssues(prev => prev.filter(item => item.id !== id))
    } catch (err: any) { alert('Gagal hapus: ' + err.message) }
  }

  // 4. Open Chat
  const handleOpenChat = async (issue: Issue) => {
      setSelectedIssue(issue)
      setIsChatOpen(true)
      setComments([]) 
      refreshComments(issue.id)
  }

  // 5. Send Message (Auto Status In Progress if Admin)
  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!newMessage.trim() || !selectedIssue) return
      if (selectedIssue.status === 'Closed') return

      setSending(true)
      try {
          await supabase.from('issue_comments').insert({
              issue_id: selectedIssue.id,
              message: newMessage,
              sender_name: currentUserName,
              is_admin: isAdmin
          })

          // Logic: Jika Admin balas tiket OPEN -> In Progress & Catat Waktu Respon
          if (isAdmin && selectedIssue.status === 'Open') {
              const now = new Date().toISOString()
              const extraFields = !selectedIssue.first_response_at 
                ? { first_response_at: now, admin_name: currentUserName } 
                : { admin_name: currentUserName }
                
              await updateStatus(selectedIssue.id, 'In Progress', extraFields)
          }

          setNewMessage('')
          refreshComments(selectedIssue.id)

      } catch (err: any) {
          alert('Gagal kirim: ' + err.message)
      } finally {
          setSending(false)
      }
  }

  // --- LOGIC KONFIRMASI 2 PIHAK (NEW) ---

  // A. Admin Mengajukan Selesai
  const handleAdminProposeResolve = async () => {
      if(!selectedIssue) return
      if(!confirm('Tandai pekerjaan selesai? Status akan menjadi "Waiting Confirmation" menunggu user.')) return
      
      await updateStatus(selectedIssue.id, 'Waiting Confirmation', { admin_name: currentUserName })
      await sendSystemMessage('Admin menandai pekerjaan selesai. Menunggu konfirmasi user.')
  }

  // B. User Konfirmasi Selesai (Final Close)
  const handleUserConfirmClose = async () => {
      if(!selectedIssue) return
      if(!confirm('Anda yakin masalah sudah tuntas? Tiket akan ditutup.')) return
      
      const now = new Date().toISOString()
      await updateStatus(selectedIssue.id, 'Closed', { resolved_at: now })
      await sendSystemMessage('User mengkonfirmasi masalah selesai. Tiket DITUTUP.')
  }

  // C. User Menolak (Revisi)
  const handleUserReject = async () => {
      if(!selectedIssue) return
      const reason = prompt('Apa yang masih belum sesuai?')
      if(!reason) return

      // Reset resolved date jika ada, kembalikan ke In Progress
      await updateStatus(selectedIssue.id, 'In Progress', { resolved_at: null }) 
      await sendSystemMessage(`User menolak penyelesaian. Alasan: "${reason}". Status kembali ke In Progress.`)
  }

  // --- FILTERING ---
  const filteredData = useMemo(() => {
    return issues.filter(item => {
        const s = searchTerm.toLowerCase()
        const matchSearch = item.customer_name?.toLowerCase().includes(s) || 
                            item.profiles?.full_name?.toLowerCase().includes(s) ||
                            item.unit_number?.toLowerCase().includes(s)
        const matchStatus = filterStatus === 'All' || item.status === filterStatus
        return matchSearch && matchStatus
    })
  }, [issues, searchTerm, filterStatus])

  const getStatusColor = (st: string) => {
    if (st === 'Closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (st === 'Waiting Confirmation') return 'bg-amber-100 text-amber-700 border-amber-200'
    if (st === 'In Progress') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  if (authChecking) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                {/* Tombol Back */}
                <button 
                    onClick={() => router.push('/')} 
                    className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                
                {/* Wrapper untuk Judul & Deskripsi */}
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/>  Summary Keluhan
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Data keluhan customer yang perlu ditindaklanjuti
                    </p>
                </div>
            </div>

            {/* ACTION GROUP: INPUT BARU + THEME DROPDOWN */}
            <div className="flex items-center gap-3">
                
                {/* 1. INPUT BARU */}
                <button 
                    onClick={() => router.push('/sales-issues')} 
                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 text-sm whitespace-nowrap"
                >
                    + Input Baru
                </button>

                {/* 2. THEME DROPDOWN */}
                <div className="relative">
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} 
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-medium shadow-sm"
                    >
                      {getThemeIcon(theme)}
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}/>
                    </button>

                    {/* Dropdown Menu */}
                    <div className={`absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden transition-all duration-200 origin-top-right z-50 ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                      {['light', 'dark', 'system'].map((m: any) => (
                        <button
                          key={m}
                          onClick={() => {
                            setTheme(m)
                            setIsDropdownOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${theme === m ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                          {getThemeIcon(m)}
                          <span className="capitalize">{m === 'system' ? 'Sistem' : m === 'light' ? 'Terang' : 'Gelap'}</span>
                        </button>
                      ))}
                    </div>
                </div>

            </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                <input type="text" placeholder="Cari..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white dark:border-slate-700"/>
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-lg border text-sm dark:text-white dark:border-slate-700">
                <option value="All">Semua Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting Confirmation">Waiting Confirmation</option>
                <option value="Closed">Closed</option>
            </select>
        </div>

        {/* Tabel Utama */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-xs font-bold border-b dark:border-slate-700">
                        <tr>
                            <th className="p-4">Tanggal Input</th>
                            <th className="p-4">Customer</th>
                            <th className="p-4 w-2/5">Detail Masalah {isAdmin && '& KPI'}</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                        {filteredData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <td className="p-4 align-top">
                                    <div className="font-bold">{new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                                    <div className="text-xs text-slate-400">{new Date(item.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                                </td>
                                <td className="p-4 align-top">
                                    <div className="font-bold text-slate-800 dark:text-slate-100">{item.customer_name}</div>
                                    <div className="text-xs text-slate-500 mt-1">Group: {item.cust_group || '-'}</div>
                                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                            <User size={12} className="text-slate-400"/> {item.profiles?.full_name || 'Tanpa Nama'}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <Mail size={12} className="text-slate-400"/> {item.profiles?.email || '-'}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <Phone size={12} className="text-slate-400"/> {item.profiles?.phone_number || '-'}
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="p-4 align-top">
                                    <div className="text-[10px] font-bold uppercase text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">
                                        {item.issue_type} | Unit: {item.unit_number}
                                    </div>
                                    <div className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-normal wrap-break-word">
                                        {item.description}
                                    </div>
                                    {renderAttachments(item.attachment_url)}

                                    {/* KPI SECTION - HANYA ADMIN */}
                                    {isAdmin && (
                                        <div className="mt-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-[10px]">
                                            {/* KPI RESPON */}
                                            <div className="flex flex-col">
                                                <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                                                    <Timer size={10}/> Respon Awal
                                                </span>
                                                {item.first_response_at ? (
                                                    <span className="font-mono font-bold text-amber-500 dark:text-amber-400">
                                                        {calculateDuration(item.created_at, item.first_response_at)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Belum di Respon</span>
                                                )}
                                            </div>

                                            {/* KPI SELESAI */}
                                            <div className="flex flex-col">
                                                <span className="text-slate-400 flex items-center gap-1 mb-0.5">
                                                    <CheckCircle2 size={10}/> Total Durasi
                                                </span>
                                                {item.resolved_at ? (
                                                    <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">
                                                        {calculateDuration(item.created_at, item.resolved_at)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Belum selesai</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </td>

                                <td className="p-4 align-top">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>

                                <td className="p-4 align-top text-center space-y-2">
                                    <button 
                                        onClick={() => handleOpenChat(item)} 
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                    >
                                        <MessageSquare size={14}/> Chat / Respon
                                    </button>
                                    
                                    {isAdmin && (
                                      <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500 transition-colors pt-1" title="Hapus">
                                          <Trash2 size={16}/>
                                      </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- POPUP TIMELINE CHAT --- */}
        {isChatOpen && selectedIssue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                    
                    <div className="p-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items- shrink-0">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                                {selectedIssue.customer_name} 
                                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${getStatusColor(selectedIssue.status)}`}>{selectedIssue.status}</span>
                            </h3>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                <Hash size={12}/> {selectedIssue.unit_number} 
                            </div>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition text-slate-500 dark:text-slate-400"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950/50">
                        {/* Masalah Awal */}
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Keluhan Awal</span>
                                <span className="text-[10px] text-slate-400">{new Date(selectedIssue.created_at).toLocaleDateString('id-ID', {day: 'numeric', month:'short', year:'numeric'})}</span>
                            </div>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{selectedIssue.description}</p>
                            {renderAttachments(selectedIssue.attachment_url)}
                        </div>

                        {/* Timeline Komentar */}
                        {comments.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs py-4 italic">Belum ada percakapan. Mulai respon di bawah.</div>
                        ) : (
                            comments.map((c) => {
                                const isSystem = c.sender_name === 'System'
                                
                                if(isSystem) return (
                                    <div key={c.id} className="flex justify-center my-4">
                                        <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 px-3 py-1 rounded-full font-bold">{c.message}</span>
                                    </div>
                                )

                                return (
                                    <div key={c.id} className={`flex flex-col ${c.is_admin ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                                            c.is_admin 
                                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none'
                                        }`}>
                                            <div className="font-bold text-[10px] mb-1 opacity-80 flex justify-between gap-4">
                                                <span>{c.sender_name} {c.is_admin ? '(Key Account)' : ''}</span>
                                            </div>
                                            <p>{c.message}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {new Date(c.created_at).toLocaleString('id-ID', { 
                                                day: '2-digit', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </span>
                                    </div>
                                )
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shrink-0">
                        {/* 1. Input Chat (Hanya jika belum Closed) */}
                        {selectedIssue.status !== 'Closed' && (
                            <form onSubmit={handleSendMessage} className="flex gap-2 mb-3">
                                <input 
                                    type="text" 
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    placeholder="Tulis balasan..."
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                                <button 
                                    type="submit" 
                                    disabled={sending || !newMessage.trim()}
                                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-all"
                                >
                                    {sending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                                </button>
                            </form>
                        )}
                        
                        {/* 2. KONTROL STATUS (2-WAY CONFIRMATION) */}
                        <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-2">

                            {/* A. ADMIN: Ajukan Selesai (Jika belum Waiting/Closed) */}
                            {isAdmin && selectedIssue.status !== 'Closed' && selectedIssue.status !== 'Waiting Confirmation' && (
                                <button onClick={handleAdminProposeResolve} className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors">
                                    <CheckCircle size={14}/> Ajukan Selesai
                                </button>
                            )}

                            {/* B. USER/ADMIN (View): Tombol Konfirmasi */}
                            {selectedIssue.status === 'Waiting Confirmation' && (
                                <>
                                    {/* Cek apakah user yang login adalah pemilik tiket */}
                                    {currentUserEmail === selectedIssue.profiles?.email ? (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={handleUserReject} 
                                                className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                                            >
                                                <XCircle size={14}/> Belum / Revisi
                                            </button>
                                            <button 
                                                onClick={handleUserConfirmClose} 
                                                className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                                            >
                                                <CheckCircle size={14}/> Konfirmasi Selesai
                                            </button>
                                        </div>
                                    ) : (
                                        /* Tampilan untuk Admin / Orang lain saat menunggu user */
                                        <span className="text-xs text-slate-500 italic flex items-center gap-1">
                                            <Clock size={14}/> Menunggu konfirmasi dari {selectedIssue.profiles?.full_name || 'User'}...
                                        </span>
                                    )}
                                </>
                            )}

                            {/* C. CLOSED */}
                            {selectedIssue.status === 'Closed' && (
                                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                    <CheckCircle size={14}/> Tiket Ditutup
                                </span>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        )}

      </div>
    </main>
  )
}