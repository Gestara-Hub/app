# GestaraHub — Guidelines for Claude Code

## 1. Project Overview & Architecture
GestaraHub is a modern multi-tenant management platform for service businesses, studios, academies, and appointment-based businesses.
- **Monorepo**: pnpm workspaces (`apps/web`, `packages/contracts`, `packages/core`).
- **Frontend Stack**: Next.js (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, React Hook Form, Zod.
- **Mock / Data Seam**: `@/mocks/store` and `@/services/*Service.ts` simulate the future NestJS API with `simulateRead` and `simulateWrite`.

---

## 2. Universal Language Rule (STRICT)

### Code Must Be 100% in English
All code artifacts and identifiers **must be written in English**:
- TypeScript types, interfaces, and type aliases (e.g., `Plan`, `Charge`, `ChargeKind`, `ClassGroup`, `Enrollment`, `ClassReservation`, `MakeupClass`, `WorkingHours`).
- Enum keys and values (e.g., `ChargeKind = "membership" | "dropin"`, `PlanPeriod = "monthly" | "biweekly" | "weekly" | "session"`).
- Object properties, database/store fields, and API payloads (e.g., `availableSpots`, `sessionPriceCents`, `competence`, `dueDate`, `amountCents`, `status`).
- Functions, methods, hooks, and variables (e.g., `useCharges`, `useReserveSession`, `markChargePaid`, `isMadeUp`).
- Query keys and cache tags (e.g., `queryKeys.billing.charges`, `queryKeys.classes.makeups`).

### User Interface Must Be in Brazilian Portuguese (`pt-BR`)
All user-facing texts **must be in Portuguese**:
- Button labels (e.g., "Salvar", "Cancelar", "Nova turma", "Adicionar aluno", "Gerar cobranças").
- Field labels, placeholders, and helper texts (e.g., "Valor da aula avulsa", "Nome do plano", "Buscar aluno...").
- Dialog titles, descriptions, and empty guides (e.g., "Lista de chamada", "Nenhuma cobrança nesta competência").
- Toast notifications and error messages (e.g., "Plano criado com sucesso.", "Turma lotada").
- Status badges and display labels (e.g., "Ativo", "Pendente", "Pago", "Matriculado", "Avulso", "Experimental").

---

## 3. Module Boundaries & Conventions
- **Domain Contracts**: Defined in `packages/contracts/src/` and shared between backend and frontend. Always evolve contracts before or alongside service layers.
- **Service Layer**: In `apps/web/src/services/*Service.ts`. Must return domain contracts / view read-models and use `simulateRead` / `simulateWrite`.
- **Shared Primitives**:
  - List components: `@/components/shared/list` (`SearchInput`, `StatusFilterSelect`, `RecordStatusBadge`, `InitialsAvatar`, `ListContainer`, `ListRow`, `ListSummaryBar`, `ListEmptyState`, `ListItemContextMenu`, `ListItemActionsMenu`).
  - Dialogs: `@/components/shared/confirm-action-dialog`.
  - Form helpers: `@/components/form` (`DialogFormFooter`, `InputCurrency`, `InputText`, `SelectField`, `SwitchField`, etc.) and `@/lib/form-errors.ts` (`handleFormApiError`).
- **Boundaries**: Code in `@/components/shared` must NEVER import from `@/features`. Features import from shared components, never vice-versa.

---

## 4. Verification Commands
Before concluding any task, ensure:
```bash
pnpm --filter @gestarahub/web typecheck  # tsc --noEmit (must be 0 errors)
pnpm --filter @gestarahub/web lint       # eslint (must be 0 errors, 0 warnings)
```
