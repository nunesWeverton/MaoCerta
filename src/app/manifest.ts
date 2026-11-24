import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MãoCerta - Ouro Preto',
    short_name: 'MãoCerta',
    description: 'Profissionais verificados de obras, manutenção e beleza em Ouro Preto e distritos.',
    start_url: '/',
    lang: 'pt-BR',
    orientation: 'portrait',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#0F4C81',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
