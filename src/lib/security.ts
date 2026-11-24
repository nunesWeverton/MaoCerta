const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const MEDIA_PREFIX = '/storage/v1/object/public/maocerta-media/'

let supabaseHost = ''
try {
  supabaseHost = new URL(SUPABASE_URL).host
} catch {
  supabaseHost = ''
}

/**
 * Aceita apenas imagens públicas do bucket do projeto no Supabase.
 * Bloqueia `javascript:`, `data:` e domínios externos vindos do banco
 * (evita XSS armazenado e rastreamento por imagens de terceiros).
 */
export function safeMediaUrl(url: string | null | undefined): string | null {
  if (!url || !supabaseHost) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    if (parsed.host !== supabaseHost) return null
    if (!parsed.pathname.startsWith(MEDIA_PREFIX)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Valida destinos de redirecionamento: apenas caminhos internos.
 * Rejeita `//site`, `/\site` e esquemas, que navegadores tratam como URL externa.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = '/'): string {
  if (!path || typeof path !== 'string') return fallback
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback
  if (/[\u0000-\u001f]/.test(path)) return fallback
  try {
    const resolved = new URL(path, 'http://interno.local')
    if (resolved.host !== 'interno.local') return fallback
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return fallback
  }
}
