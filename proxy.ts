// FILE: proxy.ts
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// PENTING: Nama fungsi WAJIB 'proxy', bukan 'middleware' lagi
export async function proxy(request: NextRequest) {
  // 1. Inisialisasi Response awal
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Logika cookie Supabase SSR
          cookiesToSet.forEach(({ name, value }) => 
            request.cookies.set(name, value)
          )
          
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          
          cookiesToSet.forEach(({ name, value, options }) => 
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Cek User Session
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Tentukan Route
  const url = request.nextUrl.clone()
  const isPublicRoute = 
    url.pathname.startsWith('/login') || 
    url.pathname.startsWith('/signup') ||
    url.pathname.startsWith('/auth/callback')

  // 4. Logika Redirect (Auth Guard)

  // KASUS A: Belum Login -> Akses halaman Private -> Lempar ke Login
  if (!user && !isPublicRoute) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // KASUS B: Sudah Login -> Akses halaman Login/Signup -> Lempar ke Home
  if (user && isPublicRoute && !url.pathname.startsWith('/auth/callback')) {
    url.pathname = '/' 
    return NextResponse.redirect(url)
  }

  return response
}

// Konfigurasi Matcher (Agar tidak jalan di file gambar/statis)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}