import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'

export async function SiteHeader() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    role = profile?.role ?? null
  }

  return (
    <header className="flex items-center justify-between gap-2">
      <Link href="/" className="shrink-0">
        <span className="text-2xl font-extrabold tracking-tight text-[#0F4C81]">MãoCerta</span>
        <p className="text-xs text-slate-500">Ouro Preto e Distritos • MG</p>
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-1">
        {user ? (
          <>
            {role === 'admin' && (
              <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60">
                Admin
              </Link>
            )}
            {role === 'pro' && (
              <Link
                href="/painel"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                Meu Painel
              </Link>
            )}
            <Link
              href="/cliente/meus-pedidos"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60"
            >
              Meus Pedidos
            </Link>
            <LogoutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            Entrar
          </Link>
        )}
      </nav>
    </header>
  )
}
