'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, FileWarning, User, AlignLeft, AlertCircle, LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function SalesIssuesPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const [loading, setLoading] = useState(false)
  const [isRestricted, setIsRestricted] = useState(false) 
  
  // Hapus 'status' dari state awal, biarkan DB yang handle default 'Open'
  const [formData, setFormData] = useState({
    customer_name: '',
    issue_type: 'Komplain Produk',
    priority: 'Normal',
    description: '',
    created_by: ''
  })

  useEffect(() => {
    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const email = user.email || ''
            setFormData(prev => ({ ...prev, created_by: email }))
            const isAllowed = email.endsWith('@traknus.co.id') || email === 'dyentadwian@gmail.com'
            setIsRestricted(!isAllowed)
        } else {
            router.push('/login')
        }
    }
    checkUser()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Kita kirim data tanpa status (status akan otomatis 'Open' di database)
      const { error } = await supabase.from('sales_issues').insert([formData])
      
      if (error) throw error
      
      alert('Keluhan berhasil disimpan!')

      if (isRestricted) {
          // Reset form
          setFormData({
            customer_name: '',
            issue_type: 'Komplain Produk',
            priority: 'Normal',
            description: '',
            created_by: formData.created_by
          })
      } else {
          router.push('/')
      }

    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 flex justify-center items-start">
      <div className="w-full max-w-2xl">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isRestricted && (
                <button 
                    onClick={() => router.back()} 
                    className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
            )}
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <FileWarning className="text-red-500" size={24}/> Input Keluhan Customer
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Isi formulir sesuai keluhan yang diterima.</p>
            </div>
          </div>
          
          {isRestricted && (
              <button onClick={handleLogout} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1">
                  <LogOut size={14}/> Logout
              </button>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 md:p-8 flex flex-col gap-6">
            
            {/* INPUT STATUS DIHILANGKAN DARI SINI */}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <User size={12}/> Customer Name
                </label>
                <input 
                  required
                  type="text" 
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  placeholder="Nama Pelanggan"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all text-sm"
                />
              </div>

              {/* Issue Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <AlertCircle size={12}/> Issue Type
                </label>
                <select 
                  name="issue_type"
                  value={formData.issue_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all text-sm"
                >
                  <option>Komplain Produk</option>
                  <option>Pengiriman Terlambat</option>
                  <option>Selisih Harga</option>
                  <option>Pelayanan Sales</option>
                  <option>Lainnya</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Priority */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                   Priority
                </label>
                <div className="flex gap-2">
                  {['Low', 'Normal', 'High', 'Urgent'].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFormData({...formData, priority: lvl})}
                      className={`flex-1 py-2 rounded-md text-xs font-bold border transition-all ${
                        formData.priority === lvl 
                        ? (lvl === 'Urgent' ? 'bg-red-500 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600')
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
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
              {!isRestricted && (
                <button 
                    type="button" 
                    onClick={() => router.back()}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    Batal
                </button>
              )}
              
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