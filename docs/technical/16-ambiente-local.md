# 16 — Ambiente local

> **Status:** 21/10/2026. Como subir o GestaraHub com o Supabase local num comando.

## Pré-requisitos

- Docker Desktop aberto.
- Supabase CLI (`brew install supabase/tap/supabase`).
- `pnpm install` na raiz.
- Para testar pagamentos com webhook: `brew install cloudflared`.

## Subir tudo

```bash
pnpm setup:local
```

O comando faz, em ordem:

1. confere o Docker e sobe o Supabase local, se estiver parado;
2. aplica as migrações pendentes (`supabase migration up`);
3. preenche no `apps/web/.env.local` as variáveis do Supabase local que faltarem (URL, chave anônima e service role), sem mexer nas que já existem;
4. prepara o cron diário: cria o `CRON_SECRET` no `.env.local` e grava `app_url` e `cron_secret` no Vault do banco local (detalhes no [doc 15](15-retirada-do-mock-turmas.md), fatia 1);
5. recria o espaço de demonstração (Academia X) no banco: cria `DEMO_PASSWORD` no `.env.local`, se faltar, e roda o cenário de `apps/web/scripts/demo` (doc 15, fatia 4). Na tela de login aparece "Entrar na demonstração"; na barra do topo dá para ver a demonstração como dono, gerente, recepção ou professor.

Nunca imprime chaves nem segredos. Depois:

```bash
pnpm dev
```

Se o app já estava rodando e o comando criou alguma variável, reinicie o `pnpm dev`.

## Começar do zero

```bash
pnpm setup:local:reset
```

Igual ao anterior, mas zera o banco local (`supabase db reset`): **apaga todos os dados locais**, aplica todas as migrações e roda o seed. O Vault também é zerado e recriado pelo passo 4. Depois do reset, saia e entre de novo no app, porque a sessão antiga aponta para dados que não existem mais.

## Webhook do Asaas (pagamentos)

```bash
pnpm tunnel
```

Sobe um túnel público para `localhost:3000` e grava a URL em `ASAAS_WEBHOOK_URL`. O endereço muda a cada execução: rode o túnel antes do `pnpm dev`, ou reinicie o `pnpm dev` depois. Detalhes no [doc 19](../product/19-levantamento-pagamentos.md), seção 4.

## Entrar com Google

1. No Google Cloud, crie um cliente OAuth do tipo **Web application** (tela de consentimento em **Testing**, com o seu e-mail em **Test users**; escopos `openid`, `email` e `profile`):
   - **Authorized JavaScript origins:** `http://localhost:3000`
   - **Authorized redirect URIs:** `http://127.0.0.1:54321/auth/v1/callback` (quem recebe a volta do Google é o Supabase, não o app)
2. Cole o Client ID e o Client secret em `apps/supabase/.env` (fora do git; modelo em `apps/supabase/.env.example`):
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` e `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
3. Reinicie o Supabase local para ler a configuração (os dados continuam): `pnpm supabase:stop` e `pnpm supabase:start`.
4. Ligue o botão no app: `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` em `apps/web/.env.local` e reinicie o `pnpm dev`. Vazio, o botão não aparece (o e2e roda assim).

**Como funciona (22/10/2026):** o botão "Continuar com Google" fica no cadastro da landing, no login e na tela de convite. O servidor abre o Google (`startGoogleSignInAction`) e a volta cai em `app/auth/callback/route.ts`, que troca o código pela sessão e escolhe a conta (`resolveGoogleAccount`, em `services/server/accountSetup.ts`):
- veio do botão do convite: o e-mail do Google tem de ser o do convite (senão, recusa);
- conta já ligada a esse usuário do Google: entra;
- convidado pelo e-mail, ainda sem acesso: aceita o convite pendente;
- e-mail já ligado a outra conta: recusa, nunca liga por e-mail;
- ninguém com o e-mail: espaço novo, como no cadastro por e-mail, e segue para a configuração inicial.

Quem entra pelo Google aceita os Termos no próprio app (o mesmo aviso de quem não aceitou). O espaço novo nasce sem nome até a configuração inicial. Quem recusa os Termos antes de concluir a configuração inicial tem a conta apagada (espaço, usuário e acesso do Auth), como se o cadastro não tivesse acontecido; conta que já aceitou ou já configurou o espaço só sai (`discardUnstartedOwnerAccount`). Falhas voltam ao login com o motivo (`?google_error=`). Testes no banco: `services/server/__tests__/googleAccount.db.test.ts`.

O bloco `[auth.external.google]` do `apps/supabase/config.toml` lê essas duas variáveis (`skip_nonce_check = true`, exigido no local). Em produção, o mesmo cliente (ou outro) leva a origem do domínio e a URL de volta `https://<ref>.supabase.co/auth/v1/callback`, e as chaves vão no painel do Supabase (Authentication, Providers, Google).

## Esqueci minha senha

"Esqueci minha senha" no login leva a `/forgot-password`: quem tem senha (cadastro por e-mail ou convite) recebe pelo MailerSend um link de 1 hora para `/reset-password`, que vale uma vez só (tabela `password_reset_tokens`, migração 36; lógica em `services/server/passwordReset.ts`). Quem entra só pelo Google não recebe link, e a tela responde igual com ou sem conta, para não revelar quais e-mails existem. Sem `MAILERSEND_API_KEY`, o link aparece no terminal do `pnpm dev` ("Link de nova senha gerado"). Depois de trocar, o login abre com o e-mail preenchido e o aviso "Senha alterada".

**Boas-vindas.** No primeiro aceite dos Termos, o dono do espaço recebe pelo MailerSend "Bem-vindo ao GestaraHub" com o botão "Continuar" (vai ao login, que leva à configuração inicial ou ao Painel) e "Dúvidas? Responda este e-mail". As respostas vão para `MAILERSEND_REPLY_TO_EMAIL` (padrão `SUPPORT_EMAIL` de `config/site.ts`, `contato@gestarahub.com.br`). Sai depois da resposta (`after` do Next), sem atrasar nem travar a entrada. Não recebem: quem aceita uma versão nova dos Termos, convidados (gerente, recepção, professor) e e-mails de domínio reservado (`.test`, `.example`, `.invalid`, `.localhost`, da demonstração e do e2e). Código: `sendWelcomeEmail` em `lib/email/mailersend.ts`, disparo em `services/legalConsent/actions.ts`. Envio com aviso do MailerSend (ex.: destinatário bloqueado, `ALL_SUPPRESSED`) vai para o log com `[mailersend] Avisos ao enviar` e conta como falha.

**Layout dos e-mails.** Todos (cadastro, convite, nova senha e boas-vindas) usam a mesma moldura, `renderEmailLayout` em `lib/email/mailersend.ts`: faixa com o gradiente da marca, topo escuro com logo, título e uma linha de introdução, corpo branco e rodapé cinza. Botão, aviso de prazo e "se o botão não abrir" também são peças comuns (`emailButton`, `emailNotice`, `emailFallbackLink`). E-mail novo entra só com o conteúdo.

## Comandos avulsos

| Comando | Para quê |
|---|---|
| `pnpm cron:local` | Só o passo 4 (CRON_SECRET e Vault). |
| `pnpm demo:local` | Só o passo 5: apaga e recria a demonstração (datas relativas a hoje). |
| `pnpm --filter @gestarahub/web test:db` | Testes contra o Supabase local (`*.db.test.ts`). |
| `pnpm --filter @gestarahub/web world:schema` | Regera o esquema das tabelas do espaço depois de uma migração. |
| `pnpm supabase:status` | Estado do Supabase local (mostra chaves: não cole em lugar público). |
| `pnpm supabase:stop` | Para o Supabase local. |
| `pnpm supabase:reset` | Só o reset do banco, sem os outros passos. |

## Testar o cron na hora

Dois agendamentos no banco (`select jobname, schedule from cron.job;`):

| Agendamento | Quando | Rota do app | O que faz |
|---|---|---|---|
| `daily` | todo dia, 9h UTC (6h de Brasília) | `/api/cron/daily` | mensalidades e lançamentos recorrentes de todos os espaços |
| `online-payments-expiry` | de hora em hora, no minuto 5 | `/api/cron/online-payments` | expira Pix e links vencidos e cancela no Asaas (que aceita pagamento até 12 meses depois do vencimento); tenta de novo os cancelamentos que falharam |

A expiração usa uma consulta só para todos os espaços, pelo índice parcial `idx_online_payments_awaiting_expiry` (migração 34): o custo acompanha quantos Pix venceram, não quantos espaços existem. As telas "Cobrar online" e o histórico de recebimentos ainda expiram na abertura (para nunca mostrar um código vencido antes do cron); a leitura da organização não expira mais.

Para rodar na hora, no banco local (Studio > SQL ou `psql`):

```sql
select public.run_membership_charges_cron();   -- diário
select public.run_online_payments_cron();      -- pagamentos online
select status_code, content from net._http_response order by id desc limit 1;
```

A resposta esperada é 200: no diário, o número de espaços, mensalidades e lançamentos criados; no de pagamentos online, quantos expiraram e quantos cancelamentos foram refeitos.
