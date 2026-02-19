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
const TABLE_NAME = 'master'; 

const REQUIRED_HEADERS = [
  "Year", "Month", "Posting Date", "GL Account", "Reference", 
  "Assignment", "Document Number", "Invoice Type", "PSS", 
  "Business Area", "Amount (Local)", "Quantity", "RPL", 
  "Material", "Material Description", "Material Group", "Material Type", 
  "Product", "Customer Code", "Customer Name", "Customer Group", 
  "Key Account Type", "PIC", "Area"
];

export default function ImportDataPage() {
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
    // Menambahkan log ke terminal UI
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

  // Helper Format Date (YYYY-MM-DD)
  const formatDateToDB = (input: any): string | null => {
    if (!input) return null;
    let dateObj: Date | null = null;

    if (input instanceof Date) {
        dateObj = input;
    } else if (typeof input === 'string') {
        const d = new Date(input);
        if (!isNaN(d.getTime())) dateObj = d;
    } else if (typeof input === 'number') {
        dateObj = new Date(Math.round((input - 25569)*86400*1000));
    }

    if (dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return String(input); 
  }

  // =========================================================================
  // 1. DOWNLOAD TEMPLATE (ExcelJS)
  // =========================================================================
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template Upload');

    sheet.columns = [
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Month', key: 'month', width: 6 },
      { header: 'Posting Date', key: 'posting_date', width: 15 },
      { header: 'GL Account', key: 'gl_account', width: 12 },
      { header: 'Reference', key: 'reference', width: 15 },
      { header: 'Assignment', key: 'assignment', width: 15 },
      { header: 'Document Number', key: 'document_number', width: 15 },
      { header: 'Invoice Type', key: 'invoice_type', width: 10 },
      { header: 'PSS', key: 'pss', width: 12 },
      { header: 'Business Area', key: 'business_area', width: 15 },
      { header: 'Amount (Local)', key: 'amount', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'RPL', key: 'rpl', width: 10 },
      { header: 'Material', key: 'material', width: 12 },
      { header: 'Material Description', key: 'material_description', width: 30 },
      { header: 'Material Group', key: 'material_group', width: 12 },
      { header: 'Material Type', key: 'material_type', width: 10 },
      { header: 'Product', key: 'product', width: 20 },
      { header: 'Customer Code', key: 'cust_code', width: 15 },
      { header: 'Customer Name', key: 'cust_name', width: 30 },
      { header: 'Customer Group', key: 'cust_group', width: 20 },
      { header: 'Key Account Type', key: 'key_account_type', width: 20 },
      { header: 'PIC', key: 'pic', width: 20 },
      { header: 'Area', key: 'area', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.protection = { locked: true };

    for (let i = 2; i <= 10000; i++) {
        const row = sheet.getRow(i);
        row.protection = { locked: false };

        sheet.getCell(`A${i}`).dataValidation = {
            type: 'whole', operator: 'between', formulae: [2000, 2099],
            showErrorMessage: true, errorTitle: 'Salah Input', error: 'Tahun harus 2000-2099'
        };
        sheet.getCell(`B${i}`).dataValidation = {
            type: 'whole', operator: 'between', formulae: [1, 12],
            showErrorMessage: true, errorTitle: 'Salah Input', error: 'Bulan harus 1-12'
        };
        sheet.getCell(`K${i}`).dataValidation = {
            type: 'decimal', operator: 'greaterThan', formulae: [0],
            showErrorMessage: true, errorTitle: 'Salah Input', error: 'Amount harus angka'
        };
        sheet.getCell(`C${i}`).numFmt = 'yyyy-mm-dd';
    }

    // Enable AutoFilter pada header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length }
    };

    await sheet.protect('admin123', {
        autoFilter: true,
        selectLockedCells: false, selectUnlockedCells: true,
        formatCells: false, insertRows: true, deleteRows: true,
        insertColumns: false, deleteColumns: false,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Template_Master_Data.xlsx');
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

        // --- 2. Validasi & Mapping Data ---
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet)
        const validRecords: any[] = []
        const errors: string[] = []

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i]
            const rowNum = i + 2 
            
            if (!row.Year || isNaN(Number(row.Year))) errors.push(`Baris ${rowNum}: 'Year' harus angka.`);
            if (!row.Month || isNaN(Number(row.Month))) errors.push(`Baris ${rowNum}: 'Month' harus angka.`);
            
            const amt = row["Amount (Local)"];
            if (amt === undefined || amt === null || isNaN(Number(amt))) {
                errors.push(`Baris ${rowNum}: 'Amount (Local)' harus angka.`);
            }

            if (errors.length > 20) {
                errors.push("... Terlalu banyak error. Perbaiki data.");
                break;
            }

            const formattedDate = formatDateToDB(row["Posting Date"]);

            validRecords.push({
                year: Number(row.Year),
                month: Number(row.Month),
                posting_date: formattedDate,
                gl_account: String(row["GL Account"] || ''),
                reference: String(row["Reference"] || ''),
                assignment: String(row["Assignment"] || ''),
                document_number: String(row["Document Number"] || ''),
                invoice_type: String(row["Invoice Type"] || ''),
                pss: String(row["PSS"] || ''),
                business_area: String(row["Business Area"] || ''),
                amount_in_local_currency: Number(row["Amount (Local)"]),
                quantity: String(row["Quantity"] || '0'), 
                rpl: String(row["RPL"] || ''),
                material: String(row["Material"] || ''),
                material_description: String(row["Material Description"] || ''),
                material_group: String(row["Material Group"] || ''),
                material_type: String(row["Material Type"] || ''),
                product: String(row["Product"] || ''),
                cust_code: String(row["Customer Code"] || ''),
                cust_name: String(row["Customer Name"] || ''),
                cust_group: String(row["Customer Group"] || ''),
                key_account_type: String(row["Key Account Type"] || ''),
                pic: String(row["PIC"] || ''),
                area: String(row["Area"] || '')
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

        // --- 4. Refresh Data ---
        addLog('Menjalankan Refresh Sales Data...')
        const { error: rpcError } = await supabase.rpc('refresh_sales_data')
        
        if (rpcError) {
             addLog(`Warning Refresh: ${rpcError.message}`)
        } else {
             addLog('Refresh Sales Data sukses.')
        }

        addLog('SELESAI! Semua data berhasil diimport.')
        setIsComplete(true)
        setIsProcessing(false)
        setProgress(100)
        alert('Import Sukses! Dashboard telah diperbarui.')

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
  // RENDER UI (Layout Original)
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
                    Import Data Master
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