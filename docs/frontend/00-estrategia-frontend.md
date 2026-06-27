# Estrategia Frontend

## Decisao

O desenvolvimento comeca pelo frontend, construido sobre uma camada de servico mockada que imita um contrato de API HTTP. A interface e os fluxos do MVP de barbearia sao validados antes de existir qualquer backend real. Quando o backend chegar (fase 3), so a implementacao dos services muda; hooks, telas e componentes permanecem.

## Contexto

O produto ainda precisa validar escopo, fluxos, telas, linguagem e regras operacionais. Construir a experiencia primeiro reduz o risco de modelar backend antes de entender a rotina real que a interface precisa suportar.

Projeto do zero: nada do `old/` (gestarahub-web, gestarahub-api) sera reaproveitado. Nao ha "arquitetura atual" do frontend a analisar; tudo e novo.

Os dados, entidades e regras que a interface precisa suportar estao definidos nos docs de produto, que sao a fonte de verdade do dominio:

- `docs/product/04-mvp-barbearia.md` (entidades e campos: Cliente, Profissional, Servico, Agendamento, Bloqueio, SerieRecorrencia, Organizacao, Unidade; status e origem).
- `docs/product/05-regras-negocio.md` (regras de conflito, disponibilidade, remarcacao, recorrencia).
- `docs/product/08-barbearia-corte-nobre.md` (cenario canonico Corte Nobre, fonte do seed).
- `docs/product/09-fluxos-principais.md` (jornadas).
- `docs/product/10-estados-e-mensagens.md` (estados vazios, erros e validacoes).

## Principio central: mocks como contrato de API

- A UI NUNCA acessa mocks direto. O fluxo de dados e sempre:

```
componentes (telas)
  -> hooks (TanStack Query)
    -> services (funcoes async tipadas)
      -> store em memoria (seed Corte Nobre)
```

- O mock imita um contrato de API HTTP: o service retorna `Promise`, pode falhar, tem latencia simulada e tipos estaveis.
- Trocar o mock por backend real significa trocar SO a implementacao dos services. Os tipos do contrato, os hooks e as telas nao mudam.
- O store em memoria e seedado a partir do cenario canonico Corte Nobre (`docs/product/08-barbearia-corte-nobre.md`). No MVP ele e volatil: reinicia a cada reload.

## Stack concreta

| Camada | Decisao | Observacao |
| --- | --- | --- |
| Framework | TanStack Start v1.0 | Production-ready (mar/2026). SSR disponivel. No MVP frontend-first, server functions NAO sao usadas; ficam reservadas para a fase 3 (backend do zero). |
| Roteamento | TanStack Router | File-based, type-safe. Ver `docs/frontend/03`. |
| Linguagem | TypeScript (strict) | Tipos sao o contrato compartilhado entre service, hook e tela. |
| UI / design system | Chakra UI v3 | Usa CSS variables, SSR-friendly (resolveu os problemas de SSR da v2). Existe guia oficial de integracao com TanStack Router. |
| Estado de servidor / dados | TanStack Query | Sobre a camada de service mockada. Ver `docs/frontend/01`. |
| Estado de UI local | useState | Estado por componente. |
| Estado de UI global leve | Zustand (se necessario) | Apenas se precisar. NAO usar Redux. |
| Calendario / Agenda | react-big-calendar (free) | DECIDIDO. Suporta colunas por recurso (profissional) no day view sem custo. Ver `docs/frontend/05`. |
| Build / bundler | Vite | Base do TanStack Start. |
| Gerenciador de pacotes | pnpm | Bom para monorepo. |
| Testes | Vitest + Testing Library | Unit/componente. Playwright para e2e em fase posterior. |
| Lint / format | ESLint + Prettier (ou Biome) | Recomendacao refinavel. |

Onde a API exata de uma lib for incerta, manter o doc conceitual e citar a doc oficial em vez de inventar assinaturas:

- TanStack Start: https://tanstack.com/start
- TanStack Router: https://tanstack.com/router
- TanStack Query: https://tanstack.com/query
- Chakra UI v3: https://www.chakra-ui.com
- react-big-calendar: https://github.com/jquense/react-big-calendar

## Estrutura de repositorio

Monorepo `gestarahub`. O frontend vive em `apps/web`. Futuro: `apps/api` e `packages/` compartilhados. Por ora so `apps/web`.

```
gestarahub/
  apps/
    web/          # frontend (TanStack Start). Unico app no MVP.
  packages/       # futuro: tipos/contratos compartilhados
```

## Navegacao

Itens do app shell: Dashboard, Agenda, Agendamentos, Clientes, Equipe, Servicos, Configuracoes.

- "Equipe" e o rotulo da navegacao; "Profissional" e usado no contexto de agendamento e em telas de detalhe.
- Login fica fora do app shell.

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

## Mapa dos docs de frontend

| Doc | Tema |
| --- | --- |
| `docs/frontend/00` | Estrategia frontend (este documento). |
| `docs/frontend/01` | Arquitetura: estrutura de pastas, camadas e fluxo de dados. |
| `docs/frontend/02` | Camada de dados mock: contratos TS, services, TanStack Query e store/seed. |
| `docs/frontend/03` | Rotas e navegacao (TanStack Router, file-based). |
| `docs/frontend/04` | Design system (Chakra UI v3, tema e cores de status). |
| `docs/frontend/05` | Calendario / Agenda (react-big-calendar). |

## Pendencias

- Detalhar o padrao de rotas em `docs/frontend/03` (estrutura file-based, layout do app shell, login fora do shell).
- Detalhar o padrao de estado e a divisao service/hook em `docs/frontend/01`.
- Detalhar a organizacao de mocks e o seed em memoria em `docs/frontend/02`.
- Detalhar a integracao do react-big-calendar (resource view por profissional, bloqueios destacados) em `docs/frontend/05`.
- Confirmar a escolha final entre Prettier e Biome para lint/format.
