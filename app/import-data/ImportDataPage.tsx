'use client'

import React, { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Save, UploadCloud, FileSpreadsheet, Loader2, 
  AlertCircle, Terminal, FileType, Database, Sun, Moon, Laptop,
  CheckCircle2, X, FileWarning
} from 'lucide-react'
import { useTheme } from '../components/ThemeProvider'

export default function ImportDataPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  ), [])

  // --- STATE ---
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const TABLE_NAME = 'master' 

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

  const processImport = async () => {
    if (!file) return
    if (!confirm("Konfirmasi: Import data ini ke Master Database?")) return

    setIsProcessing(true)
    setLogs(['Memulai proses...'])
    setProgress(5)

    try {
      // 1. Baca File
      const data = await file.arrayBuffer()
      
      // UPDATE 1: Tambahkan opsi { cellDates: true } agar Excel serial number (43203...) 
      // otomatis diubah menjadi JS Date Object
      const workbook = XLSX.read(data, { cellDates: true })
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) throw new Error("File kosong/format salah.")

      // UPDATE 2: Sanitasi Data (Cleaning)
      // Kita perlu memastikan Date Object diubah menjadi string 'YYYY-MM-DD' 
      // agar diterima oleh PostgreSQL (tipe date)
      const sanitizedData = jsonData.map((row: any) => {
        const newRow: any = {}
        Object.keys(row).forEach(key => {
          let value = row[key]

          // Cek apakah value adalah Date (hasil dari cellDates: true)
          if (value instanceof Date) {
            // Trik untuk mengatasi pergeseran Timezone agar tanggal tidak mundur 1 hari
            // Mengambil tanggal sesuai waktu lokal, bukan UTC
            const offset = value.getTimezoneOffset() * 60000
            const localDate = new Date(value.getTime() - offset)
            // Ambil bagian YYYY-MM-DD saja
            value = localDate.toISOString().split('T')[0]
          }
          
          newRow[key] = value
        })
        return newRow
      })

      addLog(`File loaded & cleaned: ${sanitizedData.length} baris.`)
      
      // 2. Batch Insert (Gunakan sanitizedData, BUKAN jsonData)
      const BATCH_SIZE = 1000
      const totalBatches = Math.ceil(sanitizedData.length / BATCH_SIZE)
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE
        const end = start + BATCH_SIZE
        const batch = sanitizedData.slice(start, end) // <-- Pakai data yang sudah dibersihkan

        const { error } = await supabase.from(TABLE_NAME).insert(batch)
        if (error) throw new Error(error.message)
        
        // ... (kode log progress sama seperti sebelumnya) ...
        const currentProgress = Math.round(((i + 1) / totalBatches) * 85)
        setProgress(currentProgress)
        addLog(`Batch ${i+1}/${totalBatches} terupload.`)
      }

      // 3. Refresh MV
      addLog('Refreshing Data Summary...')
      await supabase.rpc('refresh_sales_data')
      
      setProgress(100)
      addLog('SELESAI. Data berhasil diperbarui.')
      alert('Import Sukses!')
      setTimeout(() => {
         router.push('/') // Redirect ke dashboard setelah sukses
      }, 1000)
      
    } catch (error: any) {
      console.error(error)
      addLog(`ERROR: ${error.message}`)
      alert('Gagal: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* --- 1. TOP NAVIGATION --- */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => router.back()} 
            className="group flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <div className="p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-slate-300 dark:group-hover:border-slate-500 transition-colors">
                 <ArrowLeft size={14} />
            </div>
            <span>Kembali ke Dashboard</span>
          </button>

          <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
            {['light', 'dark', 'system'].map((m: any) => (
              <button 
                key={m} 
                onClick={() => setTheme(m)} 
                className={`p-1.5 rounded-md transition-all ${theme === m ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                {m === 'light' ? <Sun size={14}/> : m === 'dark' ? <Moon size={14}/> : <Laptop size={14}/>}
              </button>
            ))}
          </div>
        </div>

        {/* --- 2. HEADER TITLE --- */}
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800 dark:text-white">
              <Database className="text-emerald-600 dark:text-emerald-400" size={28} />
              Import Data Master
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Upload file Excel atau CSV untuk menambahkan data transaksi penjualan terbaru ke dalam sistem. 
              Data akan otomatis disinkronkan ke Dashboard setelah proses selesai.
            </p>
        </div>

        {/* --- 3. MAIN CARD FORM --- */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
          
          {/* Decorative Top Line (Sama seperti SalesIssuesPage style) */}
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400 w-full absolute top-0 left-0"></div>

          <div className="p-6 md:p-8 space-y-8 pt-8">
            
            {/* Info / Warning Box */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">Panduan Format File:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Header kolom Excel/CSV harus <strong>sama persis (case-sensitive)</strong> dengan nama kolom di database.</li>
                  <li>Pastikan tidak ada format tanggal yang ambigu (Gunakan format Text atau YYYY-MM-DD).</li>
                  <li>Maksimal ukuran file disarankan di bawah 10MB untuk performa terbaik.</li>
                </ul>
              </div>
            </div>

            {/* Input Group: Upload Area */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-slate-400"/> 
                Upload File Source
                <span className="text-red-500">*</span>
              </label>
              
              <div 
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group min-h-[180px]
                  ${dragActive 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                    : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-emerald-400'
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
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-3 shadow-sm">
                      <FileType size={28} className="text-emerald-600 dark:text-emerald-400"/>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{file.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    
                    {!isProcessing && (
                       <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
                          <CheckCircle2 size={12}/> FILE SIAP DIIMPORT
                       </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${dragActive ? 'bg-emerald-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <UploadCloud size={28} className={dragActive ? "text-emerald-700" : "text-slate-400 group-hover:text-emerald-500"} />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Klik untuk cari file</span> atau drag ke sini
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Mendukung format .xlsx (Excel) dan .csv
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Input Group: Terminal Logs */}
            {(isProcessing || logs.length > 0) && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                 <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                        <Terminal size={14} className="text-slate-400"/> Proses Import
                    </label>
                    <span className={`text-xs font-mono font-bold ${progress === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {progress}% Selesai
                    </span>
                 </div>
                 
                 <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 font-mono text-[11px] text-slate-300 shadow-inner relative overflow-hidden">
                    {/* Progress Bar Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                      <div className={`h-full transition-all duration-300 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 pt-2 space-y-1">
                      {logs.map((l, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-500 shrink-0">$</span>
                            <span>{l.replace('> ', '')}</span>
                        </div>
                      ))}
                      {isProcessing && <div className="animate-pulse pl-4 text-emerald-400">_ processing data...</div>}
                    </div>
                 </div>
              </div>
            )}

          </div>

          {/* --- 4. FOOTER ACTIONS (Inside Card) --- */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 px-6 md:px-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 items-center">
             
             {/* Info Kiri (Optional) */}
             <div className="mr-auto text-[10px] text-slate-400 hidden md:block">
                System Administrator Access
             </div>

             <button 
                type="button" 
                onClick={() => router.back()}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
                Batal
            </button>
            
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
          </div>

        </div>

        {/* Bottom Metadata */}
        <div className="text-center text-[10px] text-slate-400 dark:text-slate-600 pt-2">
           &copy; {new Date().getFullYear()} Sales Dashboard System • Data Protection Policy Applied.
        </div>

      </div>
    </main>
  )
}