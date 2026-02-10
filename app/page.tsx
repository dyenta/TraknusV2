'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, FileWarning, LayoutList, LogOut, ArrowRight, User, Phone, Mail, Sun, Moon, Laptop, ChevronDown, BarChart3, Truck } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useTheme } from './components/ThemeProvider'

export default function MenuPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  
  // State untuk data profil
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [userAccess, setUserAccess] = useState<string | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserEmail(user.email || null)

        const { data: profile } = await supabase
          .from('profiles')
          .select('*') 
          .eq('user_id', user.id)
          .single()

        if (profile) {
          setUserName(profile.full_name || 'Pengguna')
          setUserPhone(profile.phone_number || '-')
          setUserAccess(profile.akses || null) 
          if (profile.email) setUserEmail(profile.email)
        } else {
          setUserName(user.user_metadata?.full_name || 'Pengguna')
          setUserPhone(user.user_metadata?.phone_number || '-')
          setUserAccess(null)
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

  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light': return <Sun size={14} />
      case 'dark': return <Moon size={14} />
      case 'system': return <Laptop size={14} />
      default: return <Sun size={14} />
    }
  }

  const allMenuItems = [
    {
      title: "Sales Issues",
      desc: "Input dan pelaporan kendala/masalah di lapangan.",
      href: "/sales-issues",
      icon: FileWarning,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      borderHover: "hover:border-rose-500 dark:hover:border-rose-500",
      restricted: false,
    },
    {
      title: "Summary Report",
      desc: "Ringkasan dan rekapitulasi data isu secara keseluruhan.",
      href: "/summary",
      icon: LayoutList,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      borderHover: "hover:border-emerald-500 dark:hover:border-emerald-500",
      restricted: false,
    },
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
      title: "Actual vs Plan",
      desc: "Komparasi target (Plan) vs realisasi (Actual) tahun berjalan.",
      href: "/actual-vs-plan",
      icon: BarChart3,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      borderHover: "hover:border-orange-500 dark:hover:border-orange-500",
      restricted: true,
    },
    {
      title: "OTIF Analytics",
      desc: "Monitoring performa pengiriman On Time In Full (OTIF).",
      href: "/otif",
      icon: Truck,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      borderHover: "hover:border-purple-500 dark:hover:border-purple-500",
      restricted: true,
    },
  ]

  const visibleMenuItems = allMenuItems.filter((item) => {
    if (!item.restricted) return true
    if (userAccess && userAccess !== 'CUSTOMER') {
      return true
    }
    return false
  })

  // [LOGIKA GRID BARU]
  // Menggunakan grid-cols-6 agar bisa membagi layout:
  // - Baris 1: 2 item (masing-masing span-3 = 50%)
  // - Baris 2: 3 item (masing-masing span-2 = 33.3%)
  const getGridClass = (count: number) => {
    switch (count) {
      case 5: return "md:grid-cols-6 max-w-6xl mx-auto" // Layout khusus 2 atas, 3 bawah
      case 4: return "md:grid-cols-2 max-w-4xl mx-auto"
      case 3: return "md:grid-cols-3 max-w-6xl mx-auto"
      case 2: return "md:grid-cols-2 max-w-4xl mx-auto"
      case 1: return "md:grid-cols-1 max-w-md mx-auto"
      default: return "md:grid-cols-2 max-w-4xl mx-auto"
    }
  }

  // [LOGIKA SPAN ITEM]
  // Mengatur lebar per item khusus jika jumlah total item adalah 5
  const getItemSpanClass = (index: number, total: number) => {
    if (total === 5) {
      // 2 Item pertama (index 0 & 1) -> Span 3 (setengah layar)
      if (index < 2) return "md:col-span-3"
      // 3 Item berikutnya -> Span 2 (sepertiga layar)
      return "md:col-span-2"
    }
    return "" // Default behavior
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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 font-sans transition-colors duration-300">
      
      <div className="w-full max-w-6xl space-y-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col items-center space-y-3">
          <img src="/favicon.ico" alt="Logo" className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-2 shadow-sm"/>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight text-center">
            Portal Aplikasi
          </h1>
          
          <div className="flex flex-col xl:flex-row items-center gap-3 w-full justify-center relative z-20">
            {/* KARTU PROFIL */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-6 py-2 shadow-sm flex flex-col md:flex-row items-center gap-2 md:gap-6 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                <User size={16} className="text-emerald-600" />
                <span>{userName}</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-blue-500" />
                <span>{userEmail}</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-rose-500" />
                <span>{userPhone}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} 
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-medium shadow-sm"
                >
                  {getThemeIcon(theme)}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}/>
                </button>

                <div className={`absolute top-full right-0 mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden transition-all duration-200 origin-top-right z-50 ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
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

              <button 
                onClick={handleLogout}
                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition-all text-sm font-bold shadow-sm"
                title="Keluar Aplikasi"
              >
                <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform"/>
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>

        {/* MENU GRID */}
        <div className={`grid grid-cols-1 gap-4 w-full transition-all duration-500 ${getGridClass(visibleMenuItems.length)}`}>
          {visibleMenuItems.map((item, index) => (
            <Link 
              key={index} 
              href={item.href} 
              // Tambahkan getItemSpanClass di sini untuk mengatur lebar kolom
              className={`group relative h-full ${getItemSpanClass(index, visibleMenuItems.length)}`}
            >
              <div className={`h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${item.borderHover} flex flex-col justify-between`}>
                
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300 shadow-sm`}>
                    <item.icon size={24} className={item.color} />
                  </div>
                  
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-slate-900 dark:group-hover:text-white">
                    {item.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 w-full flex items-center justify-center md:justify-start text-sm font-semibold text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                  <span>Akses Modul</span>
                  <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                </div>

              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}