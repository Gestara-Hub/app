# Publicação em produção

Data: 12/11/2026 · Status: Proposta (roteiro para a primeira publicação; revisar depois dela) · Código: `apps/supabase/migrations`, `apps/web/.env.example`, `apps/admin/.env.example`, `apps/web/vercel.json`, `apps/web/next.config.ts`, `apps/web/src/app/api/cron`, `apps/web/src/app/api/webhooks`, `apps/web/src/app/api/health`, `apps/admin/src/app/api/cron/digest` · Testes: `pnpm test`, `pnpm --filter @gestarahub/web e2e:smoke`, conferências da etapa 7

Ordem para subir o GestaraHub pela primeira vez: **Supabase, depois Vercel (app e painel), depois as integrações**, e por fim as conferências. O banco vai antes porque o app novo espera as migrações aplicadas. Cada passo diz o que é **ação sua** (conta, contrato, DNS, painel de terceiro) e o que é comando.

Nunca suba um segredo para o repositório, para o chat ou para um log. Valores ficam só no painel de cada serviço.

**Branches (decidido em 13/11/2026):** o trabalho do dia a dia fica na `develop`; a `main` é a produção e só recebe a `develop` quando você decide publicar (passo 5). Na Vercel, a branch de produção é a `main`. Prévia da `develop` só com um projeto Supabase separado (homologação): sem ele, a prévia usaria o banco de produção, então fica desligada. Correção urgente sai da `main` numa branch própria e volta também para a `develop`.

## 0. Antes de começar

| Item | Quem | Por quê |
| --- | --- | --- |
| Domínio `gestarahub.com.br` com DNS acessível (app, `admin.` e e-mail) | Você | Links de e-mail, webhooks, OAuth e o Amazon SES precisam do endereço final |
| Termos e Privacidade: a identificação da MHMJ já está (`config/site.ts`, v1.2 de 10/11/2026). Antes de abrir para o público: leitura de advogado da parte de dados de saúde e confirmar a região do Supabase e do PostHog no texto de transferência internacional (pendência "Jurídico", doc `product/27`) | Você + agente | A Meta exige `/privacy` e `/terms` para virar o app para produção; o aceite grava a versão |
| Conta-pai PJ no Asaas (CNPJ da MHMJ) | Você | Pagamento online, assinatura do plano e a taxa do GestaraHub |
| Amazon SES com domínio `gestarahub.com.br` verificado e fora do Sandbox | Você | No Sandbox só envia para endereços verificados |
| Plano do Supabase com conexões suficientes | Você | Pico de uso: o limite é o banco (doc `technical/19` §14) |
| Árvore limpa, `develop` com tudo commitado e as conferências rápidas verdes | Agente | Typecheck, lint, `pnpm test` e o smoke |
| GitHub Actions com as conferências rápidas e o e2e completo, e a `main` protegida (decidido em 23/10/2026: antes da primeira publicação) | Agente + você | O push na `main` publica: ela só recebe a `develop`, e nada entra sem as conferências (doc `guides/20` etapa 2) |
| Branch de produção da Vercel na `main` (a `develop` já é a padrão no GitHub desde 13/11/2026) | Você | O dia a dia não publica sozinho |
| Plano da Vercel com Fluid Compute | Você | As rotinas (`/api/cron/*`) rodam até 300 s (`maxDuration`) |

## 1. Supabase (banco, Auth, rotinas)

1. **Criar o projeto** em São Paulo (`sa-east-1`), o mesmo lugar da Vercel (`gru1`). Ação sua.
2. **Ligar o repositório ao projeto e aplicar as migrações** (da raiz do repo; pede a senha do banco do projeto, que você digita):

   ```bash
   supabase link --workdir apps --project-ref <ref-do-projeto>
   ```

   ```bash
   supabase db push --workdir apps
   ```

   Sempre `db push` **antes** do deploy do app: o código conta com as funções das migrações (gravação em lote, versão do espaço). Depois do push, `select jobname from cron.job` deve listar `daily`, `online-payments-expiry` e as limpezas.

   As migrações criam as tabelas, o RLS, o bucket `attachments` (4 MB), o schema `platform`, o papel `platform_app` e ligam `pg_cron`, `pg_net` e `unaccent`. **Não rode o `seed.sql` em produção** (é a demonstração).
3. **Auth** (painel do Supabase → Authentication), espelhando o `apps/supabase/config.toml`, com duas diferenças:
   - **Site URL:** `https://gestarahub.com.br` (o local usa `localhost:3200`).
   - **Redirect URLs:** `https://gestarahub.com.br/**`.
   - **Senha mínima: 8 caracteres** (o local está em 6; o app já exige 8 em todas as telas).
   - Confirmação de e-mail desligada, como no local (o app manda os e-mails dele pelo Amazon SES).
   - MFA com app autenticador (TOTP) ligado, como no local.
   - Entrar com Google: só quando o app OAuth estiver pronto (chaves do Google no Supabase e `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=1` na Vercel).
4. **API → Exposed schemas:** só `public` e `graphql_public`. O `platform` **não** é exposto (o painel entra por conexão direta).
5. **Segredos no Vault** (SQL Editor do Supabase). As rotinas diárias chamam o app com eles; sem eles, não rodam e só registram um aviso:

   ```sql
   select vault.create_secret('https://gestarahub.com.br', 'app_url');
   ```

   ```sql
   select vault.create_secret('<o mesmo valor do CRON_SECRET da Vercel>', 'cron_secret');
   ```

   O `app_url` vai sem barra no fim.
6. **Senha do papel do painel** (`platform_app`), forte e gerada na hora, no SQL Editor:

   ```sql
   alter role platform_app login password '<senha-gerada>';
   ```

   Ela entra na `PLATFORM_DATABASE_URL` do painel (etapa 3), na conexão direta do Supabase, com o usuário `platform_app`.
7. **Função `health` do Supabase** (opcional, só para conferir que as funções de borda respondem; o app não depende dela): `supabase functions deploy health --workdir apps`.
8. **Rotinas agendadas** (já criadas pelas migrações, conferir em Integrations → Cron):

   | Rotina | Quando (UTC) | O que faz |
   | --- | --- | --- |
   | `daily` | 09:00 (06:00 em Brasília) | Chama `/api/cron/daily`: tarefas de cada espaço (mensalidades, lançamentos que repetem), plano do GestaraHub, anexos sem uso e resumo dos erros |
   | `online-payments-expiry` | a cada hora, no minuto 5 | Chama `/api/cron/online-payments`: Pix e links vencidos |
   | `*-prune-daily` | 06:30 a 06:50 | Limpeza de cache, erros, 2FA e históricos (só SQL) |

## 2. Vercel: o app (`apps/web`)

1. **Projeto novo** apontando para o repositório, com **Root Directory `apps/web`** (a Vercel instala o monorepo pelo `pnpm`). A região `gru1` vem do `apps/web/vercel.json`. Ação sua.
2. **Domínio** `gestarahub.com.br` (e `www` redirecionando) no projeto. Ação sua.
3. **Variáveis de ambiente (Production).** Nenhuma delas é segredo de exemplo: gere cada token na hora.

   | Variável | Obrigatória | Valor |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Do projeto de produção |
   | `SUPABASE_SERVICE_ROLE_KEY` | Sim | Do projeto de produção (só servidor) |
   | `NEXT_PUBLIC_APP_URL` | Sim | `https://gestarahub.com.br` (sem ela, os links de e-mail usam o endereço da requisição) |
   | `NEXT_PUBLIC_SITE_URL` | Sim | `https://gestarahub.com.br` (landing, sitemap e links públicos) |
   | `SESSION_SECRET` | Recomendada | 32+ caracteres aleatórios. Sem ela, deriva da chave de serviço. Trocar encerra as sessões abertas |
   | `CRON_SECRET` | Sim | Aleatório; o mesmo do `cron_secret` do Vault |
   | `ASAAS_API_URL` | Sim | `https://api.asaas.com/v3` (**antes do build**: com a URL de sandbox, aparecem os botões de simular pagamento) |
   | `ASAAS_API_KEY` | Sim | Chave da conta-pai de produção (começa com `$aact_`; no painel da Vercel vai como está, sem barra) |
   | `ASAAS_MASTER_WALLET_ID` | Sim | Carteira da conta-pai. Sem ela, o Pix sai sem a taxa do GestaraHub |
   | `ASAAS_WEBHOOK_URL` | Sim | `https://gestarahub.com.br/api/webhooks/asaas` |
   | `ASAAS_WEBHOOK_SECRET` | Sim | Aleatório, 32+ caracteres, diferente da chave de API |
   | `ASAAS_WEBHOOK_EMAIL` | Sim | `contato@gestarahub.com.br` (o Asaas avisa ali se o webhook falhar) |
   | `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | Sim | Amazon SES fora do Sandbox (`us-east-2`); remetente `naoresponda@gestarahub.com.br`, respostas em `contato@` |
   | `ERROR_DIGEST_EMAIL` | Sim | Quem recebe o alerta de erro novo e o resumo diário |
   | `META_APP_SECRET` | Com WhatsApp | Assinatura do webhook; sem ela, produção recusa o webhook |
   | `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` | Com WhatsApp | Do app da Meta em produção |
   | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Opcional | Sem a chave, a análise e o aviso de cookies ficam desligados |
   | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | Opcional | `1` só com o Google pronto no Supabase |
   | `ANTHROPIC_API_KEY`, `SUPPORT_BOT_MODEL` | Opcional | Assistente do suporte; sem a chave, vai direto para o atendimento |
   | `WORLD_CACHE_MAX_ROWS` | Opcional | Teto do cache do espaço por instância (padrão 150 mil linhas) |

   **Nunca em produção:** `DEMO_PASSWORD` (cria e libera a demonstração), `WORLD_SLICE_CHECK`, `WORLD_TIMING`, `WORLD_CACHE=off`, `E2E_*`, `NEXT_DIST_DIR`.
4. **Fuso:** o servidor força `America/Sao_Paulo` em `src/instrumentation.ts` (a Vercel reserva a variável `TZ`); não defina `TZ`.
5. **Build:** o `next.config` grava no build a versão (`NEXT_PUBLIC_APP_VERSION`), o commit e o modo de teste dos pagamentos (`NEXT_PUBLIC_PAYMENTS_TEST_MODE`, a partir do `ASAAS_API_URL`). Trocar `ASAAS_API_URL` depois pede um novo deploy.

## 3. Vercel: o painel (`apps/admin`)

1. **Projeto separado** com **Root Directory `apps/admin`**, domínio `admin.gestarahub.com.br`. Ação sua.
2. **Variáveis:**

   | Variável | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | As mesmas do app |
   | `PLATFORM_DATABASE_URL` | Conexão direta do Supabase com o usuário `platform_app` e a senha do passo 6 da etapa 1 (nunca a `service_role`) |
   | `ADMIN_SESSION_SECRET` | 32+ caracteres aleatórios |
   | `ADMIN_ENV_LABEL` | `production` |
   | `ADMIN_SERVICE_ROLE_KEY` | Chave de serviço, só para convidar administradores e redefinir 2FA |
   | `ADMIN_PUBLIC_URL` | `https://admin.gestarahub.com.br` |
   | `WEB_APP_URL` | `https://gestarahub.com.br` |
   | `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `ADMIN_NOTIFY_EMAIL` | E-mails do suporte e o resumo diário |
   | `CRON_SECRET` | Para o resumo diário do suporte |
   | `ANTHROPIC_API_KEY` | Opcional; teto de R$ 150/mês com alarme em 80% (doc `technical/26` §13) |

3. **Resumo diário do suporte** (`GET /api/cron/digest`, com `Authorization: Bearer <CRON_SECRET>`): agendado em `apps/admin/vercel.json` (`0 12 * * 1-5` UTC = 09h de Brasília em dias úteis). A Vercel injeta `Authorization: Bearer <CRON_SECRET>` quando a variável está configurada no projeto do painel.
4. **Primeiro administrador**, apontando os comandos para a produção, como no local (doc `guides/21-painel-admin-local.md`): `pnpm admin:create-admin`. O 2FA é obrigatório no primeiro acesso.

## 4. Integrações

| Serviço | O que configurar | Doc |
| --- | --- | --- |
| **Asaas** | Webhook na **conta principal** (eventos de cobrança e de assinatura, mesma URL e mesmo token; hoje só as subcontas têm). As subcontas se registram sozinhas com o `ASAAS_WEBHOOK_URL` no primeiro acesso. Pedir a homologação logo após o primeiro espaço real (período de avaliação: 10 subcontas, R$ 2.000 cada, 60 dias). | `technical/25`, `product/13` §6 |
| **Meta (WhatsApp)** | Webhook em `https://gestarahub.com.br/api/webhooks/whatsapp` com o `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; `META_APP_SECRET`; revisão das permissões `whatsapp_business_messaging` e `whatsapp_business_management`; virar para o modo de produção (pede domínio, `/privacy` e `/terms`); cadastrar os modelos (`minor_consent` e os operacionais). | `technical/07` §3.5.1 |
| **Amazon SES** | Domínio `gestarahub.com.br` verificado (DKIM e Custom MAIL FROM `envio.gestarahub.com.br`), saída do Sandbox aprovada e chaves IAM na Vercel (`us-east-2`). Feito em 17/11/2026: lista de supressão da conta para bounce e reclamação, tópico SNS `ses-gestarahub-feedback` (aviso por e-mail) e configuration set `gestarahub-default` (bounce, reclamação, rejeição e falha de renderização no SNS) como padrão do domínio. O app ainda não fica sabendo do bounce (o SES responde ok no envio); ver `pendencias.md`. Pedido de saída do Sandbox enviado, esperando a AWS. | `technical/21` |
| **PostHog** | Projeto com a chave na Vercel; ligar "Web vitals autocapture". | `technical/09` |
| **Monitor externo** | UptimeRobot ou Better Stack (conta gratuita) chamando `https://gestarahub.com.br/api/health` a cada 5 minutos, com aviso por e-mail. | `technical/27` |

## 5. Nova versão (primeira e seguintes)

1. Pedir ao agente as Novidades da versão (`apps/web/src/features/releases/release-notes.ts`, lendo desde a última tag) e revisar.
2. `pnpm release:prepare` na `develop` (atualiza a versão em `apps/web` e `apps/admin` e acrescenta a seção no `CHANGELOG.md`; não faz commit, tag nem push).
3. Commit (`chore(release): <versão>`) e `git push origin develop`.
4. Se houver migração nova em `apps/supabase/migrations/`, rodar `supabase db push --workdir apps` no banco de produção antes do deploy do app.
5. Publicar na `main` via PR `develop` → `main` **sem squash** (`gh pr merge <n> --merge`) ou fast-forward (`git checkout main && git merge --ff-only develop`): o push/merge na `main` dispara o deploy na Vercel.
6. Marcar a tag na `main` e sincronizar a `develop` de volta com a `main` para o próximo `CHANGELOG.md` manter a continuidade:
   - `git fetch origin && git checkout main && git pull --ff-only origin main`
   - `git tag v<versão> && git push origin v<versão>`
   - `git checkout develop && git merge --ff-only origin/main && git push origin develop` (e seguir em `develop`).

## 6. Ordem do dia da publicação

1. Supabase: `db push`, Auth, Vault e a senha do `platform_app` (etapa 1).
2. Vercel do app: variáveis e domínio (etapa 2), sem publicar ainda.
3. Vercel do painel (etapa 3).
4. Versão (etapa 5): o push publica os dois.
5. Integrações (etapa 4), com o domínio já no ar.
6. Conferências (etapa 7).

As sessões abertas caem uma vez na primeira publicação (cookie assinado com o segredo novo). Ninguém de fora usa ainda, então não há aviso a dar.

## 7. Conferências depois do deploy

| O que | Como | Esperado |
| --- | --- | --- |
| Saúde | Abrir `https://gestarahub.com.br/api/health` | `ok: true`, `database: true` e a versão nova |
| Sem demonstração | Abrir `/login` | Sem os usuários da demonstração |
| Cadastro do espaço | Criar uma conta com um e-mail seu e passar pela configuração inicial | E-mail de boas-vindas chega; Painel abre |
| Senha | "Esqueci a senha" na conta criada | E-mail chega com o link para `gestarahub.com.br` |
| 2FA | Ligar o código por e-mail e entrar de novo | Pede o código; o código chega |
| Pagamentos sem sandbox | Cobranças → uma cobrança | Sem botão "Simular pagamento" |
| Pix real | Ativar recebimentos num espaço seu e pagar uma cobrança pequena | Baixa automática pelo webhook; taxa do GestaraHub no extrato |
| Rotinas | No dia seguinte, Integrations → Cron do Supabase e o painel admin (Saúde) | `daily` e `online-payments-expiry` com sucesso; `job_runs` registrado |
| Erros | Painel admin → Saúde | Sem erro novo; o `ERROR_DIGEST_EMAIL` recebe o resumo |
| Navegador | Console na landing, no login e no app (aceitando os cookies) | Sem "Refused to ..." do CSP com PostHog e Meta |
| Painel | `https://admin.gestarahub.com.br` | Entra com 2FA; vê o espaço criado |
| Monitor | Painel do UptimeRobot ou Better Stack | Verde |

Depois de tudo verde, apagar o espaço de teste pelo painel admin (ou deixar inativo).

## 8. Se algo der errado

- **App com defeito:** na Vercel, "Promote" do deploy anterior (volta em segundos). O banco não volta junto: migração que quebra o app antigo precisa de outra migração para frente.
- **Rotina falhando:** conferir os segredos `app_url` e `cron_secret` no Vault e o `CRON_SECRET` na Vercel (os três precisam bater).
- **Webhook do Asaas recusado:** conferir `ASAAS_WEBHOOK_SECRET` e a URL; o Asaas pausa a fila depois de falhas e avisa no `ASAAS_WEBHOOK_EMAIL`.
- **E-mail não chega:** conferir chaves IAM (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SES_REGION`), se o domínio está verificado e se a conta já saiu do Sandbox do Amazon SES.

## 9. Depois da primeira publicação

- GitHub Actions com as conferências rápidas e o e2e completo, e a `main` protegida (doc `guides/20` etapa 2).
- Publicar pelo fluxo da etapa 5 a cada versão; migração nova vai com `supabase db push` **antes** do push do app.
- Revisar este roteiro com o que mudou na prática e passar o status para "Feito".
