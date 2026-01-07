'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, AlertCircle, ClipboardList, LogOut, ArrowRight, User, Phone, Mail } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function MenuPage() {
  const router = useRouter()
  
  // State untuk data profil
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  useEffect(() => {
    const getData = async () => {
      // 1. Cek User Auth (Siapa yang login?)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Set email dari auth sebagai fallback
        setUserEmail(user.email || null)

        // 2. Ambil data detail dari tabel 'profiles' berdasarkan ID user
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single() // Ambil satu baris saja

        if (profile) {
          // Jika ada di tabel profiles, pakai data dari sana
          setUserName(profile.full_name || 'Pengguna')
          setUserPhone(profile.phone_number || '-')
          // Update email jika di tabel profiles berbeda (opsional)
          if (profile.email) setUserEmail(profile.email)
        } else {
          // Fallback: Jika belum ada di tabel profiles, coba ambil dari metadata
          // Ini berguna agar tidak error saat transisi data
          setUserName(user.user_metadata?.full_name || 'Pengguna')
          setUserPhone(user.user_metadata?.phone_number || '-')
        }
      }

      setIsLoading(false)
    }

    getData()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  // --- CONFIG MENU ---
  const allMenuItems = [
    {
      title: "Sales Analytics",
      desc: "Dashboard monitoring performa penjualan & pivot data dinamis.",
      href: "/sales",
      icon: LayoutGrid,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      borderHover: "hover:border-blue-500 dark:hover:border-blue-500",
      restricted: true, 
    },
    {
      title: "Sales Issues",
      desc: "Input dan pelaporan kendala/masalah di lapangan.",
      href: "/sales-issues",
      icon: AlertCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      borderHover: "hover:border-rose-500 dark:hover:border-rose-500",
      restricted: false,
    },
    {
      title: "Summary Report",
      desc: "Ringkasan dan rekapitulasi data isu secara keseluruhan.",
      href: "/summary",
      icon: ClipboardList,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      borderHover: "hover:border-emerald-500 dark:hover:border-emerald-500",
      restricted: false,
    },
  ]

  // --- FILTER MENU ---
  const visibleMenuItems = allMenuItems.filter((item) => {
    if (!item.restricted) return true
    if (userEmail) {
      const isTraknus = userEmail.endsWith('@traknus.co.id')
      const isSpecificUser = userEmail === 'dyentadwian@gmail.com'
      return isTraknus || isSpecificUser
    }
    return false
  })

  // --- DYNAMIC GRID LAYOUT ---
  const getGridClass = (count: number) => {
    switch (count) {
      case 3: return "md:grid-cols-3"
      case 2: return "md:grid-cols-2 max-w-4xl mx-auto"
      case 1: return "md:grid-cols-1 max-w-md mx-auto"
      default: return "md:grid-cols-3"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 bg-slate-300 dark:bg-slate-700 rounded-full animate-bounce"></div>
          <span className="text-slate-400 text-sm">Memuat data profil...</span>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans transition-colors duration-300">
      
      <div className="w-full max-w-6xl space-y-10">
        
        {/* HEADER SECTION - Data Real dari Tabel Profiles */}
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 tracking-tight text-center">
            Portal Aplikasi
          </h1>
          
          {/* Kartu Profil */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-6 py-2 shadow-sm flex flex-col md:flex-row items-center gap-2 md:gap-6 text-sm text-slate-600 dark:text-slate-300">
            
            {/* Nama */}
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
               <User size={16} className="text-emerald-600" />
               <span>{userName}</span>
            </div>

            <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>

            {/* Email */}
            <div className="flex items-center gap-2">
               <Mail size={16} className="text-blue-500" />
               <span>{userEmail}</span>
            </div>

            <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>

            {/* Telepon */}
            <div className="flex items-center gap-2">
               <Phone size={16} className="text-rose-500" />
               <span>{userPhone}</span>
            </div>
            
          </div>
        </div>

        {/* MENU GRID */}
        <div className={`grid grid-cols-1 gap-6 w-full transition-all duration-500 ${getGridClass(visibleMenuItems.length)}`}>
          {visibleMenuItems.map((item, index) => (
            <Link key={index} href={item.href} className="group relative h-full">
              <div className={`h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${item.borderHover} flex flex-col justify-between`}>
                
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className={`w-16 h-16 rounded-2xl ${item.bg} flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300 shadow-sm`}>
                    <item.icon size={32} className={item.color} />
                  </div>
                  
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-slate-900 dark:group-hover:text-white">
                    {item.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 w-full flex items-center justify-center md:justify-start text-sm font-semibold text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                  <span>Akses Modul</span>
                  <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                </div>

              </div>
            </Link>
          ))}
        </div>

        {/* FOOTER */}
        <div className="flex justify-center pt-4">
          <button 
            onClick={handleLogout}
            className="group flex items-center gap-2 px-6 py-2.5 rounded-full bg-transparent border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition-all text-sm font-medium"
          >
            <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform"/>
            <span>Keluar Aplikasi</span>
          </button>
        </div>

      </div>
    </main>
  )
}