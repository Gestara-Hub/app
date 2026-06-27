# Arquitetura do Frontend (apps/web)

## Decisao

O frontend do GestaraHub e uma aplicacao TanStack Start (v1) com TanStack Router (roteamento file-based, type-safe), escrita em TypeScript strict, com Chakra UI v3 como design system.

O acesso a dados passa sempre por uma cadeia unica: UI/rotas -> hooks de dados (TanStack Query) -> services (async tipados) -> store em memoria (mocks). A UI nunca importa mocks diretamente.

No MVP frontend-first, server functions do TanStack Start NAO sao usadas. Elas ficam reservadas para a fase 3 (backend do zero). Trocar o mock por backend real significa trocar SO a implementacao dos services.

## Contexto

- O MVP valida escopo, fluxos, telas e regras antes de modelar o backend (ver `docs/frontend/00-estrategia-frontend.md`).
- Os dados sao mockados, mas o formato imita um contrato de API HTTP futuro (ver `docs/product/04-mvp-barbearia.md`).
- O store em memoria e seedado a partir do cenario canonico Corte Nobre (`docs/product/08-barbearia-corte-nobre.md`) e e volatil: reinicia a cada reload.
- A organizacao do codigo prioriza isolamento por dominio (feature) para evoluir sem reescrever telas quando o backend chegar.

## Escopo

- Estrutura de pastas de `apps/web`.
- Camadas e fluxo de dados.
- Convencoes de nomeacao e organizacao por feature.
- Limites entre UI, dados, services e mocks.

## Fora de escopo

- Implementacao de telas e componentes especificos (vira em docs proprios por feature).
- Contrato detalhado de cada service e tipo (vira em doc de services/contratos).
- Server functions, SSR data loading via backend real, autenticacao real (fase posterior).
- Configuracao de CI, deploy e infraestrutura.

## Repositorio

Monorepo `gestarahub`. O frontend vive em `apps/web`. Por ora so existe `apps/web`; `apps/api` e `packages/` compartilhados sao futuro.

```text
gestarahub/
├─ apps/
│  └─ web/            # frontend TanStack Start (foco deste doc)
├─ docs/              # especificacao viva (produto, frontend, tecnico)
└─ pnpm-workspace.yaml
```

## Estrutura de pastas de apps/web

A arvore abaixo combina as convencoes do TanStack Start (arquivos de roteamento e entrypoints) com a organizacao por feature do projeto.

```text
apps/web/
├─ src/
│  ├─ routes/                 # rotas file-based (TanStack Router)
│  │  ├─ __root.tsx           # rota raiz: shell, providers, layout base
│  │  ├─ index.tsx            # "/" (redireciona/leva ao dashboard)
│  │  ├─ login.tsx            # "/login" (fora do app shell)
│  │  ├─ dashboard.tsx        # "/dashboard"
│  │  ├─ agenda.tsx           # "/agenda"
│  │  ├─ agendamentos.tsx     # "/agendamentos"
│  │  ├─ clientes.tsx         # "/clientes" (e rotas filhas: clientes.$clienteId.tsx)
│  │  ├─ equipe.tsx           # "/equipe"
│  │  ├─ servicos.tsx         # "/servicos"
│  │  └─ configuracoes.tsx    # "/configuracoes"
│  ├─ routeTree.gen.ts        # GERADO pelo plugin (nao editar manualmente)
│  ├─ router.tsx              # createRouter + registro de tipos do Router
│  ├─ features/               # logica e UI por dominio
│  │  ├─ dashboard/
│  │  ├─ agenda/
│  │  ├─ agendamentos/
│  │  ├─ clientes/
│  │  ├─ equipe/
│  │  ├─ servicos/
│  │  └─ configuracoes/
│  ├─ components/             # UI compartilhada entre features
│  ├─ services/               # camada de dados async tipada (contrato de API)
│  ├─ mocks/                  # store em memoria + seed Corte Nobre
│  ├─ lib/                    # utils, config, helpers, query client
│  ├─ theme/                  # tema Chakra UI v3
│  └─ types/                  # contratos e tipos compartilhados
├─ public/                    # assets estaticos
├─ index.html                 # (se aplicavel ao template Start)
├─ vite.config.ts             # Vite + plugin TanStack Start
├─ tsconfig.json              # TypeScript strict
├─ package.json
└─ .env.example
```

Notas de convencao do TanStack Start (manter conceitual onde a API exata variar entre versoes; conferir doc oficial):

| Item | Convencao | Observacao |
| --- | --- | --- |
| Pasta de rotas | `src/routes/` | Roteamento file-based; cada arquivo vira uma rota. |
| Rota raiz | `src/routes/__root.tsx` | Define shell, providers e `<Outlet />`. |
| Arvore de rotas | `src/routeTree.gen.ts` | Gerada automaticamente; nunca editar. |
| Router | `src/router.tsx` | `createRouter` + `declare module` para type-safety. |
| Entrypoints/server | gerados/ocultos pelo Start no MVP | Server functions e SSR data loading ficam para a fase 3. |
| Config de build | `vite.config.ts` | Plugin do TanStack Start. |

Fontes oficiais (preferir sobre suposicoes de assinatura):

- TanStack Start: https://tanstack.com/start/latest
- TanStack Router (file-based routing): https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing
- Chakra UI v3 + TanStack Router: https://www.chakra-ui.com/docs/get-started/frameworks/tanstack-router

## Camadas e fluxo de dados

A regra central e fluxo unidirecional do acesso a dados. A UI nunca toca o store; sempre passa por hooks e services.

```text
┌─────────────────────────────────────────────────────────────┐
│  src/routes/*  +  src/features/<dominio>/components/*  (UI)    │
│  - renderiza, dispara acoes, le estado de UI                  │
│  - estado de UI local: useState                              │
│  - estado de UI global leve (se preciso): Zustand            │
└───────────────┬─────────────────────────────────────────────┘
                │ usa
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/features/<dominio>/hooks/*  (TanStack Query)             │
│  - useQuery / useMutation                                     │
│  - cache, loading, error, invalidacao                        │
└───────────────┬─────────────────────────────────────────────┘
                │ chama
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/services/*  (async tipado = contrato de API)            │
│  - funcoes Promise<T> tipadas com src/types                  │
│  - hoje: leem/escrevem no store em memoria                   │
│  - amanha: trocam SO a implementacao por fetch HTTP real     │
└───────────────┬─────────────────────────────────────────────┘
                │ acessa
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/mocks/*  (store em memoria + seed)                       │
│  - estado volatil em memoria (reinicia no reload)            │
│  - seedado do cenario Corte Nobre                            │
│  - NUNCA importado pela UI                                   │
└─────────────────────────────────────────────────────────────┘
```

### Responsabilidades por camada

| Camada | Pasta | Responsabilidade | Pode importar |
| --- | --- | --- | --- |
| Rotas | `src/routes/` | Mapear URL -> tela; compor features; layout. | `features/*`, `components/*`, `lib/*` |
| Features (UI) | `src/features/<dominio>/components/` | Telas e componentes do dominio. | hooks da propria feature, `components/*`, `types/*`, `lib/*` |
| Hooks de dados | `src/features/<dominio>/hooks/` | TanStack Query (queries/mutations), cache, invalidacao. | `services/*`, `types/*`, `lib/*` |
| Services | `src/services/` | Funcoes async tipadas; contrato de API. | `mocks/*`, `types/*`, `lib/*` |
| Mocks | `src/mocks/` | Store em memoria + seed Corte Nobre. | `types/*` |
| UI compartilhada | `src/components/` | Componentes genericos reutilizaveis. | `theme/*`, `lib/*`, `types/*` |
| Lib | `src/lib/` | Utils, config, query client, formatadores, datas. | `types/*` |
| Theme | `src/theme/` | Tema Chakra UI v3. | (config Chakra) |
| Types | `src/types/` | Contratos e tipos compartilhados (entidades, enums, DTOs). | (nenhuma camada de runtime) |

### Estado: dados vs UI

| Tipo de estado | Ferramenta | Onde |
| --- | --- | --- |
| Estado de servidor / dados | TanStack Query | hooks por feature |
| Estado de UI local (form aberto, aba ativa, hover) | `useState` | componente |
| Estado de UI global leve (filtro de agenda compartilhado, etc.) | Zustand (so se necessario) | `src/lib/` ou store por feature |

Nao usar Redux. Zustand entra apenas quando um estado de UI precisa ser compartilhado entre rotas/componentes distantes e nao cabe em props nem em URL/search params.

## Regras de fronteira (limites entre camadas)

| Regra | Detalhe |
| --- | --- |
| UI nunca importa `mocks` | Acesso a dados so via hooks -> services. |
| Services sao o unico ponto que toca o store | Trocar mock por API real = mudar so `src/services/*`. |
| Tipos/contratos vivem em `src/types` | Entidades, enums e shapes de request/response. Mocks e services importam de `types`, nunca o contrario. |
| `routeTree.gen.ts` e gerado | Nunca editar a mao. |
| Features nao importam umas das outras diretamente | Compartilhamento sobe para `components/`, `lib/` ou `types/`. |
| Hooks de dados nao chamam o store | So chamam services. |
| Estado de servidor mora no Query, nao em Zustand | Zustand e so para estado de UI. |

## Organizacao por feature

Cada dominio em `src/features/<dominio>/` segue a mesma estrutura interna, mantendo logica e UI coesas e isoladas:

```text
src/features/agendamentos/
├─ components/        # telas e componentes do dominio
│  ├─ ListaAgendamentos.tsx
│  ├─ FormAgendamento.tsx
│  └─ DetalheAgendamento.tsx
├─ hooks/             # TanStack Query do dominio
│  ├─ useAgendamentos.ts
│  └─ useCriarAgendamento.ts
└─ index.ts           # exporta a superficie publica da feature
```

Dominios do MVP (alinhados a navegacao):

| Feature (pasta) | Navegacao | Contexto |
| --- | --- | --- |
| `dashboard` | Dashboard | Resumo operacional do dia. |
| `agenda` | Agenda | Calendario (react-big-calendar), bloqueios, recorrencia. |
| `agendamentos` | Agendamentos | Lista/tabela complementar a agenda. |
| `clientes` | Clientes | Cadastro, busca, historico. |
| `equipe` | Equipe | Profissionais (rotulo "Profissional" no contexto de agendamento). |
| `servicos` | Servicos | Catalogo de servicos. |
| `configuracoes` | Configuracoes | Organizacao, unidade, horario de funcionamento. |

O Login fica fora do app shell (rota `src/routes/login.tsx`), nao e uma feature de dominio operacional.

## Convencoes de nomeacao

| Item | Convencao | Exemplo |
| --- | --- | --- |
| Arquivos de rota | conforme TanStack Router file-based | `agenda.tsx`, `clientes.$clienteId.tsx`, `__root.tsx` |
| Componentes React | PascalCase | `FormAgendamento.tsx` |
| Hooks | camelCase com prefixo `use` | `useAgendamentos.ts` |
| Services | camelCase, sufixo de dominio | `agendamentosService.ts` |
| Tipos/contratos | PascalCase para tipos | `Agendamento`, `StatusAgendamento` |
| Enums (valores) | chaves exatas do canon | `pendente`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`, `nao_compareceu` |
| Pastas de feature | kebab/lowercase singular do dominio em PT | `clientes/`, `equipe/`, `servicos/` |
| Constantes/config | camelCase ou UPPER_SNAKE para constantes | `queryKeys`, `API_BASE_URL` |

Enums do canon (chaves exatas), centralizados em `src/types`:

```ts
type StatusAgendamento =
  | 'pendente'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado'
  | 'nao_compareceu';

type OrigemAgendamento = 'manual' | 'recorrencia'; // futuro: 'online' | 'whatsapp'

type Frequencia = 'semanal' | 'quinzenal' | 'mensal';
```

## Exemplo de fluxo (referencia conceitual)

```ts
// src/types/agendamento.ts  -> contrato
export interface Agendamento {
  id: string;
  clienteId: string;
  profissionalId: string;
  servicoId: string;
  data: string;        // ISO date
  inicio: string;      // HH:mm
  fim: string;         // HH:mm
  status: StatusAgendamento;
  origem: OrigemAgendamento;
  serieId?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

// src/services/agendamentosService.ts -> async tipado (unico que toca o store)
export async function listarAgendamentos(): Promise<Agendamento[]> {
  // hoje: le do store em memoria (src/mocks)
  // amanha: troca SO esta implementacao por fetch HTTP
}

// src/features/agendamentos/hooks/useAgendamentos.ts -> TanStack Query
export function useAgendamentos() {
  return useQuery({
    queryKey: ['agendamentos'],
    queryFn: listarAgendamentos,
  });
}

// src/features/agendamentos/components/ListaAgendamentos.tsx -> UI
// usa useAgendamentos(); NUNCA importa src/mocks.
```

## Alinhamento com produto

- Entidades e campos: `docs/product/04-mvp-barbearia.md`.
- Regras de conflito/disponibilidade/remarcacao/recorrencia (vivem nos services/hooks): `docs/product/05-regras-negocio.md`.
- Seed do store em memoria: `docs/product/08-barbearia-corte-nobre.md`.
- Jornadas que as rotas/features cobrem: `docs/product/09-fluxos-principais.md`.
- Estados vazios, de erro e validacoes (UI): `docs/product/10-estados-e-mensagens.md`.

## Pendencias

- Definir o contrato detalhado de cada service e os tipos em `src/types` (doc proprio).
- Definir a estrutura interna do store em memoria e a estrategia de seed/reset (doc de mocks).
- Definir convencao de `queryKeys` e politica de invalidacao do TanStack Query.
- Confirmar entrypoints/arquivos gerados exatos da versao do TanStack Start adotada no scaffold inicial.
- Decidir se algum estado de UI global (ex.: filtros de agenda) justifica Zustand ou se search params bastam.
- Definir padrao de testes (Vitest + Testing Library) por camada.
