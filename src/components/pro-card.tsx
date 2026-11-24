import Link from 'next/link'
import { Star, ShieldCheck, MapPin, Crown, CalendarDays } from 'lucide-react'
import { isScheduledCategory } from '@/lib/constants'
import { safeMediaUrl } from '@/lib/security'
import { formatPrice, one, PricingType } from '@/lib/format'

type Rel<T> = T | T[] | null

export interface ProCardData {
  user_id: string
  slug: string
  business_name: string
  bio: string | null
  plan_tier: 'free' | 'pro'
  plan_expires_at: string | null
  is_verified: boolean
  avg_rating: number
  reviews_count: number
  profiles: Rel<{
    full_name: string
    avatar_url: string | null
  }>
  pro_zones: {
    zone_id: number
    zones: Rel<{ name: string }>
  }[]
  services: {
    title: string
    category: string
    subcategory: string
    description: string | null
    pricing_type: PricingType
    price_value: number | null
  }[]
  portfolio_items: {
    image_url: string
  }[]
}

export function ProCard({ pro, highlight = false }: { pro: ProCardData; highlight?: boolean }) {
  const profile = one(pro.profiles)
  const mainService = pro.services?.[0]
  const zonesList = (pro.pro_zones || []).map((pz) => one(pz.zones)?.name).filter(Boolean) as string[]
  const avatarSrc = safeMediaUrl(profile?.avatar_url)
  const photos = (pro.portfolio_items || [])
    .map((p) => safeMediaUrl(p.image_url))
    .filter((u): u is string => !!u)
    .slice(0, 3)
  const hasAgenda = (pro.services || []).some((s) => isScheduledCategory(s.category))

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0F4C81]/40">
      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-lg font-bold text-[#0F4C81]">
            {avatarSrc ? (
              <img src={avatarSrc} alt={pro.business_name} className="h-full w-full object-cover" />
            ) : (
              pro.business_name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-bold text-slate-900">{pro.business_name}</h3>
              {pro.is_verified && (
                <ShieldCheck aria-label="Profissional verificado" className="h-4 w-4 shrink-0 text-[#16A34A]" />
              )}
              {highlight && <Crown aria-label="Destaque" className="h-4 w-4 shrink-0 text-amber-500" />}
            </div>
            <p className="truncate text-sm font-medium text-[#0F4C81]">
              {mainService?.subcategory || mainService?.title || 'Prestador de Serviços'}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-slate-800">
                {pro.reviews_count > 0 ? Number(pro.avg_rating).toFixed(1) : 'Novo'}
              </span>
              {pro.reviews_count > 0 && (
                <span>
                  ({pro.reviews_count} {pro.reviews_count === 1 ? 'avaliação' : 'avaliações'})
                </span>
              )}
            </div>
          </div>
        </div>

        {hasAgenda && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-800">
            <CalendarDays className="h-3.5 w-3.5" /> Agenda online • atendimento no estabelecimento
          </span>
        )}

        {zonesList.length > 0 && (
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="line-clamp-1">
              Atende: {zonesList.slice(0, 3).join(', ')}
              {zonesList.length > 3 ? ` +${zonesList.length - 3}` : ''}
            </span>
          </div>
        )}

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {photos.map((src, idx) => (
              <img key={idx} src={src} alt="Trabalho realizado" className="h-16 w-full rounded-md object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div>
          <span className="block text-[11px] uppercase tracking-wide text-slate-400">
            {mainService?.title || 'Valor estimado'}
          </span>
          <span className="text-sm font-bold text-slate-900">
            {mainService ? formatPrice(mainService.pricing_type, mainService.price_value) : 'Sob orçamento'}
          </span>
        </div>
        <Link
          href={`/pro/${pro.slug}`}
          className="rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0F4C81]/90"
        >
          Ver Perfil
        </Link>
      </div>
    </div>
  )
}
