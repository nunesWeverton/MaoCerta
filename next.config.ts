import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

let supabaseHost = ''
try {
  supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host
} catch {
  supabaseHost = ''
}
const supabase = supabaseHost ? `https://${supabaseHost}` : ''
const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : ''

// Content Security Policy: só carrega scripts do próprio site e só conversa com o Supabase do projeto
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabaseWs}${isDev ? ' ws: http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Raiz explícita: evita que um package-lock.json em pasta superior confunda o build
  outputFileTracingRoot: process.cwd(),
  // O app usa <img> com URLs do Supabase; o otimizador de imagens fica desligado
  // para não funcionar como proxy aberto de imagens de qualquer domínio.
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
