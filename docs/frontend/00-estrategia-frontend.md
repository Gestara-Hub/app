# Estrategia Frontend

## Decisao

O desenvolvimento comeca pelo frontend, construido sobre uma camada de servico mockada que imita um contrato de API HTTP. A interface e os fluxos sao validados antes de existir qualquer backend real. O foco ativo e o **Modelo 3 (turmas, academia de lutas)**, ver `docs/product/14-mvp-academia-lutas.md`; o Modelo 1 (agenda, barbearia) esta completo e segue como referencia. Quando o backend chegar (fase 3), so a implementacao dos services muda; hooks, telas e componentes permanecem.

A stack e Next.js 16 (App Router, RSC) com shadcn/ui + Tailwind CSS v4, escolhida por ser madura, estavel e ja dominada pelo time, com layout de referencia refinado em `old/gestarahub-web`. No MVP frontend-first a camada de dados roda inteiramente no cliente (client components + TanStack Query sobre services mockados). A unica excecao no servidor e a sessao mockada: guarda em `src/proxy.ts` e server actions de login/troca/logout em `src/app/(auth)/actions.ts`.

## Contexto

O produto ainda precisa validar escopo, fluxos, telas, linguagem e regras operacionais. Construir a experiencia primeiro reduz o risco de modelar backend antes de entender a rotina real que a interface precisa suportar.

Projeto do zero: nada do `old/gestarahub-api` sera reaproveitado. O `old/gestarahub-web` (Next + shadcn) serve apenas como referencia visual e de componentes; nao ha "arquitetura atual" do frontend a analisar, tudo e construido novo seguindo esta estrategia.

Os dados, entidades e regras que a interface precisa suportar estao definidos nos docs de produto, que sao a fonte de verdade do dominio:

- `docs/product/14-mvp-academia-lutas.md` e `docs/product/11-modelo-3-turmas.md` (Modelo 3, foco ativo).
- `docs/product/15-regras-de-cobranca.md` (regras de mensalidade).
- `docs/product/04-mvp-barbearia.md` (Modelo 1: entidades e campos: Cliente, Profissional, Servico, Agendamento, Bloqueio, SerieRecorrencia, Organizacao, Unidade; status e origem).
- `docs/product/05-regras-negocio.md` (regras de conflito, disponibilidade, remarcacao, recorrencia).
- `docs/product/08-barbearia-corte-nobre.md` (cenario canonico Corte Nobre; referencia de produto, o seed atual nasce vazio).
- `docs/product/09-fluxos-principais.md` (jornadas).
- `docs/product/10-estados-e-mensagens.md` (estados vazios, erros e validacoes).

## Principio central: mocks como contrato de API

- A UI NUNCA acessa mocks direto. O fluxo de dados e sempre:

```
componentes (telas, client components)
  -> hooks (TanStack Query)
    -> services (funcoes async tipadas)
      -> store em memoria (mundo multi-tenant, persistido no localStorage)
```

- O mock imita um contrato de API HTTP: o service retorna `Promise`, pode falhar, tem latencia simulada e tipos estaveis.
- Trocar o mock por backend real significa trocar SO a implementacao dos services. Os tipos do contrato, os hooks e as telas nao mudam.
- O store em memoria guarda um mundo multi-tenant (ver `docs/technical/03-multi-tenant-e-escopo.md`). O seed cria **dois tenants vazios, so com o proprietario**: Corte Nobre (`scheduling`) e Academia X (`classes`). O restante dos dados nasce pelo uso da UI. O mundo e persistido no localStorage: sobrevive a reloads (reset por versao de seed ou pela acao "Apagar dados da demonstração" (aba Dados) em Configuracoes, `features/system/components/reset-data-card.tsx`).

## Stack concreta

| Camada | Decisao | Observacao |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, RSC) | Maduro e estavel. No MVP frontend-first as telas de dados sao client components; server actions so para a sessao mockada. |
| Roteamento | App Router (file-based) | Rotas em `src/app`, grupos `(auth)` e `(app)`. Ver `docs/frontend/03`. |
| Linguagem | TypeScript (strict) | Tipos sao o contrato compartilhado entre service, hook e tela. |
| UI / design system | shadcn/ui (style "new-york", base color "neutral", cssVariables) | Componentes em `src/components/ui`, copiados para o repo. Radix por baixo. Ver `docs/frontend/04`. |
| Estilo | Tailwind CSS v4 | Variaveis CSS do tema shadcn em `globals.css`, personalizador de tema (`lib/theme-customizer.ts`). Cores de status como tokens `--status-*`. |
| Icones | lucide-react | Padrao do shadcn. |
| Formularios | React Hook Form 7 + Zod 4 (`@hookform/resolvers`, `zodResolver`) | Validacao no submit, revalida no change (`mode: onSubmit`, `reValidateMode: onChange`). Wrappers de campo em `src/components/form`. |
| Estado de servidor / dados | TanStack Query | Sobre a camada de service mockada. Ver `docs/frontend/01` e `02`. |
| Estado de UI local | useState | Estado por componente. |
| Estado de UI global leve | Nenhum (React context quando preciso, ex.: `SessionProvider`) | Zustand nao foi adotado. NAO usar Redux. |
| Calendario / Agenda | Feito a mao (Dia/Semana/Mes, colunas por profissional) | `features/appointments/components/calendar-panel.tsx` e `schedule-day-grid.tsx`. `react-big-calendar` foi descartado (ver `docs/frontend/06` e o banner de `docs/frontend/05`). |
| Toasts | sonner | `<Toaster />` no root layout. |
| Datas | date-fns | Formatacao e calculo de datas/horarios. |
| Gerenciador de pacotes | pnpm (workspaces, `packageManager: pnpm@11.9.0`) | Monorepo com `apps/web`, `packages/contracts`, `packages/core`. |
| Testes | `node --test` (motor em `packages/core`) + Vitest (services) + Playwright (e2e) | Sem Testing Library. Ver `docs/technical/04-estrategia-de-testes.md`. |
| Lint / format | ESLint (`eslint-config-next` + regras de fronteira) | Prettier/Biome nao adotados. |

Aliases: `@/*` -> `src/*`, com `@/components/ui`, `@/lib/utils` e `@/hooks` no padrao do shadcn.

Onde a API exata de uma lib for incerta, manter o doc conceitual e citar a doc oficial em vez de inventar assinaturas:

- Next.js (App Router): https://nextjs.org/docs/app
- shadcn/ui: https://ui.shadcn.com
- Tailwind CSS v4: https://tailwindcss.com
- React Hook Form: https://react-hook-form.com
- Zod: https://zod.dev
- TanStack Query: https://tanstack.com/query
- sonner: https://sonner.emilkowal.ski
- date-fns: https://date-fns.org

## Estrutura de repositorio

Monorepo `gestarahub` (pnpm workspaces). O frontend vive em `apps/web`; contratos e logica pura ja estao em `packages/`. Futuro: `apps/api`.

```
gestarahub/
  apps/
    web/          # frontend (Next.js App Router). Unico app no MVP.
      e2e/            # testes Playwright
      src/
        app/          # rotas (App Router): layout, globals.css, (auth), (app)
        proxy.ts      # guarda de sessao (Next 16)
        assets/       # logos
        components/   # ui (shadcn), layout (sidebar/topbar/nav), form (wrappers RHF),
                      # shared (listas, confirmacao, combobox), theme (personalizador)
        config/       # tenant.ts (ids do seed)
        features/     # UI por dominio (components/, hooks/, schemas, index.ts)
        hooks/        # use-mobile
        lib/          # utils (cn), queryKeys, labels, permissions, session, providers
        services/     # camada de servico mockada (async tipada) + __tests__
        mocks/        # store multi-tenant + seed + config + helpers
        test/         # setup e cenarios do Vitest
  packages/
    contracts/    # tipos do dominio (entidades, enums, ApiError)
    core/         # logica pura (scheduling, billing, date, format, api-error) + test/
```

## Navegacao

Itens do app shell (`components/layout/nav.ts`), filtrados pelo modelo do tenant e pela permissao do perfil:

- Compartilhados: Dashboard, Equipe; no rodape, Usuários, Auditoria, Configurações.
- `scheduling` (barbearia): Clientes, Serviços, Agenda.
- `classes` (academia): Alunos, Turmas, Calendário, Modalidades, Planos, Mensalidades.

- "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de agendamento e em telas de detalhe.
- Login fica fora do app shell, no grupo `(auth)`.
- Guarda de sessao mockada: `src/proxy.ts` (Next 16 substitui o `middleware.ts`) exige o cookie de sessao e redireciona para `/login`; o `(app)/layout` resolve o usuario (`getCurrentUser`) e cada page aplica o RBAC (`requirePermission`). Ver `docs/frontend/03`.

## Enums (chaves exatas)

Codigos em ingles; o rotulo PT vai na UI (`src/lib/labels.ts`).

- AppointmentStatus: `pending` | `confirmed` | `in_service` | `completed` | `canceled` | `no_show`
- AppointmentOrigin: `manual` | `recurrence` (futuro: `online`, `whatsapp`)
- Frequency: `weekly` | `biweekly` | `monthly`
- RecordStatus: `active` | `inactive`
- OperationalModel: `scheduling` | `classes` | `delivery`
- PlanPeriod: `monthly` | `biweekly` | `weekly`
- ChargeKind: `membership` | `dropin`; ChargeStatus: `pending` | `paid` | `overdue` | `canceled`
- Categoria de servico/modalidade e uma entidade (`Category`, `categoryId`), nao um enum.

## Direcao

- Usar dados mockados realistas; o seed nasce vazio e os cenarios de teste montam os dados (`src/test/academy.ts`, `e2e/fixtures.ts`).
- Manter os mocks como contrato futuro de API (tipados, async, com erro e latencia).
- Nunca espalhar dados soltos dentro de componentes; tudo passa por hook -> service.
- Priorizar telas e fluxos do Modelo 3 (academia).
- Respeitar as regras de negocio (conflito, expediente, bloqueio, recorrencia, lotacao, cobranca) ja na camada mockada.
- Codigo em ingles, incluindo keys e enum VALUES; UI em portugues (acentuado). So texto livre (name, description, notes) e os rotulos de exibicao dos enums (`src/lib/labels.ts`) ficam em portugues. Os docs sao em portugues.

## Mapa dos docs de frontend

| Doc | Tema |
| --- | --- |
| `docs/frontend/00` | Estrategia frontend (este documento). |
| `docs/frontend/01` | Arquitetura: estrutura de pastas (App Router), camadas e fluxo de dados. |
| `docs/frontend/02` | Camada de dados mock: contratos TS, services, TanStack Query e store/seed. |
| `docs/frontend/03` | Rotas e navegacao (Next App Router, grupos `(auth)`/`(app)`, guarda de sessao). |
| `docs/frontend/04` | Design system (shadcn/ui + Tailwind v4, tema e cores de status). |
| `docs/frontend/05` | Historico: plano da agenda com react-big-calendar (descartado). |
| `docs/frontend/06` | Decisoes de interface ja implementadas (confirmacoes, tema, agenda, mobile). |

## Pendencias

- As pendencias anteriores (rotas, estado, mocks, tema, agenda, lint/format) foram resolvidas nos docs 01–06 e no codigo.
- Backend (NestJS), paginacao e escolha de banco seguem adiados (`docs/technical/00`).
