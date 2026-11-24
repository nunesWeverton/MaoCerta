'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => null)
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setReady(session ? 'ok' : 'invalid')
    }
    init()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) return setError('Não foi possível alterar a senha. Solicite um novo link.')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-center text-xl font-bold text-slate-900">Criar nova senha</h1>
        {ready === 'checking' && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando link...
          </p>
        )}
        {ready === 'invalid' && (
          <div className="mt-6 text-center text-sm text-slate-600">
            <p>Este link expirou ou já foi usado.</p>
            <Link href="/login" className="mt-3 inline-block font-semibold text-[#0F4C81]">
              Solicitar novo link na tela de login
            </Link>
          </div>
        )}
        {ready === 'ok' && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              placeholder="Nova senha"
              aria-label="Nova senha"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
            />
            <input
              type="password"
              placeholder="Repita a nova senha"
              aria-label="Repita a nova senha"
              minLength={6}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
            />
            {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-[#0F4C81] py-3 text-base font-bold text-white disabled:opacity-60"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
