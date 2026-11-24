'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { OPEN_STATUSES, SHIFT_LABELS, STATUS_LABELS, STATUS_STYLES, RequestStatus } from '@/lib/constants'
import { dateTimeLabel, timeLabel } from '@/lib/schedule'
import { formatDate, one } from '@/lib/format'
import { formatBrazilianPhone } from '@/lib/whatsapp'
import { DeleteAccount } from '@/components/delete-account'
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2, MapPin, MessageCircle, Star, XCircle } from 'lucide-react'

type Rel<T> = T | T[] | null

interface RequestItem {
  id: string
  pro_id: string
  description: string
  status: RequestStatus
  preferred_shift: keyof typeof SHIFT_LABELS
  created_at: string
  pro_details: Rel<{
    business_name: string
    slug: string
    business_address: string | null
    profiles: Rel<{ phone_whatsapp: string | null }>
  }>
  appointments: Rel<{ starts_at: string; ends_at: string }>
  services: Rel<{ title: string }>
  zones: Rel<{ name: string }>
  reviews: Rel<{ id: string; rating: number; comment: string | null }>
}

export default function MeusPedidosPage() {
  const supabase = useMemo(() => createClient(), [])
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({})
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login?redirect=/cliente/meus-pedidos'
      return
    }
    setUserId(user.id)

    const { data } = await supabase
      .from('service_requests')
      .select(
        'id, pro_id, description, status, preferred_shift, created_at, pro_details(business_name, slug, business_address, profiles(phone_whatsapp)), services(title), zones(name), reviews(id, rating, comment), appointments(starts_at, ends_at)'
      )
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    setRequests((data as unknown as RequestItem[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function changeStatus(req: RequestItem, status: 'completed' | 'canceled') {
    const msg =
      status === 'canceled'
        ? 'Cancelar este pedido? Se houver horário agendado, ele será liberado.'
        : 'Confirmar que o serviço foi realizado? Depois você poderá avaliar o profissional.'
    if (!window.confirm(msg)) return
    const { error } = await supabase.from('service_requests').update({ status }).eq('id', req.id)
    if (error) setErrorMap((m) => ({ ...m, [req.id]: error.message || 'Não foi possível atualizar o pedido.' }))
    loadRequests()
  }

  async function submitReview(req: RequestItem) {
    if (!userId) return
    setSending(req.id)
    const { error } = await supabase.from('reviews').insert({
      request_id: req.id,
      client_id: userId,
      pro_id: req.pro_id,
      rating: ratingMap[req.id] || 5,
      comment: (commentMap[req.id] || '').trim() || null,
    })
    setSending(null)
    if (error) {
      setErrorMap((m) => ({ ...m, [req.id]: 'Não foi possível enviar a avaliação.' }))
      return
    }
    loadRequests()
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Voltar" className="rounded-lg border border-slate-200 bg-white p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Meus Pedidos</h1>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">Você ainda não fez nenhum pedido ou agendamento.</p>
            <Link href="/buscar" className="mt-3 inline-block rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-bold text-white">
              Encontrar um profissional
            </Link>
          </div>
        ) : (
          requests.map((req) => {
            const pro = one(req.pro_details)
            const proPhone = one(pro?.profiles)?.phone_whatsapp
            const review = one(req.reviews)
            const open = OPEN_STATUSES.includes(req.status)
            const appt = one(req.appointments)
            return (
              <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {pro?.slug ? (
                    <Link href={`/pro/${pro.slug}`} className="font-bold text-slate-900 hover:underline">
                      {pro.business_name}
                    </Link>
                  ) : (
                    <h3 className="font-bold text-slate-900">Profissional</h3>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[req.status]}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                {appt ? (
                  <div className="mt-1.5 rounded-lg bg-indigo-50 p-2.5 text-sm text-indigo-950">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <CalendarClock className="h-4 w-4" /> {one(req.services)?.title || 'Serviço'} •{' '}
                      {dateTimeLabel(appt.starts_at)} até {timeLabel(appt.ends_at)}
                    </p>
                    {pro?.business_address && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3.5 w-3.5" /> {pro.business_address}
                      </p>
                    )}
                    {req.status === 'pending' && (
                      <p className="mt-0.5 text-xs text-indigo-800">Aguardando o profissional confirmar o horário.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {one(req.services)?.title || 'Outro serviço'} • {one(req.zones)?.name || 'Ouro Preto'} •{' '}
                    {SHIFT_LABELS[req.preferred_shift] || req.preferred_shift} • {formatDate(req.created_at)}
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-600">{req.description}</p>

                {open && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {proPhone && (
                      <a
                        href={`https://wa.me/${formatBrazilianPhone(proPhone)}?text=${encodeURIComponent(
                          `Olá! Fiz um pedido pelo MãoCerta: ${req.description}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Falar no WhatsApp
                      </a>
                    )}
                    {(!appt || new Date(appt.starts_at) <= new Date()) && (
                      <button
                        type="button"
                        onClick={() => changeStatus(req, 'completed')}
                        className="inline-flex items-center gap-1 rounded-md border border-green-600 px-3 py-1.5 text-xs font-bold text-green-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Serviço realizado
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => changeStatus(req, 'canceled')}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                )}

                {req.status === 'completed' && !review && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-bold text-slate-700">Como foi o serviço? Avalie o profissional:</p>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                          onClick={() => setRatingMap({ ...ratingMap, [req.id]: star })}
                          className="p-1"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              (ratingMap[req.id] || 5) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      maxLength={400}
                      placeholder="Comentário opcional sobre o atendimento..."
                      value={commentMap[req.id] || ''}
                      onChange={(e) => setCommentMap({ ...commentMap, [req.id]: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={sending === req.id}
                      onClick={() => submitReview(req)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {sending === req.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar Avaliação
                    </button>
                  </div>
                )}

                {review && (
                  <p className="mt-3 text-xs font-semibold text-[#16A34A]">
                    ✓ Você avaliou com {'★'.repeat(review.rating)}
                    {review.comment ? ` — “${review.comment}”` : ''}
                  </p>
                )}

                {errorMap[req.id] && <p className="mt-2 text-xs text-red-600">{errorMap[req.id]}</p>}
              </div>
            )
          })
        )}
      </div>

      {!loading && (
        <div className="mt-10">
          <DeleteAccount />
        </div>
      )}
    </main>
  )
}
