'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, FileWarning, User, AlignLeft, AlertCircle, Users, Hash } from 'lucide-react' 
import { createBrowserClient } from '@supabase/ssr'

export default function SalesIssuesPage() {
  const router = useRouter()
  // Pastikan variabel environment ini sudah benar di .env.local Anda
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [loading, setLoading] = useState(false)
  const [customerList, setCustomerList] = useState<{name: string, group: string}[]>([])

  const [formData, setFormData] = useState({
    customer_name: '',
    cust_group: '', 
    unit_number: '', 
    issue_type: '', 
    description: '',
    created_by: ''
  })

  // 1. Fetch User & Customer Data
  useEffect(() => {
    const initData = async () => {
        // Ambil User hanya untuk data created_by
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const email = user.email || ''
            setFormData(prev => ({ ...prev, created_by: email }))
        }

        // Fetch Customer Data
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
                        uniqueCust.set(item.cust_name, item.cust_group)
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

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const found = customerList.find(c => c.name === val)
    
    setFormData({
        ...formData,
        customer_name: val,
        cust_group: found ? found.group : '' 
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // --- BAGIAN INI YANG DIPERBAIKI ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('sales_issues').insert([formData])
      
      if (error) throw error
      
      alert('Keluhan berhasil disimpan!')

      // LOGIC BARU: Langsung paksa pindah ke summary untuk SIAPAPUN
      router.refresh()
      router.push('/summary') 

    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  // ----------------------------------

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 flex justify-center items-start">
      <div className="w-full max-w-2xl">
        
        {/* Header */}
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
                <FileWarning className="text-red-500" size={24}/> Input Keluhan Customer
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Isi formulir sesuai keluhan yang diterima.</p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 md:p-8 flex flex-col gap-6">
            
            {/* Baris 1: Customer & Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <User size={12}/> Customer Name
                </label>
                <input 
                  list="customer-list" 
                  required
                  type="text" 
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleCustomerChange}
                  placeholder="Ketik/Pilih Customer"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all text-sm"
                  autoComplete="off"
                />
                <datalist id="customer-list">
                    {customerList.map((cust, idx) => (
                        <option key={idx} value={cust.name} />
                    ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Users size={12}/> Cust. Group
                </label>
                <input 
                  type="text" 
                  name="cust_group"
                  value={formData.cust_group}
                  readOnly
                  placeholder="Auto-fill Group"
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed text-sm font-semibold"
                />
              </div>
            </div>

            {/* Baris 2: Unit Number & Issue Type */}
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
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <AlignLeft size={12}/> Description
              </label>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Deskripsi detail masalah..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all text-sm resize-none"
              />
            </div>
            
            <div className="text-xs text-slate-400 text-right">
                Created by: {formData.created_by || 'Loading user...'}
            </div>

            {/* Actions */}
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
                {loading ? 'Menyimpan...' : <><Save size={16}/> Simpan Data</>}
              </button>
            </div>

          </form>
        </div>
      </div>
    </main>
  )
}