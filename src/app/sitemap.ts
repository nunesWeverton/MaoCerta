import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const staticPages: MetadataRoute.Sitemap = ['', '/buscar', '/termos', '/privacidade'].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: 'daily',
  }))

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await supabase.from('pro_details').select('slug, updated_at').eq('is_active', true)
    return [
      ...staticPages,
      ...(data || []).map((p) => ({
        url: `${base}/pro/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
      })),
    ]
  } catch {
    return staticPages
  }
}
