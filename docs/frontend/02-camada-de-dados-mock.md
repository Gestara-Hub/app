# Camada de Dados Mock

## Decisao

A UI nunca acessa mocks diretamente. O acesso a dados acontece sempre por uma cadeia bem definida:

```
UI (componentes/telas)
  -> hooks (TanStack Query: useQuery / useMutation)
    -> services (modulos async tipados, um por dominio)
      -> store em memoria (mundo multi-tenant, persistido no localStorage)
```

O mock imita um contrato de API HTTP. Toda funcao de service e assincrona (retorna `Promise`), com latencia simulada e erro simulado opcional. Trocar o mock por um backend real significa trocar SO a implementacao do service (o corpo das funcoes), mantendo a mesma assinatura, os mesmos tipos de retorno e o mesmo formato de erro. Hooks, queryKeys, telas e contratos nao mudam.

Esta e a doc-ponte entre `docs/product` e o codigo. Os detalhes que mudam com frequencia (campos de cada entidade, metodos de cada service) vivem no proprio codigo; aqui ficam a forma e as regras da camada.

## Contexto

- Stack: Next.js (App Router) + TypeScript strict, TanStack Query sobre camada de servico mockada. Detalhes em `technical/00-decisoes-tecnicas.md`.
- TanStack Query e os services rodam no cliente (`'use client'`). O "backend" e a camada de service mockada que vive na memoria do browser.
- O mundo mock e multi-tenant (um store por organizacao) e persistido no localStorage. O modelo de tenant e escopo esta em [`../technical/03-multi-tenant-e-escopo.md`](../technical/03-multi-tenant-e-escopo.md); o motor de cobranca que os services usam esta em [`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md).
- Estados de carregando/vazio/erro e mensagens seguem `docs/product/10-estados-e-mensagens.md`.

## Escopo

- Contratos TypeScript (`packages/contracts`).
- Camada de servico: um modulo por dominio, com funcoes async tipadas e acoes especificas.
- Store multi-tenant, seed, versao e reset.
- Convencao de queryKeys, useQuery/useMutation e invalidacao.
- Mapeamento dos estados de Query aos estados do doc 10.
- Como o service mock valida regras de negocio.

## Fora de escopo

- Backend real, persistencia real e camada de API (fase 3).
- Implementacao de telas e componentes (ver demais docs de frontend).
- Validacao de formulario na UI (React Hook Form + Zod, ver `frontend/04`).
- Roteamento (ver `frontend/03-rotas-e-navegacao.md`).

## Principio: mock como contrato de API

- O service e o unico ponto que conhece o mock. Para a UI, ele e indistinguivel de um cliente HTTP.
- Cada funcao de service:
  - e async e retorna uma `Promise` tipada;
  - simula latencia (`mockConfig.latencyMs`);
  - rejeita sempre com o mesmo formato de erro (`ApiError`);
  - recebe e devolve apenas tipos de contrato (entidades ou read-models `*View`), nunca referencias internas do store (os services devolvem copias).
- Migracao para backend real: substituir o corpo das funcoes por chamadas HTTP. A assinatura publica do service e o `ApiError` permanecem identicos.

## Contratos (TypeScript)

Os contratos vivem em `packages/contracts/src/*.ts` (pacote `@gestarahub/contracts`), em ingles, um arquivo por dominio:

| Arquivo | Conteudo principal |
| --- | --- |
| `common.ts` | `Id`, `DateISO`, `TimeISO`, `DateTimeISO`, `RecordStatus`, `Address`, `AppointmentStatus`, `AppointmentOrigin`, `Frequency`, `Weekday`, `WorkingHours`, `SeriesScope`, `ApiError`, `isApiError`, `TenantScopeFields` |
| `organization.ts` | `Organization`, `OperationalModel`, `OrganizationSettings` (regra padrao de cobranca), `Unit`, `BusinessHoursDay` |
| `client.ts` | `Client` (aluno na academia), `CreateClient`, `CreateClientInitialCharge`, `ClientFilter` |
| `professional.ts`, `role.ts`, `user.ts`, `permission.ts` | Equipe, cargos, usuarios e RBAC |
| `service.ts`, `category.ts` | Catalogo de servicos (`priceCents`, `categoryId`) e categorias/modalidades |
| `appointment.ts`, `time-block.ts`, `recurrence-series.ts` | Agenda (Modelo 1) |
| `class.ts` | Modelo 3: `ClassGroup`, `Enrollment`, `ClassSession`, `Attendance`, `WaitlistEntry`, `ClassReservation` |
| `billing.ts` | `Plan`, `PlanPeriod`, `Charge`, `ChargeKind`, `ChargeStatus`, `PaymentMethod`, `ChargeView` |
| `audit-log.ts` | `AuditLogEntry`, filtros e atores |

Convencoes:

- `Create*` omite `id`, timestamps e `TenantScopeFields` (`organizationId`/`unitId`): o escopo do tenant e carimbado pelo service, nunca vem do cliente.
- `Update*` = `Partial<Create*>`. Filtros = `*Filter`. Read-models de leitura = `*View` (ex.: `AppointmentView`, `ChargeView`).
- Valores monetarios em centavos (`priceCents`, `amountCents`, `sessionPriceCents`).

### Formato de erro simulado

Copiado de `packages/contracts/src/common.ts`:

```ts
export type ApiErrorCode =
  // Infra simulada
  | "NETWORK"
  | "NOT_FOUND"
  | "VALIDATION"
  // Regras de negocio (agenda)
  | "OVERLAP_CONFLICT"
  | "OUTSIDE_BUSINESS_HOURS"
  | "OUTSIDE_PROFESSIONAL_HOURS"
  | "ON_BREAK"
  | "TIME_BLOCKED"
  | "PROFESSIONAL_DOES_NOT_OFFER_SERVICE"
  | "PROFESSIONAL_INACTIVE"
  | "SERVICE_INACTIVE"
  // Regras de negocio (turmas — Modelo 3)
  | "CLASS_FULL"
  | "CLASS_SCHEDULE_CONFLICT";

export interface ApiErrorField {
  field: string;   // ex.: 'name', 'priceCents'
  message: string; // texto em PT, visto pelo usuario
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;           // mensagem amigavel em PT
  fields?: ApiErrorField[];  // erros por campo (validacao)
  httpStatus?: number;       // 400 | 404 | 409 | 422 | 500
}
```

Fabricas em `apps/web/src/mocks/helpers.ts`: `apiError`, `networkError`, `notFoundError`, `validationError`. Leitura do erro na UI: `getErrorMessage`/`getFieldErrors` (`@gestarahub/core/api-error`) e `handleFormApiError` (`src/lib/form-errors.ts`).

## Store em memoria

Arquivo: `apps/web/src/mocks/store.ts`.

```ts
export interface MockStore {
  organization: Organization;
  unit: Unit;
  clients: Client[];
  professionals: Professional[];
  users: User[];
  roles: Role[];
  categories: Category[];
  services: Service[];
  appointments: Appointment[];
  timeBlocks: TimeBlock[];
  series: RecurrenceSeries[];
  auditLog: AuditLogEntry[];
  // Modelo 3
  classGroups: ClassGroup[];
  enrollments: Enrollment[];
  attendances: Attendance[];
  plans: Plan[];
  charges: Charge[];
  waitlist: WaitlistEntry[];
  reservations: ClassReservation[];
  sessionOverrides?: ClassSessionOverride[];
}

export interface MockWorld {
  tenants: Record<Id, MockStore>;
  activeOrganizationId: Id;
}
```

- O `store` exportado e um **Proxy** para o tenant ativo: os services escrevem `store.clients` sem filtrar por organizacao, e dois tenants nunca vazam dados. `setActiveOrganization` (chamado pelo `SessionProvider`) troca o tenant; `allTenants()` so e usado por `usersService.listForSwitch` (login/troca de usuario demo).
- Sessoes de turma nao sao armazenadas: sao geradas dos `meetingSlots`; so presenca, overrides e reservas sao persistidos.
- **Seed** (`mocks/seed.ts`, `createInitialWorld`): dois tenants vazios, so com organizacao, unidade e proprietario: Corte Nobre (`scheduling`, `org-corte-nobre`) e Academia X (`classes`, `org-academia-x`).
- **Persistencia:** chave `gestarahub:db`, blob `{ v, data }`. Hidrata na 1a carga do modulo no browser e regrava a cada escrita (`simulateWrite` -> `persist()`). No SSR/Node e no-op.
- **Versao:** `SEED_VERSION = 21`. Blobs com `v < 20` sao descartados e re-seedados; blobs `v20` passam por `migrateWorld` (v21: endereco estruturado, vencimento e status de matricula no aluno), sem perder dados.
- **Reset:** `resetStore()` recria o mundo e faz `localStorage.clear()`. Na UI, o card "Zerar mocks" em Configuracoes (`features/system`, via `services/system.ts`).

## Camada de servico

Um modulo por dominio em `apps/web/src/services/`, exportando um objeto (`export const xService = { ... }`). Os cadastros seguem a forma CRUD `list(filter?)`, `getById(id)`, `create(payload)`, `update(id, payload)`, `remove(id)`.

| Service | Metodos alem do CRUD / observacoes |
| --- | --- |
| `clientsService` | Na academia, `create` pode gerar a 1a cobranca (`CreateClientInitialCharge`) pelo motor. |
| `professionalsService`, `rolesService`, `categoriesService`, `servicesService` | CRUD. |
| `usersService` | `listForSwitch()` (cross-tenant, para a troca de usuario demo). |
| `appointmentsService` | `list`, `getById`, `create`, `update`, `reschedule`, `rescheduleSeriesFuture`, `setStatus`, `cancel`, `markNoShow`. |
| `timeBlocksService` | `list`, `create`, `update`, `remove`. |
| `recurrenceService` | `create(payload)` -> `{ series, createdCount, conflicts }`. Escopo de serie: `SeriesScope = "only_this" \| "this_and_future"`. |
| `turmasService` | Turmas (`list`, `create`, `update`, `deactivate`, `reactivate`), matriculas (`enroll`, `cancelEnrollment`), sessoes e presenca (`listSessions`, `getSession`, `markAttendance`, `getAttendanceSummary`), instrutor substituto, lista de espera, reservas avulsas (`reserveSession`, `cancelReservation`). |
| `billingService` | Planos (`listPlans`, `createPlan`, `updatePlan`) e cobrancas (`listCharges`, `generateCharges`, `markPaid`, `markPending`, `cancelCharge`, `reopenCharge`, `clearCharges`). Helpers sincronos `studentMembershipTerms`, `cancelOpenMembershipCharges`. |
| `settingsService` | `getOrganization`, `getUnit`, `updateOrganization`, `updateUnit`. |
| `auditLogService` | `record(input)` (chamado pelos outros services em cada mutacao, com o ator de `mocks/currentActor.ts`) e `list(filter)`. |

A lista exata de metodos e assinaturas e a do codigo; ao evoluir, siga a skill `web-data` (`.claude/skills/web-data`).

### Latencia e erro simulados

```ts
// apps/web/src/mocks/config.ts
export const mockConfig: MockConfig = {
  latencyMs: 350,     // aplicado em toda chamada
  readErrorRate: 0,   // probabilidade de ApiError NETWORK nas leituras
  persistence: true,  // espelhar no localStorage (desligado nos testes)
};
```

- `simulateRead(produce)`: espera `latencyMs` e, se `readErrorRate > 0`, pode rejeitar com `NETWORK`.
- `simulateWrite(produce)`: espera `latencyMs`, executa a mutacao (as regras lancam `ApiError`) e chama `persist()`.
- Erros de negocio e validacao nao sao aleatorios: vem das regras.

## Regras de negocio no service

O service mock aplica as regras exatamente onde o backend real aplicaria. A UI ja lida hoje com os mesmos erros que recebera amanha.

### Escopo do tenant

Toda escrita carimba `organizationId`/`unitId` a partir do tenant ativo (`store.organization.id`, `store.unit.id`). Ver `technical/03`.

### Validacao de campos

Payload invalido rejeita com `VALIDATION` e `fields[]` preenchido (mensagens em PT). A validacao Zod da UI e independente; o service continua sendo a fonte de verdade.

### Agendamento (create, update, reschedule)

Ordem em `appointmentsService` (primeira que falha rejeita):

1. Campos obrigatorios (`clientId`, `professionalId`, `serviceIds`, `date`, `start`) -> `VALIDATION`.
2. Profissional ativo -> `PROFESSIONAL_INACTIVE`; servicos ativos -> `SERVICE_INACTIVE`. (A associacao profissional x servico e informativa na agenda; `PROFESSIONAL_DOES_NOT_OFFER_SERVICE` so e usado por `recurrenceService`.)
3. `end` = `start` + soma das duracoes dos servicos.
4. `checkSlotAvailability` (`@gestarahub/core/scheduling`): `OUTSIDE_BUSINESS_HOURS`, `OUTSIDE_PROFESSIONAL_HOURS`, `ON_BREAK`, `TIME_BLOCKED`, `OVERLAP_CONFLICT`.

Regras moles (a UI confirma e reenvia com override): `allowOutsideHours` (horario do profissional), `allowBreak` (almoco) e `allowOutsideBusinessHours` (expediente, override administrativo). Bloqueio e sobreposicao nunca sao pulados.

`reschedule` preserva cliente e servicos, recalcula `end`, ignora o proprio agendamento na sobreposicao e registra o rastro em `rescheduledFrom[]`. `rescheduleSeriesFuture` aplica a mudanca a esta e as futuras ocorrencias, pulando as em conflito (`conflicts[]`).

### Recorrencia

`recurrenceService.create` gera ocorrencias finitas; as validas sao criadas com `origin: "recurrence"`, as em conflito voltam em `conflicts[]` para resolucao manual.

### Turmas e cobranca (Modelo 3)

- Lotacao e regra mole: `enroll` lanca `CLASS_FULL` e a UI confirma e reenvia com `allowOverCapacity`. Aluno ja matriculado em outra turma no mesmo horario -> `CLASS_SCHEDULE_CONFLICT`.
- Cobrancas: calculo sempre pelo motor `@gestarahub/core/billing`; status "atrasado" derivado na leitura (`effectiveStatus`). Ver `technical/02` e `product/15`.

## TanStack Query

A UI consome os services apenas via hooks em `src/features/<dominio>/hooks/use-*.ts` (`'use client'`). O `QueryClientProvider` e montado em `src/lib/providers.tsx`, com o `QueryClient` criado dentro do componente (`useState`), `staleTime: 30_000` e `retry: false`.

### Convencao de queryKeys

Arquivo real: `apps/web/src/lib/queryKeys.ts`. Hierarquia: `[entity]`, `[entity, "list", filter]`, `[entity, "detail", id]`.

```ts
queryKeys.clients.list(filter)            // ["clients", "list", filter]
queryKeys.appointments.occurrences(id)    // ["appointments", "series", id]
queryKeys.audit.list(filter, viewer)      // perfil do espectador entra na key
queryKeys.classes.sessions({ classGroupId, dateFrom, dateTo })
queryKeys.classes.waitlist(classGroupId)
queryKeys.billing.plans(filter)
queryKeys.billing.charges(filter)
```

Namespaces existentes: `clients`, `professionals`, `users`, `services`, `categories`, `roles`, `appointments`, `timeBlocks`, `series`, `audit`, `classes`, `billing`, `organization`, `unit`.

### useQuery e useMutation

```ts
// features/appointments/hooks/use-appointments.ts
export function useAppointments(filter?: AppointmentFilter) {
  return useQuery({
    queryKey: queryKeys.appointments.list(filter),
    queryFn: () => appointmentsService.list(filter),
  });
}

// features/turmas/hooks/use-billing.ts (useMarkChargePaid)
return useMutation({
  mutationFn: (vars) => billingService.markPaid(/* ... */),
  onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.billing.all }),
});
```

Toda mutation invalida o namespace afetado no `onSuccess` (ex.: `queryKeys.billing.all`, `queryKeys.classes.all`, `queryKeys.appointments.all`). Mutations que afetam mais de um dominio invalidam todos eles.

### Mapeamento de estados (Query -> doc 10)

| Estado da Query | Estado do doc 10 | O que a UI mostra |
| --- | --- | --- |
| `isPending` (sem dados em cache) | Carregando | Skeleton/spinner; nao renderizar "vazio". |
| `isError` (`ApiError` `NETWORK`) | Erro simulado | Mensagem de erro + "Tentar novamente" (`refetch`). |
| `isSuccess` e vazio, sem filtro/busca | Vazio (sem dados) | Empty state com call-to-action (`ListEmptyState`, `ModuleEmptyGuide`). |
| `isSuccess` e vazio, com filtro/busca | Vazio por filtro/busca | "Nenhum resultado..." + limpar filtros. |
| `isSuccess` com dados | Com dados | Lista preenchida. |

- "Vazio por filtro/busca" e derivado na UI; o service nao distingue os dois vazios.
- Erros de negocio de mutations alimentam mensagens perto do campo (`handleFormApiError`) ou um dialogo de confirmacao (regras moles).

## Estrutura de arquivos

```
packages/contracts/src/   # contratos (ver tabela acima)
packages/core/src/        # scheduling.ts, billing.ts, date.ts, format.ts, api-error.ts
apps/web/src/
  mocks/
    store.ts          # MockWorld, Proxy `store`, persistencia, SEED_VERSION, resetStore
    seed.ts           # createInitialWorld (2 tenants vazios)
    config.ts         # mockConfig
    helpers.ts        # simulateRead/Write, apiError & cia, newId, nowIso
    currentActor.ts   # ator ambiente da auditoria
  services/           # *Service.ts, nouns.ts, system.ts, index.ts, __tests__/
  features/<dominio>/hooks/   # use-*.ts (TanStack Query)
  lib/
    providers.tsx     # QueryClientProvider + ThemeProvider
    queryKeys.ts
```

Separacao logica: contratos -> store/seed -> services -> hooks -> UI. A regra de fronteira (so services tocam o store, com as excecoes de sessao) esta em `frontend/01-arquitetura.md`.

## Pendencias

- Resolvidas: seed e data de referencia (seed vazio; testes fixam a data em 22/09/2026, ver `technical/04`), rastro de remarcacao (`rescheduledFrom[]`) e auditoria (`auditLogService`), conflitos de serie (`conflicts[]`), `readErrorRate` desligado por padrao.
- Aberta: paginacao nas listas (adiada para o backend).
