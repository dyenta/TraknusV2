'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Save, User, AlignLeft, AlertCircle, Users, Hash, 
  Paperclip, Loader2, X, FileText, UploadCloud, ChevronDown, Check,
  Sun, Moon, Laptop 
} from 'lucide-react' 
import { createBrowserClient } from '@supabase/ssr'
// Pastikan path ini sesuai dengan struktur project Anda
import { useTheme } from '../components/ThemeProvider'

// ... (Kode komponen SearchableSelect TETAP SAMA, tidak perlu diubah) ...
const SearchableSelect = ({ value, options, onChange, placeholder, disabled }: any) => {
    // ... (isi komponen SearchableSelect sama seperti sebelumnya)
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value || "")
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setInputValue(value || "")
    }, [value])

    const filteredOptions = useMemo(() => {
        if (!inputValue) return options
        return options.filter((o: any) => 
            o.label.toLowerCase().includes(inputValue.toLowerCase())
        )
    }, [options, inputValue])

    useEffect(() => {
        const handleDown = (e: MouseEvent) => { 
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                if (value) setInputValue(value)
                else setInputValue("") 
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleDown); 
        return () => document.removeEventListener('mousedown', handleDown)
    }, [isOpen, value])

    const handleSelect = (val: string) => {
        onChange(val)      
        setInputValue(val) 
        setIsOpen(false)   
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value
        setInputValue(text)
        setIsOpen(true)
        if (text === '') {
            onChange('')
        }
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <input 
                    type="text"
                    disabled={disabled}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    className={`w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg transition-all text-sm outline-none ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'dark:text-white'}`}
                />
                <ChevronDown size={16} className={`absolute right-3 top-3 text-slate-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col max-h-60 animate-in fade-in zoom-in-95 duration-200">
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt: any, idx: number) => (
                                <button 
                                    key={`${opt.value}-${idx}`}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full text-left px-3 py-2 text-xs rounded flex items-center justify-between transition-colors ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <span>{opt.label}</span>
                                    {value === opt.value && <Check size={14} className="shrink-0"/>}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                Tidak ada data "{inputValue}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function SalesIssuesPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [loading, setLoading] = useState(false)
  const [customerList, setCustomerList] = useState<{name: string, group: string}[]>([])
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const [formData, setFormData] = useState({
    customer_name: '',
    cust_group: '',  
    unit_number: '', 
    issue_type: '', 
    description: '',
    created_by: ''
  })

  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light': return <Sun size={14} />
      case 'dark': return <Moon size={14} />
      case 'system': return <Laptop size={14} />
      default: return <Sun size={14} />
    }
  }

  // --- FETCH DATA MENGGUNAKAN RPC & NORMALISASI ---
  useEffect(() => {
    const initData = async () => {
        try {
            // 1. Get User Session
            const { data: { user } } = await supabase.auth.getUser()
            
            if (user) {
                // --- PERUBAHAN DISINI: Ambil dari tabel profiles ---
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('email') // Pastikan nama kolom di tabel profiles adalah 'email'
                    .eq('id', user.id) // Pastikan primary key profiles adalah 'id' yang sama dengan auth.uid
                    .single()

                if (profileData && !profileError) {
                    setFormData(prev => ({ ...prev, created_by: profileData.email }))
                } else {
                    // Fallback jika data di profiles kosong/error, pakai email auth bawaan
                    console.warn("Profile not found, using auth email", profileError)
                    setFormData(prev => ({ ...prev, created_by: user.email || '' }))
                }
            }

            // 2. Panggil Function RPC 'get_all_customers'
            const { data, error } = await supabase.rpc('get_all_customers')
            
            if (data && !error) {
                const uniqueCust = new Map()
                
                // 3. Logic Pembersih Double (Normalization)
                data.forEach((item: any) => {
                    if (item.cust_name) {
                        const cleanName = item.cust_name.trim()
                        const key = cleanName.toUpperCase()

                        if (!uniqueCust.has(key)) {
                            uniqueCust.set(key, { 
                                name: cleanName, 
                                group: item.cust_group || '' 
                            }) 
                        }
                    }
                })
                
                setCustomerList(Array.from(uniqueCust.values()))
            } else if (error) {
                console.error("Error RPC:", error)
            }
        } catch (err) {
            console.error("Gagal memuat data:", err)
        }
    }

    initData()
  }, []) 

  const handleCustomerSelect = (val: string) => {
    const found = customerList.find(c => c.name === val)
    setFormData({
        ...formData,
        customer_name: val,
        cust_group: found ? (found.group || '') : '' 
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const newFiles = Array.from(e.target.files)
        const MAX_SIZE = 50 * 1024 * 1024 
        
        const validFiles = newFiles.filter(f => {
            if (f.size > MAX_SIZE) {
                alert(`File ${f.name} terlalu besar (Max 50MB)`)
                return false
            }
            return true
        })

        setFiles(prev => [...prev, ...validFiles])
        e.target.value = '' 
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if(!formData.customer_name) {
        alert('Mohon pilih Customer Name!')
        return
    }

    if(!formData.description.trim()) {
        alert('Mohon isi kolom Deskripsi!')
        return
    }

    setLoading(true)

    try {
      const uploadedUrls: string[] = []

      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('issue-attachments')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
                .from('issue-attachments')
                .getPublicUrl(filePath)
            
            return urlData.publicUrl
        })

        const results = await Promise.all(uploadPromises)
        uploadedUrls.push(...results)
      }

      const attachmentValue = uploadedUrls.length > 0 
          ? JSON.stringify(uploadedUrls) 
          : null

      const payload = {
          ...formData,
          cust_group: formData.cust_group || null, 
          attachment_url: attachmentValue 
      }

      const { error } = await supabase.from('sales_issues').insert([payload])
      
      if (error) throw error
      
      alert('Keluhan berhasil disimpan!')
      router.refresh()
      // Ganti route di bawah sesuai kebutuhan
      router.push('/summary') 

    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const customerOptions = useMemo(() => 
    customerList.map(c => ({ label: c.name, value: c.name })), 
  [customerList])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 flex justify-center items-start">
      <div className="w-full max-w-2xl">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"><ArrowLeft size={20} /></button>
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/>  Input Keluhan Customer
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Isi formulir sesuai keluhan yang diterima.</p>
            </div>
          </div>

          {/* THEME DROPDOWN */}
          <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} 
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-medium shadow-sm"
                >
                  {getThemeIcon(theme)}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}/>
                </button>

                <div className={`absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden transition-all duration-200 origin-top-right z-50 ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
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

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 md:p-8 flex flex-col gap-6">
            
            {/* Baris 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <User size={12}/> Customer Name <span className="text-red-500">*</span>
                </label>
                
                {/* COMBOBOX */}
                <SearchableSelect 
                    placeholder="Ketik nama customer..."
                    value={formData.customer_name}
                    options={customerOptions}
                    onChange={handleCustomerSelect}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Users size={12}/> Cust. Group
                </label>
                <input 
                  type="text" 
                  name="cust_group"
                  value={formData.cust_group || ''} 
                  readOnly
                  placeholder="Auto-fill Group"
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed text-sm font-semibold"
                />
              </div>
            </div>

            {/* Baris 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                        <Hash size={12}/> Unit Number
                    </label>
                    <input 
                        type="text" 
                        required 
                        name="unit_number"
                        value={formData.unit_number}
                        onChange={handleChange}
                        placeholder="Contoh: UN-2024-001"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all text-sm"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                        <AlertCircle size={12}/> Issue Type
                    </label>
                    <select 
                        required 
                        name="issue_type"
                        value={formData.issue_type}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm ${formData.issue_type === '' ? 'text-slate-400' : 'dark:text-white'}`}
                    >
                        <option value="" disabled>Pilih Issue Type</option>
                        <option value="PO BELUM TERSUPLAI">PO BELUM TERSUPLAI</option>
                        <option value="PENGAJUAN WARRANTY">PENGAJUAN WARRANTY</option>
                        <option value="OTHERS">OTHERS</option>
                    </select>
                </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <AlignLeft size={12}/> Description <span className="text-red-500">*</span>
              </label>
              <textarea 
                required
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Deskripsi detail masalah..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all text-sm resize-none"
              />
            </div>

            {/* ATTACHMENT SECTION */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                    <Paperclip size={14}/> Lampiran (Foto / PDF)
                </label>
                
                <div>
                  <input 
                      id="file-upload" 
                      type="file" 
                      multiple 
                      accept="image/*,.pdf" 
                      onChange={handleFileChange}
                      className="hidden" 
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    <UploadCloud size={16} /> Pilih File
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {files.map((f, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={14} className="text-blue-500 shrink-0"/>
                          <span className="text-xs truncate font-medium dark:text-slate-200 max-w-50">{f.name}</span>
                          <span className="text-[10px] text-slate-400"> ({f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / (1024 * 1024)).toFixed(2)} MB`})</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeFile(idx)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                          <X size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="text-[10px] text-slate-400 mt-2">
                    *Opsional. Bisa pilih lebih dari 1 file sekaligus. <strong>Max 50MB/file.</strong>
                </div>
            </div>
            
            <div className="text-xs text-slate-400 text-right">
                Created by: {formData.created_by || 'Loading user...'}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                  type="button" 
                  onClick={() => router.back()}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                  Batal
              </button>
              
              <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <><Loader2 className="animate-spin" size={16}/> Mengirim...</> : <><Save size={16}/> Simpan Data</>}
              </button>
            </div>

          </form>
        </div>
      </div>
    </main>
  )
}