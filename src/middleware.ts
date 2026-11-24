import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PREFIXES = ['/painel', '/admin', '/cliente']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Renova a sessão (obrigatório com @supabase/ssr)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?redirect=${encodeURIComponent(path)}`
    return NextResponse.redirect(url)
  }

  // Usuário já logado não precisa ver a tela de login
  if (path === '/login' && user) {
    const params = request.nextUrl.searchParams
    const redirect = params.get('redirect')
    // "Criar minha vitrine": o painel oferece ativar a vitrine para quem é cliente
    const target =
      params.get('role') === 'pro'
        ? '/painel'
        : redirect && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : '/'
    return NextResponse.redirect(new URL(target, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
