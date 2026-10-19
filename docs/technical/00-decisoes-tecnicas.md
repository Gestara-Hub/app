# Decisoes Tecnicas

## Decisao

O GestaraHub e construido com abordagem frontend-first e dados mockados, sobre uma stack TypeScript moderna baseada em Next.js 16 (App Router, React Server Components). O backend real fica adiado para a fase 3; ate la, toda a aplicacao roda no frontend, consumindo uma camada de servico mockada que imita um contrato de API HTTP.

A referencia visual e de componentes e o projeto `old/gestarahub-web` (Next + shadcn/ui), presente na maquina mas fora do git. Dele reaproveitamos layout refinado, componentes shadcn e wrappers de formulario; nao reaproveitamos a antiga `gestarahub-api`. Este documento, junto com os ADRs do indice abaixo, e a fonte de verdade das escolhas tecnicas; decisoes marcadas como "refinavel" podem ser revistas sem reabrir a discussao das demais.

## Indice de decisoes

Decisoes registradas em documentos proprios (ADRs). Onde contradizem este documento, valem elas:

- [`01-extensao-modelos-operacionais.md`](01-extensao-modelos-operacionais.md) — Modelos 2 e 3 como modulos separados, sem genericizar o Modelo 1.
- [`02-motor-de-cobranca.md`](02-motor-de-cobranca.md) — motor de cobranca unico em `packages/core/src/billing.ts`.
- [`03-multi-tenant-e-escopo.md`](03-multi-tenant-e-escopo.md) — mundo multi-tenant no mock, um modelo por tenant, escopo carimbado pelo servidor, sessao.
- [`04-estrategia-de-testes.md`](04-estrategia-de-testes.md) — `node --test` (motor), Vitest (services) e Playwright (e2e).
- [`08-backend-supabase.md`](08-backend-supabase.md) — backend no Supabase (banco, login, Edge Functions com Hono, Cron, Storage), menor custo por fase; frontend segue na Vercel por enquanto.
- [`10-monolito-frontend-pwa.md`](10-monolito-frontend-pwa.md) — monólito frontend no Next.js com PWA (gestor, professor e aluno unificados; substitui React Native).
- [`11-identidade-global-e-multi-membership.md`](11-identidade-global-e-multi-membership.md) — um único e-mail com múltiplos vínculos/organizações (Workspace Selector na visão PWA).
- [`../product/15-regras-de-cobranca.md`](../product/15-regras-de-cobranca.md) — regras de produto das mensalidades.
- [`../frontend/06-decisoes-de-interface.md`](../frontend/06-decisoes-de-interface.md) — confirmacoes, tema com sidebar escura, agenda feita a mao, mobile.

## Contexto

O produto precisa validar escopo, telas, fluxos e regras operacionais antes de modelar um backend definitivo (ver `docs/frontend/00-estrategia-frontend.md`). O foco ativo e o Modelo 3 (academia, `docs/product/14-mvp-academia-lutas.md`); o Modelo 1 (barbearia, `docs/product/04-mvp-barbearia.md`) esta implementado e segue como referencia. Por isso a UI e desenvolvida primeiro, contra mocks que ja se parecem com a futura API. Quando o backend chegar, trocamos apenas a implementacao da camada de servico, sem reescrever telas.

A escolha por Next.js + shadcn/ui (no lugar de TanStack Start + Chakra) busca uma stack mais madura e estavel, ja dominada pelo time, com layout de referencia pronto em `old/gestarahub-web`.

## Escopo

- Stack tecnica e justificativa de cada item.
- Estrutura de repositorio (monorepo) e organizacao interna de `apps/web` (App Router).
- Convencoes de codigo (TypeScript, organizacao por feature, path aliases, lint/format, gerenciador de pacotes).
- Estrategia de testes.
- Principio de mocks como contrato de API.
- Posicionamento do backend (fase 3).

## Fora de escopo

- Detalhe de implementacao da camada de dados mockada (ver `docs/frontend/02-camada-de-dados-mock.md`).
- Modelagem de entidades e campos (ver `docs/product/04-mvp-barbearia.md`).
- Regras de negocio de agendamento, conflito, remarcacao e recorrencia (ver `docs/product/05-regras-negocio.md`).
- Especificacao de telas e componentes (ver docs de frontend 01 a 06).
- Backend real, persistencia, autenticacao real e infraestrutura.

## Stack escolhida

| Camada | Escolha | Justificativa curta |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, RSC) | Full-stack React maduro e estavel; App Router com Server e Client Components. No MVP a camada de dados roda no cliente; no servidor so a sessao mockada (`src/proxy.ts`, server actions de login). |
| Linguagem | TypeScript (modo strict) | Seguranca de tipos em todo o codigo; os mocks viram contratos tipados reutilizaveis pelo backend futuro. |
| UI / design system | shadcn/ui (style "new-york", base color "neutral", cssVariables) | Componentes copiados para o repo (controle total), sobre Radix. Layout de referencia ja pronto em `old/gestarahub-web`. |
| CSS / estilo | Tailwind CSS v4 | Utilitarios + variaveis CSS do tema shadcn. |
| Primitivas acessiveis | Radix UI | Base dos componentes shadcn (dialog, select, dropdown, etc.). |
| Icones | lucide-react | Conjunto de icones padrao do shadcn. |
| Formularios | React Hook Form 7 + Zod 4 via `@hookform/resolvers` (zodResolver) | Validacao no submit, revalidacao no change (padrao RHF: `mode: onSubmit` + `reValidateMode: onChange`). Wrappers de campo Controller-based em `src/components/form`. |
| Estado de servidor / dados | TanStack Query | Cache, loading/erro, invalidacao e refetch padronizados. Consome a camada de servico mockada como se fosse uma API real. Roda em client components. |
| Estado de UI local | useState | Estado simples vive no componente. |
| Estado de UI global leve | Nenhum (React context, ex.: `SessionProvider`) | Zustand nao foi adotado (nao houve necessidade). NAO usar Redux. |
| Calendario / Agenda | Feito a mao (React + Tailwind) | `react-big-calendar` foi avaliado e revertido: controle total do layout, zero dependencia externa (ver `docs/frontend/05`, historico, e `docs/frontend/06`). NAO usar Schedule-X nem FullCalendar (resource view paga). |
| Datas | date-fns | Formatacao e manipulacao de datas. |
| Toasts / notificacoes | sonner | Toasts via `<Toaster/>` montado no root layout. |
| Gerenciador de pacotes | pnpm, fixado em `packageManager: pnpm@11.9.0` | Workspaces `apps/*` e `packages/*` (`pnpm-workspace.yaml`). |
| Testes | `node --test` (motor em `packages/core`) + Vitest (services) + Playwright (e2e) | Ver [`04-estrategia-de-testes.md`](04-estrategia-de-testes.md). Testing Library nao adotado. |
| Lint / format | ESLint (`eslint-config-next` + regras de fronteira) | Prettier/Biome nao adotados. |

### Notas sobre a stack

- RSC esta disponivel no App Router, mas a camada de dados mockada (TanStack Query + services) vive em client components no MVP; o foco e a experiencia interativa contra mocks.
- Nenhuma rota de servidor / route handler do Next acessa dados reais no MVP. Ficam reservados para a fase 3.
- Onde a API exata de uma lib for incerta, consultar a doc oficial antes de codificar.

## Estrutura de repositorio

Monorepo pnpm. `apps/api` e previsao para a fase 3.

```text
gestarahub
  apps/
    web/                # frontend (Next.js 16, App Router)
    api/                # FUTURO (fase 3): backend NestJS (do zero)
  packages/
    contracts/          # @gestarahub/contracts: tipos do dominio (entidades, enums, ApiError)
    core/               # @gestarahub/core: logica pura (scheduling, billing, date, format, api-error)
  pnpm-workspace.yaml   # workspaces do monorepo
  package.json          # scripts da raiz (dev, build, lint, typecheck, test, e2e)
```

- Os pacotes sao consumidos como fonte TS pelo app (`transpilePackages` em `apps/web/next.config.ts`), sem build separado, e poderao ser importados pelo backend.

### Organizacao interna de apps/web (App Router, por feature)

As rotas vivem em `src/app`. A UI de dominio vive em `src/features`, organizada por feature. Alias `@/*` aponta para `src/*`. Arvore completa e regras de fronteira em `docs/frontend/01-arquitetura.md`.

```text
apps/web/src
  proxy.ts                    # guarda de sessao (Next 16)
  app/                        # rotas: (auth)/login + actions.ts, (app)/* (dashboard, clients, team,
                              #   services, schedule, classes/*, users, audit, settings)
  components/ui|layout|form|shared|theme
  config/tenant.ts            # ids do seed
  features/<dominio>/         # UI por dominio (components/, hooks/, schemas, index.ts)
  lib/                        # cn, queryKeys, labels, permissions, session, form-errors, providers
  services/                   # camada de servico mockada + __tests__
  mocks/                      # store multi-tenant, seed, config, helpers
  test/                       # setup e cenarios do Vitest
```

### Guarda de rota (mock)

Sessao mockada via cookie `gestarahub_session`. `src/proxy.ts` (o `proxy` do Next 16 substitui o `middleware`) redireciona para `/login` sem cookie; RBAC por page com `requirePermission`. Ver `docs/frontend/03` e `03-multi-tenant-e-escopo.md`.

## Convencoes

- TypeScript em modo strict em todo o repositorio; evitar `any`, preferir tipos de `@gestarahub/contracts` e schemas Zod das features.
- Organizacao por feature/dominio (ver arvore acima). Codigo realmente generico vai para `components/`, `lib/` ou `packages/`. Fronteiras aplicadas por ESLint (`apps/web/eslint.config.mjs`).
- Path alias `@/*` -> `src/*`, configurado no `tsconfig` e em `components.json`.
- Nomenclatura de codigo em ingles (identificadores, keys e enum VALUES), seguindo o padrao das libs. So strings vistas pelo usuario ficam em portugues: texto livre de cadastro (name, description, notes...) e os ROTULOS de exibicao dos enums (`src/lib/labels.ts`). Os codigos de enum sao em ingles (ver secao de enums).
- Formularios: React Hook Form + zodResolver; validacao no submit e revalidacao no change. Usar os wrappers de campo em `components/form`.
- Lint: ESLint (0 erros, 0 warnings). Sem Prettier/Biome.
- Gerenciador de pacotes: pnpm, com workspaces na raiz do monorepo.

### Navegacao (itens canonicos)

Definidos em `apps/web/src/components/layout/nav.ts` e filtrados pelo modelo do tenant e pela permissao:

- Compartilhados: Dashboard, Equipe; rodape: Usuários, Auditoria, Configurações.
- `scheduling`: Clientes, Serviços, Agenda.
- `classes`: Alunos, Turmas, Calendário, Modalidades, Planos, Mensalidades.

- "Equipe" e o rotulo da navegacao; "Profissional" e o termo usado no contexto de agendamento e nas telas de detalhe.
- Login fica fora do app shell (rota `(auth)/login`, sessao mockada).

### Enums (chaves exatas)

Codigos em ingles, definidos em `packages/contracts/src`; o rotulo PT vai na UI (ver `src/lib/labels.ts`).

```ts
type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_service"
  | "completed"
  | "canceled"
  | "no_show";

type AppointmentOrigin = "manual" | "recurrence"; // futuro: "online" | "whatsapp"

type Frequency = "weekly" | "biweekly" | "monthly";

type RecordStatus = "active" | "inactive";

type OperationalModel = "scheduling" | "classes" | "delivery";

type PlanPeriod = "monthly" | "biweekly" | "weekly";

type ChargeKind = "membership" | "dropin" | "extra"; // extra = cobranca avulsa (doc 20, fase A)

// Area do negocio no Modelo 3 (Organization.classSegment). Ausente = martial_arts.
type ClassesBusinessSegment =
  | "martial_arts"
  | "pilates_yoga"
  | "functional_training"
  | "dance"
  | "music"
  | "languages"
  | "swimming_sports"
  | "gastronomy"
  | "arts_crafts"
  | "beauty_courses"
  | "custom";
// So na area custom (Organization.customSegmentProgression). Ausente = none.
type CustomSegmentProgression = "belts" | "levels" | "modules" | "none";
// Categoria de servico/modalidade e a entidade Category (categoryId), nao um enum.
```

### Area do negocio (segmento) no Modelo 3

- A area e uma chave fechada (`Organization.classSegment`), nunca texto. `Organization.segment` (texto) e so rotulo de exibicao; na "Outra área" (`custom`), o nome digitado fica em `Organization.customSegmentName` e a forma de avanço em `Organization.customSegmentProgression` (o preset efetivo vem de `getSegmentPreset(classSegment, customSegmentProgression)`).
- A area so define padroes e vocabulario, nunca liga ou desliga recursos. O perfil de cada area fica em `apps/web/src/lib/business-segment-presets.ts`: trilha padrao das modalidades, duracao e vagas de nova turma, palavras das telas (faixa, nivel, modulo ou fase) e o tom dos modelos de mensagem. Detalhe em `docs/frontend/08-decisoes-landing-page-e-onboarding.md`, secao 4.5.
- Com uma modalidade em contexto, as palavras seguem a trilha dela (`vocabularyForTrack` / `useModalityVocabulary`), nao a area; a area fica como padrao de modalidade nova e para textos sem modalidade (14/10/2026).

## Testes

Decisao em [`04-estrategia-de-testes.md`](04-estrategia-de-testes.md): motor de cobranca com `node --test` (`packages/core/test`), regras de negocio dos services com Vitest (`apps/web/src/services/__tests__`) e fluxos com Playwright (`apps/web/e2e`). Comandos: `pnpm test` e `pnpm e2e`. Todo bug corrigido ganha o teste que o reproduz.

## Mocks como contrato de API (principio central)

- A UI nunca acessa mocks diretamente. O fluxo e sempre: hooks (TanStack Query) -> services (funcoes async tipadas) -> store em memoria.
- O service imita um contrato de API HTTP (mesma forma de chamada, mesmos tipos de entrada e saida, mesmos erros).
- Trocar o mock por backend real significa trocar SO a implementacao do service; hooks e telas permanecem iguais.
- O store em memoria e multi-tenant (dois tenants vazios no seed, so com o proprietario) e persistido no localStorage do navegador (simula um banco): sobrevive a reloads, com migracao/reset por versao de seed (`SEED_VERSION`) e acao "Apagar dados da demonstração" (aba Dados) em Configuracoes. A persistencia e so no cliente (no SSR/Node e no-op). Ver `03-multi-tenant-e-escopo.md`.

O detalhamento desta camada (estrutura de services, store, seed, simulacao de latencia e erro) esta em `docs/frontend/02-camada-de-dados-mock.md`.

## Backend (fase 3)

- **Decidido em 14/10/2026 e atualizado em 19/10/2026: backend no Supabase e Monólito Frontend PWA no Next.js**, ver [`08-backend-supabase.md`](08-backend-supabase.md) e [`10-monolito-frontend-pwa.md`](10-monolito-frontend-pwa.md). Banco Postgres com RLS, Supabase Auth, regras de negócio e orquestração via Server Actions no Next.js (Vercel) e Supabase Storage. A ideia de apps em React Native foi substituída por monólito Next.js distribuído como PWA para gestor, professor e aluno.
- A camada de servico mockada do frontend ja imita o contrato da API: na fase 3, troca-se apenas a implementacao dos services (de store em memoria para Supabase e Edge Functions), mantendo assinaturas e tipos. Os contratos (`packages/contracts`) e a logica pura (`packages/core`, incluindo o motor de cobranca) ja estao em `packages/` para serem compartilhados com `apps/api`.
- Ate la, nenhum endpoint real e usado; a persistencia e mockada (localStorage no cliente) e a autenticacao tambem (cookie de sessao mockado).
- **WhatsApp (13/10/2026):** sempre com o numero do proprio espaco; envio assistido (`wa.me`) no plano gratuito e API oficial da Meta no Pro, que funciona por avisos (webhooks). A sessao por QR code simulada hoje no mock foi descartada e nao deve ser implementada. Nada na comunicacao exige servidor sempre ligado. Ver `docs/product/13-modelo-de-negocio.md`, secao 5.
- **Hospedagem (13/10/2026, substituida pelo 08 em 14/10/2026): direcao Vercel.** O frontend ja roda no Vercel e o backend deve usar funcoes serverless do mesmo provedor. NestJS foi a escolha inicial e pesa em funcoes serverless (partida a frio); a escolha do framework (sugestao: Hono, que roda em qualquer lugar) sera fechada e registrada aqui no inicio da fase 3, junto com o banco (Postgres gerenciado com intermediario de conexoes), armazenamento de arquivos privado (comprovantes) e o agendador para as tarefas que hoje rodam na leitura (mensalidades, lancamentos recorrentes, parabens automatico). Ainda em aberto: app do aluno no celular e orcamento mensal.

## Referencias

Frontend:

- `docs/frontend/00-estrategia-frontend.md`
- `docs/frontend/01-arquitetura.md` (estrutura, camadas, fronteiras)
- `docs/frontend/02-camada-de-dados-mock.md` (camada de dados mockada)
- `docs/frontend/03-rotas-e-navegacao.md`
- `docs/frontend/04-design-system.md`
- `docs/frontend/05-agenda-react-big-calendar.md` (historico, decisao revertida)
- `docs/frontend/06-decisoes-de-interface.md`

Produto:

- `docs/product/14-mvp-academia-lutas.md`, `11-modelo-3-turmas.md`, `15-regras-de-cobranca.md` (Modelo 3, foco ativo)
- `docs/product/04-mvp-barbearia.md`, `05-regras-negocio.md` (Modelo 1)

## Pendencias

- Resolvidas: pnpm fixado e workspaces criados; lint so com ESLint; aliases configurados; agenda feita a mao; docs de frontend 01–06 completos.
- Resolvidas em 14/10/2026: banco, login, framework, armazenamento de arquivos e tarefas agendadas do backend (Supabase, ver `08-backend-supabase.md`).
- Abertas: hospedagem definitiva do frontend web (Vercel Pro ou Cloudflare, antes do primeiro cliente real), integracao real do WhatsApp (`07-integracao-whatsapp.md`), provedor de pagamentos (`docs/product/19-levantamento-pagamentos.md`), paginacao, multiunidade (Fase 5).
