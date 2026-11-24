export type PricingType = 'fixed' | 'starting_at' | 'quote'

export function formatBRL(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPrice(pricingType: PricingType, priceValue: number | null | undefined): string {
  if (pricingType === 'quote' || !priceValue) return 'Sob orçamento'
  const prefix = pricingType === 'starting_at' ? 'A partir de ' : ''
  return `${prefix}${formatBRL(priceValue)}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Normaliza relações do Supabase que podem vir como objeto ou array */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
