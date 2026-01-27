'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { 
  ArrowLeft, Search, Trash2, Loader2, User, 
  X, Send, Mail, Phone, Hash, Paperclip, 
  MessageSquare, Clock, CheckCircle2, Timer, CheckCircle, XCircle,
  Sun, Moon, Laptop, ChevronDown, ShieldAlert, Image as ImageIcon, FileText, Plus
} from 'lucide-react'
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
  issue_id: number
  sender_name: string
  message: string
  created_at: string
  is_admin: boolean
  attachment_url?: string | null 
}

export default function SummaryPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  // State Data
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  
  // State Auth & Akses
  const [authChecking, setAuthChecking] = useState(true)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  
  const [userAccess, setUserAccess] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // State Modal Chat
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // State untuk Multi Upload File
  const [chatFiles, setChatFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // REF UNTUK REALTIME
  const selectedIssueRef = useRef<Issue | null>(null)

  useEffect(() => {
    selectedIssueRef.current = selectedIssue
  }, [selectedIssue])

  // State Filter UI
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterGroup, setFilterGroup] = useState('All')

  // --- LOGIC FILTER BI-DIRECTIONAL ---
  const availableGroups = useMemo(() => {
    let data = issues
    if (filterStatus !== 'All') {
      data = data.filter(i => i.status === filterStatus)
    }
    const groups = data.map(i => i.cust_group).filter(Boolean) as string[]
    const uniqueGroups = Array.from(new Set(groups)).sort()
    const hasNoGroupData = data.some(i => !i.cust_group)
    if (hasNoGroupData) uniqueGroups.push('NO_GROUP')
    return uniqueGroups
  }, [issues, filterStatus])

  const availableStatuses = useMemo(() => {
    let data = issues
    if (filterGroup !== 'All') {
      if (filterGroup === 'NO_GROUP') {
          data = data.filter(i => !i.cust_group)
      } else {
          data = data.filter(i => i.cust_group === filterGroup)
      }
    }
    const sts = data.map(i => i.status)
    const uniqueSt = Array.from(new Set(sts))
    const sortOrder = ['OPEN', 'IN PROGRESS', 'WAITING CONFIRMATION', 'CLOSED']
    return uniqueSt.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b))
  }, [issues, filterGroup])

  // --- HELPER FUNCTIONS ---
  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light': return <Sun size={14} />
      case 'dark': return <Moon size={14} />
      case 'system': return <Laptop size={14} />
      default: return <Sun size={14} />
    }
  }

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const getFileNameFromUrl = (url: string) => {
    try {
        const decoded = decodeURIComponent(url)
        return decoded.split('/').pop() || 'Attachment'
    } catch {
        return 'Attachment'
    }
  }

  const isImageFile = (url: string) => {
    const cleanUrl = url.split('?')[0].toLowerCase()
    return /\.(jpg|jpeg|png|gif|webp)$/.test(cleanUrl)
  }

  // --- SMART PARSER: Handle Format Lama (String) & Baru (JSON Array) ---
  const parseAttachmentUrls = (attachmentUrl: string | null): string[] => {
      if (!attachmentUrl) return []
      
      try {
          // Coba parse sebagai JSON (Format Baru: ["url1", "url2"])
          const parsed = JSON.parse(attachmentUrl)
          
          if (Array.isArray(parsed)) {
              return parsed
          }
          // Jika parse berhasil tapi bukan array, kembalikan sebagai single array
          return [attachmentUrl]
          
      } catch (e) {
          // ERROR saat parse = Format Lama (String URL biasa: "https://...")
          // Kita tangani sebagai array berisi 1 item
          return [attachmentUrl]
      }
  }

  // Render Attachment di List Issue
  const renderAttachments = (attachmentUrl: string | null) => {
    const urls = parseAttachmentUrls(attachmentUrl)
    if (urls.length === 0) return null

    return (
        <div className="mt-2 flex flex-wrap gap-2">
            {urls.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" title={getFileNameFromUrl(url)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold hover:bg-blue-100 transition-colors max-w-50">
                    <Paperclip size={10} className="shrink-0"/> <span className="truncate">{getFileNameFromUrl(url)}</span>
                </a>
            ))}
        </div>
    )
  }

  // Render Attachment di Chat Bubble (Support Multi & Single)
  const renderChatAttachments = (attachmentUrl: string | null) => {
    const urls = parseAttachmentUrls(attachmentUrl)
    if (urls.length === 0) return null

    return (
        <div className={`mt-2 grid gap-2 ${urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {urls.map((url, idx) => {
                if (isImageFile(url)) {
                    return (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-lg border border-black/10 block">
                            <img 
                                src={url} 
                                alt="Attachment" 
                                className="w-full h-auto max-h-48 object-cover hover:scale-105 transition-transform duration-300 bg-slate-100" 
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                        </a>
                    )
                } else {
                    return (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg text-xs font-bold bg-white/20 backdrop-blur-sm border border-black/10 hover:bg-white/40 transition-colors overflow-hidden text-slate-700 dark:text-slate-200">
                            <Paperclip size={14} className="shrink-0"/> 
                            <span className="truncate">{getFileNameFromUrl(url)}</span>
                        </a>
                    )
                }
            })}
        </div>
    )
  }

  const calculateDuration = (startStr: string, endStr: string | null) => {
    if (!endStr) return '-'
    const start = new Date(startStr).getTime()
    const end = new Date(endStr).getTime()
    const diffMs = end - start
    if (diffMs < 60000) return '< 1 m'
    const minutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}h ${hours % 24}j`
    if (hours > 0) return `${hours}j ${minutes % 60}m`
    return `${minutes} m`
  }

  // --- DATA FETCHING ---
  const fetchIssues = useCallback(async (overrideIsAdmin?: boolean, overrideEmail?: string) => {
      const isUserAdmin = overrideIsAdmin !== undefined ? overrideIsAdmin : isAdmin
      const userEmail = overrideEmail || currentUserEmail

      try {
        let query = supabase
            .from('sales_issues')
            .select(`*, profiles!inner (full_name, email, phone_number)`)
            .order('created_at', { ascending: false })

        if (!isUserAdmin && userEmail) {
            query = query.eq('profiles.email', userEmail)
        }
        
        const { data, error } = await query
        
        if (error) throw error
        setIssues((data as any) || [])
        setLoading(false)
      } catch (err: any) { 
          console.error('Error:', err.message) 
          setLoading(false)
      } 
  }, [supabase, isAdmin, currentUserEmail])

  // --- AUTH CHECK ---
  useEffect(() => {
    const init = async () => {
        setAuthChecking(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/login'); return }

        const email = user.email || ''
        setCurrentUserEmail(email)

        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, akses')
            .eq('email', email)
            .single()

        const fullName = profile?.full_name || email.split('@')[0]
        setCurrentUserName(fullName)
        
        const userRole = profile?.akses || 'CUSTOMER' 
        setUserAccess(userRole)

        const isHO = userRole === 'HO'
        setIsAdmin(isHO)

        setAuthChecking(false)
        fetchIssues(isHO, email)
    }
    init()
  }, []) 

  // --- REALTIME LISTENER ---
  useEffect(() => {
    if (authChecking) return

    const channel = supabase
      .channel('app-global-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales_issues' }, async (payload) => {
          const updated = payload.new as Issue
          const { data: fullData } = await supabase
            .from('sales_issues')
            .select(`*, profiles!inner (full_name, email, phone_number)`)
            .eq('id', updated.id)
            .single()

           if (fullData) {
               const dataOwnerEmail = (fullData as any).profiles?.email
               if (isAdmin || dataOwnerEmail === currentUserEmail) {
                   setIssues(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated, profiles: (fullData as any).profiles } : i))
                   if (selectedIssueRef.current && selectedIssueRef.current.id === updated.id) {
                        setSelectedIssue(prev => prev ? { ...prev, ...updated } : null)
                   }
               }
           }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales_issues' }, async (payload) => {
            const newRecord = payload.new as Issue
            const { data: fullData } = await supabase
                .from('sales_issues')
                .select(`*, profiles!inner (full_name, email, phone_number)`)
                .eq('id', newRecord.id)
                .single()
            
            if (fullData) {
                const dataOwnerEmail = (fullData as any).profiles?.email
                if (isAdmin || dataOwnerEmail === currentUserEmail) {
                    setIssues(prev => [fullData as any, ...prev])
                }
            }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sales_issues' }, (payload) => {
          const deletedId = payload.old.id 
          setIssues(prev => prev.filter(i => i.id !== deletedId))
          if (selectedIssueRef.current && selectedIssueRef.current.id === deletedId) {
             setIsChatOpen(false)
             setSelectedIssue(null)
          }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issue_comments' }, (payload) => {
          const newComment = payload.new as Comment
          if (selectedIssueRef.current && selectedIssueRef.current.id === newComment.issue_id) {
             setComments(prev => {
                if (prev.some(c => c.id === newComment.id)) return prev
                setTimeout(scrollToBottom, 100)
                return [...prev, newComment]
             })
          }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, authChecking, isAdmin, currentUserEmail])

  // --- ACTIONS ---

  const refreshComments = async (id: number) => {
    const { data } = await supabase.from('issue_comments').select('*').eq('issue_id', id).order('created_at', { ascending: true })
    if (data) setComments(data)
    setTimeout(scrollToBottom, 100)
  }

  const updateStatus = async (id: number, status: string, extraFields: any = {}) => {
      const { error } = await supabase.from('sales_issues').update({ status, ...extraFields }).eq('id', id)
      if (error) { alert('Gagal update status: ' + error.message); return }
      
      setIssues(prev => prev.map(i => i.id === id ? { ...i, status, ...extraFields } : i))
      setSelectedIssue(prev => prev ? { ...prev, status, ...extraFields } : null)
  }

  const sendSystemMessage = async (msg: string) => {
      if(!selectedIssue) return
      await supabase.from('issue_comments').insert({
          issue_id: selectedIssue.id, message: msg, sender_name: 'System', is_admin: true
      })
  }

  const handleDelete = async (id: number) => {
    if(!isAdmin) return 
    if(!confirm('PERINGATAN: Yakin ingin menghapus tiket ini? Semua riwayat chat dan file lampiran di dalamnya akan ikut terhapus permanen.')) return
    
    setLoading(true) 
    try {
        const bucketName = 'issue-attachments'
        let allPathsToRemove: string[] = []

        // --- LANGKAH 1: Kumpulkan File dari TIKET UTAMA ---
        const issueToDelete = issues.find(i => i.id === id)
        if (issueToDelete && issueToDelete.attachment_url) {
            const mainUrls = parseAttachmentUrls(issueToDelete.attachment_url)
            allPathsToRemove.push(...mainUrls)
        }

        // --- LANGKAH 2: Kumpulkan File dari SEMUA KOMENTAR/CHAT ---
        const { data: commentsData } = await supabase
            .from('issue_comments')
            .select('attachment_url')
            .eq('issue_id', id)

        if (commentsData && commentsData.length > 0) {
            commentsData.forEach(comment => {
                if (comment.attachment_url) {
                    const commentUrls = parseAttachmentUrls(comment.attachment_url)
                    allPathsToRemove.push(...commentUrls)
                }
            })
        }

        // --- LANGKAH 3: Hapus FILE FISIK di Storage (Jika ada) ---
        if (allPathsToRemove.length > 0) {
            // Konversi Full URL menjadi Path Storage (path relative di bucket)
            const filesToRemove = allPathsToRemove.map(url => {
                try {
                    const decodedUrl = decodeURIComponent(url)
                    const splitKey = `/public/${bucketName}/`
                    const parts = decodedUrl.split(splitKey)
                    // Ambil string setelah nama bucket
                    return parts.length > 1 ? parts[1] : decodedUrl.split('/').pop() 
                } catch { return null }
            }).filter(p => p) as string[] // Filter yang null/gagal parse

            if (filesToRemove.length > 0) {
                // Eksekusi hapus massal ke Supabase Storage
                const { error: storageError } = await supabase.storage
                    .from(bucketName)
                    .remove(filesToRemove)
                
                if (storageError) console.error('Gagal hapus sebagian file storage:', storageError.message)
            }
        }

        // --- LANGKAH 4: Hapus DATA di Database ---
        const { error } = await supabase.from('sales_issues').delete().eq('id', id)
        if (error) throw error

        // --- LANGKAH 5: Update State UI ---
        setIssues(prev => prev.filter(item => item.id !== id))
        if (selectedIssue?.id === id) {
            setIsChatOpen(false)
            setSelectedIssue(null)
        }

    } catch (err: any) { 
        alert('Gagal hapus: ' + err.message) 
    } finally {
        setLoading(false)
    }
  }

  const handleOpenChat = async (issue: Issue) => {
      setSelectedIssue(issue)
      setIsChatOpen(true)
      setComments([]) 
      setChatFiles([]) 
      setNewMessage('')
      refreshComments(issue.id)
  }

  // Handler Input File (Multi)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Cek apakah ada file yang dipilih
    if (e.target.files && e.target.files.length > 0) {
        // 1. Convert FileList bawaan browser menjadi Array JavaScript standar
        const selectedFiles = Array.from(e.target.files)
        
        // 2. Masukkan ke state (gabungkan dengan file yg sudah ada sebelumnya jika mau)
        setChatFiles(prev => [...prev, ...selectedFiles])
    }

    // 3. PENTING: Reset value input agar jika user memilih file yang sama lagi, event onChange tetap jalan
    if (fileInputRef.current) {
        fileInputRef.current.value = '' 
    }
  }

  const handleRemoveFile = (indexToRemove: number) => {
    setChatFiles(prev => prev.filter((_, index) => index !== indexToRemove))
  }

  // Send Message dengan Multi Upload & Kompatibilitas Data
  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault()
      
      if ((!newMessage.trim() && chatFiles.length === 0) || !selectedIssue) return
      if (selectedIssue.status === 'CLOSED') return

      setSending(true)
      try {
          let attachmentUrlStr = null

          // 1. Upload Semua File (jika ada)
          if (chatFiles.length > 0) {
            const uploadPromises = chatFiles.map(async (file) => {
                const fileExt = file.name.split('.').pop()
                const uniqueId = Math.random().toString(36).substring(2, 8)
                const fileName = `chat/${selectedIssue.id}/${Date.now()}_${uniqueId}.${fileExt}`
                
                const { error: uploadError } = await supabase.storage
                    .from('issue-attachments')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data: urlData } = supabase.storage
                    .from('issue-attachments')
                    .getPublicUrl(fileName)
                
                return urlData.publicUrl
            })

            const uploadedUrls = await Promise.all(uploadPromises)
            
            // Simpan sebagai JSON Array String
            attachmentUrlStr = JSON.stringify(uploadedUrls)
          }

          // 2. Insert Comment
          const { error } = await supabase.from('issue_comments').insert({
              issue_id: selectedIssue.id, 
              message: newMessage, 
              sender_name: currentUserName, 
              is_admin: isAdmin,
              attachment_url: attachmentUrlStr 
          })
          if(error) throw error

          if (isAdmin && selectedIssue.status === 'OPEN') {
              const now = new Date().toISOString()
              const extraFields = !selectedIssue.first_response_at 
                ? { first_response_at: now, admin_name: currentUserName } 
                : { admin_name: currentUserName }
              await updateStatus(selectedIssue.id, 'IN PROGRESS', extraFields)
          }
          
          setNewMessage('')
          setChatFiles([])

      } catch (err: any) { alert('Gagal kirim: ' + err.message) } 
      finally { setSending(false) }
  }

  const handleAdminProposeResolve = async () => {
      if(!selectedIssue) return
      await updateStatus(selectedIssue.id, 'WAITING CONFIRMATION', { admin_name: currentUserName })
      await sendSystemMessage('Admin menandai pekerjaan selesai. Menunggu konfirmasi user.')
  }

  const handleUserConfirmClose = async () => {
      if(!selectedIssue) return
      if(!confirm('Anda yakin masalah sudah tuntas? Tiket akan ditutup.')) return
      
      const now = new Date().toISOString()
      await updateStatus(selectedIssue.id, 'CLOSED', { resolved_at: now })
      await sendSystemMessage('User mengkonfirmasi masalah selesai. Tiket DITUTUP.')
  }

  const handleUserReject = async () => {
      if(!selectedIssue) return
      const reason = prompt('Apa yang masih belum sesuai?') 
      if(!reason) return

      await updateStatus(selectedIssue.id, 'IN PROGRESS', { resolved_at: null }) 
      await sendSystemMessage(`User menolak penyelesaian. Alasan: "${reason}". Status kembali ke IN PROGRESS.`)
  }

  // --- FILTERING ---
  const filteredData = useMemo(() => {
    return issues.filter(item => {
        const s = searchTerm.toLowerCase()
        const matchSearch = item.customer_name?.toLowerCase().includes(s) || 
                            item.profiles?.full_name?.toLowerCase().includes(s) ||
                            item.unit_number?.toLowerCase().includes(s)
        
        const matchStatus = filterStatus === 'All' || item.status === filterStatus
        let matchGroup = false
        if (filterGroup === 'All') matchGroup = true
        else if (filterGroup === 'NO_GROUP') matchGroup = !item.cust_group 
        else matchGroup = item.cust_group === filterGroup

        return matchSearch && matchStatus && matchGroup
    })
  }, [issues, searchTerm, filterStatus, filterGroup])

  const getStatusColor = (st: string) => {
    if (st === 'CLOSED') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (st === 'WAITING CONFIRMATION') return 'bg-amber-100 text-amber-700 border-amber-200'
    if (st === 'IN PROGRESS') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  // --- LOGIC TAMBAHAN: Cek Apakah Admin Pernah Reply ---
  // Kita cek apakah di state 'comments' ada minimal 1 komentar yang is_admin === true
  const hasAdminReplied = useMemo(() => {
    return comments.some(c => c.is_admin)
  }, [comments])

  if (authChecking) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="animate-spin text-blue-600"/></div>

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/')} className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/>  Summary Keluhan
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Data keluhan customer yang perlu ditindaklanjuti</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/sales-issues')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow text-sm whitespace-nowrap">
                    + Input Baru
                </button>
                <div className="relative">
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-medium shadow-sm">
                      {getThemeIcon(theme)} <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}/>
                    </button>
                    <div className={`absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden transition-all duration-200 origin-top-right z-50 ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                      {['light', 'dark', 'system'].map((m: any) => (
                        <button key={m} onClick={() => { setTheme(m); setIsDropdownOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${theme === m ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          {getThemeIcon(m)} <span className="capitalize">{m === 'system' ? 'Sistem' : m === 'light' ? 'Terang' : 'Gelap'}</span>
                        </button>
                      ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Filters & Table */}
        <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                <input type="text" placeholder="Cari..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white dark:border-slate-700"/>
            </div>
            <select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-lg border text-sm dark:text-white dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="All">SEMUA GROUP</option>
                {availableGroups.map(group => (
                    <option key={group} value={group}>{group === 'NO_GROUP' ? 'Tanpa Group' : group}</option>
                ))}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-lg border text-sm dark:text-white dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="All">SEMUA STATUS</option>
                {availableStatuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
        </div>

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
                        {filteredData.length === 0 ? (
                             <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <ShieldAlert size={32} className="opacity-50"/>
                                        <span>Tidak ada data ditemukan.</span>
                                    </div>
                                </td>
                             </tr>
                        ) : (
                            filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <td className="p-4 align-top">
                                        <div className="font-bold">{new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                                        <div className="text-xs text-slate-400">{new Date(item.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">{item.customer_name}</div>
                                        <div className="text-xs text-slate-500 mt-1">Group: {item.cust_group || '-'}</div>
                                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium"><User size={12} className="text-slate-400"/> {item.profiles?.full_name || 'Tanpa Nama'}</div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500"><Mail size={12} className="text-slate-400"/> {item.profiles?.email || '-'}</div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500"><Phone size={12} className="text-slate-400"/> {item.profiles?.phone_number || '-'}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="text-[10px] font-bold uppercase text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1">{item.issue_type} | Unit: {item.unit_number}</div>
                                        <div className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-normal wrap-break-word">{item.description}</div>
                                        {renderAttachments(item.attachment_url)}
                                        {isAdmin && (
                                            <div className="mt-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-[10px]">
                                                <div className="flex flex-col"><span className="text-slate-400 flex items-center gap-1 mb-0.5"><Timer size={10}/> Respon Awal</span>{item.first_response_at ? <span className="font-mono font-bold text-amber-500 dark:text-amber-400">{calculateDuration(item.created_at, item.first_response_at)}</span> : <span className="text-slate-400 italic">Belum di Respon</span>}</div>
                                                <div className="flex flex-col"><span className="text-slate-400 flex items-center gap-1 mb-0.5"><CheckCircle2 size={10}/> Total Durasi</span>{item.resolved_at ? <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">{calculateDuration(item.created_at, item.resolved_at)}</span> : <span className="text-slate-400 italic">Belum selesai</span>}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 align-top">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${getStatusColor(item.status)}`}>{item.status}</span>
                                    </td>
                                    <td className="p-4 align-top text-center space-y-2">
                                        <button onClick={() => handleOpenChat(item)} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"><MessageSquare size={14}/> Chat / Respon</button>
                                        {isAdmin && (<button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500 transition-colors pt-1" title="Hapus"><Trash2 size={16}/></button>)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Modal Chat */}
        {isChatOpen && selectedIssue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div className="p-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                                {selectedIssue.customer_name} 
                                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${getStatusColor(selectedIssue.status)}`}>{selectedIssue.status}</span>
                            </h3>
                            <div className="text-xs text-slate-500 flex items-center gap-2"><Hash size={12}/> {selectedIssue.unit_number} </div>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition text-slate-500 dark:text-slate-400"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950/50">
                        {/* Detail Keluhan Awal */}
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Keluhan Awal</span>
                                <span className="text-[10px] text-slate-400">{new Date(selectedIssue.created_at).toLocaleDateString('id-ID', {day: 'numeric', month:'short', year:'numeric'})}</span>
                            </div>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{selectedIssue.description}</p>
                            {renderAttachments(selectedIssue.attachment_url)}
                        </div>

                        {/* List Chat */}
                        {comments.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs py-4 italic">Belum ada percakapan. Mulai respon di bawah.</div>
                        ) : (
                            comments.map((c) => {
                                const isSystem = c.sender_name === 'System'
                                if(isSystem) return (<div key={c.id} className="flex justify-center my-4"><span className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 px-3 py-1 rounded-full font-bold">{c.message}</span></div>)
                                return (
                                    <div key={c.id} className={`flex flex-col ${c.is_admin ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${c.is_admin ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none'}`}>
                                            <div className="font-bold text-[10px] mb-1 opacity-80 flex justify-between gap-4"><span>{c.sender_name} {c.is_admin ? '(Key Account)' : ''}</span></div>
                                            
                                            {/* Render Message Text */}
                                            {c.message && <p className="whitespace-pre-wrap">{c.message}</p>}
                                            
                                            {/* Render Chat Attachment (Aman untuk Format Lama & Baru) */}
                                            {c.attachment_url && renderChatAttachments(c.attachment_url)}

                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">{new Date(c.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                )
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shrink-0">
                        {/* Input Area */}
                        {selectedIssue.status !== 'CLOSED' && (
                            <div className="flex flex-col gap-2">
                                
                                {/* AREA PREVIEW FILE */}
                                {chatFiles.length > 0 && (
                                    <div className="flex gap-3 overflow-x-auto pt-3 pb-2 px-1 scrollbar-hide">
                                        {chatFiles.map((file, idx) => (
                                            <div key={idx} className="relative shrink-0 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 w-32 shadow-sm animate-in fade-in zoom-in duration-200">
                                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md shrink-0">
                                                    {file.type.startsWith('image/') ? <ImageIcon size={14}/> : <FileText size={14}/>}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[10px] font-bold truncate block w-full text-slate-700 dark:text-slate-200" title={file.name}>{file.name}</span>
                                                    <span className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                                                </div>
                                                
                                                {/* TOMBOL HAPUS */}
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveFile(idx)} 
                                                    className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-transform hover:scale-110 z-10 border-2 border-white dark:border-slate-900"
                                                >
                                                    <X size={10}/>
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {/* Tombol Tambah File Lagi (+) */}
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="shrink-0 w-8 h-full min-h-10 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                                            title="Tambah file lain"
                                        >
                                            <Plus size={16}/>
                                        </button>
                                    </div>
                                )}

                                {/* FORM TEXT & TOMBOL KIRIM */}
                                <form onSubmit={handleSendMessage} className="flex gap-2 mb-3 items-end">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileSelect} 
                                        className="hidden" 
                                        multiple 
                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                    />
                                    
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors mb-0.5"
                                        title="Lampirkan File"
                                    >
                                        <Paperclip size={20}/>
                                    </button>

                                    <input 
                                        type="text" 
                                        value={newMessage} 
                                        onChange={e => setNewMessage(e.target.value)} 
                                        placeholder={chatFiles.length > 0 ? "Tambahkan pesan (opsional)..." : "Tulis balasan..."} 
                                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                                    />
                                    
                                    <button 
                                        type="submit" 
                                        disabled={sending || (!newMessage.trim() && chatFiles.length === 0)} 
                                        className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 transition-all mb-0.5 shadow-md"
                                    >
                                        {sending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                                    </button>
                                </form>
                            </div>
                        )}
                        <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-2">
                            {/* LOGIC TOMBOL AJUKAN SELESAI */}
                            {/* Kondisi: Admin + Belum Closed + Belum Waiting + SUDAH ADA REPLY ADMIN */}
                            {isAdmin && selectedIssue.status !== 'CLOSED' && selectedIssue.status !== 'WAITING CONFIRMATION' && hasAdminReplied && (
                                <button onClick={handleAdminProposeResolve} className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"><CheckCircle size={14}/> Ajukan Selesai</button>
                            )}
                            
                            {selectedIssue.status === 'WAITING CONFIRMATION' && (
                                <>
                                    {currentUserEmail === selectedIssue.profiles?.email ? (
                                        <div className="flex gap-2">
                                            <button onClick={handleUserReject} className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"><XCircle size={14}/> Belum / Revisi</button>
                                            <button onClick={handleUserConfirmClose} className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"><CheckCircle size={14}/> Konfirmasi Selesai</button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500 italic flex items-center gap-1"><Clock size={14}/> Menunggu konfirmasi dari {selectedIssue.profiles?.full_name || 'User'}...</span>
                                    )}
                                </>
                            )}
                            {selectedIssue.status === 'CLOSED' && (<span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={14}/> Tiket Ditutup</span>)}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </main>
  )
}