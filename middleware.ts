import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Ganti nama fungsi menjadi 'middleware' agar dikenali Next.js
export async function middleware(request: NextRequest) {
  // 1. Buat respons awal
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        // GANTI 'get' DENGAN 'getAll'
        getAll() {
          return request.cookies.getAll()
        },
        // GANTI 'set' & 'remove' DENGAN 'setAll'
        setAll(cookiesToSet) {
          // 1. Update cookie di Request (agar Server Component bisa baca langsung)
          cookiesToSet.forEach(({ name, value, options }) => 
            response.cookies.set(name, value, options)
          )
          
          // 2. Refresh object Response agar membawa cookie baru
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          
          // 3. Update cookie di Response (agar Browser user menyimpan cookie)
          cookiesToSet.forEach(({ name, value, options }) => 
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Cek User Session (Gunakan getUser, BUKAN getSession karena lebih aman)
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Tentukan Route Publik
  // Pastikan '/auth/callback' ada di sini agar proses login tidak redirect loop
  const isPublicRoute = 
    request.nextUrl.pathname.startsWith('/login') || 
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/auth/callback') 

  // 4. Logika Redirect (Proteksi Halaman)
  
  // Jika User BELUM login dan mencoba akses halaman PRIVATE -> Tendang ke Login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    // (Opsional) Simpan halaman yg mau diakses user sbg parameter 'next'
    // loginUrl.searchParams.set('next', request.nextUrl.pathname) 
    return NextResponse.redirect(loginUrl)
  }

  // Jika User SUDAH login dan mencoba akses halaman PUBLIC (Login/Signup) -> Tendang ke Dashboard
  if (user && isPublicRoute && !request.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

// Konfigurasi Matcher: Middleware jalan di semua route KECUALI aset statis & gambar
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}