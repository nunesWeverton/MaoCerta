import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="text-2xl font-extrabold text-[#0F4C81]">MãoCerta</span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">Página não encontrada</h1>
      <p className="mt-1 text-sm text-slate-600">O endereço pode ter mudado ou o profissional não está mais ativo.</p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Início
        </Link>
        <Link href="/buscar" className="rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-bold text-white">
          Buscar profissionais
        </Link>
      </div>
    </main>
  )
}
