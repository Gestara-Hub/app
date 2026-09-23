# Arquitetura do Frontend (apps/web)

## Decisao

O frontend do GestaraHub e uma aplicacao Next.js 16 (App Router, com React Server Components), escrita em TypeScript strict, usando shadcn/ui (style "new-york", base color "neutral", CSS variables) sobre Tailwind CSS v4 e Radix como design system. Icones: lucide-react.

O acesso a dados passa sempre por uma cadeia unica: UI (componentes/pages) -> hooks de dados (TanStack Query) -> services (async tipados) -> store em memoria (mocks). A UI nunca importa mocks diretamente.

No MVP frontend-first, o app roda contra uma camada de servico mockada em client components. Trocar o mock por backend real significa trocar SO a implementacao dos services. Server Actions / Route Handlers do Next NAO sao usados para dados de dominio no MVP; ficam reservados para a fase de backend.

## Contexto

- O MVP valida escopo, fluxos, telas e regras antes de modelar o backend (ver `docs/frontend/00-estrategia-frontend.md`).
- Os dados sao mockados, mas o formato imita um contrato de API HTTP futuro. Os contratos vivem em `packages/contracts` (`@gestarahub/contracts`).
- O store em memoria guarda um mundo multi-tenant (um store por organizacao) e e persistido no localStorage: sobrevive a reloads (reset por versao de seed ou pela acao "Apagar dados da demonstração" (aba Dados) em Configuracoes). O seed cria dois tenants vazios, so com o proprietario (ver `docs/technical/03-multi-tenant-e-escopo.md`).
- A organizacao do codigo prioriza isolamento por dominio (feature) para evoluir sem reescrever telas quando o backend chegar.

## Escopo

- Estrutura de pastas de `apps/web` (Next App Router) e dos pacotes de workspace.
- Route groups, layouts e a divisao entre Server Components (RSC) e Client Components.
- Camadas e fluxo de dados.
- Convencoes de nomeacao e organizacao por feature.
- Limites entre UI, dados, services e mocks.

## Fora de escopo

- Implementacao de telas e componentes especificos.
- Contrato detalhado de cada service e tipo (ver `docs/frontend/02` e o proprio `packages/contracts/src`).
- Route Handlers, SSR data loading via backend real, autenticacao real (fase posterior).
- Configuracao de CI, deploy e infraestrutura.

## Repositorio

Monorepo `gestarahub` (pnpm workspaces). `apps/api` e futuro.

```text
gestarahub/
├─ apps/
│  └─ web/            # frontend Next.js (App Router) (foco deste doc)
├─ packages/
│  ├─ contracts/      # @gestarahub/contracts: tipos do dominio (entidades, enums, ApiError)
│  └─ core/           # @gestarahub/core: logica pura (scheduling, billing, date, format, api-error)
├─ docs/              # especificacao viva (produto, frontend, tecnico)
└─ pnpm-workspace.yaml
```

## Estrutura de pastas de apps/web

A arvore abaixo combina as convencoes do Next App Router (route groups, layouts, entrypoints) com a organizacao por feature do projeto. Alias: `@/*` aponta para `src/*`.

```text
apps/web/
├─ e2e/                            # testes Playwright (specs + fixtures.ts)
├─ src/
│  ├─ proxy.ts                     # guarda de rota (Next 16: substitui middleware.ts)
│  ├─ app/                         # App Router (rotas, layouts)
│  │  ├─ layout.tsx                # root layout: <html>, Providers, <Toaster/>,
│  │  │                            #   script de boot do tema
│  │  ├─ globals.css               # Tailwind v4 + variaveis CSS (tema, --status-*)
│  │  ├─ (auth)/                   # route group publico (sem app shell)
│  │  │  ├─ login/page.tsx         # "/login"
│  │  │  └─ actions.ts             # server actions de sessao (signIn/switchUser/signOut)
│  │  └─ (app)/                    # route group protegido (app shell)
│  │     ├─ layout.tsx             # Sidebar + Topbar + SessionProvider
│  │     ├─ page.tsx               # Dashboard ("/")
│  │     ├─ clients/page.tsx       # "/clients" (Clientes / Alunos)
│  │     ├─ team/page.tsx          # "/team"
│  │     ├─ services/page.tsx      # "/services" (scheduling)
│  │     ├─ schedule/page.tsx      # "/schedule" (agenda, scheduling)
│  │     ├─ appointments/page.tsx  # "/appointments" -> redirect para /schedule
│  │     ├─ classes/page.tsx       # "/classes" (turmas, classes)
│  │     ├─ classes/[id]/page.tsx  # "/classes/:id"
│  │     ├─ classes/sessions/[sessionId]/page.tsx  # "/classes/sessions/:sessionId"
│  │     ├─ classes/calendar/page.tsx    # "/classes/calendar"
│  │     ├─ classes/modalities/page.tsx  # "/classes/modalities"
│  │     ├─ classes/plans/page.tsx       # "/classes/plans"
│  │     ├─ classes/billing/page.tsx     # "/classes/billing"
│  │     ├─ users/page.tsx         # "/users"
│  │     ├─ audit/page.tsx         # "/audit"
│  │     └─ settings/page.tsx      # "/settings"
│  ├─ assets/                      # logos (icon, logo-light, logo-dark)
│  ├─ components/
│  │  ├─ ui/                       # componentes shadcn (button, dialog, sidebar, ...)
│  │  ├─ layout/                   # app-sidebar, app-topbar, nav.ts, page-header
│  │  ├─ form/                     # wrappers de campo RHF (InputText, InputCurrency, ...)
│  │  ├─ shared/                   # list/ (primitivos de lista), confirm-action-dialog,
│  │  │                            #   entity-manager-dialog, combobox, module-empty-guide...
│  │  └─ theme/                    # theme-customizer.tsx (painel do personalizador)
│  ├─ config/tenant.ts             # ids fixos consumidos so pelo seed
│  ├─ features/<dominio>/          # UI por dominio (components/, hooks/, schemas, index.ts)
│  ├─ services/                    # camada de dados async tipada + __tests__ (Vitest)
│  ├─ mocks/                       # store multi-tenant, seed, config, helpers, currentActor
│  ├─ lib/                         # utils (cn), queryKeys, providers, labels, permissions,
│  │                               #   session, form-errors, theme-customizer
│  ├─ hooks/                       # use-mobile
│  └─ test/                        # setup.ts + cenarios (academy.ts) do Vitest
├─ public/                         # assets estaticos
├─ next.config.ts                  # transpilePackages dos pacotes de workspace
├─ components.json                 # config do shadcn
├─ eslint.config.mjs               # regras de fronteira (no-restricted-imports)
├─ vitest.config.ts / playwright.config.ts
├─ tsconfig.json                   # TypeScript strict
└─ package.json
```

Notas de convencao do Next App Router:

| Item | Convencao | Observacao |
| --- | --- | --- |
| Pasta de rotas | `src/app/` | App Router; pastas viram segmentos de URL, `page.tsx` torna o segmento navegavel. |
| Root layout | `src/app/layout.tsx` | Unico `<html>`/`<body>`; monta Providers e `<Toaster/>`. Server Component. |
| Route groups | `(auth)`, `(app)` | Parenteses agrupam rotas sem virar segmento de URL; cada grupo pode ter seu `layout.tsx`. |
| Layout de grupo | `src/app/(app)/layout.tsx` | App shell (Sidebar + Topbar); resolve o usuario (`getCurrentUser`) e o modelo do tenant. |
| Rotas dinamicas | `[id]`, `[sessionId]` | Ex.: `classes/[id]/page.tsx` -> `/classes/:id`. |
| 404 | padrao do Next | Nao ha `not-found.tsx` proprio. |
| Guarda de rota | `src/proxy.ts` | Exige o cookie de sessao e redireciona para `/login?from=...`. RBAC por page via `requirePermission`. |
| Estilos globais | `src/app/globals.css` | Tailwind v4 + variaveis CSS do tema. |

Fontes oficiais (preferir sobre suposicoes de assinatura):

- Next.js App Router: https://nextjs.org/docs/app
- Route Groups: https://nextjs.org/docs/app/building-your-application/routing/route-groups
- shadcn/ui: https://ui.shadcn.com
- Tailwind CSS v4: https://tailwindcss.com
- TanStack Query: https://tanstack.com/query/latest

## Server Components vs Client Components

Por padrao no App Router todo componente e um Server Component (RSC). Marca-se `'use client'` apenas onde ha interatividade ou dependencia de runtime de browser.

| Tipo | Regra | Exemplos no MVP |
| --- | --- | --- |
| Server Component (default) | Sem estado/efeito de cliente; pode ser `async`; nao usa hooks de React de estado. | `app/layout.tsx`, `(app)/layout.tsx` (le cookie de sessao), `page.tsx` de casca que chama `requirePermission` e renderiza a view da feature. |
| Client Component (`'use client'`) | Tudo que usa estado, efeitos, TanStack Query, React Hook Form, eventos, ou libs client-only. | Providers, componentes shadcn interativos, hooks de dados, telas de feature, agenda feita a mao. |

Diretrizes:

- Os Providers (`QueryClientProvider`, `ThemeProvider`) ficam em `lib/providers.tsx` (`'use client'`), montado pelo root layout (Server Component) junto com o `<Toaster/>`.
- A camada de dados (hooks TanStack Query + services + mocks) roda em client components no MVP. Server Actions existem so para a sessao (`app/(auth)/actions.ts`: `signIn`, `switchUser`, `signOut`).
- `page.tsx` pode ser uma casca fina (Server Component) que importa e renderiza o componente de tela da feature (client). Mantem o segmento simples e a logica na feature.

## Camadas e fluxo de dados

A regra central e fluxo unidirecional do acesso a dados. A UI nunca toca o store; sempre passa por hooks e services.

```text
┌─────────────────────────────────────────────────────────────┐
│  src/app/**/page.tsx  +  src/features/<dominio>/components/*  │
│  (UI) - renderiza, dispara acoes, le estado de UI            │
│  - estado de UI local: useState                              │
│  - formularios: React Hook Form + Zod (zodResolver)         │
└───────────────┬─────────────────────────────────────────────┘
                │ usa
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/features/<dominio>/hooks/*  (TanStack Query)            │
│  - useQuery / useMutation                                     │
│  - cache, loading, error, invalidacao                        │
└───────────────┬─────────────────────────────────────────────┘
                │ chama
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/services/*  (async tipado = contrato de API)           │
│  - funcoes Promise<T> tipadas com @gestarahub/contracts      │
│  - hoje: leem/escrevem no store em memoria                   │
│  - amanha: trocam SO a implementacao por fetch HTTP real     │
└───────────────┬─────────────────────────────────────────────┘
                │ acessa
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/mocks/*  (store em memoria + seed)                      │
│  - persiste no localStorage (sobrevive ao reload)           │
│  - um store por tenant (Proxy para o tenant ativo)          │
│  - NUNCA importado pela UI (ver excecoes de sessao abaixo)  │
└─────────────────────────────────────────────────────────────┘
```

### Responsabilidades por camada

| Camada | Pasta | Responsabilidade | Pode importar |
| --- | --- | --- | --- |
| Rotas/pages | `src/app/` | Mapear URL -> tela; layouts; compor features; `requirePermission`. | `features/*`, `components/*`, `lib/*` |
| Features (UI) | `src/features/<dominio>/components/` | Telas e componentes do dominio. | hooks da propria feature, outras features so pelo barrel, `components/*`, `lib/*`, contratos |
| Hooks de dados | `src/features/<dominio>/hooks/` | TanStack Query (queries/mutations), cache, invalidacao. | `services/*`, `lib/*`, contratos |
| Services | `src/services/` | Funcoes async tipadas; contrato de API; regras de negocio. | `mocks/*`, `lib/*`, `@gestarahub/core`, contratos |
| Mocks | `src/mocks/` | Store multi-tenant + seed + config + helpers. | contratos, `config/tenant` |
| UI shadcn | `src/components/ui/` | Primitivos do design system (gerados pelo shadcn). | `lib/utils` (cn) |
| Layout | `src/components/layout/` | Sidebar, Topbar, `nav.ts`. | `components/*`, `lib/*`, features (barrel), contratos |
| Form | `src/components/form/` | Wrappers de campo RHF (Controller-based). | `components/ui/*`, `components/shared/*`, `lib/*` |
| Shared | `src/components/shared/` | Primitivos de lista, confirmacao, combobox, gestor de entidades. | `components/ui/*`, `lib/*` |
| Lib | `src/lib/` | Utils (cn), Providers, queryKeys, labels, sessao, `form-errors`, tema, RBAC (`permissions.ts`: matriz `PROFILE_PERMISSIONS` + `can()`). | contratos, `@gestarahub/core` |
| Auth/Sessao | `src/features/auth/` | Resolver o usuario logado no server (`get-current-user`), `SessionProvider`/`useCurrentUser`/`useCan`/`useModel` (client), guarda de page (`require-permission`), escopo do Profissional (`scope`). | `lib/*`, contratos, `mocks/*` (excecao de sessao) |
| Contratos | `packages/contracts/src/` | Entidades, enums, Create/Update, filtros, `ApiError`. Schemas Zod ficam nas features (`*-schema.ts`). | (nenhuma camada de runtime) |

### Estado: dados vs UI

| Tipo de estado | Ferramenta | Onde |
| --- | --- | --- |
| Estado de servidor / dados | TanStack Query | hooks por feature |
| Estado de formulario | React Hook Form + Zod (`zodResolver`) | componente de form |
| Estado de UI local (dialog aberto, aba ativa) | `useState` | componente |
| Tema (claro/escuro) | next-themes (ThemeProvider) | root layout |

Validacao de formularios: padrao RHF `mode: onSubmit` + `reValidateMode: onChange` (valida no submit, revalida no change). Nao usar Redux.

## Regras de fronteira (limites entre camadas)

| Regra | Detalhe |
| --- | --- |
| UI nunca importa `mocks` | Acesso a dados so via hooks -> services. Excecoes, todas de sessao: `features/auth/*` (`get-current-user`, `require-permission`, `session-provider`; liberado no ESLint), `app/(app)/layout.tsx`, `app/(auth)/login/page.tsx` e `app/(auth)/actions.ts` (leem `organizationModelById`; `src/app` nao e coberto pelas regras de fronteira do ESLint). `src/test/*` tambem usa o store. |
| RBAC deriva do perfil | Permissoes vem de `PROFILE_PERMISSIONS`/`can()` (`lib/permissions`); a UI checa via `useCan()`/`requirePermission`, nunca compara `profile === '...'`. |
| Services sao o unico ponto que toca o store | Trocar mock por API real = mudar so `src/services/*`. |
| Tipos/contratos vivem no pacote `@gestarahub/contracts` | Entidades, enums, payloads e `ApiError`. Nao existe `src/types`. Mocks e services importam do contrato, nunca o contrario. |
| Features so se conhecem pelo barrel publico | Uma feature importa outra apenas via `@/features/<x>` (o `index.ts`), nunca pelos internals (`hooks/`, `components/`). Codigo usado por varias features sobe para `components/` ou `lib/`. |
| `'use client'` so onde necessario | Estado, efeitos, Query, RHF, eventos ou libs client-only. Default e RSC. |
| Providers num client wrapper | Root layout (RSC) monta `lib/providers.tsx` (`'use client'`) com Query/Theme. |
| Hooks de dados nao chamam o store | So chamam services. |
| Estado de servidor mora no Query | Nao duplicar dados de servidor em estado de UI. |

### Pacotes compartilhados e prontidao para microfrontend (MFE)

O monolito vive em `apps/web`, mas as **costuras** de um futuro split (MFE / Next
Multi-Zones) ja estao desenhadas e **aplicadas por lint** — extrair depois vira
tarefa mecanica, nao um rewrite.

- **Pacotes de workspace** (`packages/*`, consumidos como fonte TS via
  `transpilePackages`):
  - `@gestarahub/contracts` — o contrato de dominio (entidades, enums, `ApiError`).
    Todo o resto depende dele; ele nao depende de nada do app.
  - `@gestarahub/core` — logica pura, framework-agnostica: `scheduling` (motor de
    conflito), `billing` (motor de cobranca, ver `docs/technical/02`), `date`,
    `format`, `api-error`. Reutilizavel por qualquer app futuro.
  - O **design system** (`components/ui|form|shared`) fica no app por ora; a
    extracao para `@gestarahub/ui` acontece no split (envolve config de conteudo
    do Tailwind v4 cross-package).

- **Fronteiras aplicadas** (ESLint `no-restricted-imports`, ver
  `apps/web/eslint.config.mjs`):
  - Camada compartilhada (design system + `lib` + `config`) **nao** importa de
    `features` nem do `mocks` store.
  - Cada **feature** so importa outra pelo **barrel publico** (`@/features/<x>`),
    nunca pelos internals — cada feature e uma unidade trocavel.
  - **Nenhuma** feature (nem a shell `components/layout`) acessa o `mocks` store
    direto (so via `services`). Excecao transitoria: `features/auth` (sessao).
    `src/app` fica fora dessas regras; ali so layout/login/actions leem
    `organizationModelById`.

- **Plataforma vs. workflow:** `clients`, `professionals`, `services`,
  `categories`, `roles`, `users`, `settings`, `auth` sao **dados de referencia
  transversais** (plataforma) consumidos por features de workflow como `appointments`
  (agenda), `turmas` (Modelo 3), `audit` e `dashboard`. No split, a plataforma vira camada/contrato
  compartilhado; as features de workflow viram as zonas.

## Organizacao por feature

Cada dominio em `src/features/<dominio>/` segue a mesma estrutura interna, mantendo logica e UI coesas e isoladas:

```text
src/features/appointments/
├─ components/               # telas e componentes do dominio (client components)
│  ├─ agenda-view.tsx
│  ├─ calendar-panel.tsx
│  ├─ appointment-form.tsx
│  └─ appointment-detail-dialog.tsx
├─ hooks/                    # TanStack Query do dominio
│  ├─ use-appointments.ts
│  └─ use-time-blocks.ts
├─ appointment-schema.ts     # schema Zod do formulario
└─ index.ts                  # superficie publica da feature (barrel)
```

Features existentes (rota tecnica em ingles, rotulo de UI em PT; itens com modelo aparecem so no tenant daquele modelo):

| Feature (pasta) | Rota | Navegacao (rotulo PT) | Contexto |
| --- | --- | --- | --- |
| `dashboard` | `/` | Dashboard | Resumo operacional, muda por modelo. |
| `appointments` | `/schedule` | Agenda | `scheduling`. Abas Calendário (Dia/Semana/Mês, feito a mao) e Lista; bloqueios, recorrencia. `/appointments` so redireciona para `/schedule`. |
| `clients` | `/clients` | Clientes / Alunos | Cadastro, busca; na academia inclui plano, vencimento e 1a cobranca. |
| `professionals` | `/team` | Equipe | Profissionais / instrutores. |
| `roles` | (dentro de Equipe) | Cargos | CRUD de cargos (`Role`). |
| `services` | `/services` | Serviços | `scheduling`. Catalogo de servicos. |
| `categories` | (dentro de Serviços / Modalidades) | Categorias | Entidade `Category`. |
| `turmas` | `/classes`, `/classes/[id]`, `/classes/sessions/[sessionId]`, `/classes/calendar`, `/classes/modalities`, `/classes/plans`, `/classes/billing` | Turmas, Calendário, Modalidades, Planos, Mensalidades | `classes` (Modelo 3). Nome em portugues e divida conhecida (ver `docs/technical/01`). |
| `users` | `/users` | Usuários | Usuarios e perfis de acesso. |
| `audit` | `/audit` | Auditoria | Log de auditoria. |
| `settings` | `/settings` | Configurações | Organizacao, unidade, horario, regras de cobranca. |
| `onboarding` | (banner/tour no shell) | — | Onboarding do tenant. |
| `system` | (card em Configurações) | — | "Apagar dados da demonstração" (aba Dados). |
| `auth` | — | — | Sessao (ver tabela de camadas). |

O Login fica no route group `(auth)` (`src/app/(auth)/login/page.tsx`), fora do app shell; nao e uma feature de dominio operacional.

## Convencoes de nomeacao

| Item | Convencao | Exemplo |
| --- | --- | --- |
| Pastas de rota | kebab/lowercase em ingles | `clients/`, `classes/[id]/` |
| Arquivos especiais Next | nomes reservados | `page.tsx`, `layout.tsx`, `proxy.ts` |
| Route groups | parenteses, sem virar URL | `(auth)`, `(app)` |
| Arquivos de componente | kebab-case | `appointment-form.tsx` |
| Componentes React | PascalCase (no codigo) | `AppointmentForm` |
| Arquivos de hook | kebab-case com prefixo `use-` | `use-appointments.ts` (exporta `useAppointments`) |
| Services | camelCase, sufixo `Service` | `appointmentsService.ts` |
| Tipos/contratos | PascalCase para tipos | `Appointment`, `AppointmentStatus` |
| Enums (valores) | snake/lowercase em ingles | `pending`, `in_service`, `no_show` |
| Pastas de feature | lowercase em ingles, por dominio | `clients/`, `professionals/`, `appointments/` |
| Constantes/config | camelCase ou UPPER_SNAKE | `queryKeys`, `SESSION_COOKIE` |

Codigo em ingles, UI em PT (acentuado). Os enums ficam em `packages/contracts/src` e os rotulos PT em `src/lib/labels.ts`:

```ts
// packages/contracts/src/common.ts
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_service"
  | "completed"
  | "canceled"
  | "no_show";

export type AppointmentOrigin = "manual" | "recurrence"; // futuro: online | whatsapp

export type Frequency = "weekly" | "biweekly" | "monthly";
```

## Exemplo de fluxo (codigo real, resumido)

```ts
// packages/contracts/src/appointment.ts -> contrato (Appointment, AppointmentFilter, ...)

// apps/web/src/services/appointmentsService.ts -> async tipado (unico que toca o store)
export const appointmentsService = {
  list(filter?: AppointmentFilter): Promise<AppointmentView[]> { /* simulateRead(...) */ },
  // create, update, reschedule, setStatus, cancel, markNoShow, ...
};

// apps/web/src/features/appointments/hooks/use-appointments.ts -> TanStack Query
export function useAppointments(filter?: AppointmentFilter) {
  return useQuery({
    queryKey: queryKeys.appointments.list(filter),
    queryFn: () => appointmentsService.list(filter),
  });
}

// apps/web/src/features/appointments/components/*.tsx -> UI (client)
// usa useAppointments(); NUNCA importa src/mocks.
```

## Alinhamento com produto

- Modelo 3 (foco ativo): `docs/product/11-modelo-3-turmas.md`, `docs/product/14-mvp-academia-lutas.md`, `docs/product/15-regras-de-cobranca.md`.
- Entidades e campos do Modelo 1: `docs/product/04-mvp-barbearia.md`.
- Regras de conflito/disponibilidade/remarcacao/recorrencia (vivem nos services/hooks): `docs/product/05-regras-negocio.md`.
- Seed e escopo do tenant: `docs/technical/03-multi-tenant-e-escopo.md`.
- Jornadas que as rotas/features cobrem: `docs/product/09-fluxos-principais.md`.
- Estados vazios, de erro e validacoes (UI): `docs/product/10-estados-e-mensagens.md`.

## Convencao de Idioma: English Code Standard com UI em Portugues

- **Codigo (100% em Ingles)**: Todo identificador de codigo DEVE ser em ingles. Isso inclui:
  - Tipos e interfaces (`Plan`, `Charge`, `ClassGroup`, `Enrollment`, `ClassReservation`, `WaitlistEntry`).
  - Enums e keys (`ChargeKind = "membership" | "dropin"`, `PlanPeriod = "monthly" | "biweekly" | "weekly"`).
  - Propriedades de objetos e colunas (`availableSpots`, `sessionPriceCents`, `competence`, `dueDate`, `amountCents`).
  - Funcoes, metodos, hooks e variaveis (`useCharges`, `useMarkChargePaid`, `billingService.markPaid`, `useReserveSession`).
  - Query keys (`queryKeys.billing.charges`, `queryKeys.classes.waitlist`).
- **Interface (100% em Portugues pt-BR)**: Toda string visivel para o usuario deve ser em portugues (rotulos, botoes, toasts, mensagens de erro, titulos de modal e guides).
- Essa regra e compulsoria para todos os agentes e desenvolvedores (registrada em `CLAUDE.md` e `AGENTS.md`).
- Divida conhecida: `features/turmas`, `turmasService`, `TurmaForm*` e aliases de contrato em portugues (`Cobranca`, `Reserva`, `Plano`) ainda violam a regra; ver `docs/technical/01`.

## Pendencias

- Resolvidas: contratos (`packages/contracts`), store/seed/reset (`docs/frontend/02`, `docs/technical/03`), `queryKeys` (`src/lib/queryKeys.ts`), guarda de sessao (`src/proxy.ts`), testes (`docs/technical/04`).
- Aberta: renomear `features/turmas`/`turmasService` e remover os aliases em portugues.
