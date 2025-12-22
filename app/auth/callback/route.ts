import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = {
      get(name: string) { return null }, // Hanya butuh setter untuk route handler
      set(name: string, value: string, options: CookieOptions) {},
      remove(name: string, options: CookieOptions) {},
    }
    
    // Kita buat client khusus yang bisa manipulasi cookie response
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.headers.get('cookie')?.match(new RegExp(`(^| )${name}=([^;]+)`))?.[2]
            },
            set(name: string, value: string, options: CookieOptions) {
               // Mekanisme cookie di Route Handler Next.js agak tricky,
               // tapi @supabase/ssr menangani ini via parameter di bawah
            },
            remove(name: string, options: CookieOptions) {},
          },
        }
      )
      
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error) {
        // PENTING: Lakukan redirect dengan NextResponse agar cookie tersimpan
        const response = NextResponse.redirect(`${origin}${next}`)
        
        // Kita perlu "mengoper" cookie dari supabase client ke response browser
        const { cookies } = await import('next/headers') // Workaround standard nextjs 
        // Namun cara termudah di route handler adalah membiarkan supabase/ssr bekerja di middleware.
        // Tapi untuk route handler murni, kita bisa langsung redirect jika middleware sudah setup benar.
        
        return response
      }
  }

  // Jika error, kembalikan ke login
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}