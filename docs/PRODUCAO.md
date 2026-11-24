# MãoCerta em produção

| Item | Onde |
|---|---|
| Site | https://maocerta-ouropreto.netlify.app |
| Hospedagem | Netlify, projeto `maocerta-ouropreto` (plano gratuito, uso comercial permitido) |
| Banco, login e fotos | Supabase, projeto `gsbdaekdlcvnokgffmqx` |
| Código | https://github.com/nunesWeverton/MaoCerta |

## Como publicar uma atualização

O site foi publicado pela Netlify CLI (ainda não há publicação automática a cada `git push`).

```powershell
git push origin main
npx netlify-cli@27.16.2 deploy --build --prod
```

O comando faz o build no computador e envia para a Netlify (leva de 5 a 10 minutos).
Para publicar automaticamente a cada `git push`, ligue o repositório em
**Netlify → Project configuration → Build & deploy → Link repository** (feito pelo navegador normal, não pelo painel do app).

Se mudar o `supabase/schema.sql`, execute o arquivo inteiro no **SQL Editor** do Supabase. Ele é idempotente e
foi testado para atualizar bancos já existentes.

## Variáveis de ambiente (Netlify → Project configuration → Environment variables)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave "anon public" do Supabase (pública por natureza, protegida pelo RLS) |
| `NEXT_PUBLIC_SITE_URL` | `https://maocerta-ouropreto.netlify.app` (trocar ao usar domínio próprio) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | opcional: WhatsApp de suporte (só dígitos com DDD); ativa o botão do plano PRO e o link no rodapé |

Depois de mudar variáveis, publique de novo. A chave `service_role` do Supabase **nunca** deve ir para o site.

## Configuração do Supabase (Authentication)

- **URL Configuration:** Site URL = endereço do site; Redirect URLs = `<site>/auth/callback` e `http://localhost:3000/auth/callback`.
- **Sign In / Providers:** cadastro liberado, confirmação de e-mail **ligada**, login anônimo desligado.
  E-mail: senha mínima de 8 caracteres com letras e números.
- **Emails → SMTP Settings:** SMTP próprio (Gmail `smtp.gmail.com`, porta 465, senha de app do Google).
  Sem SMTP próprio, o Supabase só envia e-mails para membros da equipe e ninguém consegue se cadastrar.
- **Rate Limits:** com SMTP próprio, o padrão é 30 e-mails por hora; aumente se houver muitos cadastros.

## Segurança implementada

- RLS em todas as tabelas; dados de clientes visíveis só para o próprio cliente, o admin e os profissionais com quem ele abriu pedido.
- Triggers impedem que usuários alterem papel, plano, selo, nota e slug; pedidos têm campos imutáveis.
- Agenda sem horários sobrepostos (constraint de exclusão), reserva até 60 dias e no máximo 3 horários futuros por cliente com o mesmo profissional.
- Imagens só do bucket do projeto e da pasta do próprio usuário (bloqueia XSS por `javascript:` e imagens de terceiros).
- Limites contra spam: 10 pedidos por dia por cliente, 30 serviços e 60 fotos por vitrine, 200 arquivos por usuário, 30 demandas anônimas a cada 10 minutos.
- Cabeçalhos: CSP restrita ao próprio site e ao Supabase, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Redirecionamentos só para caminhos internos; otimizador de imagens desligado (não funciona como proxy).
- LGPD: aceite de termos no cadastro e exclusão da conta pelo próprio usuário.

## Operação

- **Tornar alguém admin** (SQL Editor):
  `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'email@exemplo.com');`
- **Painel admin:** `/admin`: selo de verificado, pausar vitrines, estender plano PRO, moderar avaliações e ver demandas não atendidas.
- **Pausar vitrines de teste** antes de divulgar (ex.: a vitrine "teste").

## Pendências recomendadas

| Prioridade | Item | Custo |
|---|---|---|
| Alta | Backups: o plano gratuito do Supabase não tem backup e pausa o projeto após 7 dias sem acesso. Para operação comercial, plano Pro. | US$ 25/mês |
| Alta | Revisão jurídica dos Termos e da Política de Privacidade (razão social/CNPJ e contato do encarregado). | — |
| Média | CAPTCHA no cadastro (Cloudflare Turnstile, suportado pelo Supabase Auth) se aparecerem cadastros falsos. | grátis |
| Média | Domínio próprio (.com.br) e e-mail com o domínio (ex.: Resend) no lugar do Gmail. | registro anual |
| Média | Publicação automática pelo GitHub (ver acima). | grátis |
| Baixa | "Prevent use of leaked passwords" (só no plano Pro do Supabase). | incluso no Pro |
| Baixa | Limpeza de fotos órfãs no Storage (fotos removidas do portfólio continuam no bucket). | — |
