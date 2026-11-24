import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = { title: 'Política de Privacidade | MãoCerta' }

export default function PrivacidadePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-[#0F4C81]">
        ← Voltar
      </Link>
      <article className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
        <h1 className="text-xl font-bold text-slate-900">Política de Privacidade</h1>
        <p className="text-xs text-slate-500">Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</p>

        <section>
          <h2 className="font-bold text-slate-900">1. Quais dados coletamos</h2>
          <ul className="ml-5 list-disc">
            <li>Cadastro: nome, e-mail, WhatsApp e senha (armazenada de forma criptografada pelo provedor de autenticação).</li>
            <li>Profissionais: nome comercial, descrição, serviços, preços, bairros atendidos, foto de perfil e fotos de trabalhos.</li>
            <li>Pedidos: descrição do serviço, bairro, prazo desejado e foto opcional enviada pelo cliente.</li>
            <li>Avaliações: nota, comentário e o primeiro nome de quem avaliou.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">2. Para que usamos</h2>
          <p>
            Para permitir que clientes encontrem profissionais e peçam orçamentos, que profissionais recebam e respondam
            esses pedidos, para exibir avaliações e para manter a segurança da plataforma (prevenção de fraudes e
            moderação). A base legal é a execução do serviço solicitado por você e o seu consentimento no cadastro.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">3. Com quem compartilhamos</h2>
          <ul className="ml-5 list-disc">
            <li>Dados da vitrine do profissional (incluindo o WhatsApp) são públicos.</li>
            <li>Nome e WhatsApp do cliente são visíveis apenas para os profissionais a quem ele enviou pedidos.</li>
            <li>
              Usamos provedores de infraestrutura (hospedagem e banco de dados) que tratam os dados em nosso nome. Não
              vendemos dados pessoais.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">4. Seus direitos</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados e revogar o consentimento a
            qualquer momento, pelos canais de contato informados no rodapé. Dados de perfil podem ser corrigidos
            diretamente no painel.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">5. Retenção e segurança</h2>
          <p>
            Mantemos os dados enquanto a conta estiver ativa ou pelo prazo exigido por lei. O acesso é protegido por
            regras de segurança no banco de dados para que cada usuário veja apenas o que lhe diz respeito.
          </p>
        </section>

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Documento-modelo para a fase piloto. Antes do lançamento comercial, deve ser revisado por profissional jurídico
          e completado com a razão social/CNPJ do controlador e o contato do encarregado (DPO).
        </p>
      </article>
      <SiteFooter />
    </main>
  )
}
