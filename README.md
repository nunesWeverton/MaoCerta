# MãoCerta – Marketplace Hiperlocal de Serviços (Ouro Preto - MG)

Web app (PWA instalável no celular) que conecta moradores de Ouro Preto e distritos a profissionais de
**obras/manutenção** e **beleza/estética**. O contato e o fechamento acontecem pelo WhatsApp; a plataforma
registra o pedido, permite acompanhar o status e libera a avaliação ao final.

**Stack:** Next.js 15 (App Router) · Supabase (Auth, Postgres com RLS, Storage) · Tailwind CSS.

## Funcionalidades do MVP

| Quem | O que faz |
|---|---|
| Cliente | Busca por texto, categoria, subcategoria e bairro/distrito · **compara** profissionais ordenando por relevância, melhor avaliação ou menor preço (o cartão mostra o serviço buscado e seu preço) · vê portfólio, selo de verificação e avaliações · pede orçamento (com foto opcional) e abre o WhatsApp já com a mensagem pronta · acompanha pedidos, cancela, confirma realização e avalia · se não encontra o serviço, registra a demanda |
| Profissional | Vitrine pública `/pro/[slug]` · serviços com subcategoria, tipo de preço e local de atendimento (adicionar, **editar** e remover) · portfólio e foto de perfil (imagens comprimidas no navegador) · bairros atendidos · recebe pedidos e muda status (negociação, concluído, não fechado) · responde o cliente no WhatsApp · indicadores de desempenho (pedidos, pendentes, concluídos e taxa de fechamento, nota) · checklist de perfil completo · botão de divulgar vitrine · seção de **plano de divulgação** (PRO) com contato da equipe pelo WhatsApp |
| Beleza e estética | Atendimento **somente no estabelecimento** (regra garantida no banco) · endereço com link para o mapa e horário de funcionamento na vitrine · **agenda online**: o cliente vê as datas e os horários livres dos próximos 14 dias e reserva na hora · o profissional configura dias/turnos de atendimento, intervalo da grade e duração de cada serviço, vê por dia todos os horários marcados, livres e bloqueados, confirma ou cancela agendamentos, bloqueia horários marcados fora do app e marca folgas |
| Admin (`/admin`) | Métricas · dá/retira selo de verificado · pausa vitrines · estende ou rebaixa o plano PRO · vê pedidos recentes · modera (exclui) avaliações · vê as **demandas não atendidas** (o que os moradores procuraram e não acharam) |
| Geral | Cadastro com aceite de Termos/LGPD · confirmação de e-mail e recuperação de senha via `/auth/callback` · Termos e Política de Privacidade · SEO (metadata por profissional, sitemap, robots) · manifest PWA com ícones |

### Segurança (no banco, não só na interface)
- Perfil e vitrine são criados por **trigger** no cadastro; ninguém consegue se cadastrar como admin.
- Usuários **não conseguem** alterar o próprio papel, plano, selo, status ativo, nota ou slug (triggers de proteção).
- Dados de **clientes não são públicos**: só o próprio cliente, o admin e os profissionais que receberam pedido dele veem nome/WhatsApp.
- Avaliação só pode ser feita pelo cliente do pedido **depois de concluído**, uma por pedido; a média é recalculada automaticamente.
- Pedidos têm campos imutáveis; o cliente só pode cancelar ou confirmar a realização — e, se houver horário agendado, só depois do horário.
- Agenda: o banco impede dois agendamentos sobrepostos (constraint de exclusão), limita a reserva a 60 dias de antecedência e a 3 horários futuros por cliente com o mesmo profissional; folgas e agendamentos não são públicos (o cliente vê apenas os horários livres).
- Upload no Storage restrito à pasta do próprio usuário; bucket limitado a imagens de até 2 MB.
- Middleware protege `/painel`, `/admin` e `/cliente`; redirecionamento pós-login só aceita caminhos internos.

## Como executar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.local.example` para `.env.local` e preencha com as chaves do Supabase
   (**Project Settings → API**).
3. No Supabase, abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e execute.
   O arquivo é idempotente: pode ser rodado de novo sempre que for atualizado (ele também cria o bucket
   `maocerta-media`, as permissões e as políticas de segurança).
4. Em **Authentication → URL Configuration**, defina:
   - *Site URL*: a URL do site (ex.: `http://localhost:3000` ou o domínio de produção)
   - *Redirect URLs*: adicione `<site>/auth/callback` (usado na confirmação de e-mail e na recuperação de senha)
5. Crie sua conta pelo site e torne-se administrador executando no SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'seu-email@exemplo.com');
   ```
6. Rode localmente:
   ```bash
   npm run dev
   ```

### Testes do banco
O `schema.sql` foi validado em PostgreSQL 16 com uma simulação do ambiente Supabase (`auth.users`, `auth.uid()`,
papéis `anon`/`authenticated` e storage): execução em banco novo, reexecução, atualização a partir da versão
original do schema (com usuários sem perfil) e 30 cenários de uso e de ataque (alterar selo/plano/papel, agendar
horário ocupado ou sobreposto, avaliar sem concluir, ver dados de outros clientes, enviar foto para pasta alheia etc.).

## Deploy (recomendado: Vercel)
Importe o projeto na Vercel, configure as mesmas variáveis de ambiente (incluindo `NEXT_PUBLIC_SITE_URL`
com o domínio final) e atualize as URLs de redirecionamento no Supabase.

## Estrutura
```
src/
  app/
    (public)/        início, busca, vitrine do profissional, termos, privacidade
    (auth)/          login/cadastro e redefinição de senha
    painel/          painel do profissional
    cliente/         pedidos do cliente
    admin/           painel administrativo
  components/        cartão de profissional, formulário de orçamento, upload, cabeçalho/rodapé
  lib/               supabase, formatação, regras de busca/ordenação, WhatsApp
  middleware.ts      sessão + proteção de rotas
supabase/schema.sql  banco completo (tabelas, triggers, RLS, storage, seed de bairros)
```

## Decisões pendentes (precisam de aprovação do responsável pelo negócio)
- **Pagamentos online** e **cobrança do plano PRO**: hoje o plano é concedido/estendido manualmente pelo admin.
  Integrar Mercado Pago ou Asaas (Pix + cartão) quando houver validação de demanda e preço definido.
- **Novas categorias** (limpeza, jardinagem, fretes, tecnologia…): o MVP foca em duas verticais para concentrar a
  oferta; para ampliar, adicionar em `src/lib/constants.ts` e no `check` da coluna `services.category`.
- **Revisão jurídica** dos Termos e da Política de Privacidade (incluir razão social/CNPJ e contato do encarregado).
- **Verificação de profissionais**: definir o processo (documento com foto, antecedentes, referências) antes de conceder o selo.
- Notificações por e-mail/push: hoje o canal é o WhatsApp; avaliar após o piloto.
