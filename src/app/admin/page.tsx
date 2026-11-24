'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SERVICE_CATEGORIES, STATUS_LABELS, STATUS_STYLES, RequestStatus } from '@/lib/constants'
import { formatDate, one } from '@/lib/format'
import { formatBrazilianPhone } from '@/lib/whatsapp'
import { LogoutButton } from '@/components/logout-button'
import { Loader2, Trash2 } from 'lucide-react'

type Rel<T> = T | T[] | null

interface AdminPro {
  user_id: string
  slug: string
  business_name: string
  plan_tier: 'free' | 'pro'
  plan_expires_at: string | null
  is_verified: boolean
  is_active: boolean
  avg_rating: number
  reviews_count: number
  profiles: Rel<{ phone_whatsapp: string | null; created_at: string }>
  services: { id: string }[]
}

interface AdminRequest {
  id: string
  description: string
  status: RequestStatus
  created_at: string
  pro_details: Rel<{ business_name: string }>
  profiles: Rel<{ full_name: string }>
}

interface DemandSignal {
  id: string
  category: string | null
  search_text: string | null
  details: string | null
  contact_whatsapp: string | null
  created_at: string
  zones: Rel<{ name: string }>
}

interface AdminReview {
  id: string
  rating: number
  comment: string | null
  author_name: string | null
  created_at: string
  pro_details: Rel<{ business_name: string }>
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const [access, setAccess] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [pros, setPros] = useState<AdminPro[]>([])
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [demands, setDemands] = useState<DemandSignal[]>([])
  const [stats, setStats] = useState({ clients: 0, pros: 0, requests: 0, completed: 0, reviews: 0 })
  const [filter, setFilter] = useState('')

  const loadAdmin = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login?redirect=/admin'
      return
    }
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role !== 'admin') {
      setAccess('denied')
      return
    }

    const [
      { data: proList },
      { count: clientCount },
      { count: reqCount },
      { count: completedCount },
      { count: reviewCount },
      { data: reqList },
      { data: revList },
      { data: demandList },
    ] = await Promise.all([
      supabase
        .from('pro_details')
        .select(
          'user_id, slug, business_name, plan_tier, plan_expires_at, is_verified, is_active, avg_rating, reviews_count, profiles(phone_whatsapp, created_at), services(id)'
        )
        .order('updated_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('service_requests').select('id', { count: 'exact', head: true }),
      supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('reviews').select('id', { count: 'exact', head: true }),
      supabase
        .from('service_requests')
        .select('id, description, status, created_at, pro_details(business_name), profiles!service_requests_client_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('reviews')
        .select('id, rating, comment, author_name, created_at, pro_details(business_name)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('demand_signals')
        .select('id, category, search_text, details, contact_whatsapp, created_at, zones(name)')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setPros((proList as unknown as AdminPro[]) || [])
    setRequests((reqList as unknown as AdminRequest[]) || [])
    setReviews((revList as unknown as AdminReview[]) || [])
    setDemands((demandList as unknown as DemandSignal[]) || [])
    setStats({
      clients: clientCount || 0,
      pros: proList?.length || 0,
      requests: reqCount || 0,
      completed: completedCount || 0,
      reviews: reviewCount || 0,
    })
    setAccess('ok')
  }, [supabase])

  useEffect(() => {
    loadAdmin()
  }, [loadAdmin])

  async function updatePro(userId: string, patch: Partial<AdminPro>) {
    const { error } = await supabase.from('pro_details').update(patch).eq('user_id', userId)
    if (error) window.alert('Erro: ' + error.message)
    loadAdmin()
  }

  function extendPlan(p: AdminPro, days: number) {
    const base = p.plan_expires_at && new Date(p.plan_expires_at) > new Date() ? new Date(p.plan_expires_at) : new Date()
    base.setDate(base.getDate() + days)
    updatePro(p.user_id, { plan_tier: 'pro', plan_expires_at: base.toISOString() })
  }

  async function deleteDemand(id: string) {
    await supabase.from('demand_signals').delete().eq('id', id)
    loadAdmin()
  }

  async function deleteReview(id: string) {
    if (!window.confirm('Excluir esta avaliação? A nota do profissional será recalculada.')) return
    await supabase.from('reviews').delete().eq('id', id)
    loadAdmin()
  }

  if (access === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
      </div>
    )
  }

  if (access === 'denied') {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-600">Esta área é exclusiva da equipe MãoCerta.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#0F4C81]">
          Voltar ao início
        </Link>
      </main>
    )
  }

  const filteredPros = pros.filter((p) => p.business_name.toLowerCase().includes(filter.toLowerCase()))
  const now = new Date()

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/" className="text-xs font-semibold text-[#0F4C81]">
            ← MãoCerta
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Admin • Ouro Preto</h1>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Clientes', value: stats.clients },
          { label: 'Profissionais', value: stats.pros },
          { label: 'Pedidos', value: stats.requests },
          { label: 'Concluídos', value: stats.completed },
          { label: 'Avaliações', value: stats.reviews },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-xs text-slate-500">{s.label}</span>
            <p className="text-2xl font-bold text-[#0F4C81]">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Profissionais</h2>
          <input
            type="search"
            placeholder="Filtrar por nome..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Profissional</th>
                <th className="p-3">Serviços</th>
                <th className="p-3">Nota</th>
                <th className="p-3">Plano</th>
                <th className="p-3">Verificação</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPros.map((p) => {
                const phone = one(p.profiles)?.phone_whatsapp
                const planActive = p.plan_tier === 'pro' && p.plan_expires_at && new Date(p.plan_expires_at) > now
                return (
                  <tr key={p.user_id}>
                    <td className="p-3">
                      <Link href={`/pro/${p.slug}`} className="font-semibold text-slate-900 hover:underline">
                        {p.business_name}
                      </Link>
                      {phone && (
                        <a
                          href={`https://wa.me/${formatBrazilianPhone(phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-green-700"
                        >
                          WhatsApp {phone}
                        </a>
                      )}
                    </td>
                    <td className="p-3">{p.services?.length || 0}</td>
                    <td className="p-3">{p.reviews_count > 0 ? `${Number(p.avg_rating).toFixed(1)} (${p.reviews_count})` : '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold ${planActive ? 'text-amber-700' : 'text-slate-500'}`}>
                        {planActive ? `PRO até ${formatDate(p.plan_expires_at)}` : 'GRÁTIS'}
                      </span>
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          onClick={() => extendPlan(p, 30)}
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800"
                        >
                          +30 dias
                        </button>
                        {planActive && (
                          <button
                            type="button"
                            onClick={() => updatePro(p.user_id, { plan_tier: 'free' })}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600"
                          >
                            Rebaixar
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => updatePro(p.user_id, { is_verified: !p.is_verified })}
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          p.is_verified ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.is_verified ? 'Verificado ✓' : 'Dar Selo'}
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => updatePro(p.user_id, { is_active: !p.is_active })}
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          p.is_active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {p.is_active ? 'Ativo' : 'Pausado'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Pedidos recentes</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {requests.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhum pedido ainda.</li>}
            {requests.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {one(r.profiles)?.full_name || 'Cliente'} → {one(r.pro_details)?.business_name || 'Profissional'}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-500">
                  {formatDate(r.created_at)} • {r.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Avaliações recentes</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {reviews.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhuma avaliação ainda.</li>}
            {reviews.map((rv) => (
              <li key={rv.id} className="flex items-start justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-800">
                    {rv.author_name || 'Cliente'} → {one(rv.pro_details)?.business_name}
                  </span>
                  <span className="ml-2 text-xs font-bold text-amber-500">{'★'.repeat(rv.rating)}</span>
                  {rv.comment && <p className="text-xs text-slate-600">{rv.comment}</p>}
                  <p className="text-[11px] text-slate-400">{formatDate(rv.created_at)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Excluir avaliação"
                  onClick={() => deleteReview(rv.id)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Demandas não atendidas ({demands.length})</h2>
        <p className="text-xs text-slate-500">
          O que os moradores procuraram e não encontraram. Use para priorizar a captação de profissionais.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {demands.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhuma demanda registrada.</li>}
          {demands.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-800">{d.details || d.search_text || '—'}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(d.created_at)}
                  {d.category && d.category in SERVICE_CATEGORIES
                    ? ` • ${SERVICE_CATEGORIES[d.category as keyof typeof SERVICE_CATEGORIES].label}`
                    : ''}
                  {one(d.zones)?.name ? ` • ${one(d.zones)?.name}` : ''}
                  {d.search_text && d.details !== d.search_text ? ` • busca: "${d.search_text}"` : ''}
                </p>
                {d.contact_whatsapp && (
                  <a
                    href={`https://wa.me/${formatBrazilianPhone(d.contact_whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-green-700"
                  >
                    WhatsApp {d.contact_whatsapp}
                  </a>
                )}
              </div>
              <button
                type="button"
                aria-label="Excluir demanda"
                onClick={() => deleteDemand(d.id)}
                className="rounded p-1.5 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
