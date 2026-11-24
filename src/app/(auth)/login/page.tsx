'use client'

import { useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeRedirectPath } from '@/lib/security'
import { Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isProParam = searchParams.get('role') === 'pro'
  const defaultRole = isProParam ? 'pro' : 'client'
  const rawRedirect = searchParams.get('redirect')
  // Só aceita caminhos internos (evita redirecionamento para sites externos)
  const explicitRedirect = rawRedirect ? safeRedirectPath(rawRedirect, '') || null : null
  const redirectUrl = explicitRedirect || (defaultRole === 'pro' ? '/painel' : '/')

  // Abre direto no modo cadastro se vier pelo botão "Criar Minha Vitrine Grátis"
  const [isSignUp, setIsSignUp] = useState(isProParam || searchParams.get('cadastro') === '1')
  const [role, setRole] = useState<'client' | 'pro'>(defaultRole)
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(
    searchParams.get('confirmado') === '1' ? 'E-mail confirmado! Agora entre com seu e-mail e senha.' : null
  )
  const [accepted, setAccepted] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfoMsg(null)

    if (isSignUp) {
      if (!accepted) {
        setError('Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.')
        setLoading(false)
        return
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError('A senha precisa ter pelo menos 8 caracteres, com letras e números.')
        setLoading(false)
        return
      }
      if (whatsapp.replace(/\D/g, '').length < 10) {
        setError('Informe o WhatsApp com DDD (ex.: 31999999999).')
        setLoading(false)
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            phone_whatsapp: whatsapp.replace(/\D/g, ''),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            role === 'pro' ? '/painel' : redirectUrl
          )}`,
        },
      })

      if (signUpError) {
        setError(
          /already registered|already exists/i.test(signUpError.message)
            ? 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.'
            : /password/i.test(signUpError.message)
              ? 'Senha muito fraca. Use pelo menos 8 caracteres, com letras e números.'
              : 'Não foi possível criar a conta. Verifique os dados e tente novamente.'
        )
        setLoading(false)
        return
      }

      if (!data.session) {
        setInfoMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro ou faça login.')
        setIsSignUp(false)
        setLoading(false)
        return
      }

      router.push(role === 'pro' ? '/painel' : redirectUrl)
      router.refresh()
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data.user) {
        setError(
          signInError && /not confirmed/i.test(signInError.message)
            ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
            : 'E-mail ou senha inválidos.'
        )
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (explicitRedirect) {
        router.push(explicitRedirect)
      } else if (profile?.role === 'pro') {
        router.push('/painel')
      } else if (profile?.role === 'admin') {
        router.push('/admin')
      } else {
        router.push(redirectUrl)
      }
      router.refresh()
    }
  }

  async function handleForgotPassword() {
    setError(null)
    setInfoMsg(null)
    if (!email.trim()) {
      setError('Digite seu e-mail no campo acima e clique novamente em "Esqueci minha senha".')
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })
    if (resetError) {
      setError('Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.')
      return
    }
    setInfoMsg('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.')
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        <Link href="/" className="text-2xl font-extrabold text-[#0F4C81]">
          MãoCerta
        </Link>
        <p className="mt-1 text-sm text-slate-500">
          {isSignUp ? 'Crie sua conta gratuita em Ouro Preto' : 'Acesse sua conta'}
        </p>
      </div>

      <form onSubmit={handleAuth} className="mt-6 space-y-4">
        {isSignUp && (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`rounded-md py-2 text-sm font-bold ${
                  role === 'client' ? 'bg-white text-[#0F4C81] shadow-sm' : 'text-slate-600'
                }`}
              >
                Sou Cliente
              </button>
              <button
                type="button"
                onClick={() => setRole('pro')}
                className={`rounded-md py-2 text-sm font-bold ${
                  role === 'pro' ? 'bg-white text-[#0F4C81] shadow-sm' : 'text-slate-600'
                }`}
              >
                Sou Profissional
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {role === 'pro' ? 'Seu Nome ou Nome do Salão/Empresa' : 'Seu Nome Completo'}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">WhatsApp (com DDD)</label>
              <input
                type="tel"
                required
                placeholder="31999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Senha (mín. 8 caracteres)</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
          />
        </div>

        {isSignUp && (
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" className="font-semibold text-[#0F4C81] underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" className="font-semibold text-[#0F4C81] underline">
                Política de Privacidade
              </Link>
              . Meu nome e WhatsApp serão compartilhados com os profissionais que eu contatar
              {role === 'pro' ? ' e exibidos publicamente na minha vitrine' : ''}.
            </span>
          </label>
        )}

        {!isSignUp && (
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs font-semibold text-slate-500 hover:text-[#0F4C81] hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}
        {infoMsg && <p className="rounded-lg bg-green-50 p-2.5 text-sm text-green-700">{infoMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-[#0F4C81] py-3 text-base font-bold text-white hover:bg-[#0F4C81]/90 disabled:opacity-60"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSignUp ? 'Criar Conta Grátis' : 'Entrar'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError(null)
          }}
          className="text-sm font-semibold text-[#0F4C81] hover:underline"
        >
          {isSignUp ? 'Já tenho conta? Entrar' : 'Ainda não tem conta? Cadastre-se grátis'}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Suspense fallback={<div>Carregando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}