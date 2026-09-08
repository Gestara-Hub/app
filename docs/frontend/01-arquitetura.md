# Arquitetura do Frontend (apps/web)

## Decisao

O frontend do GestaraHub e uma aplicacao Next.js 16 (App Router, com React Server Components), escrita em TypeScript strict, usando shadcn/ui (style "new-york", base color "neutral", CSS variables) sobre Tailwind CSS v4 e Radix como design system. Icones: lucide-react.

O acesso a dados passa sempre por uma cadeia unica: UI (componentes/pages) -> hooks de dados (TanStack Query) -> services (async tipados) -> store em memoria (mocks). A UI nunca importa mocks diretamente.

No MVP frontend-first, o app roda contra uma camada de servico mockada em client components. Trocar o mock por backend real significa trocar SO a implementacao dos services. Server Actions / Route Handlers do Next NAO sao usados para dados de dominio no MVP; ficam reservados para a fase de backend.

## Contexto

- O MVP valida escopo, fluxos, telas e regras antes de modelar o backend (ver `docs/frontend/00-estrategia-frontend.md`).
- Os dados sao mockados, mas o formato imita um contrato de API HTTP futuro (ver `docs/product/04-mvp-barbearia.md`).
- O store em memoria e seedado a partir do cenario canonico Corte Nobre (`docs/product/08-barbearia-corte-nobre.md`) e persistido no localStorage do navegador: sobrevive a reloads (reset por versao de seed ou pela acao "Restaurar dados de exemplo" em Configuracoes).
- A organizacao do codigo prioriza isolamento por dominio (feature) para evoluir sem reescrever telas quando o backend chegar.

## Escopo

- Estrutura de pastas de `apps/web` (Next App Router).
- Route groups, layouts e a divisao entre Server Components (RSC) e Client Components.
- Camadas e fluxo de dados.
- Convencoes de nomeacao e organizacao por feature.
- Limites entre UI, dados, services e mocks.

## Fora de escopo

- Implementacao de telas e componentes especificos (vira em docs proprios por feature).
- Contrato detalhado de cada service e tipo (vira em doc de services/contratos).
- Server Actions, Route Handlers, SSR data loading via backend real, autenticacao real (fase posterior).
- Configuracao de CI, deploy e infraestrutura.

## Repositorio

Monorepo `gestarahub`. O frontend vive em `apps/web`. Por ora so existe `apps/web`; `apps/api` e `packages/` compartilhados sao futuro.

```text
gestarahub/
├─ apps/
│  └─ web/            # frontend Next.js (App Router) (foco deste doc)
├─ docs/              # especificacao viva (produto, frontend, tecnico)
└─ pnpm-workspace.yaml
```

## Estrutura de pastas de apps/web

A arvore abaixo combina as convencoes do Next App Router (route groups, layouts, entrypoints) com a organizacao por feature do projeto. Aliases: `@/*` aponta para `src/*` (e `@/components/ui`, `@/lib/utils`, `@/hooks` conforme o padrao shadcn).

```text
apps/web/
├─ src/
│  ├─ app/                         # App Router (rotas, layouts)
│  │  ├─ layout.tsx                # root layout: <html>, Providers (QueryClient,
│  │  │                            #   ThemeProvider) e <Toaster/> (sonner)
│  │  ├─ globals.css               # Tailwind v4 + variaveis CSS do shadcn (tema)
│  │  ├─ not-found.tsx             # pagina 404
│  │  ├─ (auth)/                   # route group publico (sem app shell)
│  │  │  └─ login/page.tsx         # "/login"
│  │  └─ (app)/                    # route group protegido (app shell)
│  │     ├─ layout.tsx             # Sidebar + Topbar + guarda de sessao
│  │     ├─ page.tsx               # Dashboard ("/")
│  │     ├─ services/page.tsx      # "/services"
│  │     ├─ clients/page.tsx       # "/clients"
│  │     ├─ clients/[id]/page.tsx  # "/clients/:id"
│  │     ├─ team/page.tsx          # "/team"
│  │     ├─ team/[id]/page.tsx     # "/team/:id"
│  │     ├─ schedule/page.tsx      # "/schedule" (agenda, client component)
│  │     ├─ appointments/page.tsx  # "/appointments"
│  │     └─ settings/page.tsx      # "/settings"
│  ├─ components/
│  │  ├─ ui/                       # componentes shadcn (button, dialog, form, ...)
│  │  ├─ layout/                   # Sidebar, Topbar, AppShell
│  │  └─ form/                     # wrappers de campo RHF (InputText, InputCurrency, ...)
│  ├─ features/<dominio>/          # UI por dominio (components/, hooks/)
│  ├─ services/                    # camada de dados async tipada (contrato de API)
│  ├─ mocks/                       # store em memoria + seed Corte Nobre
│  ├─ lib/                         # utils (cn), queryKeys, providers, labels, session
│  │                               #   (puros scheduling/date/format/api-error -> @gestarahub/core)
│  └─ hooks/                       # hooks genericos reutilizaveis
│                                  # (types/ movido para o pacote @gestarahub/contracts)
├─ middleware.ts                   # guarda de rota mock (cookie de sessao)
├─ public/                         # assets estaticos
├─ next.config.ts                  # config do Next
├─ components.json                 # config do shadcn (style, base color, aliases)
├─ tsconfig.json                   # TypeScript strict
├─ package.json
└─ .env.example
```

Notas de convencao do Next App Router:

| Item | Convencao | Observacao |
| --- | --- | --- |
| Pasta de rotas | `src/app/` | App Router; pastas viram segmentos de URL, `page.tsx` torna o segmento navegavel. |
| Root layout | `src/app/layout.tsx` | Unico `<html>`/`<body>`; monta Providers e `<Toaster/>`. Server Component. |
| Route groups | `(auth)`, `(app)` | Parenteses agrupam rotas sem virar segmento de URL; cada grupo pode ter seu `layout.tsx`. |
| Layout de grupo | `src/app/(app)/layout.tsx` | App shell (Sidebar + Topbar) + guarda de sessao. |
| Rotas dinamicas | `[id]` | Ex.: `clients/[id]/page.tsx` -> `/clients/:id`. |
| 404 | `src/app/not-found.tsx` | Pagina de nao encontrado. |
| Guarda de rota | `middleware.ts` (raiz) | Protege `(app)/*` via cookie de sessao mock e redireciona para `/login`. |
| Estilos globais | `src/app/globals.css` | Tailwind v4 + variaveis CSS do tema shadcn. |

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
| Server Component (default) | Sem estado/efeito de cliente; pode ser `async`; nao usa hooks de React de estado. | `app/layout.tsx`, `(app)/layout.tsx` (le cookie de sessao), `page.tsx` de casca que so renderiza a feature. |
| Client Component (`'use client'`) | Tudo que usa estado, efeitos, TanStack Query, React Hook Form, eventos, ou libs client-only. | Providers, componentes shadcn interativos, hooks de dados, telas de feature, agenda (react-big-calendar). |

Diretrizes:

- Os Providers (`QueryClientProvider`, `ThemeProvider`) e o `<Toaster/>` ficam num componente `'use client'` montado pelo root layout (Server Component).
- A camada de dados (hooks TanStack Query + services + mocks) roda em client components no MVP.
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
│  - funcoes Promise<T> tipadas com src/types                  │
│  - hoje: leem/escrevem no store em memoria                   │
│  - amanha: trocam SO a implementacao por fetch HTTP real     │
└───────────────┬─────────────────────────────────────────────┘
                │ acessa
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/mocks/*  (store em memoria + seed)                      │
│  - persiste no localStorage (sobrevive ao reload)           │
│  - seedado do cenario Corte Nobre                            │
│  - NUNCA importado pela UI                                   │
└─────────────────────────────────────────────────────────────┘
```

### Responsabilidades por camada

| Camada | Pasta | Responsabilidade | Pode importar |
| --- | --- | --- | --- |
| Rotas/pages | `src/app/` | Mapear URL -> tela; layouts; compor features. | `features/*`, `components/*`, `lib/*` |
| Features (UI) | `src/features/<dominio>/components/` | Telas e componentes do dominio. | hooks da propria feature, `components/*`, `types/*`, `lib/*` |
| Hooks de dados | `src/features/<dominio>/hooks/` | TanStack Query (queries/mutations), cache, invalidacao. | `services/*`, `types/*`, `lib/*` |
| Services | `src/services/` | Funcoes async tipadas; contrato de API. | `mocks/*`, `types/*`, `lib/*` |
| Mocks | `src/mocks/` | Store em memoria + seed Corte Nobre. | `types/*` |
| UI shadcn | `src/components/ui/` | Primitivos do design system (gerados pelo shadcn). | `lib/utils` (cn) |
| Layout | `src/components/layout/` | Sidebar, Topbar, AppShell. | `components/ui/*`, `lib/*`, `types/*` |
| Form | `src/components/form/` | Wrappers de campo RHF (Controller-based). | `components/ui/*`, `lib/*` |
| Lib | `src/lib/` | Utils (cn), Providers, queryKeys, format, datas, RBAC (`permissions.ts`: matriz `PROFILE_PERMISSIONS` + `can()`). | `types/*` |
| Auth/Sessao | `src/features/auth/` | Resolver o usuario logado no server (`get-current-user`), `SessionProvider`/`useCurrentUser`/`useCan` (client), guarda de rota (`require-permission`), escopo do Profissional (`scope`). | `services/*`, `lib/*`, `types/*`, `mocks/store` (so em `get-current-user`, server) |
| Types | `src/types/` | Contratos e tipos (entidades, enums, schemas Zod). | (nenhuma camada de runtime) |

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
| UI nunca importa `mocks` | Acesso a dados so via hooks -> services. Excecao unica: a cola de sessao server `features/auth/get-current-user.ts` le `mocks/store` para resolver o usuario do cookie (infra de sessao, nao e UI). |
| RBAC deriva do perfil | Permissoes vem de `PROFILE_PERMISSIONS`/`can()` (`lib/permissions`); a UI checa via `useCan()`/`requirePermission`, nunca compara `profile === '...'`. |
| Services sao o unico ponto que toca o store | Trocar mock por API real = mudar so `src/services/*`. |
| Tipos/contratos vivem no pacote `@gestarahub/contracts` | Entidades, enums e schemas Zod (era `src/types`). Mocks e services importam do contrato, nunca o contrario. |
| Features so se conhecem pelo barrel publico | Uma feature importa outra apenas via `@/features/<x>` (o `index.ts`), nunca pelos internals (`hooks/`, `components/`). |
| `'use client'` so onde necessario | Estado, efeitos, Query, RHF, eventos ou libs client-only. Default e RSC. |
| Providers num client wrapper | Root layout (RSC) monta o wrapper `'use client'` com Query/Theme/Toaster. |
| Features nao importam umas das outras diretamente | Compartilhamento sobe para `components/`, `lib/` ou `types/`. |
| Hooks de dados nao chamam o store | So chamam services. |
| Estado de servidor mora no Query | Nao duplicar dados de servidor em estado de UI. |

### Pacotes compartilhados e prontidao para microfrontend (MFE)

O monolito vive em `apps/web`, mas as **costuras** de um futuro split (MFE / Next
Multi-Zones) ja estao desenhadas e **aplicadas por lint** — extrair depois vira
tarefa mecanica, nao um rewrite.

- **Pacotes de workspace** (`packages/*`, consumidos como fonte TS via
  `transpilePackages`):
  - `@gestarahub/contracts` — o contrato de dominio (entidades, enums, schemas).
    Todo o resto depende dele; ele nao depende de nada do app.
  - `@gestarahub/core` — logica pura, framework-agnostica: `scheduling` (motor de
    conflito), `date`, `format`, `api-error`. Reutilizavel por qualquer app futuro.
  - O **design system** (`components/ui|form|shared`) fica no app por ora; a
    extracao para `@gestarahub/ui` acontece no split (envolve config de conteudo
    do Tailwind v4 cross-package).

- **Fronteiras aplicadas** (ESLint `no-restricted-imports`, ver
  `apps/web/eslint.config.mjs`):
  - Camada compartilhada (design system + `lib` + `config`) **nao** importa de
    `features` nem do `mocks` store.
  - Cada **feature** so importa outra pelo **barrel publico** (`@/features/<x>`),
    nunca pelos internals — cada feature e uma unidade trocavel.
  - **Nenhuma** feature/UI acessa o `mocks` store direto (so via `services`).
    Excecao unica e transitoria: a resolucao de sessao server-side em
    `features/auth` (vira auth/API real depois).

- **Plataforma vs. workflow:** `clients`, `professionals`, `services`,
  `categories`, `roles`, `users`, `settings`, `auth` sao **dados de referencia
  transversais** (plataforma) consumidos por features de workflow como `schedule`
  (agenda) e `dashboard`. No split, a plataforma vira camada/contrato
  compartilhado; as features de workflow viram as zonas.

## Organizacao por feature

Cada dominio em `src/features/<dominio>/` segue a mesma estrutura interna, mantendo logica e UI coesas e isoladas:

```text
src/features/appointments/
├─ components/        # telas e componentes do dominio (client components)
│  ├─ AppointmentsList.tsx
│  ├─ AppointmentForm.tsx
│  └─ AppointmentDetail.tsx
├─ hooks/             # TanStack Query do dominio
│  ├─ useAppointments.ts
│  └─ useCreateAppointment.ts
└─ index.ts           # exporta a superficie publica da feature
```

Dominios do MVP (alinhados a navegacao canonica; rota tecnica em ingles, rotulo de UI em PT):

| Feature (pasta) | Rota | Navegacao (rotulo PT) | Contexto |
| --- | --- | --- | --- |
| `dashboard` | `/` | Dashboard | Resumo operacional do dia. |
| `schedule` (feature `appointments`) | `/schedule` | Agenda | Calendario hand-built (React + Tailwind, sem lib externa), bloqueios, recorrencia. |
| `appointments` | `/appointments` | Agendamentos | Lista/tabela complementar a agenda. |
| `clients` | `/clients`, `/clients/[id]` | Clientes | Cadastro, busca, historico. |
| `team` | `/team`, `/team/[id]` | Equipe | Profissionais (rotulo "Profissional" no contexto de agendamento). |
| `services` | `/services` | Servicos | Catalogo de servicos. |
| `settings` | `/settings` | Configuracoes | Organizacao, unidade, horario de funcionamento. |

O Login fica no route group `(auth)` (`src/app/(auth)/login/page.tsx`), fora do app shell; nao e uma feature de dominio operacional.

## Convencoes de nomeacao

| Item | Convencao | Exemplo |
| --- | --- | --- |
| Pastas de rota | kebab/lowercase em ingles | `clients/`, `team/`, `clients/[id]/` |
| Arquivos especiais Next | nomes reservados | `page.tsx`, `layout.tsx`, `not-found.tsx`, `middleware.ts` |
| Route groups | parenteses, sem virar URL | `(auth)`, `(app)` |
| Componentes React | PascalCase | `AppointmentForm.tsx` |
| Hooks | camelCase com prefixo `use` | `useAppointments.ts` |
| Services | camelCase, sufixo de dominio | `appointmentsService.ts` |
| Tipos/contratos | PascalCase para tipos | `Appointment`, `AppointmentStatus` |
| Enums (valores) | chaves exatas do canon | `pendente`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`, `nao_compareceu` |
| Pastas de feature | lowercase em ingles, alinhado a rota | `clients/`, `team/`, `services/` |
| Constantes/config | camelCase ou UPPER_SNAKE | `queryKeys`, `API_BASE_URL` |

Codigo em ingles, UI em PT (acentuado). Os enums abaixo mantem as chaves exatas do canon, centralizados em `src/types`:

```ts
type AppointmentStatus =
  | 'pendente'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado'
  | 'nao_compareceu';

type AppointmentOrigin = 'manual' | 'recorrencia'; // futuro: 'online' | 'whatsapp'

type RecurrenceFrequency = 'semanal' | 'quinzenal' | 'mensal';
```

## Exemplo de fluxo (referencia conceitual)

```ts
// src/types/appointment.ts  -> contrato
export interface Appointment {
  id: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  date: string;        // ISO date
  start: string;       // HH:mm
  end: string;         // HH:mm
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  seriesId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// src/services/appointmentsService.ts -> async tipado (unico que toca o store)
export async function listAppointments(): Promise<Appointment[]> {
  // hoje: le do store em memoria (src/mocks)
  // amanha: troca SO esta implementacao por fetch HTTP
}

// src/features/appointments/hooks/useAppointments.ts -> TanStack Query
'use client';
export function useAppointments() {
  return useQuery({
    queryKey: queryKeys.appointments.all,
    queryFn: listAppointments,
  });
}

// src/features/appointments/components/AppointmentsList.tsx -> UI (client)
// usa useAppointments(); NUNCA importa src/mocks.
```

## Alinhamento com produto

- Entidades e campos: `docs/product/04-mvp-barbearia.md`.
- Regras de conflito/disponibilidade/remarcacao/recorrencia (vivem nos services/hooks): `docs/product/05-regras-negocio.md`.
- Seed do store em memoria: `docs/product/08-barbearia-corte-nobre.md`.
- Jornadas que as rotas/features cobrem: `docs/product/09-fluxos-principais.md`.
- Estados vazios, de erro e validacoes (UI): `docs/product/10-estados-e-mensagens.md`.

## Convencao de Idioma: English Code Standard com UI em Portugues

- **Codigo (100% em Ingles)**: Todo identificador de codigo DEVE ser em ingles. Isso inclui:
  - Tipos e interfaces (`Plan`, `Charge`, `ClassGroup`, `Enrollment`, `ClassReservation`, `MakeupClass`).
  - Enums e keys (`ChargeKind = "membership" | "dropin"`, `PlanPeriod = "monthly" | "biweekly" | "weekly" | "session"`).
  - Propriedades de objetos e colunas (`availableSpots`, `sessionPriceCents`, `competence`, `dueDate`, `amountCents`).
  - Funcoes, metodos, hooks e variaveis (`useCharges`, `markChargePaid`, `isMadeUp`).
  - Query keys (`queryKeys.billing.charges`, `queryKeys.classes.makeups`).
- **Interface (100% em Portugues pt-BR)**: Toda string visivel para o usuario deve ser em portugues (rotulos, botoes, toasts, mensagens de erro, titulos de modal e guides).
- Essa regra e compulsoria para todos os agentes e desenvolvedores (registrada em `CLAUDE.md` e `AGENTS.md`).

## Pendencias

- Definir o contrato detalhado de cada service e os schemas Zod / tipos em `src/types` (doc proprio).
- Definir a estrutura interna do store em memoria e a estrategia de seed/reset (doc de mocks).
- Definir convencao de `queryKeys` e politica de invalidacao do TanStack Query.
- Confirmar a estrategia exata da guarda de sessao (middleware.ts vs guarda no `(app)/layout.tsx`) no scaffold inicial.
- Definir padrao de testes (Vitest + Testing Library) por camada.
