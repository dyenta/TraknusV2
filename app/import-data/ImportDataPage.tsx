'use client'

import React, { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Save, UploadCloud, FileSpreadsheet, Loader2, 
  AlertCircle, Terminal, FileType, Database, Sun, Moon, Laptop,
  CheckCircle2, ChevronDown, RotateCcw
} from 'lucide-react'
import { useTheme } from '../components/ThemeProvider'

export default function ImportDataPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  
  // State untuk Dropdown Tema (Sesuai SalesIssuesPage)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  ), [])

  // --- STATE ---
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false) // State baru untuk menandai selesai
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const TABLE_NAME = 'master' 

  // --- HELPER UNTUK ICON TEMA ---
  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light': return <Sun size={14} />
      case 'dark': return <Moon size={14} />
      case 'system': return <Laptop size={14} />
      default: return <Sun size={14} />
    }
  }

  // --- LOGIC ---
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `> ${message}`])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      resetState()
    }
  }

  const resetState = () => {
    setLogs([])
    setProgress(0)
    setIsComplete(false)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      resetState();
    }
  }

  const handleResetForm = () => {
    setFile(null)
    resetState()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processImport = async () => {
    if (!file) return
    if (!confirm("Konfirmasi: Import data ini ke Master Database?")) return

    setIsProcessing(true)
    setIsComplete(false)
    setLogs(['Memulai proses...'])
    setProgress(5)

    try {
      // 1. Baca File
      const data = await file.arrayBuffer()
      
      const workbook = XLSX.read(data, { cellDates: true })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) throw new Error("File kosong/format salah.")

      // 2. Sanitasi Data
      const sanitizedData = jsonData.map((row: any) => {
        const newRow: any = {}
        Object.keys(row).forEach(key => {
          let value = row[key]
          if (value instanceof Date) {
            const offset = value.getTimezoneOffset() * 60000
            const localDate = new Date(value.getTime() - offset)
            value = localDate.toISOString().split('T')[0]
          }
          newRow[key] = value
        })
        return newRow
      })

      addLog(`File loaded & cleaned: ${sanitizedData.length} baris.`)
      
      // 3. Batch Insert
      const BATCH_SIZE = 1000
      const totalBatches = Math.ceil(sanitizedData.length / BATCH_SIZE)
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE
        const end = start + BATCH_SIZE
        const batch = sanitizedData.slice(start, end)

        const { error } = await supabase.from(TABLE_NAME).insert(batch)
        if (error) throw new Error(error.message)
        
        const currentProgress = Math.round(((i + 1) / totalBatches) * 85)
        setProgress(currentProgress)
        addLog(`Batch ${i+1}/${totalBatches} terupload.`)
      }

      // 4. TRIGGER FUNCTION Refresh MV
      addLog('Menjalankan Refresh Data Sales...')
      const { error: rpcError } = await supabase.rpc('refresh_sales_data')
      
      if (rpcError) {
        throw new Error(`Gagal refresh data: ${rpcError.message}`)
      }
      
      setProgress(100)
      addLog('SELESAI. Data berhasil diperbarui.')
      setIsComplete(true)
      
      // NOTIFIKASI SUKSES (Tanpa Redirect)
      alert('Import Sukses! Data Dashboard telah diperbarui.')
      
    } catch (error: any) {
      console.error(error)
      addLog(`ERROR: ${error.message}`)
      alert('Gagal: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 flex justify-center items-start">
      <div className="w-full max-w-2xl">

        {/* --- HEADER (Style SalesIssuesPage) --- */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
                onClick={() => router.back()} 
                className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
            >
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                    <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded"/>
                    Import Data Master
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Upload Excel/CSV untuk update data penjualan.
                </p>
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

        {/* --- MAIN CARD --- */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
          
          {/* Decorative Top Line */}
          <div className="h-1  w-full absolute top-0 left-0"></div>

          <div className="p-6 md:p-8 space-y-6 pt-8">
            
            {/* Info / Warning Box */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">Panduan Format File:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Header kolom harus <strong>sama persis</strong> dengan nama kolom database.</li>
                  <li>Pastikan tanggal berformat Text atau YYYY-MM-DD.</li>
                </ul>
              </div>
            </div>

            {/* Upload Area */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-slate-400"/> 
                Upload File Source <span className="text-red-500">*</span>
              </label>
              
              <div 
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 group min-h-40
                  ${dragActive 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                    : isProcessing 
                        ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60' 
                        : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-emerald-400 cursor-pointer'
                  }
                `}
              >
                <input 
                  ref={fileInputRef} type="file" className="hidden"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleFileChange} disabled={isProcessing}
                />
                
                {file ? (
                  <div className="animate-in fade-in zoom-in-95 flex flex-col items-center">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-3 shadow-sm">
                      <FileType size={24} className="text-emerald-600 dark:text-emerald-400"/>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{file.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    
                    {!isProcessing && !isComplete && (
                       <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
                          <CheckCircle2 size={12}/> SIAP DIIMPORT
                       </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${dragActive ? 'bg-emerald-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <UploadCloud size={24} className={dragActive ? "text-emerald-700" : "text-slate-400 group-hover:text-emerald-500"} />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Klik cari file</span> / drag ke sini
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Terminal Logs (Muncul saat proses atau ada logs) */}
            {(isProcessing || logs.length > 0) && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                 <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                        <Terminal size={14} className="text-slate-400"/> Status Proses
                    </label>
                    <span className={`text-xs font-mono font-bold ${progress === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {progress}%
                    </span>
                 </div>
                 
                 <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 font-mono text-[10px] text-slate-300 shadow-inner relative overflow-hidden">
                    {/* Progress Bar Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                      <div className={`h-full transition-all duration-300 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 pt-2 space-y-1">
                      {logs.map((l, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-500 shrink-0">$</span>
                            <span>{l.replace('> ', '')}</span>
                        </div>
                      ))}
                      {isProcessing && <div className="animate-pulse pl-4 text-emerald-400">_ working...</div>}
                    </div>
                 </div>
              </div>
            )}

          </div>

          {/* --- FOOTER ACTIONS --- */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 px-6 md:px-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 items-center">
             
            <button 
                type="button" 
                onClick={() => router.back()}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
                Kembali
            </button>
            
            {isComplete ? (
               <button 
                 onClick={handleResetForm}
                 className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 flex items-center gap-2 shadow-lg transition-all active:scale-95"
               >
                 <RotateCcw size={18}/> Import Lagi
               </button>
            ) : (
                <button 
                onClick={processImport}
                disabled={!file || isProcessing}
                className={`
                    px-6 py-2.5 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-lg transition-all
                    ${!file || isProcessing 
                    ? 'bg-slate-400 cursor-not-allowed opacity-70 shadow-none' 
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/30 active:scale-95'
                    }
                `}
                >
                {isProcessing ? (
                    <><Loader2 className="animate-spin" size={18}/> Memproses...</>
                ) : (
                    <><Save size={18}/> Mulai Import</>
                )}
                </button>
            )}
          </div>

        </div>
      </div>
    </main>
  )
}