import Link from 'next/link'
import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import { ProCard, ProCardData } from '@/components/pro-card'
import { SiteFooter } from '@/components/site-footer'
import { SERVICE_CATEGORIES, CategoryKey } from '@/lib/constants'
import { PRO_CARD_SELECT, SORT_OPTIONS, SortKey, filterPros, isPlanActive, sortPros } from '@/lib/pros'
import { DemandForm } from '@/components/demand-form'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Buscar profissionais em Ouro Preto | MãoCerta',
}

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    categoria?: string
    sub?: string
    bairro?: string
    ordem?: string
  }>
}

export default async function BuscarPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const categoria = params.categoria && params.categoria in SERVICE_CATEGORIES ? (params.categoria as CategoryKey) : undefined
  const sub =
    categoria && params.sub && (SERVICE_CATEGORIES[categoria].subcategories as readonly string[]).includes(params.sub)
      ? params.sub
      : undefined

  const ordem: SortKey = params.ordem && params.ordem in SORT_OPTIONS ? (params.ordem as SortKey) : 'relevancia'
  const supabase = await createServerSupabase()

  const [{ data: zones }, { data: rawPros }] = await Promise.all([
    supabase.from('zones').select('id, name, zone_group').order('id', { ascending: true }),
    supabase.from('pro_details').select(PRO_CARD_SELECT).eq('is_active', true).limit(500),
  ])

  const results = sortPros(
    filterPros((rawPros as unknown as ProCardData[]) || [], { q: params.q, categoria, sub, bairro: params.bairro }),
    ordem
  )

  const zoneGroups = (zones || []).reduce<Record<string, { id: number; name: string }[]>>((acc, z) => {
    ;(acc[z.zone_group] ||= []).push(z)
    return acc
  }, {})

  const hasFilters = !!(params.q || categoria || params.bairro)

  function chipHref(subcategory?: string) {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (categoria) qs.set('categoria', categoria)
    if (subcategory) qs.set('sub', subcategory)
    if (params.bairro) qs.set('bairro', params.bairro)
    if (ordem !== 'relevancia') qs.set('ordem', ordem)
    return `/buscar?${qs.toString()}`
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Voltar" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Profissionais em Ouro Preto</h1>
      </div>

      <form method="GET" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
        {sub && <input type="hidden" name="sub" value={sub} />}
        <input
          type="text"
          name="q"
          aria-label="Buscar"
          defaultValue={params.q || ''}
          placeholder="Serviço ou nome..."
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        />

        <select
          name="categoria"
          aria-label="Categoria"
          defaultValue={categoria || ''}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
            <option key={key} value={key}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          name="bairro"
          aria-label="Bairro ou distrito"
          defaultValue={params.bairro || ''}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        >
          <option value="">Todos os bairros/distritos</option>
          {Object.entries(zoneGroups).map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          name="ordem"
          aria-label="Ordenar por"
          defaultValue={ordem}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        >
          {Object.entries(SORT_OPTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-lg bg-[#EA580C] py-2.5 text-base font-bold text-white hover:bg-[#EA580C]/90 sm:col-span-4"
        >
          Filtrar Resultados
        </button>
      </form>

      {categoria && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <Link
            href={chipHref()}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              !sub ? 'bg-[#0F4C81] text-white' : 'border border-slate-300 bg-white text-slate-700'
            }`}
          >
            Todos
          </Link>
          {SERVICE_CATEGORIES[categoria].subcategories.map((s) => (
            <Link
              key={s}
              href={chipHref(s)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                sub === s ? 'bg-[#0F4C81] text-white' : 'border border-slate-300 bg-white text-slate-700'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-slate-500">
        {results.length} {results.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}
        {hasFilters && (
          <>
            {' • '}
            <Link href="/buscar" className="font-semibold text-[#0F4C81]">
              Limpar filtros
            </Link>
          </>
        )}
      </p>

      <div className="mt-3 space-y-4">
        {results.length === 0 ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-medium text-slate-700">Nenhum profissional encontrado com esses filtros.</p>
              <p className="mt-1 text-sm text-slate-500">Tente remover o filtro de bairro ou buscar em outra categoria.</p>
            </div>
            <DemandForm q={params.q} categoria={categoria} bairro={params.bairro} />
          </>
        ) : (
          results.map((pro) => <ProCard key={pro.user_id} pro={pro} highlight={ordem === 'relevancia' && isPlanActive(pro)} />)
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-6 text-center">
          <DemandForm q={params.q} categoria={categoria} bairro={params.bairro} compact />
        </div>
      )}

      <SiteFooter />
    </main>
  )
}
