'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  SERVICE_CATEGORIES,
  CategoryKey,
  PRICING_LABELS,
  LOCATION_LABELS,
  LocationKey,
  SHIFT_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  RequestStatus,
  OPEN_STATUSES,
  isScheduledCategory,
  SUPPORT_WHATSAPP,
} from '@/lib/constants'
import { formatDate, formatPrice, one, PricingType } from '@/lib/format'
import { formatBrazilianPhone } from '@/lib/whatsapp'
import { safeMediaUrl } from '@/lib/security'
import { ImageUploader } from '@/components/image-uploader'
import { ProAgenda } from '@/components/pro-agenda'
import { dateTimeLabel, DURATION_OPTIONS, formatDuration } from '@/lib/schedule'
import { LogoutButton } from '@/components/logout-button'
import { DeleteAccount } from '@/components/delete-account'
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Plus,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
  Handshake,
  CalendarClock,
  Crown,
  Pencil,
} from 'lucide-react'

interface ProDetails {
  slug: string
  business_name: string
  bio: string | null
  business_address: string | null
  plan_tier: 'free' | 'pro'
  plan_expires_at: string | null
  is_verified: boolean
  is_active: boolean
  avg_rating: number
  reviews_count: number
}

interface Service {
  id: string
  title: string
  category: CategoryKey
  subcategory: string
  description: string | null
  pricing_type: PricingType
  price_value: number | null
  service_location: LocationKey
  duration_minutes: number
}

interface RequestRow {
  id: string
  description: string
  status: RequestStatus
  preferred_shift: keyof typeof SHIFT_LABELS
  photo_url: string | null
  created_at: string
  profiles: { full_name: string; phone_whatsapp: string | null } | { full_name: string; phone_whatsapp: string | null }[] | null
  services: { title: string } | { title: string }[] | null
  zones: { name: string } | { name: string }[] | null
  appointments: { starts_at: string } | { starts_at: string }[] | null
}

type Zone = { id: number; name: string; zone_group: string }

export default function PainelProfissionalPage() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<'loading' | 'ready' | 'no-profile' | 'not-pro'>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [proDetails, setProDetails] = useState<ProDetails | null>(null)
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [portfolio, setPortfolio] = useState<{ id: string; image_url: string }[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZones, setSelectedZones] = useState<number[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [version, setVersion] = useState(0)
  const [availabilityCount, setAvailabilityCount] = useState(0)

  // Novo serviço
  const [srvTitle, setSrvTitle] = useState('')
  const [srvCat, setSrvCat] = useState<CategoryKey>('obras_manutencao')
  const [srvSub, setSrvSub] = useState<string>(SERVICE_CATEGORIES.obras_manutencao.subcategories[0])
  const [srvDesc, setSrvDesc] = useState('')
  const [srvPricing, setSrvPricing] = useState<PricingType>('quote')
  const [srvPrice, setSrvPrice] = useState('')
  const [srvLocation, setSrvLocation] = useState<LocationKey>('client_site')
  const [srvDuration, setSrvDuration] = useState(60)
  const [editingId, setEditingId] = useState<string | null>(null)
  const srvScheduled = isScheduledCategory(srvCat)

  function notify(type: 'ok' | 'error', text: string) {
    setToast({ type, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  const loadAll = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login?redirect=/painel'
      return
    }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, phone_whatsapp, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      setState('no-profile')
      return
    }
    setPhone(profile.phone_whatsapp || '')
    setAvatarUrl(safeMediaUrl(profile.avatar_url))

    const { data: details } = await supabase.from('pro_details').select('*').eq('user_id', user.id).maybeSingle()
    if (!details) {
      setState('not-pro')
      return
    }

    const [{ data: srvs }, { data: port }, { data: allZones }, { data: myZones }, { data: reqs }, { count: avCount }] = await Promise.all([
      supabase.from('services').select('*').eq('pro_id', user.id).order('created_at'),
      supabase.from('portfolio_items').select('id, image_url').eq('pro_id', user.id).order('created_at', { ascending: false }),
      supabase.from('zones').select('id, name, zone_group').order('id'),
      supabase.from('pro_zones').select('zone_id').eq('pro_id', user.id),
      supabase
        .from('service_requests')
        .select(
          'id, description, status, preferred_shift, photo_url, created_at, profiles!service_requests_client_id_fkey(full_name, phone_whatsapp), services(title), zones(name), appointments(starts_at)'
        )
        .eq('pro_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('pro_availability').select('id', { count: 'exact', head: true }).eq('pro_id', user.id),
    ])

    setProDetails(details as ProDetails)
    setServices((srvs as Service[]) || [])
    setPortfolio(
      (port || [])
        .map((p) => ({ ...p, image_url: safeMediaUrl(p.image_url) || '' }))
        .filter((p) => p.image_url)
    )
    setZones((allZones as Zone[]) || [])
    setSelectedZones((myZones || []).map((z) => z.zone_id))
    setRequests((reqs as unknown as RequestRow[]) || [])
    setAvailabilityCount(avCount || 0)
    setVersion((v) => v + 1)
    setState('ready')
  }, [supabase])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function activateShowcase() {
    setActivating(true)
    const { error } = await supabase.rpc('become_pro')
    setActivating(false)
    if (error) {
      notify('error', 'Não foi possível ativar sua vitrine. Tente novamente.')
      return
    }
    setState('loading')
    loadAll()
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !proDetails) return
    if (!proDetails.business_name.trim()) {
      notify('error', 'Informe o nome que aparece na sua vitrine.')
      return
    }
    setSaving(true)
    const phoneDigits = phone.replace(/\D/g, '')

    const results = await Promise.all([
      supabase
        .from('pro_details')
        .update({
          business_name: proDetails.business_name.trim(),
          bio: proDetails.bio,
          business_address: proDetails.business_address?.trim() || null,
        })
        .eq('user_id', userId),
      supabase.from('profiles').update({ phone_whatsapp: phoneDigits || null }).eq('id', userId),
    ])

    let error = results.find((r) => r.error)?.error
    if (!error) {
      const { error: delError } = await supabase.from('pro_zones').delete().eq('pro_id', userId)
      error = delError ?? undefined
      if (!error && selectedZones.length > 0) {
        const { error: insError } = await supabase
          .from('pro_zones')
          .insert(selectedZones.map((zone_id) => ({ pro_id: userId, zone_id })))
        error = insError ?? undefined
      }
    }
    setSaving(false)
    notify(error ? 'error' : 'ok', error ? 'Erro ao salvar. Tente novamente.' : 'Dados e bairros salvos!')
  }

  async function saveAvatar(url: string) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    if (error) return notify('error', 'Não foi possível salvar a foto.')
    setAvatarUrl(safeMediaUrl(url))
    notify('ok', 'Foto de perfil atualizada!')
  }

  function resetServiceForm() {
    setEditingId(null)
    setSrvTitle('')
    setSrvPrice('')
    setSrvDesc('')
  }

  function startEditService(s: Service) {
    setEditingId(s.id)
    setSrvTitle(s.title)
    setSrvCat(s.category)
    setSrvSub(s.subcategory)
    setSrvDesc(s.description || '')
    setSrvPricing(s.pricing_type)
    setSrvPrice(s.price_value ? String(s.price_value) : '')
    setSrvLocation(s.service_location)
    setSrvDuration(s.duration_minutes || 60)
    document.getElementById('form-servico')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !srvTitle.trim()) {
      notify('error', 'Dê um nome ao serviço.')
      return
    }
    const price = Number(String(srvPrice).replace(',', '.'))
    if (srvPricing !== 'quote' && (!price || price <= 0)) {
      notify('error', 'Informe um valor válido ou escolha "Sob orçamento".')
      return
    }
    const payload = {
      category: srvCat,
      subcategory: srvSub,
      title: srvTitle.trim(),
      description: srvDesc.trim() || null,
      pricing_type: srvPricing,
      price_value: srvPricing === 'quote' ? null : price,
      service_location: srvScheduled ? 'pro_studio' : srvLocation,
      duration_minutes: srvScheduled ? srvDuration : 60,
    }
    const { error } = editingId
      ? await supabase.from('services').update(payload).eq('id', editingId)
      : await supabase.from('services').insert({ ...payload, pro_id: userId })
    if (error) return notify('error', 'Erro ao salvar o serviço.')
    notify('ok', editingId ? 'Serviço atualizado!' : 'Serviço adicionado!')
    resetServiceForm()
    loadAll()
  }

  async function deleteService(id: string) {
    if (!window.confirm('Remover este serviço da sua vitrine?')) return
    await supabase.from('services').delete().eq('id', id)
    if (editingId === id) resetServiceForm()
    loadAll()
  }

  async function handlePortfolioUpload(url: string) {
    if (!userId) return
    const { error } = await supabase.from('portfolio_items').insert({ pro_id: userId, image_url: url })
    if (error) return notify('error', 'Erro ao salvar a foto.')
    loadAll()
  }

  async function deletePortfolio(id: string) {
    if (!window.confirm('Remover esta foto do portfólio?')) return
    await supabase.from('portfolio_items').delete().eq('id', id)
    loadAll()
  }

  async function updateRequestStatus(reqId: string, status: RequestStatus) {
    const { error } = await supabase.from('service_requests').update({ status }).eq('id', reqId)
    if (error) notify('error', error.message || 'Não foi possível atualizar o pedido.')
    loadAll()
  }

  function shareShowcase() {
    if (!proDetails) return
    const url = `${window.location.origin}/pro/${proDetails.slug}`
    const text = `Veja meus serviços no MãoCerta: ${url}`
    if (navigator.share) {
      navigator.share({ title: proDetails.business_name, text, url }).catch(() => {})
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando painel...
      </div>
    )
  }

  if (state === 'no-profile') {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-slate-900">Perfil não encontrado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sua conta existe, mas o perfil ainda não foi criado no banco de dados. Se você é o administrador, execute
          novamente o arquivo <code>supabase/schema.sql</code> no Supabase e recarregue esta página.
        </p>
        <div className="mt-4 flex justify-center">
          <LogoutButton />
        </div>
      </main>
    )
  }

  if (state === 'not-pro') {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-slate-900">Você está com uma conta de cliente</h1>
        <p className="mt-2 text-sm text-slate-600">
          Quer oferecer seus serviços em Ouro Preto? Ative sua vitrine grátis e comece a receber pedidos pelo WhatsApp.
        </p>
        <button
          type="button"
          onClick={activateShowcase}
          disabled={activating}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {activating && <Loader2 className="h-4 w-4 animate-spin" />} Ativar Minha Vitrine Grátis
        </button>
        <div className="mt-4">
          <Link href="/" className="text-sm font-semibold text-[#0F4C81]">
            Voltar ao início
          </Link>
        </div>
        {toast && <p className="mt-4 text-sm text-red-600">{toast.text}</p>}
      </main>
    )
  }

  if (!proDetails) return null

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const completedCount = requests.filter((r) => r.status === 'completed').length
  const closedCount = requests.filter((r) => r.status === 'completed' || r.status === 'canceled').length
  const conversion = closedCount > 0 ? Math.round((completedCount / closedCount) * 100) : null
  const planActive =
    proDetails.plan_tier === 'pro' && proDetails.plan_expires_at && new Date(proDetails.plan_expires_at) > new Date()
  const supportPhone = formatBrazilianPhone(SUPPORT_WHATSAPP)
  const planMsg = `Olá, equipe MãoCerta! Sou ${proDetails.business_name} (/pro/${proDetails.slug}) e quero saber como ${
    planActive ? 'continuar' : 'assinar'
  } o plano PRO.`
  const zoneGroups = zones.reduce<Record<string, Zone[]>>((acc, z) => {
    ;(acc[z.zone_group] ||= []).push(z)
    return acc
  }, {})
  const checklist = [
    { done: !!avatarUrl, label: 'Foto de perfil' },
    { done: !!phone.replace(/\D/g, ''), label: 'WhatsApp' },
    { done: services.length > 0, label: 'Ao menos 1 serviço' },
    { done: selectedZones.length > 0, label: 'Bairros atendidos' },
    { done: portfolio.length > 0, label: 'Fotos de trabalhos' },
  ]
  const hasScheduled = services.some((s) => isScheduledCategory(s.category))
  if (hasScheduled) {
    checklist.push(
      { done: !!proDetails.business_address?.trim(), label: 'Endereço do estabelecimento' },
      { done: availabilityCount > 0, label: 'Horários da agenda' }
    )
  }
  const missing = checklist.filter((c) => !c.done)

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-6">
      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-lg ${
            toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-xs font-semibold text-[#0F4C81]">
            ← MãoCerta
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Painel do Profissional</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {planActive ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                Plano Fundador PRO • até {formatDate(proDetails.plan_expires_at)}
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">Plano Grátis</span>
            )}
            {proDetails.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Verificado
              </span>
            )}
            {!proDetails.is_active && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                Vitrine pausada pela equipe
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/pro/${proDetails.slug}`}
            className="rounded-lg border border-[#0F4C81] px-3 py-1.5 text-sm font-semibold text-[#0F4C81]"
          >
            Ver Minha Vitrine
          </Link>
          <button
            type="button"
            onClick={shareShowcase}
            className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Share2 className="h-4 w-4" /> Divulgar
          </button>
          <LogoutButton />
        </div>
      </div>

      {/* Desempenho */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pedidos recebidos', value: requests.length },
          { label: 'Aguardando resposta', value: pendingCount },
          { label: conversion !== null ? `Concluídos (${conversion}% fechados)` : 'Concluídos', value: completedCount },
          {
            label: `Nota (${proDetails.reviews_count} aval.)`,
            value: proDetails.reviews_count > 0 ? Number(proDetails.avg_rating).toFixed(1) : '—',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <span className="text-xs text-slate-500">{s.label}</span>
            <p className="text-2xl font-bold text-[#0F4C81]">{s.value}</p>
          </div>
        ))}
      </section>

      {missing.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">Complete sua vitrine para aparecer melhor nas buscas:</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {checklist.map((c) => (
              <li
                key={c.label}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  c.done ? 'bg-green-100 text-green-800' : 'bg-white text-amber-900 ring-1 ring-amber-300'
                }`}
              >
                {c.done ? '✓ ' : ''}
                {c.label}
              </li>
            ))}
          </ul>
          {services.length === 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Sua vitrine só aparece na busca depois que você cadastrar pelo menos um serviço.
            </p>
          )}
        </section>
      )}

      {/* Planos de divulgação */}
      <section className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
              <Crown className="h-5 w-5 text-amber-500" /> Plano de divulgação
            </h2>
            <p className="mt-0.5 text-sm text-slate-700">
              {planActive
                ? `Você está no plano Fundador PRO até ${formatDate(proDetails.plan_expires_at)}.`
                : 'Você está no plano Grátis: sua vitrine aparece na busca normalmente.'}
            </p>
          </div>
          {supportPhone.length >= 12 ? (
            <a
              href={`https://wa.me/${supportPhone}?text=${encodeURIComponent(planMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600"
            >
              <Crown className="h-4 w-4" /> {planActive ? 'Renovar PRO' : 'Quero o PRO'}
            </a>
          ) : (
            <span className="text-xs text-slate-500">Para assinar, fale com a equipe MãoCerta.</span>
          )}
        </div>
        <ul className="mt-3 grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
          <li>✓ Aparece antes dos demais na busca e na página inicial</li>
          <li>✓ Selo de destaque (coroa) no cartão da vitrine</li>
          <li>✓ Vitrine com serviços, preços, fotos e avaliações</li>
          <li>✓ Pedidos e agendamentos ilimitados pelo WhatsApp</li>
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">
          O cadastro e o recebimento de pedidos são gratuitos. Valores do PRO são informados pela equipe e nenhuma cobrança
          é feita sem a sua confirmação.
        </p>
      </section>

      {/* Agenda (serviços com atendimento no estabelecimento) */}
      {hasScheduled && userId && (
        <ProAgenda userId={userId} version={version} notify={notify} onRequestsChanged={loadAll} />
      )}

      {/* Pedidos Recebidos */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Solicitações Recebidas ({requests.length})</h2>
        <div className="mt-3 space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma solicitação ainda. Divulgue o link da sua vitrine no seu WhatsApp e Instagram!
            </p>
          ) : (
            requests.map((r) => {
              const client = one(r.profiles)
              const service = one(r.services)
              const zone = one(r.zones)
              const appt = one(r.appointments)
              const photo = safeMediaUrl(r.photo_url)
              const clientPhone = client?.phone_whatsapp ? formatBrazilianPhone(client.phone_whatsapp) : ''
              const open = OPEN_STATUSES.includes(r.status)
              return (
                <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">{client?.full_name || 'Cliente'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  {appt ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-indigo-800">
                      <CalendarClock className="h-3.5 w-3.5" /> {service?.title || 'Serviço'} • {dateTimeLabel(appt.starts_at)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {service?.title || 'Outro serviço'} • {zone?.name || 'Ouro Preto'} •{' '}
                      {SHIFT_LABELS[r.preferred_shift] || r.preferred_shift} • {formatDate(r.created_at)}
                    </p>
                  )}
                  <p className="mt-1.5 text-sm text-slate-700">{r.description}</p>
                  {photo && (
                    <a href={photo} target="_blank" rel="noopener noreferrer">
                      <img src={photo} alt="Foto enviada pelo cliente" className="mt-2 h-24 rounded-md object-cover" />
                    </a>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {clientPhone && (
                      <a
                        href={`https://wa.me/${clientPhone}?text=${encodeURIComponent(
                          `Olá ${client?.full_name?.split(' ')[0] || ''}! Recebi seu pedido pelo MãoCerta sobre: ${r.description}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-3 py-1 text-xs font-bold text-white"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Responder no WhatsApp
                      </a>
                    )}
                    {r.status === 'pending' && appt && (
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(r.id, 'confirmed')}
                        className="inline-flex items-center gap-1 rounded-md bg-[#0F4C81] px-3 py-1 text-xs font-bold text-white"
                      >
                        <CalendarClock className="h-3.5 w-3.5" /> Confirmar horário
                      </button>
                    )}
                    {r.status === 'pending' && !appt && (
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(r.id, 'negotiating')}
                        className="inline-flex items-center gap-1 rounded-md bg-[#0F4C81] px-3 py-1 text-xs font-bold text-white"
                      >
                        <Handshake className="h-3.5 w-3.5" /> Em negociação
                      </button>
                    )}
                    {open && (
                      <>
                        {(!appt || new Date(appt.starts_at) <= new Date()) && (
                          <button
                            type="button"
                            onClick={() => updateRequestStatus(r.id, 'completed')}
                            className="inline-flex items-center gap-1 rounded-md border border-green-600 px-3 py-1 text-xs font-bold text-green-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Serviço concluído
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => updateRequestStatus(r.id, 'canceled')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Não fechado
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Serviços */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Meus Serviços e Preços</h2>
        <form id="form-servico" onSubmit={addService} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {editingId && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 sm:col-span-2">
              Editando o serviço &quot;{services.find((x) => x.id === editingId)?.title}&quot;
            </p>
          )}
          <input
            type="text"
            placeholder="Nome do serviço (ex.: Pintura de quarto)"
            value={srvTitle}
            onChange={(e) => setSrvTitle(e.target.value)}
            maxLength={80}
            className="rounded-lg border border-slate-300 p-2 text-sm sm:col-span-2"
          />
          <select
            value={srvCat}
            onChange={(e) => {
              const cat = e.target.value as CategoryKey
              setSrvCat(cat)
              setSrvSub(SERVICE_CATEGORIES[cat].subcategories[0])
            }}
            className="rounded-lg border border-slate-300 p-2 text-sm"
          >
            {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
              <option key={key} value={key}>
                {cat.label}
              </option>
            ))}
          </select>
          <select value={srvSub} onChange={(e) => setSrvSub(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm">
            {SERVICE_CATEGORIES[srvCat].subcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
          <select
            value={srvPricing}
            onChange={(e) => setSrvPricing(e.target.value as PricingType)}
            className="rounded-lg border border-slate-300 p-2 text-sm"
          >
            {Object.entries(PRICING_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {srvPricing !== 'quote' ? (
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              placeholder="Valor em R$"
              value={srvPrice}
              onChange={(e) => setSrvPrice(e.target.value)}
              className="rounded-lg border border-slate-300 p-2 text-sm"
            />
          ) : (
            <div className="hidden sm:block" />
          )}
          {srvScheduled ? (
            <>
              <select
                value={srvDuration}
                onChange={(e) => setSrvDuration(Number(e.target.value))}
                aria-label="Duração do atendimento"
                className="rounded-lg border border-slate-300 p-2 text-sm"
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Duração: {formatDuration(m)}
                  </option>
                ))}
              </select>
              <p className="flex items-center rounded-lg bg-slate-50 px-2 text-xs text-slate-600">
                Atendimento no seu estabelecimento, com agendamento online.
              </p>
            </>
          ) : (
            <select
              value={srvLocation}
              onChange={(e) => setSrvLocation(e.target.value as LocationKey)}
              className="rounded-lg border border-slate-300 p-2 text-sm sm:col-span-2"
            >
              {Object.entries(LOCATION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <textarea
            rows={2}
            placeholder="Descrição curta (opcional): o que está incluso, tempo médio..."
            value={srvDesc}
            onChange={(e) => setSrvDesc(e.target.value)}
            maxLength={300}
            className="rounded-lg border border-slate-300 p-2 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0F4C81] py-2 text-sm font-bold text-white sm:col-span-2"
          >
            {editingId ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Salvar Alterações do Serviço
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Adicionar Serviço
              </>
            )}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetServiceForm}
              className="rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-600 sm:col-span-2"
            >
              Cancelar edição
            </button>
          )}
        </form>

        <ul className="mt-4 divide-y divide-slate-100">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <span className="font-semibold text-slate-800">{s.title}</span>
                <span className="block text-xs text-slate-500">
                  {s.subcategory} • {formatPrice(s.pricing_type, s.price_value)}
                  {isScheduledCategory(s.category) ? ` • ${formatDuration(s.duration_minutes)} • no estabelecimento` : ''}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Editar ${s.title}`}
                  onClick={() => startEditService(s)}
                  className="rounded p-1.5 text-[#0F4C81] hover:bg-blue-50"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${s.title}`}
                  onClick={() => deleteService(s.id)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Portfólio */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-slate-900">Portfólio de Fotos</h2>
        <p className="mb-3 text-xs text-slate-500">Fotos de trabalhos reais passam mais confiança. As imagens são otimizadas automaticamente.</p>
        {userId && (
          <ImageUploader folder="portfolio" userId={userId} label="Subir foto de trabalho" onUploadSuccess={handlePortfolioUpload} />
        )}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {portfolio.map((p) => (
            <div key={p.id} className="relative">
              <img src={p.image_url} alt="Portfólio" className="h-24 w-full rounded-lg object-cover" />
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => deletePortfolio(p.id)}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Dados e Bairros */}
      <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Dados da Vitrine e Bairros Atendidos</h2>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-lg font-bold text-[#0F4C81]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              proDetails.business_name.slice(0, 2).toUpperCase()
            )}
          </div>
          {userId && <ImageUploader folder="avatars" userId={userId} label="Trocar foto de perfil" onUploadSuccess={saveAvatar} />}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome na vitrine</label>
          <input
            type="text"
            value={proDetails.business_name}
            maxLength={80}
            onChange={(e) => setProDetails({ ...proDetails, business_name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">WhatsApp para receber pedidos</label>
          <input
            type="tel"
            placeholder="31999999999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Endereço do estabelecimento {hasScheduled ? '(obrigatório para beleza e estética)' : '(se tiver)'}
          </label>
          <input
            type="text"
            maxLength={160}
            placeholder="Ex.: Rua Direita, 120 – Centro Histórico"
            value={proDetails.business_address || ''}
            onChange={(e) => setProDetails({ ...proDetails, business_address: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Sobre você</label>
          <textarea
            rows={3}
            maxLength={600}
            placeholder="Conte sua experiência, há quanto tempo trabalha em Ouro Preto, diferenciais..."
            value={proDetails.bio || ''}
            onChange={(e) => setProDetails({ ...proDetails, bio: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Onde você atende? ({selectedZones.length} selecionados)</p>
          {Object.entries(zoneGroups).map(([group, list]) => {
            const allChecked = list.every((z) => selectedZones.includes(z.id))
            return (
              <div key={group}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{group}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedZones(
                        allChecked
                          ? selectedZones.filter((id) => !list.some((z) => z.id === id))
                          : Array.from(new Set([...selectedZones, ...list.map((z) => z.id)]))
                      )
                    }
                    className="text-xs font-semibold text-[#0F4C81]"
                  >
                    {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {list.map((z) => {
                    const checked = selectedZones.includes(z.id)
                    return (
                      <label key={z.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedZones(checked ? selectedZones.filter((id) => id !== z.id) : [...selectedZones, z.id])
                          }
                        />
                        {z.name}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#EA580C] py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Alterações
        </button>
      </form>

      <DeleteAccount />

      <p className="flex items-center justify-center gap-1 pb-4 text-xs text-slate-400">
        <Star className="h-3 w-3" /> Avaliações só podem ser feitas por clientes com pedido concluído.
      </p>
    </main>
  )
}
