import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'MãoCerta | Profissionais de Confiança em Ouro Preto - MG',
  description:
    'Encontre pedreiros, encanadores, pintores, eletricistas e profissionais de beleza em Ouro Preto e distritos. Veja preços, fotos e avaliações e peça orçamento no WhatsApp.',
  applicationName: 'MãoCerta',
  appleWebApp: { capable: true, title: 'MãoCerta', statusBarStyle: 'default' },
  icons: { apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'MãoCerta',
    title: 'MãoCerta • Profissionais de confiança em Ouro Preto',
    description: 'Obras, reparos e beleza na Sede e nos distritos. Peça orçamento direto no WhatsApp.',
  },
}

export const viewport: Viewport = {
  themeColor: '#0F4C81',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#F8FAFC] text-slate-900 antialiased`}>{children}</body>
    </html>
  )
}
