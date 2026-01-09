'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, FileWarning, User, AlignLeft, AlertCircle, Users, Hash, Paperclip, Loader2, X, FileText, UploadCloud, ChevronDown, Check } from 'lucide-react' 
import { createBrowserClient } from '@supabase/ssr'

// --- KOMPONEN BARU: SEARCHABLE INPUT (COMBOBOX) ---
// Search langsung di input field, dropdown hanya menampilkan hasil.
const SearchableSelect = ({ value, options, onChange, placeholder, disabled }: any) => {
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value || "")
    const containerRef = useRef<HTMLDivElement>(null)

    // Sync input value jika value dari parent berubah (misal setelah save atau load data)
    useEffect(() => {
        setInputValue(value || "")
    }, [value])

    // Filter options berdasarkan apa yang diketik user
    const filteredOptions = useMemo(() => {
        if (!inputValue) return options
        // Jika input sama persis dengan salah satu option, tampilkan semua (asumsi user sedang melihat)
        // atau tetap filter. Di sini kita tetap filter agar responsif.
        return options.filter((o: any) => 
            o.label.toLowerCase().includes(inputValue.toLowerCase())
        )
    }, [options, inputValue])

    // Handle klik di luar untuk menutup dropdown
    useEffect(() => {
        const handleDown = (e: MouseEvent) => { 
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                // Jika user klik luar, kembalikan input ke value terakhir yang valid (jika ada)
                // atau biarkan apa adanya (tergantung preference). 
                // Disini kita set agar sinkron dengan state parent.
                if (value) setInputValue(value)
                else setInputValue("") 
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleDown); 
        return () => document.removeEventListener('mousedown', handleDown)
    }, [isOpen, value])

    const handleSelect = (val: string) => {
        onChange(val)      // Update state parent
        setInputValue(val) // Update text di input
        setIsOpen(false)   // Tutup dropdown
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value
        setInputValue(text)
        setIsOpen(true)
        
        // Opsional: Jika user menghapus teks sampai habis, reset parent value
        if (text === '') {
            onChange('')
        }
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* INPUT FIELD SEKALIGUS SEARCH */}
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

            {/* DROPDOWN MENU (Hanya List) */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col max-h-60 animate-in fade-in zoom-in-95 duration-200">
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt: any) => (
                                <button 
                                    key={opt.value} 
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full text-left px-3 py-2 text-xs rounded flex items-center justify-between transition-colors ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <span>{opt.label}</span>
                                    {value === opt.value && <Check size={14}/>}
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [loading, setLoading] = useState(false)
  const [customerList, setCustomerList] = useState<{name: string, group: string}[]>([])
  
  // State untuk Multiple Files
  const [files, setFiles] = useState<File[]>([])

  const [formData, setFormData] = useState({
    customer_name: '',
    cust_group: '',  
    unit_number: '', 
    issue_type: '', 
    description: '',
    created_by: ''
  })

  // 1. Fetch Data
  useEffect(() => {
    const initData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const email = user.email || ''
            setFormData(prev => ({ ...prev, created_by: email }))
        }

        try {
            const { data, error } = await supabase
                .from('mv_sales_summary')
                .select('cust_name, cust_group')
                .not('cust_name', 'is', null)
                .order('cust_name')
            
            if (data && !error) {
                const uniqueCust = new Map()
                data.forEach(item => {
                    if (!uniqueCust.has(item.cust_name)) {
                        uniqueCust.set(item.cust_name, item.cust_group || '') 
                    }
                })
                setCustomerList(Array.from(uniqueCust, ([name, group]) => ({ name, group })))
            }
        } catch (err) {
            console.error("Gagal memuat list customer:", err)
        }
    }

    initData()
  }, [])

  // Handle Select dari Component Baru
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

  // --- HANDLE FILE CHANGE ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const newFiles = Array.from(e.target.files)
        const MAX_SIZE = 50 * 1024 * 1024 // 50MB
        
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
    
    // Validasi sederhana: pastikan customer dipilih dari list yang valid
    // (Opsional: Jika boleh input manual nama baru, hapus validasi ini)
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

      // Upload Multiple Files
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
      router.push('/summary') 

    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Siapkan options untuk SearchableSelect
  const customerOptions = customerList.map(c => ({ label: c.name, value: c.name }))

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 flex justify-center items-start">
      <div className="w-full max-w-2xl">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"><ArrowLeft size={20} /></button>
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <FileWarning className="text-red-500" size={24}/> Input Keluhan Customer
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Isi formulir sesuai keluhan yang diterima.</p>
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
                
                {/* COMPONENT COMBOBOX BARU */}
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
                        <option value="PO belum tersuplai">PO belum tersuplai</option>
                        <option value="Pengajuan Warranty">Pengajuan Warranty</option>
                        <option value="Others">Others</option>
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
                    <UploadCloud size={16} />
                    Pilih File
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