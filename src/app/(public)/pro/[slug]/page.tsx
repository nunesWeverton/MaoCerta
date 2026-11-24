import { cache } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { QuoteModal } from '@/components/quote-modal'
import { BookingWidget } from '@/components/booking-widget'
import { SiteFooter } from '@/components/site-footer'
import { LOCATION_LABELS, LocationKey, isScheduledCategory } from '@/lib/constants'
import { formatDuration, WEEKDAY_LABELS } from '@/lib/schedule'
import { formatDate, formatPrice, one, PricingType } from '@/lib/format'
import { safeMediaUrl } from '@/lib/security'
import { ArrowLeft, ShieldCheck, Star, MapPin, Home, Clock, Store } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ProProfilePageProps {
  params: Promise<{ slug: string }>
}

type Rel<T> = T | T[] | null

interface ProPageData {
  user_id: string
  slug: string
  business_name: string
  bio: string | null
  business_address: string | null
  is_verified: boolean
  avg_rating: number
  reviews_count: number
  profiles: Rel<{ full_name: string; avatar_url: string | null; phone_whatsapp: string | null }>
  pro_zones: { zones: Rel<{ id: number; name: string }> }[]
  services: {
    id: string
    title: string
    category: string
    subcategory: string
    description: string | null
    duration_minutes: number
    pricing_type: PricingType
    price_value: number | null
    service_location: LocationKey
  }[]
  portfolio_items: { id: string; image_url: string; caption: string | null }[]
  reviews: { id: string; rating: number; comment: string | null; author_name: string | null; created_at: string }[]
  pro_availability: { weekday: number; start_time: string; end_time: string }[]
}

// cache(): generateMetadata e a página compartilham a mesma consulta por requisição
const loadPro = cache(async (slug: string) => {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('pro_details')
    .select(
      `
      user_id,
      slug,
      business_name,
      bio,
      business_address,
      is_verified,
      avg_rating,
      reviews_count,
      profiles!inner(full_name, avatar_url, phone_whatsapp),
      pro_zones(zones(id, name)),
      services(id, title, category, subcategory, description, pricing_type, price_value, service_location, duration_minutes),
      portfolio_items(id, image_url, caption),
      reviews(id, rating, comment, author_name, created_at),
      pro_availability(weekday, start_time, end_time)
    `
    )
    .eq('slug', slug)
    .order('created_at', { referencedTable: 'reviews', ascending: false })
    .maybeSingle()
  return { supabase, pro: data as unknown as ProPageData | null }
})

export async function generateMetadata({ params }: ProProfilePageProps): Promise<Metadata> {
  const { slug } = await params
  const { pro } = await loadPro(slug)
  if (!pro) return { title: 'Profissional não encontrado | MãoCerta' }
  const main = pro.services?.[0]?.subcategory
  return {
    title: `${pro.business_name}${main ? ` – ${main}` : ''} em Ouro Preto | MãoCerta`,
    description: pro.bio?.slice(0, 160) || `Veja serviços, preços e avaliações de ${pro.business_name} em Ouro Preto - MG.`,
  }
}

export default async function ProProfilePage({ params }: ProProfilePageProps) {
  const { slug } = await params
  const { supabase, pro } = await loadPro(slug)

  if (!pro) return notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profileData = one(pro.profiles)
  const avatarSrc = safeMediaUrl(profileData?.avatar_url)
  const portfolio = (pro.portfolio_items || [])
    .map((item) => ({ ...item, image_url: safeMediaUrl(item.image_url) }))
    .filter((item): item is typeof item & { image_url: string } => !!item.image_url)
  const zonesList = (pro.pro_zones || []).map((pz) => one(pz.zones)).filter(Boolean) as { id: number; name: string }[]

  // Se o profissional ainda não marcou bairros, o cliente escolhe entre todos
  let quoteZones = zonesList
  if (quoteZones.length === 0) {
    const { data: allZones } = await supabase.from('zones').select('id, name').order('id')
    quoteZones = allZones || []
  }

  const isOwner = user?.id === pro.user_id
  const scheduledServices = (pro.services || []).filter((s) => isScheduledCategory(s.category))
  const quoteServices = (pro.services || []).filter((s) => !isScheduledCategory(s.category))
  const hours = [1, 2, 3, 4, 5, 6, 0].map((wd) => ({
    wd,
    ranges: (pro.pro_availability || [])
      .filter((a) => a.weekday === wd)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((a) => `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`),
  }))
  const hasHours = hours.some((h) => h.ranges.length > 0)

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <Link href="/buscar" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Voltar para busca
      </Link>

      {isOwner && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Esta é a sua vitrine, como os clientes a veem.{' '}
          <Link href="/painel" className="font-bold underline">
            Editar no painel
          </Link>
        </div>
      )}

      {/* Cabeçalho do Perfil */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xl font-bold text-[#0F4C81]">
            {avatarSrc ? (
              <img src={avatarSrc} alt={pro.business_name} className="h-full w-full object-cover" />
            ) : (
              pro.business_name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{pro.business_name}</h1>
              {pro.is_verified && <ShieldCheck aria-label="Profissional verificado" className="h-5 w-5 text-[#16A34A]" />}
            </div>
            {pro.is_verified && <p className="text-xs font-semibold text-[#16A34A]">Documentos conferidos pela equipe MãoCerta</p>}
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-bold text-slate-900">
                {pro.reviews_count > 0 ? Number(pro.avg_rating).toFixed(1) : 'Novo na plataforma'}
              </span>
              {pro.reviews_count > 0 && (
                <span>
                  ({pro.reviews_count} {pro.reviews_count === 1 ? 'avaliação' : 'avaliações'})
                </span>
              )}
            </div>
            {pro.bio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{pro.bio}</p>}
          </div>
        </div>

        {zonesList.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              <MapPin className="h-3.5 w-3.5" /> Bairros e Distritos Atendidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {zonesList.map((z) => (
                <span key={z.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {z.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {(pro.business_address || (scheduledServices.length > 0 && hasHours)) && (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            {pro.business_address && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Store className="h-3.5 w-3.5" /> Estabelecimento
                </p>
                <p className="text-sm text-slate-700">{pro.business_address}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${pro.business_address}, Ouro Preto - MG`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C81]"
                >
                  <MapPin className="h-3.5 w-3.5" /> Ver no mapa
                </a>
              </div>
            )}
            {scheduledServices.length > 0 && hasHours && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> Horário de atendimento
                </p>
                <ul className="text-xs text-slate-700">
                  {hours.map((h) => (
                    <li key={h.wd} className="flex justify-between gap-2">
                      <span>{WEEKDAY_LABELS[h.wd]}</span>
                      <span className={h.ranges.length ? 'tabular-nums' : 'text-slate-400'}>
                        {h.ranges.length ? h.ranges.join(' • ') : 'Fechado'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Serviços */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Serviços e Preços</h2>
        <div className="mt-3 space-y-2.5">
          {(pro.services || []).length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Este profissional ainda não cadastrou serviços.
            </p>
          )}
          {(pro.services || []).map((srv) => (
            <div key={srv.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <h3 className="font-bold text-slate-900">{srv.title}</h3>
                <p className="text-xs font-medium text-[#0F4C81]">{srv.subcategory}</p>
                {srv.description && <p className="mt-1 text-xs text-slate-500">{srv.description}</p>}
                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                  <Home className="h-3 w-3" /> {LOCATION_LABELS[srv.service_location] || ''}
                  {isScheduledCategory(srv.category) ? ` • ${formatDuration(srv.duration_minutes)} • agendamento online` : ''}
                </p>
              </div>
              <span className="shrink-0 text-right text-sm font-bold text-[#0F4C81]">
                {formatPrice(srv.pricing_type, srv.price_value)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Valores informados pelo profissional. O preço final é combinado diretamente com ele.
        </p>
      </section>

      {/* Portfólio */}
      {portfolio.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-slate-900">Portfólio de Trabalhos</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {portfolio.map((item) => (
              <a key={item.id} href={item.image_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={item.image_url}
                  alt={item.caption || 'Trabalho realizado'}
                  className="aspect-square w-full rounded-xl border border-slate-200 object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Agendamento online (beleza e estética: atendimento no estabelecimento) */}
      {scheduledServices.length > 0 && (
        <section className="mt-6" id="agendar">
          {isOwner ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Seus clientes verão aqui a agenda com as datas e horários livres.{' '}
              <Link href="/painel" className="font-semibold text-[#0F4C81]">
                Gerenciar agenda
              </Link>
            </p>
          ) : (
            <BookingWidget
              proId={pro.user_id}
              proName={pro.business_name}
              proPhone={profileData?.phone_whatsapp || ''}
              address={pro.business_address}
              services={scheduledServices.map((s) => ({
                id: s.id,
                title: s.title,
                duration_minutes: s.duration_minutes,
                pricing_type: s.pricing_type,
                price_value: s.price_value,
              }))}
              currentUserId={user?.id || null}
            />
          )}
        </section>
      )}

      {/* Formulário de Orçamento (demais serviços) */}
      {!isOwner && (quoteServices.length > 0 || scheduledServices.length === 0) && (
        <section className="mt-6" id="orcamento">
          <QuoteModal
            proId={pro.user_id}
            proName={pro.business_name}
            proPhone={profileData?.phone_whatsapp || ''}
            services={quoteServices.map((s) => ({ id: s.id, title: s.title }))}
            zones={quoteZones}
            currentUserId={user?.id || null}
          />
        </section>
      )}

      {/* Avaliações */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Avaliações de Clientes</h2>
        <div className="mt-3 space-y-3">
          {(pro.reviews || []).length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Este profissional ainda não possui avaliações.
            </p>
          ) : (
            (pro.reviews || []).map((rev) => (
              <div key={rev.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{rev.author_name || 'Cliente'}</span>
                  <span className="text-xs font-bold text-amber-500" aria-label={`${rev.rating} de 5 estrelas`}>
                    {'★'.repeat(rev.rating)}
                    <span className="text-slate-300">{'★'.repeat(5 - rev.rating)}</span>
                  </span>
                </div>
                {rev.comment && <p className="mt-1.5 text-sm text-slate-600">{rev.comment}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{formatDate(rev.created_at)} • Pedido concluído pelo MãoCerta</p>
              </div>
            ))
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
