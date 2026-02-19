'use client'

import React, { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Save, UploadCloud, FileSpreadsheet, Loader2, 
  AlertCircle, Terminal, FileType, Sun, Moon, Laptop,
  CheckCircle2, ChevronDown, RotateCcw, FileDown
} from 'lucide-react'
import { useTheme } from '../components/ThemeProvider'

// ==========================================
// KONFIGURASI DATA
// ==========================================
const TABLE_NAME = 'otif_data'

const REQUIRED_HEADERS = [
  "sheet_source", "plant", "pss_name", "customer_code", "customer_name",
  "customer_group", "product", "fill_rate", "year_sap", "year", "month",
  "month_invoice", "categori_rank", "performance", "otif",
  "lt_po_ke_sap", "sap_ke_sourching", "sourching_to_allocated",
  "allocated_ke_dn", "dn_ke_shipment", "shipment_ke_billing",
  "billing_ke_delivery", "delivery_ke_receive",
  "remaks_aging_po", "adjustment_outstanding", "material_no"
]

const COLUMN_DEFS: { header: string; key: string; width: number }[] = [
  { header: 'sheet_source', key: 'sheet_source', width: 14 },
  { header: 'plant', key: 'plant', width: 8 },
  { header: 'pss_name', key: 'pss_name', width: 28 },
  { header: 'customer_code', key: 'customer_code', width: 15 },
  { header: 'customer_name', key: 'customer_name', width: 35 },
  { header: 'customer_group', key: 'customer_group', width: 20 },
  { header: 'product', key: 'product', width: 18 },
  { header: 'fill_rate', key: 'fill_rate', width: 15 },
  { header: 'year_sap', key: 'year_sap', width: 10 },
  { header: 'year', key: 'year', width: 8 },
  { header: 'month', key: 'month', width: 12 },
  { header: 'month_invoice', key: 'month_invoice', width: 14 },
  { header: 'categori_rank', key: 'categori_rank', width: 16 },
  { header: 'performance', key: 'performance', width: 13 },
  { header: 'otif', key: 'otif', width: 10 },
  { header: 'lt_po_ke_sap', key: 'lt_po_ke_sap', width: 14 },
  { header: 'sap_ke_sourching', key: 'sap_ke_sourching', width: 16 },
  { header: 'sourching_to_allocated', key: 'sourching_to_allocated', width: 20 },
  { header: 'allocated_ke_dn', key: 'allocated_ke_dn', width: 16 },
  { header: 'dn_ke_shipment', key: 'dn_ke_shipment', width: 14 },
  { header: 'shipment_ke_billing', key: 'shipment_ke_billing', width: 18 },
  { header: 'billing_ke_delivery', key: 'billing_ke_delivery', width: 18 },
  { header: 'delivery_ke_receive', key: 'delivery_ke_receive', width: 18 },
  { header: 'remaks_aging_po', key: 'remaks_aging_po', width: 18 },
  { header: 'adjustment_outstanding', key: 'adjustment_outstanding', width: 20 },
  { header: 'material_no', key: 'material_no', width: 22 },
]

export default function ImportOTIFPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  ), [])

  // --- STATE ---
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- LOGIC HELPER ---
  const addLog = (message: string) => {
    setLogs(prev => [...prev, message.startsWith('>') ? message : `> ${message}`])
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

  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light': return <Sun size={14} />
      case 'dark': return <Moon size={14} />
      case 'system': return <Laptop size={14} />
      default: return <Sun size={14} />
    }
  }

  // =========================================================================
  // 1. DOWNLOAD TEMPLATE (ExcelJS)
  // =========================================================================
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Template OTIF')

    sheet.columns = COLUMN_DEFS.map(c => ({ header: c.header, key: c.key, width: c.width }))

    // Style header row: locked
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.eachCell(cell => {
      cell.protection = { locked: true }
    })

    // Unlock data cells explicitly (cell-level, like SalesPlan)
    // Use column letters for all 26 columns (A-Z)
    const colLetters = Array.from({ length: COLUMN_DEFS.length }, (_, i) => {
      let col = ''
      let n = i
      while (n >= 0) {
        col = String.fromCharCode((n % 26) + 65) + col
        n = Math.floor(n / 26) - 1
      }
      return col
    })

    for (let i = 2; i <= 100000; i++) {
      const row = sheet.getRow(i)
      row.protection = { locked: false }
      // Touch each cell to force ExcelJS to create the cell object with unlocked flag
      colLetters.forEach(col => {
        sheet.getCell(`${col}${i}`).protection = { locked: false }
      })
    }

    await sheet.protect('admin123', {
      selectLockedCells: false, selectUnlockedCells: true,
      formatCells: false, insertRows: true, deleteRows: true,
      insertColumns: false, deleteColumns: false,
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, 'Template_OTIF_Data.xlsx')
  }

  // =========================================================================
  // 2. PROCESS IMPORT
  // =========================================================================
  const processImport = async () => {
    if (!file) return
    if (!confirm(`Konfirmasi: Import data ini ke tabel '${TABLE_NAME}'?`)) return

    setIsProcessing(true)
    setIsComplete(false)
    setLogs([])
    addLog('Memulai analisis file...')
    setProgress(5)
  
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        
        // --- 1. Validasi Header ---
        const jsonDataRaw = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        if (jsonDataRaw.length === 0) throw new Error("File kosong.")

        const fileHeaders = (jsonDataRaw[0] as string[]).map(h => String(h).trim())
        const missingHeaders = REQUIRED_HEADERS.filter(req => !fileHeaders.includes(req))

        if (missingHeaders.length > 0) {
          throw new Error(`HEADER SALAH. Hilang: ${missingHeaders.join(', ')}`)
        }

        addLog(`Header valid. Memproses data...`)
        setProgress(20)

        // --- 2. Mapping Data ---
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet)
        const validRecords: any[] = []

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]

          const record: any = {}
          REQUIRED_HEADERS.forEach(header => {
            const val = row[header]
            record[header] = val !== undefined && val !== null ? String(val).trim() : null
          })

          // Skip completely empty rows
          const hasData = Object.values(record).some(v => v !== null && v !== '')
          if (hasData) validRecords.push(record)
        }

        if (validRecords.length === 0) {
          throw new Error('Tidak ada data valid ditemukan di file.')
        }

        addLog(`Data Valid (${validRecords.length} baris). Uploading ke tabel '${TABLE_NAME}'...`)
        
        // --- 3. Upload Batching ---
        const BATCH_SIZE = 1000
        const totalBatches = Math.ceil(validRecords.length / BATCH_SIZE)
        
        for (let i = 0; i < totalBatches; i++) {
          const batch = validRecords.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
          const { error } = await supabase.from(TABLE_NAME).insert(batch)
          if (error) throw new Error(`Batch ${i+1} gagal: ${error.message}`)
          
          const currentProgress = 30 + Math.floor(((i + 1) / totalBatches) * 65)
          setProgress(currentProgress)
          addLog(`Batch ${i+1}/${totalBatches} sukses.`)
        }

        addLog('SELESAI! Semua data berhasil diimport.')
        setIsComplete(true)
        setIsProcessing(false)
        setProgress(100)
        alert(`Import Sukses! ${validRecords.length} baris telah ditambahkan ke tabel ${TABLE_NAME}.`)

      } catch (err: any) {
        console.error(err)
        addLog(`ERROR: ${err.message}`)
        setIsProcessing(false)
        setProgress(0)
        alert('Gagal: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  // ==========================================
  // RENDER UI
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 flex justify-center items-start">
      <div className="w-full max-w-2xl">

        {/* HEADER */}
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
                Import Data OTIF
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Upload Excel/CSV untuk update data {TABLE_NAME}.
              </p>
            </div>
          </div>

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
                  onClick={() => { setTheme(m); setIsDropdownOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${theme === m ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {getThemeIcon(m)}
                  <span className="capitalize">{m === 'system' ? 'Sistem' : m === 'light' ? 'Terang' : 'Gelap'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
          <div className="h-1 w-full absolute top-0 left-0"></div>

          <div className="p-6 md:p-8 space-y-6 pt-8">
            
            {/* TEMPLATE DOWNLOAD */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Belum punya format data?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Download template resmi agar import berjalan lancar.<br/>
                    Data akan dimasukkan ke tabel: <strong className="text-slate-700 dark:text-slate-300">{TABLE_NAME}</strong>.
                    <br/><span className="text-[10px] text-slate-400">Atau gunakan output dari script <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">combine_otif.py</code></span>
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleDownloadTemplate}
                className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 transition-all shadow-sm active:scale-95"
              >
                <FileDown size={16} />
                Download Template
              </button>
            </div>

            {/* DRAG & DROP AREA */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-slate-400"/> 
                Upload File OTIF <span className="text-red-500">*</span>
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
                    <p className="text-[10px] text-slate-400 mt-1">Format: .xlsx / .csv — Gunakan output combine_otif.py atau template</p>
                  </>
                )}
              </div>
            </div>

            {/* LOGS TERMINAL */}
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
                 
                 <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 border border-slate-700 font-mono text-[10px] text-slate-300 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                      <div className={`h-full transition-all duration-300 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 pt-2 space-y-1">
                      {logs.map((l, i) => (
                        <div key={i} className="flex gap-2 text-slate-700 dark:text-slate-300">
                            <span className="text-slate-700 dark:text-slate-300">$</span>
                            <span>{l.replace(/^> /, '')}</span>
                        </div>
                      ))}
                      {isProcessing && <div className="animate-pulse pl-4 text-slate-400">_ working...</div>}
                    </div>
                 </div>
              </div>
            )}

          </div>

          {/* ACTION BUTTONS */}
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
                 className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-400 hover:bg-slate-700 flex items-center gap-2 shadow-lg transition-all active:scale-95"
               >
                 <RotateCcw size={18}/> Import Lagi
               </button>
            ) : (
                <button 
                onClick={processImport}
                disabled={!file || isProcessing}
                className={`
                    px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-lg transition-all
                    ${!file || isProcessing 
                    ? 'bg-slate-400 cursor-not-allowed opacity-80 shadow-none' 
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