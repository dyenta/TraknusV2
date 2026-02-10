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
// KONFIGURASI DATA (SALES PLAN)
// ==========================================
const TABLE_NAME = 'sales_plan'; 

// Header yang wajib ada di file Excel/CSV user
const REQUIRED_HEADERS = [
  "Year", "Business Area", "PSS", "Product", 
  "Customer Code", "Customer Name", "Customer Group", "Key Account Type",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Total Plan"
];

export default function ImportSalesPlanPage() {
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
  // 1. DOWNLOAD TEMPLATE (ExcelJS) - Disesuaikan dengan Sales Plan
  // =========================================================================
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template Sales Plan');

    // Definisi Kolom sesuai Skema Database Sales Plan
    sheet.columns = [
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Business Area', key: 'business_area', width: 15 },
      { header: 'PSS', key: 'pss', width: 12 },
      { header: 'Product', key: 'product', width: 20 },
      { header: 'Key Account Type', key: 'key_account_type', width: 20 },      
      { header: 'Customer Code', key: 'cust_code', width: 15 },
      { header: 'Customer Name', key: 'cust_name', width: 30 },
      { header: 'Customer Group', key: 'cust_group', width: 20 },
      // Kolom Bulan (Numeric)
      { header: 'Jan', key: 'jan', width: 12 },
      { header: 'Feb', key: 'feb', width: 12 },
      { header: 'Mar', key: 'mar', width: 12 },
      { header: 'Apr', key: 'apr', width: 12 },
      { header: 'May', key: 'may', width: 12 },
      { header: 'Jun', key: 'jun', width: 12 },
      { header: 'Jul', key: 'jul', width: 12 },
      { header: 'Aug', key: 'agt', width: 12 }, // Mapping header ke 'agt' db
      { header: 'Sep', key: 'sept', width: 12 }, // Mapping header ke 'sept' db
      { header: 'Oct', key: 'oct', width: 12 },
      { header: 'Nov', key: 'nov', width: 12 },
      { header: 'Dec', key: 'dec', width: 12 },
      { header: 'Total Plan', key: 'total_plan', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.protection = { locked: true };

    for (let i = 2; i <= 10000; i++) {
        const row = sheet.getRow(i);
        row.protection = { locked: false };

        // Validasi Tahun
        sheet.getCell(`A${i}`).dataValidation = {
            type: 'whole', operator: 'between', formulae: [2020, 2030],
            showErrorMessage: true, errorTitle: 'Salah Input', error: 'Tahun harus 2020-2030'
        };

        // Format Angka untuk kolom I (Jan) sampai U (Total Plan)
        ['I','J','K','L','M','N','O','P','Q','R','S','T','U'].forEach(col => {
            sheet.getCell(`${col}${i}`).numFmt = '#,##0.00';
            sheet.getCell(`${col}${i}`).dataValidation = {
                type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0],
                showErrorMessage: false, // Allow negative if adjustment needed, or strict positive
            };
        });
    }

    await sheet.protect('admin123', {
        selectLockedCells: false, selectUnlockedCells: true,
        formatCells: false, insertRows: true, deleteRows: true,
        insertColumns: false, deleteColumns: false,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Template_Sales_Plan.xlsx');
  }

  // =========================================================================
  // 2. PROCESS IMPORT (Logic Update)
  // =========================================================================
  const processImport = async () => {
    if (!file) return
    if (!confirm(`Konfirmasi: Import data ini ke tabel '${TABLE_NAME}'?`)) return

    setIsProcessing(true)
    setIsComplete(false)
    setLogs([])
    addLog('Memulai analisis file Sales Plan...')
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

        // --- 2. Validasi & Mapping Data ---
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet)
        const validRecords: any[] = []
        const errors: string[] = []

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i]
            const rowNum = i + 2 
            
            // Validasi Field Wajib
            if (!row.Year || isNaN(Number(row.Year))) errors.push(`Baris ${rowNum}: 'Year' harus angka.`);
            if (!row["Customer Code"]) errors.push(`Baris ${rowNum}: 'Customer Code' wajib diisi.`);
            if (!row["Product"]) errors.push(`Baris ${rowNum}: 'Product' wajib diisi.`);
            
            // Cek jika jumlah error terlalu banyak
            if (errors.length > 20) {
                errors.push("... Terlalu banyak error. Perbaiki data.");
                break;
            }

            // Mapping Excel Row -> Database Column
            // Menggunakan 0 jika kosong/null untuk kolom angka
            validRecords.push({
                year: Number(row.Year),
                business_area: String(row["Business Area"] || ''),
                pss: String(row["PSS"] || ''),
                product: String(row["Product"] || ''),
                cust_code: String(row["Customer Code"] || ''),
                cust_name: String(row["Customer Name"] || ''),
                cust_group: String(row["Customer Group"] || ''),
                key_account_type: String(row["Key Account Type"] || ''),
                
                // Monthly Values
                jan: Number(row["Jan"] || 0),
                feb: Number(row["Feb"] || 0),
                mar: Number(row["Mar"] || 0),
                apr: Number(row["Apr"] || 0),
                may: Number(row["May"] || 0),
                jun: Number(row["Jun"] || 0),
                jul: Number(row["Jul"] || 0),
                agt: Number(row["Aug"] || 0),   // Mapping header Aug -> col agt
                sept: Number(row["Sep"] || 0),  // Mapping header Sep -> col sept
                oct: Number(row["Oct"] || 0),
                nov: Number(row["Nov"] || 0),
                dec: Number(row["Dec"] || 0),
                total_plan: Number(row["Total Plan"] || 0)
            })
        }

        if (errors.length > 0) {
            errors.forEach(err => addLog(`${err}`))
            addLog("PROSES DIBATALKAN. Perbaiki data Excel Anda.")
            setIsProcessing(false)
            setProgress(0)
            alert("Validasi Gagal! Cek log.")
            return
        }

        addLog(`Data Valid (${validRecords.length} baris). Uploading ke tabel '${TABLE_NAME}'...`)
        
        // --- 3. Upload Batching ---
        const BATCH_SIZE = 1000
        const totalBatches = Math.ceil(validRecords.length / BATCH_SIZE)
        
        for (let i = 0; i < totalBatches; i++) {
            const batch = validRecords.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
            const { error } = await supabase.from(TABLE_NAME).insert(batch)
            if (error) throw new Error(`Batch ${i+1} gagal: ${error.message}`)
            
            const currentProgress = 30 + Math.floor(((i + 1) / totalBatches) * 60)
            setProgress(currentProgress)
            addLog(`Batch ${i+1}/${totalBatches} sukses.`)
        }

        // --- 4. Refresh Data (Optional RPC Call) ---
        addLog('Menjalankan Refresh Sales Summary...')
        // Asumsi ada RPC untuk refresh materialized view sales plan jika diperlukan
        // Jika tidak ada, baris ini bisa di-comment atau disesuaikan
        const { error: rpcError } = await supabase.rpc('refresh_sales_data') 
        
        if (rpcError) {
             addLog(`Note: Refresh skipped or failed (${rpcError.message}). Data inserted.`)
        } else {
             addLog('Refresh Summary sukses.')
        }

        addLog('SELESAI! Semua Sales Plan berhasil diimport.')
        setIsComplete(true)
        setIsProcessing(false)
        setProgress(100)
        alert('Import Sukses! Data Sales Plan telah diperbarui.')

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
                    Import Sales Plan
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
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Belum punya format Sales Plan?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Download template resmi agar import berjalan lancar.<br/>
                    Data akan dimasukkan ke tabel: <strong className="text-slate-700 dark:text-slate-300">{TABLE_NAME}</strong>.
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
                Upload File Plan <span className="text-red-500">*</span>
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
                        <div key={i} className={`flex gap-2' text-slate-700 dark:text-slate-300 : ''}`}>
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