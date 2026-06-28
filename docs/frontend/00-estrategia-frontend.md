# Estrategia Frontend

## Decisao

O desenvolvimento comeca pelo frontend, construido sobre uma camada de servico mockada que imita um contrato de API HTTP. A interface e os fluxos do MVP de barbearia sao validados antes de existir qualquer backend real. Quando o backend chegar (fase 3), so a implementacao dos services muda; hooks, telas e componentes permanecem.

A stack e Next.js 16 (App Router, RSC) com shadcn/ui + Tailwind CSS v4, escolhida por ser madura, estavel e ja dominada pelo time, com layout de referencia refinado em `old/gestarahub-web`. No MVP frontend-first a camada de dados roda inteiramente no cliente (client components + TanStack Query sobre services mockados); Server Components e server actions ficam reservados para a fase de backend.

## Contexto

O produto ainda precisa validar escopo, fluxos, telas, linguagem e regras operacionais. Construir a experiencia primeiro reduz o risco de modelar backend antes de entender a rotina real que a interface precisa suportar.

Projeto do zero: nada do `old/gestarahub-api` sera reaproveitado. O `old/gestarahub-web` (Next + shadcn) serve apenas como referencia visual e de componentes; nao ha "arquitetura atual" do frontend a analisar, tudo e construido novo seguindo esta estrategia.

Os dados, entidades e regras que a interface precisa suportar estao definidos nos docs de produto, que sao a fonte de verdade do dominio:

- `docs/product/04-mvp-barbearia.md` (entidades e campos: Cliente, Profissional, Servico, Agendamento, Bloqueio, SerieRecorrencia, Organizacao, Unidade; status e origem).
- `docs/product/05-regras-negocio.md` (regras de conflito, disponibilidade, remarcacao, recorrencia).
- `docs/product/08-barbearia-corte-nobre.md` (cenario canonico Corte Nobre, fonte do seed).
- `docs/product/09-fluxos-principais.md` (jornadas).
- `docs/product/10-estados-e-mensagens.md` (estados vazios, erros e validacoes).

## Principio central: mocks como contrato de API

- A UI NUNCA acessa mocks direto. O fluxo de dados e sempre:

```
componentes (telas, client components)
  -> hooks (TanStack Query)
    -> services (funcoes async tipadas)
      -> store em memoria (seed Corte Nobre)
```

- O mock imita um contrato de API HTTP: o service retorna `Promise`, pode falhar, tem latencia simulada e tipos estaveis.
- Trocar o mock por backend real significa trocar SO a implementacao dos services. Os tipos do contrato, os hooks e as telas nao mudam.
- O store em memoria e seedado a partir do cenario canonico Corte Nobre (`docs/product/08-barbearia-corte-nobre.md`) e persistido no localStorage do navegador: sobrevive a reloads (reset por versao de seed ou pela acao "Restaurar dados de exemplo" em Configuracoes).

## Stack concreta

| Camada | Decisao | Observacao |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, RSC) | Maduro e estavel. No MVP frontend-first as telas de dados sao client components; RSC/server actions ficam para a fase 3 (backend). |
| Roteamento | App Router (file-based) | Rotas em `src/app`, grupos `(auth)` e `(app)`. Ver `docs/frontend/03`. |
| Linguagem | TypeScript (strict) | Tipos sao o contrato compartilhado entre service, hook e tela. |
| UI / design system | shadcn/ui (style "new-york", base color "neutral", cssVariables) | Componentes em `src/components/ui`, copiados para o repo. Radix por baixo. Ver `docs/frontend/04`. |
| Estilo | Tailwind CSS v4 | Variaveis CSS do tema shadcn em `globals.css`. Cores de status como tokens semanticos. |
| Icones | lucide-react | Padrao do shadcn. |
| Formularios | React Hook Form 7 + Zod 4 (`@hookform/resolvers`, `zodResolver`) | Validacao no submit, revalida no change (`mode: onSubmit`, `reValidateMode: onChange`). Wrappers de campo em `src/components/form`. |
| Estado de servidor / dados | TanStack Query | Sobre a camada de service mockada. Ver `docs/frontend/01` e `02`. |
| Estado de UI local | useState | Estado por componente. |
| Estado de UI global leve | Zustand (se necessario) | Apenas se precisar. NAO usar Redux. |
| Calendario / Agenda | react-big-calendar (free, client component) | DECIDIDO. Suporta colunas por recurso (profissional) no day view sem custo. Ver `docs/frontend/05`. |
| Toasts | sonner | `<Toaster />` no root layout. |
| Datas | date-fns | Formatacao e calculo de datas/horarios. |
| Gerenciador de pacotes | pnpm | Bom para monorepo. |
| Testes | Vitest + Testing Library | Unit/componente. Playwright para e2e em fase posterior. |
| Lint / format | ESLint + Prettier (ou Biome) | Recomendacao refinavel. |

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
- react-big-calendar: https://github.com/jquense/react-big-calendar

## Estrutura de repositorio

Monorepo `gestarahub`. O frontend vive em `apps/web`. Futuro: `apps/api` e `packages/` compartilhados. Por ora so `apps/web`.

```
gestarahub/
  apps/
    web/          # frontend (Next.js App Router). Unico app no MVP.
      src/
        app/          # rotas (App Router): layout, globals.css, (auth), (app)
        components/   # ui (shadcn), layout (Sidebar/Topbar/AppShell), form (wrappers RHF)
        features/     # UI por dominio (components/, hooks/)
        lib/          # utils (cn), queryKeys, format, providers
        services/     # camada de servico mockada (async tipada)
        mocks/        # store em memoria + seed Corte Nobre
        types/        # contratos (entidades, enums, schemas Zod)
  packages/       # futuro: tipos/contratos compartilhados
```

## Navegacao

Itens do app shell: Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes.

- "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de agendamento e em telas de detalhe.
- Login fica fora do app shell, no grupo `(auth)`.
- Guarda de sessao mockada (cookie + `middleware.ts`, ou guarda no `(app)/layout`) protege `(app)/*` e redireciona para `/login`. Como e mock, manter simples. Ver `docs/frontend/03`.

## Enums (chaves exatas)

- StatusAgendamento: `pendente` | `confirmado` | `em_atendimento` | `concluido` | `cancelado` | `nao_compareceu`
- OrigemAgendamento: `manual` | `recorrencia` (futuro: `online`, `whatsapp`)
- Frequencia (recorrencia): `semanal` | `quinzenal` | `mensal`

## Direcao

- Usar dados mockados realistas e coerentes com o cenario canonico Corte Nobre.
- Manter os mocks como contrato futuro de API (tipados, async, com erro e latencia).
- Nunca espalhar dados soltos dentro de componentes; tudo passa por hook -> service.
- Priorizar telas e fluxos do MVP de barbearia.
- Respeitar as regras de negocio (conflito, expediente, bloqueio, recorrencia) ja na camada mockada.
- Codigo em ingles; UI em portugues (acentuado). Os docs seguem portugues SEM acentos (padrao ASCII do repo).

## Mapa dos docs de frontend

| Doc | Tema |
| --- | --- |
| `docs/frontend/00` | Estrategia frontend (este documento). |
| `docs/frontend/01` | Arquitetura: estrutura de pastas (App Router), camadas e fluxo de dados. |
| `docs/frontend/02` | Camada de dados mock: contratos TS, services, TanStack Query e store/seed. |
| `docs/frontend/03` | Rotas e navegacao (Next App Router, grupos `(auth)`/`(app)`, guarda de sessao). |
| `docs/frontend/04` | Design system (shadcn/ui + Tailwind v4, tema e cores de status). |
| `docs/frontend/05` | Calendario / Agenda (react-big-calendar). |

## Pendencias

- Detalhar o padrao de rotas em `docs/frontend/03` (App Router, grupos `(auth)`/`(app)`, app shell, guarda de sessao mockada via cookie/middleware).
- Detalhar o padrao de estado e a divisao service/hook em `docs/frontend/01`.
- Detalhar a organizacao de mocks e o seed em memoria em `docs/frontend/02`.
- Detalhar o tema shadcn/Tailwind v4 e os wrappers de formulario RHF/Zod em `docs/frontend/04`.
- Detalhar a integracao do react-big-calendar (resource view por profissional, bloqueios destacados) em `docs/frontend/05`.
- Confirmar a escolha final entre Prettier e Biome para lint/format.
</content>
</invoke>
