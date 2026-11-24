import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { ProCard, ProCardData } from '@/components/pro-card'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PRO_CARD_SELECT, filterPros, isPlanActive, sortPros } from '@/lib/pros'
import {
  Search,
  Hammer,
  Wrench,
  Paintbrush,
  Zap,
  DoorOpen,
  Scissors,
  Sparkles,
  Brush,
  Heart,
  Smile,
  MessageCircle,
  ShieldCheck,
  Star,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const QUICK_CATEGORIES = [
  { label: 'Pedreiro', cat: 'obras_manutencao', sub: 'Pedreiro e Alvenaria', icon: Hammer },
  { label: 'Encanador', cat: 'obras_manutencao', sub: 'Encanador e Hidráulica', icon: Wrench },
  { label: 'Pintor', cat: 'obras_manutencao', sub: 'Pintor Residencial e Comercial', icon: Paintbrush },
  { label: 'Eletricista', cat: 'obras_manutencao', sub: 'Eletricista e Pequenos Reparos', icon: Zap },
  { label: 'Marcenaria', cat: 'obras_manutencao', sub: 'Serralheria, Marcenaria e Vidraçaria', icon: DoorOpen },
  { label: 'Cabeleireiro', cat: 'beleza_estetica', sub: 'Cabeleireiro(a) e Escovista', icon: Scissors },
  { label: 'Barbearia', cat: 'beleza_estetica', sub: 'Barbearia', icon: Smile },
  { label: 'Manicure', cat: 'beleza_estetica', sub: 'Manicure, Pedicure e Nail Designer', icon: Sparkles },
  { label: 'Estética', cat: 'beleza_estetica', sub: 'Estética Facial e Corporal', icon: Heart },
  { label: 'Maquiagem', cat: 'beleza_estetica', sub: 'Maquiagem, Sobrancelhas e Cílios', icon: Brush },
]

export default async function HomePage() {
  const supabase = await createServerSupabase()

  const { data } = await supabase.from('pro_details').select(PRO_CARD_SELECT).eq('is_active', true).limit(200)

  const featuredPros = sortPros(filterPros((data as unknown as ProCardData[]) || [], {})).slice(0, 6)

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <SiteHeader />

      <section className="mt-6 rounded-2xl bg-[#0F4C81] p-5 text-white shadow-sm">
        <h1 className="text-xl font-bold leading-snug">Profissionais de confiança em Ouro Preto, sem enrolação.</h1>
        <p className="mt-1 text-sm text-blue-100">Obras, reparos e beleza na Sede e nos distritos. Peça orçamento direto no WhatsApp.</p>
        <form action="/buscar" method="GET" className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              name="q"
              aria-label="O que você precisa?"
              placeholder="Ex.: pedreiro, chuveiro, escova..."
              className="w-full rounded-lg bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <button type="submit" className="rounded-lg bg-[#EA580C] px-4 py-2.5 text-base font-bold text-white hover:bg-[#EA580C]/90">
            Buscar
          </button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Categorias</h2>
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {QUICK_CATEGORIES.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                href={`/buscar?categoria=${item.cat}&sub=${encodeURIComponent(item.sub)}`}
                className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-[#0F4C81]"
              >
                <Icon className="h-6 w-6 text-[#0F4C81]" />
                <span className="mt-1.5 text-xs font-semibold text-slate-700">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Profissionais em Destaque</h2>
          <Link href="/buscar" className="text-sm font-semibold text-[#0F4C81]">
            Ver todos
          </Link>
        </div>

        <div className="mt-3 space-y-4">
          {featuredPros.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Ainda não há profissionais cadastrados. Seja o primeiro fundador em Ouro Preto!
            </div>
          ) : (
            featuredPros.map((pro) => <ProCard key={pro.user_id} pro={pro} highlight={isPlanActive(pro)} />)
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Como funciona</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Search, title: '1. Encontre', text: 'Busque por serviço e bairro. Veja fotos, preços e avaliações.' },
            { icon: MessageCircle, title: '2. Peça orçamento', text: 'Descreva o que precisa e converse direto no WhatsApp.' },
            { icon: Star, title: '3. Avalie', text: 'Depois do serviço, sua avaliação ajuda outros moradores.' },
          ].map((step) => {
            const Icon = step.icon
            return (
              <li key={step.title} className="rounded-lg bg-slate-50 p-3">
                <Icon className="h-5 w-5 text-[#0F4C81]" />
                <p className="mt-1 text-sm font-bold text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-600">{step.text}</p>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-[#16A34A]" /> O selo verde indica profissionais com documentos conferidos pela equipe MãoCerta.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p className="font-bold text-slate-900">É profissional ou tem salão em Ouro Preto?</p>
        <p className="mt-1 text-sm text-slate-600">Cadastre seus serviços grátis e receba pedidos direto no seu WhatsApp.</p>
        <Link href="/login?role=pro" className="mt-3 inline-block rounded-lg bg-[#0F4C81] px-5 py-2.5 text-sm font-bold text-white">
          Criar Minha Vitrine Grátis
        </Link>
      </section>

      <SiteFooter />
    </main>
  )
}
