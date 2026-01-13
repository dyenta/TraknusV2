import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 'next' digunakan untuk redirect user ke halaman tujuan awal setelah login
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!, // Pastikan nama variabel env sesuai
      {
        cookies: {
          // Adapter untuk membaca semua cookies
          getAll() {
            return cookieStore.getAll()
          },
          // Adapter untuk menulis cookies (Login session disimpan di sini)
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Error ini biasanya aman diabaikan di Route Handler (terjadi jika dipanggil dari Server Component murni)
            }
          },
        },
      }
    )

    // Menukar Auth Code dengan Session Token
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Login Sukses: Redirect ke halaman tujuan
      // forward user to target page
      const forwardedHost = request.headers.get('x-forwarded-host') // Penting jika pakai proxy/Vercel
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // Localhost
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // Production (Vercel/Cloud)
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        // Fallback
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Jika error atau code tidak valid, kembalikan ke login dengan pesan error
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}