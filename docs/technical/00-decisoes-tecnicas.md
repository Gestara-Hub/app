# Decisoes Tecnicas

## Decisao

O GestaraHub e construido do zero, com abordagem frontend-first e dados mockados, sobre uma stack TypeScript moderna baseada em TanStack Start. O backend real fica adiado para a fase 3; ate la, toda a aplicacao roda no frontend, consumindo uma camada de servico mockada que imita um contrato de API HTTP.

Nada do projeto anterior (old gestarahub-web e gestarahub-api) sera reaproveitado. Este documento e a fonte de verdade das escolhas tecnicas; decisoes marcadas como "refinavel" podem ser revistas sem reabrir a discussao das demais.

## Contexto

O produto precisa validar escopo, telas, fluxos e regras operacionais antes de modelar um backend definitivo (ver `docs/frontend/00-estrategia-frontend.md` e `docs/product/04-mvp-barbearia.md`). Por isso a UI e desenvolvida primeiro, contra mocks que ja se parecem com a futura API. Quando o backend chegar, trocamos apenas a implementacao da camada de servico, sem reescrever telas.

## Escopo

- Stack tecnica e justificativa de cada item.
- Estrutura de repositorio (monorepo).
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
| Framework | TanStack Start (v1.0, mar/2026, production-ready) | Full-stack React sobre Vite, com SSR e server functions disponiveis. No MVP usamos so o lado cliente; o caminho para o backend (fase 3) ja fica preparado sem trocar de framework. |
| Roteamento | TanStack Router (file-based, type-safe) | Rotas tipadas de ponta a ponta, params e search params validados, integrado ao TanStack Start. |
| Linguagem | TypeScript (modo strict) | Seguranca de tipos em todo o codigo; os mocks viram contratos tipados reutilizaveis pelo backend futuro. |
| UI / design system | Chakra UI v3 | Usa CSS variables e e SSR-friendly (resolveu os problemas de SSR da v2). Tem guia oficial de integracao com TanStack Router. |
| Estado de servidor / dados | TanStack Query | Cache, loading/erro, invalidacao e refetch padronizados. Consome a camada de servico mockada como se fosse uma API real. |
| Estado de UI local | useState | Estado simples vive no componente. |
| Estado de UI global leve | Zustand (se necessario) | Para estado de UI compartilhado (ex.: filtros, preferencias). NAO usar Redux. So introduzir quando houver necessidade real. |
| Calendario / Agenda | react-big-calendar (free) | Suporta colunas por recurso (profissional) no day view sem custo. NAO usar Schedule-X (resource view paga) nem FullCalendar (resource pago). |
| Build / bundler | Vite | Base do TanStack Start; dev server rapido e build otimizado. |
| Gerenciador de pacotes | pnpm (refinavel) | Bom para monorepo (workspaces, store unico, instalacao rapida). |
| Testes unit/componente | Vitest + Testing Library | Integra com Vite; testes rapidos focados em comportamento de componentes e logica. |
| Testes e2e | Playwright (fase posterior) | E2e dos fluxos principais quando a aplicacao amadurecer. |
| Lint / format | ESLint + Prettier OU Biome (refinavel) | Padronizacao de estilo e qualidade. A escolha entre o par ESLint+Prettier e o Biome (tudo-em-um, mais rapido) fica em aberto. |

### Notas sobre a stack

- SSR esta disponivel no TanStack Start, mas no MVP frontend-first nao e um requisito; o foco e a experiencia interativa contra mocks.
- Server functions do TanStack Start NAO sao usadas no MVP. Ficam reservadas para a fase 3, quando o backend for construido.
- Onde a API exata de uma lib for incerta, consultar a doc oficial antes de codificar (ex.: integracao Chakra UI v3 + TanStack Router, configuracao de resource view do react-big-calendar).

## Estrutura de repositorio

Monorepo unico em `gestarahub/app`. No momento existe apenas o frontend; `apps/api` e `packages/` sao previsao para fases futuras.

```text
gestarahub/app
  apps/
    web/                # frontend (TanStack Start) - unico app no MVP
    api/                # FUTURO (fase 3): backend do zero
  packages/             # FUTURO: codigo compartilhado (tipos, contratos, utils)
  pnpm-workspace.yaml   # workspaces do monorepo
  package.json          # scripts e deps na raiz
```

- No MVP, todo o desenvolvimento acontece em `apps/web`.
- `packages/` surgira quando houver codigo a compartilhar entre `apps/web` e `apps/api` (ex.: tipos de entidade e contratos de servico).
- O monorepo evita reescrita: os contratos tipados nascidos nos mocks podem migrar para `packages/` e ser consumidos pelo backend.

### Organizacao interna de apps/web (por feature)

A organizacao e por feature (dominio), nao por tipo de arquivo. Cada feature agrupa suas telas, componentes, hooks e services.

```text
apps/web/src
  routes/               # rotas file-based do TanStack Router
  features/
    agenda/
    agendamentos/
    clientes/
    equipe/
    servicos/
    dashboard/
    configuracoes/
  components/            # componentes de UI compartilhados (design system local)
  services/             # camada de servico mockada (contrato de API)
  lib/                  # utils, setup de query client, theme Chakra, etc.
  mocks/                # store em memoria e seed (ver doc de frontend 02)
```

A divisao final de pastas dentro de cada feature e detalhada nos docs de frontend.

## Convencoes

- TypeScript em modo strict em todo o repositorio; evitar `any`, preferir tipos derivados dos contratos.
- Organizacao por feature/dominio (ver arvore acima). Codigo realmente generico vai para `components/`, `lib/` ou, no futuro, `packages/`.
- Path aliases (ex.: `@/features/...`, `@/services/...`, `@/lib/...`) para imports limpos e estaveis, configurados no `tsconfig` e no Vite. Os aliases exatos serao fixados no setup do `apps/web`.
- Nomenclatura de codigo em ingles segue o padrao das libs; os ENUMS de dominio usam as chaves canonicas em portugues definidas pelo produto (ver secao de enums).
- Lint/format: ESLint + Prettier OU Biome (refinavel). Decidir um e aplicar consistentemente no `apps/web`.
- Gerenciador de pacotes: pnpm (refinavel), com workspaces na raiz do monorepo.

### Navegacao (itens canonicos)

Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes.

- "Equipe" e o rotulo da navegacao; "Profissional" e o termo usado no contexto de agendamento e nas telas de detalhe.
- Login fica fora do app shell (tela separada, sessao mockada).

### Enums (chaves exatas)

```ts
type StatusAgendamento =
  | "pendente"
  | "confirmado"
  | "em_atendimento"
  | "concluido"
  | "cancelado"
  | "nao_compareceu";

type OrigemAgendamento = "manual" | "recorrencia"; // futuro: "online" | "whatsapp"

type Frequencia = "semanal" | "quinzenal" | "mensal";
```

## Testes

- Unit e componente: Vitest + Testing Library. Foco em comportamento (renderizacao, interacao, estados de loading/erro/vazio) e em logica pura (regras de conflito, disponibilidade, geracao de recorrencia).
- E2e: Playwright em fase posterior, cobrindo os fluxos principais (ver `docs/product/09-fluxos-principais.md`) sobre os mocks.
- As regras de negocio (`docs/product/05-regras-negocio.md`) sao alvo prioritario de testes, pois sao estaveis e independem de backend.

## Mocks como contrato de API (principio central)

- A UI nunca acessa mocks diretamente. O fluxo e sempre: hooks (TanStack Query) -> services (funcoes async tipadas) -> store em memoria.
- O service imita um contrato de API HTTP (mesma forma de chamada, mesmos tipos de entrada e saida, mesmos erros).
- Trocar o mock por backend real significa trocar SO a implementacao do service; hooks e telas permanecem iguais.
- O store em memoria e seedado a partir do cenario canonico Corte Nobre (`docs/product/08-barbearia-corte-nobre.md`). E volatil no MVP: reinicia a cada reload da pagina.

O detalhamento desta camada (estrutura de services, store, seed, simulacao de latencia e erro) esta em `docs/frontend/02-camada-de-dados-mock.md`.

## Backend (fase 3)

- O backend sera construido do zero na fase 3, sem reaproveitar nada do projeto antigo.
- Caminho provavel: server functions do TanStack Start (e/ou um `apps/api` dedicado), reaproveitando os contratos tipados ja definidos pelos mocks.
- Ate la, nenhuma server function e usada; persistencia e autenticacao continuam mockadas e volateis.

## Referencias

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
- Definir os path aliases exatos no `tsconfig` e no Vite.
- Confirmar na doc oficial os detalhes de integracao Chakra UI v3 + TanStack Router e de resource view do react-big-calendar antes de codificar.
- Completar os docs de frontend 01 a 05 referenciados acima.
