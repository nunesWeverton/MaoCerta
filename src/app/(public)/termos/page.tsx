import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = { title: 'Termos de Uso | MãoCerta' }

export default function TermosPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-[#0F4C81]">
        ← Voltar
      </Link>
      <article className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        <h1 className="text-xl font-bold text-slate-900">Termos de Uso</h1>

        <section>
          <h2 className="font-bold text-slate-900">1. O que é o MãoCerta</h2>
          <p>
            O MãoCerta é uma plataforma de divulgação que aproxima moradores de Ouro Preto e distritos de profissionais
            autônomos e empresas prestadoras de serviço. O MãoCerta não é parte dos contratos de serviço: preço, prazo,
            forma de pagamento, garantia e execução são combinados diretamente entre cliente e profissional.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">2. Responsabilidades do profissional</h2>
          <ul className="ml-5 list-disc">
            <li>Manter informações verdadeiras sobre serviços, preços e áreas de atendimento.</li>
            <li>Publicar apenas fotos de trabalhos próprios.</li>
            <li>Cumprir a legislação aplicável à sua atividade, inclusive normas técnicas e de segurança.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">3. Responsabilidades do cliente</h2>
          <ul className="ml-5 list-disc">
            <li>Descrever o serviço de forma clara e tratar o profissional com respeito.</li>
            <li>Avaliar de forma honesta, apenas serviços efetivamente contratados.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">4. Selo de verificação e avaliações</h2>
          <p>
            O selo &quot;Verificado&quot; indica que a equipe conferiu documentos de identificação do profissional; não é
            garantia sobre a qualidade do serviço. Avaliações falsas, ofensivas ou que exponham dados pessoais podem ser
            removidas.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">5. Planos</h2>
          <p>
            O cadastro de profissionais é gratuito. Profissionais fundadores recebem um período promocional do plano PRO
            (maior destaque nas buscas). Condições de planos pagos serão informadas com antecedência, e nenhuma cobrança
            será feita sem aceite expresso.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">6. Suspensão</h2>
          <p>
            Contas que violem estes termos, publiquem conteúdo enganoso ou recebam denúncias graves podem ser pausadas ou
            removidas.
          </p>
        </section>

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Documento-modelo para a fase piloto. Deve ser revisado por profissional jurídico antes do lançamento comercial.
        </p>
      </article>
      <SiteFooter />
    </main>
  )
}
