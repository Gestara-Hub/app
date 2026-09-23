# Multi-tenant, modelo operacional e escopo do tenant

> Decisões já implementadas. A multiunidade continua adiada para a Fase 5 do roadmap ([`../product/07-roadmap.md`](../product/07-roadmap.md)).

## Decisao

1. **Mundo multi-tenant no mock.** `apps/web/src/mocks/store.ts` guarda um `MockWorld` com `tenants: Record<organizationId, MockStore>` e `activeOrganizationId`. O `store` exportado é um Proxy para o tenant ativo, então os services continuam escrevendo `store.clients`. O seed cria dois tenants vazios, só com o proprietário: **Corte Nobre** (`scheduling`, Marcelo Andrade) e **Academia X** (`classes`, Ana Ribeiro).
2. **Um modelo operacional por tenant** (`Organization.model`: `scheduling` | `classes` | `delivery`). A navegação (`components/layout/nav.ts`: `navForModel`, `canAccessRoute`), o dashboard e os textos mudam conforme o modelo. `delivery` está tipado, sem telas.
3. **Termos por modelo.** Na academia, cliente é "aluno" e categoria é "modalidade" (`services/nouns.ts`, `lib/labels.ts` `auditEntityTypeLabel(type, model)`).
4. **Escopo do tenant é carimbado pelo servidor.** Os contratos `Create*` omitem `organizationId`/`unitId` (`TenantScopeFields` em `packages/contracts/src/common.ts`); os services sempre usam o tenant ativo da sessão. Nenhuma feature importa `@/config/tenant` (só o seed).
5. **Unidade única por enquanto.** `store.unit` é singleton. Já têm `unitId`: turma, profissional, agendamento, bloqueio, série, auditoria e **mensalidade** (`Charge.unitId`: mensalidade = unidade ativa; aula avulsa = unidade da turma).
6. **Sessão:** cookie `gestarahub_session` com o `UserView` em base64 (`lib/session.ts`), guarda em `src/proxy.ts` (Next 16), login e troca de usuário por server actions (`app/(auth)/actions.ts`). Trocar de usuário troca de organização.

## Contexto

A academia virou o MVP ativo enquanto a barbearia seguia como referência. Rodar os dois modelos lado a lado exigiu isolamento real de dados. Os ids de organização e unidade fixos nos formulários funcionavam por coincidência (só havia um tenant de agenda) e quebrariam com um segundo tenant ou uma segunda unidade.

## Escopo

- Mock: `mocks/store.ts` (`setActiveOrganization`, `resetStore`, `SEED_VERSION`), `mocks/seed.ts`.
- Contratos: `common.ts` (`TenantScopeFields`), `organization.ts` (`OperationalModel`, `OrganizationSettings`).
- Testes: `apps/web/src/services/__tests__/tenant.test.ts`.

## Alternativas

- **Um tenant fixo com troca de "segmento" só de rótulo:** rejeitado; os modelos divergem no núcleo (ver [`01-extensao-modelos-operacionais.md`](01-extensao-modelos-operacionais.md)).
- **Preparar multiunidade agora (lista de unidades, seletor, filtro):** rejeitado; parte disso é do mock descartável e parte depende de decisões de produto (aluno, plano e usuário por unidade?). Fica para a Fase 5, com o backend.
- **Cliente enviar organização/unidade:** rejeitado; a API real deriva do usuário logado.
