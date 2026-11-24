import type { ProCardData } from '@/components/pro-card'
import { normalize } from '@/lib/format'

export const PRO_CARD_SELECT = `
  user_id,
  slug,
  business_name,
  bio,
  plan_tier,
  plan_expires_at,
  is_verified,
  avg_rating,
  reviews_count,
  profiles!inner(full_name, avatar_url),
  pro_zones(zone_id, zones(name)),
  services(title, category, subcategory, description, pricing_type, price_value),
  portfolio_items(image_url)
`

export const SORT_OPTIONS = {
  relevancia: 'Mais relevantes',
  avaliacao: 'Melhor avaliados',
  preco: 'Menor preço',
} as const

export type SortKey = keyof typeof SORT_OPTIONS

export function isPlanActive(pro: Pick<ProCardData, 'plan_tier' | 'plan_expires_at'>): boolean {
  return pro.plan_tier === 'pro' && !!pro.plan_expires_at && new Date(pro.plan_expires_at) > new Date()
}

/** Menor preço informado entre os serviços exibidos (ignora "sob orçamento") */
function lowestPrice(pro: ProCardData): number {
  const prices = (pro.services || [])
    .filter((s) => s.pricing_type !== 'quote' && s.price_value)
    .map((s) => Number(s.price_value))
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i]
  }
  return 0
}

/**
 * relevancia: plano PRO ativo > verificado > nota > nº de avaliações > fotos
 * avaliacao:  nota > nº de avaliações > verificado
 * preco:      menor preço informado (sem preço por último) > nota
 */
export function sortPros(pros: ProCardData[], sort: SortKey = 'relevancia'): ProCardData[] {
  return [...pros].sort((a, b) => {
    if (sort === 'preco') {
      const pa = lowestPrice(a)
      const pb = lowestPrice(b)
      if (pa !== pb) return pa - pb
      return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0)
    }
    const score = (p: ProCardData) =>
      sort === 'avaliacao'
        ? [Number(p.avg_rating) || 0, p.reviews_count || 0, p.is_verified ? 1 : 0]
        : [
            isPlanActive(p) ? 1 : 0,
            p.is_verified ? 1 : 0,
            Number(p.avg_rating) || 0,
            p.reviews_count || 0,
            p.portfolio_items?.length || 0,
          ]
    return compareScores(score(a), score(b))
  })
}

interface FilterParams {
  q?: string
  categoria?: string
  sub?: string
  bairro?: string
}

/**
 * Filtra profissionais e reordena os serviços de cada um para que o serviço
 * que corresponde à busca apareça primeiro no cartão (preço comparável).
 */
export function filterPros(pros: ProCardData[], { q, categoria, sub, bairro }: FilterParams): ProCardData[] {
  const terms = q ? normalize(q).split(/\s+/).filter((t) => t.length > 1) : []
  const result: ProCardData[] = []

  for (const pro of pros) {
    const services = pro.services || []
    // Só aparece quem já cadastrou ao menos um serviço
    if (services.length === 0) continue

    const inCategory = services.filter(
      (s) => (!categoria || s.category === categoria) && (!sub || s.subcategory === sub)
    )
    if ((categoria || sub) && inCategory.length === 0) continue

    if (bairro && !pro.pro_zones?.some((pz) => String(pz.zone_id) === bairro)) continue

    let matching = inCategory
    if (terms.length > 0) {
      const serviceText = (s: (typeof services)[number]) => normalize(`${s.title} ${s.subcategory} ${s.description || ''}`)
      const proText = normalize(`${pro.business_name} ${pro.bio || ''}`)
      const haystack = `${proText} ${services.map(serviceText).join(' ')}`
      if (!terms.every((t) => haystack.includes(t))) continue
      const byService = inCategory.filter((s) => terms.some((t) => serviceText(s).includes(t)))
      if (byService.length > 0) matching = byService
    }

    const rest = services.filter((s) => !matching.includes(s))
    result.push({ ...pro, services: [...matching, ...rest] })
  }
  return result
}
