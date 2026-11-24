import Link from 'next/link'
import { SUPPORT_WHATSAPP } from '@/lib/constants'
import { formatBrazilianPhone } from '@/lib/whatsapp'

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
      <p className="font-semibold text-slate-700">MãoCerta • Ouro Preto - MG</p>
      <nav className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/termos" className="hover:underline">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="hover:underline">
          Privacidade (LGPD)
        </Link>
        {SUPPORT_WHATSAPP && (
          <a
            href={`https://wa.me/${formatBrazilianPhone(SUPPORT_WHATSAPP)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Suporte no WhatsApp
          </a>
        )}
      </nav>
      <p className="mt-2">
        O MãoCerta aproxima clientes e profissionais independentes. A negociação, o pagamento e a execução do serviço são
        combinados diretamente entre as partes.
      </p>
    </footer>
  )
}
