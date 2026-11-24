import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro e recuperação de senha).
 * Troca o código por uma sessão no servidor e redireciona para `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const rawNext = searchParams.get('next') || '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  const supabase = await createServerSupabase()
  let ok = false

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`)

  // O e-mail costuma ser confirmado mesmo quando a sessão não pode ser criada
  // (ex.: link aberto em outro aparelho). Basta entrar normalmente.
  if (next.startsWith('/redefinir-senha')) return NextResponse.redirect(`${origin}/redefinir-senha`)
  return NextResponse.redirect(`${origin}/login?confirmado=1`)
}
