'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// Tambahkan Eye dan EyeOff di sini
import { LayoutGrid, Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // State untuk toggle lihat password
  const [showPassword, setShowPassword] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      router.refresh()
      router.push('/') 
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans transition-colors duration-300">
      
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        
        <div className="p-8 text-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-4 shadow-sm">
            <LayoutGrid size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Welcome Back</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Masuk untuk mengakses Dashboard</p>
        </div>

        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock size={18} />
                </div>
                
                {/* Input Password Dimodifikasi */}
                <input
                  type={showPassword ? "text" : "password"} // Tipe berubah dinamis
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // pr-4 diubah jadi pr-10 agar teks tidak tertutup icon mata
                  className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />

                {/* Tombol Toggle Show/Hide */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors focus:outline-none"
                  tabIndex={-1} // Opsional: Supaya tombol ini dilewati saat tab jika diinginkan
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Belum punya akun?{' '}
            <Link href="/signup" className="font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-6 text-slate-400 dark:text-slate-600 text-xs text-center">
        &copy; {new Date().getFullYear()} Sales Analytics Dashboard.
      </div>
    </div>
  )
}