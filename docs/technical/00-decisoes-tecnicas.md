# Decisoes Tecnicas

## Decisao

O GestaraHub e construido com abordagem frontend-first e dados mockados, sobre uma stack TypeScript moderna baseada em Next.js 16 (App Router, React Server Components). O backend real fica adiado para a fase 3; ate la, toda a aplicacao roda no frontend, consumindo uma camada de servico mockada que imita um contrato de API HTTP.

A referencia visual e de componentes e o projeto `old/gestarahub-web` (Next + shadcn/ui), presente na maquina mas fora do git. Dele reaproveitamos layout refinado, componentes shadcn e wrappers de formulario; nao reaproveitamos a antiga `gestarahub-api`. Este documento e a fonte de verdade das escolhas tecnicas; decisoes marcadas como "refinavel" podem ser revistas sem reabrir a discussao das demais.

## Contexto

O produto precisa validar escopo, telas, fluxos e regras operacionais antes de modelar um backend definitivo (ver `docs/frontend/00-estrategia-frontend.md` e `docs/product/04-mvp-barbearia.md`). Por isso a UI e desenvolvida primeiro, contra mocks que ja se parecem com a futura API. Quando o backend chegar, trocamos apenas a implementacao da camada de servico, sem reescrever telas.

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
- Especificacao de telas e componentes (ver docs de frontend 01 a 05).
- Backend real, persistencia, autenticacao real e infraestrutura.

## Stack escolhida

| Camada | Escolha | Justificativa curta |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, RSC) | Full-stack React maduro e estavel; App Router com Server e Client Components. No MVP usamos so o lado cliente para a camada mockada; o caminho para o backend (fase 3) fica preparado. |
| Linguagem | TypeScript (modo strict) | Seguranca de tipos em todo o codigo; os mocks viram contratos tipados reutilizaveis pelo backend futuro. |
| UI / design system | shadcn/ui (style "new-york", base color "neutral", cssVariables) | Componentes copiados para o repo (controle total), sobre Radix. Layout de referencia ja pronto em `old/gestarahub-web`. |
| CSS / estilo | Tailwind CSS v4 | Utilitarios + variaveis CSS do tema shadcn. |
| Primitivas acessiveis | Radix UI | Base dos componentes shadcn (dialog, select, dropdown, etc.). |
| Icones | lucide-react | Conjunto de icones padrao do shadcn. |
| Formularios | React Hook Form 7 + Zod 4 via `@hookform/resolvers` (zodResolver) | Validacao no submit, revalidacao no change (padrao RHF: `mode: onSubmit` + `reValidateMode: onChange`). Wrappers de campo Controller-based (ver `old/src/components/form`). |
| Estado de servidor / dados | TanStack Query | Cache, loading/erro, invalidacao e refetch padronizados. Consome a camada de servico mockada como se fosse uma API real. Roda em client components. |
| Estado de UI local | useState | Estado simples vive no componente. |
| Estado de UI global leve | Zustand (se necessario) | Para estado de UI compartilhado (ex.: filtros, preferencias). NAO usar Redux. So introduzir quando houver necessidade real. |
| Calendario / Agenda | react-big-calendar (free, client component) | Suporta colunas por recurso (profissional) no day view sem custo. NAO usar Schedule-X (resource view paga) nem FullCalendar (resource pago). |
| Datas | date-fns | Formatacao e manipulacao de datas. |
| Toasts / notificacoes | sonner | Toasts via `<Toaster/>` montado no root layout. |
| Gerenciador de pacotes | pnpm (refinavel) | Bom para monorepo (workspaces, store unico, instalacao rapida). |
| Testes unit/componente | Vitest + Testing Library | Testes rapidos focados em comportamento de componentes e logica pura. |
| Testes e2e | Playwright (fase posterior) | E2e dos fluxos principais quando a aplicacao amadurecer. |
| Lint / format | ESLint + Prettier OU Biome (refinavel) | Padronizacao de estilo e qualidade. A escolha fica em aberto. |

### Notas sobre a stack

- RSC esta disponivel no App Router, mas a camada de dados mockada (TanStack Query + services) vive em client components no MVP; o foco e a experiencia interativa contra mocks.
- Nenhuma rota de servidor / route handler do Next acessa dados reais no MVP. Ficam reservados para a fase 3.
- Onde a API exata de uma lib for incerta, consultar `old/gestarahub-web` e a doc oficial antes de codificar (ex.: configuracao de resource view do react-big-calendar, padroes de wrapper RHF).

## Estrutura de repositorio

Monorepo unico. No momento existe apenas o frontend; `apps/api` e `packages/` sao previsao para fases futuras.

```text
gestarahub
  apps/
    web/                # frontend (Next.js 16, App Router) - unico app no MVP
    api/                # FUTURO (fase 3): backend NestJS (do zero)
  packages/             # FUTURO: codigo compartilhado (tipos, contratos, utils)
  pnpm-workspace.yaml   # workspaces do monorepo
  package.json          # scripts e deps na raiz
```

- No MVP, todo o desenvolvimento acontece em `apps/web`.
- `packages/` surgira quando houver codigo a compartilhar entre `apps/web` e `apps/api` (ex.: tipos de entidade e contratos de servico).
- O monorepo evita reescrita: os contratos tipados nascidos nos mocks podem migrar para `packages/` e ser consumidos pelo backend.

### Organizacao interna de apps/web (App Router, por feature)

As rotas vivem em `src/app` (App Router). A UI de dominio vive em `src/features`, organizada por feature, nao por tipo de arquivo. Aliases `@/*` apontam para `src/*` (incluindo `@/components/ui`, `@/lib/utils`, `@/hooks`, como o shadcn espera).

```text
apps/web/src
  app/                        # rotas (App Router)
    layout.tsx                # root layout: html, Providers (QueryClient, ThemeProvider, <Toaster/>), globals.css
    globals.css               # Tailwind v4 + variaveis CSS do tema shadcn
    not-found.tsx             # pagina 404
    (auth)/login/page.tsx     # login (publico)
    (app)/layout.tsx          # app shell (Sidebar + Topbar) + guarda de sessao
    (app)/page.tsx            # Dashboard (/)
    (app)/services/  clients/[id]  team/[id]  schedule/  appointments/  settings/
  components/ui/              # componentes shadcn (button, dialog, select, form, input, ...)
  components/layout/          # Sidebar, Topbar, AppShell
  components/form/            # wrappers de campo RHF (Controller-based): InputText, InputCurrency, ...
  features/<dominio>/         # UI por dominio (components/, hooks/)
  lib/                        # utils (cn), queryKeys, format, providers
  services/                   # camada de servico mockada (async tipada)
  mocks/                      # store em memoria + seed Corte Nobre
  types/                      # contratos (entidades, enums, schemas Zod)
```

A divisao final de pastas dentro de cada feature e detalhada nos docs de frontend.

### Guarda de rota (mock)

Sessao mockada via cookie. A protecao de `(app)/*` e feita por Next middleware (`middleware.ts`) que redireciona para `/login`, ou por guarda no `(app)/layout`. Como e mock, manter simples.

## Convencoes

- TypeScript em modo strict em todo o repositorio; evitar `any`, preferir tipos derivados dos contratos (`src/types`, schemas Zod).
- Organizacao por feature/dominio (ver arvore acima). Codigo realmente generico vai para `components/`, `lib/` ou, no futuro, `packages/`.
- Path aliases `@/*` -> `src/*`, com `@/components/ui`, `@/lib/utils` e `@/hooks` conforme o padrao do shadcn; configurados no `tsconfig` e em `components.json`.
- Nomenclatura de codigo em ingles (identificadores, keys e enum VALUES), seguindo o padrao das libs. So strings vistas pelo usuario ficam em portugues: texto livre de cadastro (name, description, notes...) e os ROTULOS de exibicao dos enums (`src/lib/labels.ts`). Os codigos de enum sao em ingles (ver secao de enums).
- Formularios: React Hook Form + zodResolver; validacao no submit e revalidacao no change. Usar os wrappers de campo em `components/form`.
- Lint/format: ESLint + Prettier OU Biome (refinavel). Decidir um e aplicar consistentemente no `apps/web`.
- Gerenciador de pacotes: pnpm (refinavel), com workspaces na raiz do monorepo.

### Navegacao (itens canonicos)

Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes.

- "Equipe" e o rotulo da navegacao; "Profissional" e o termo usado no contexto de agendamento e nas telas de detalhe.
- Login fica fora do app shell (rota `(auth)/login`, sessao mockada).

### Enums (chaves exatas)

Codigos em ingles; o rotulo PT vai na UI (ver `src/lib/labels.ts`).

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

type ServiceCategory = "hair" | "beard" | "care" | "combo"; // labels: Cabelo/Barba/Cuidados/Combos
```

## Testes

- Unit e componente: Vitest + Testing Library. Foco em comportamento (renderizacao, interacao, estados de loading/erro/vazio) e em logica pura (regras de conflito, disponibilidade, geracao de recorrencia).
- E2e: Playwright em fase posterior, cobrindo os fluxos principais (ver `docs/product/09-fluxos-principais.md`) sobre os mocks.
- As regras de negocio (`docs/product/05-regras-negocio.md`) sao alvo prioritario de testes, pois sao estaveis e independem de backend.

## Mocks como contrato de API (principio central)

- A UI nunca acessa mocks diretamente. O fluxo e sempre: hooks (TanStack Query) -> services (funcoes async tipadas) -> store em memoria.
- O service imita um contrato de API HTTP (mesma forma de chamada, mesmos tipos de entrada e saida, mesmos erros).
- Trocar o mock por backend real significa trocar SO a implementacao do service; hooks e telas permanecem iguais.
- O store em memoria e seedado a partir do cenario canonico Corte Nobre (`docs/product/08-barbearia-corte-nobre.md`) e persistido no localStorage do navegador (simula um banco): sobrevive a reloads, com reset por versao de seed (`SEED_VERSION`) e acao "Restaurar dados de exemplo" em Configuracoes. A persistencia e so no cliente (no SSR/Node e no-op).

O detalhamento desta camada (estrutura de services, store, seed, simulacao de latencia e erro) esta em `docs/frontend/02-camada-de-dados-mock.md`.

## Backend (fase 3)

- O backend sera **NestJS**, construido do zero na fase 3 num `apps/api` dedicado (monorepo), sem reaproveitar nada do projeto antigo (`gestarahub-api`).
- A camada de servico mockada do frontend ja imita o contrato da futura API NestJS: na fase 3, troca-se apenas a implementacao dos services (de store em memoria para `fetch` ao NestJS), mantendo assinaturas e tipos. Os contratos tipados podem ser promovidos para `packages/` e compartilhados entre `apps/web` e `apps/api`.
- Ate la, nenhum endpoint real e usado; a persistencia e mockada (localStorage no cliente) e a autenticacao tambem (cookie de sessao mockado).

## Referencias

Referencia de implementacao:

- `old/gestarahub-web` (Next + shadcn) - layout, componentes shadcn e wrappers de formulario.

Frontend:

- `docs/frontend/00-estrategia-frontend.md`
- `docs/frontend/01-...` (arquitetura/rotas)
- `docs/frontend/02-camada-de-dados-mock.md` (camada de dados mockada)
- `docs/frontend/03-...`
- `docs/frontend/04-...`
- `docs/frontend/05-...`

Produto:

- `docs/product/04-mvp-barbearia.md` (entidades, campos, status e origem)
- `docs/product/05-regras-negocio.md` (conflito, disponibilidade, remarcacao, recorrencia)
- `docs/product/08-barbearia-corte-nobre.md` (dados do seed)

## Pendencias

- Fixar o gerenciador de pacotes (pnpm e a recomendacao) e inicializar o monorepo com workspaces.
- Decidir entre ESLint + Prettier e Biome e aplicar no `apps/web`.
- Confirmar os path aliases em `tsconfig` e `components.json` no setup do `apps/web`.
- Confirmar na doc oficial / em `old/gestarahub-web` os detalhes de resource view do react-big-calendar antes de codificar.
- Completar os docs de frontend 01 a 05 referenciados acima.
