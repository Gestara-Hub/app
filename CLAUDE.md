# GestaraHub — Guidelines for Claude Code

## 1. Project Overview & Architecture
GestaraHub is a modern multi-tenant management platform for service businesses, studios, academies, and appointment-based businesses.
- **Monorepo**: pnpm workspaces (`apps/web`, `packages/contracts`, `packages/core`).
- **Frontend Stack**: Next.js (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, React Hook Form, Zod.
- **Packages**: `@gestarahub/contracts` (domain types, enums, `ApiError`) and `@gestarahub/core` (pure logic: `scheduling`, `billing`, `date`, `format`, `api-error`).
- **Mock / Data Seam**: `@/mocks/store` (multi-tenant world persisted in `localStorage`) and `@/services/*Service.ts` simulate the future NestJS API with `simulateRead` and `simulateWrite`.
- **Session**: mocked cookie `gestarahub_session`, route guard in `apps/web/src/proxy.ts` (Next 16), server actions in `apps/web/src/app/(auth)/actions.ts`, per-page RBAC with `requirePermission`.
- **Docs**: `docs/README.md` is the index; ADRs in `docs/technical/` and `docs/frontend/06-decisoes-de-interface.md`.

---

## 2. Universal Language Rule (STRICT)

### Code Must Be 100% in English
All code artifacts and identifiers **must be written in English**:
- TypeScript types, interfaces, and type aliases (e.g., `Plan`, `Charge`, `ChargeKind`, `ClassGroup`, `Enrollment`, `ClassReservation`, `WaitlistEntry`, `WorkingHours`).
- Enum keys and values (e.g., `ChargeKind = "membership" | "dropin"`, `PlanPeriod = "monthly" | "biweekly" | "weekly"`).
- Object properties, database/store fields, and API payloads (e.g., `availableSpots`, `sessionPriceCents`, `competence`, `dueDate`, `amountCents`, `status`).
- Functions, methods, hooks, and variables (e.g., `useCharges`, `useReserveSession`, `useMarkChargePaid`, `billingService.markPaid`).
- Query keys and cache tags (e.g., `queryKeys.billing.charges`, `queryKeys.classes.waitlist`).

**Known naming debt (do not copy):** `features/turmas`, `turmasService`, `Turma*` components/schemas, `turmasService.cancelReserva` and the Portuguese contract aliases (`Plano`, `Cobranca*`, `Reserva*`). New code uses English names; see `docs/technical/01-extensao-modelos-operacionais.md`.

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
  - List components: `@/components/shared/list` (`SearchInput`, `StatusFilterSelect`, `RecordStatusBadge`, `InitialsAvatar`, `ListContainer`, `ListRow`, `ListSummaryBar`, `ListEmptyState`); row menus in `@/components/shared/list-item-actions-menu` (`ListItemActionsMenu`, `ListItemContextMenu`); `ModuleEmptyGuide`, `Combobox`, `EntityManagerDialog` in `@/components/shared/*`.
  - Dialogs: `@/components/shared/confirm-action-dialog` (`useConfirmAction`, `ConfirmActionDialog`).
  - Form helpers: `@/components/form` (`DialogFormFooter`, `InputCurrency`, `InputText`, `SelectField`, `ComboboxField`, `SegmentedChoiceField`, `SwitchField`, etc.) and `@/lib/form-errors.ts` (`handleFormApiError`).
- **Navigation**: `apps/web/src/components/layout/nav.ts` (`MAIN_NAV`, `FOOTER_NAV`, filtered by operational model and permission).
- **Boundaries** (enforced by `apps/web/eslint.config.mjs`):
  - `@/components/ui`, `@/components/form`, `@/components/shared`, `@/lib` and `@/config` must NEVER import from `@/features` or `@/mocks`.
  - `@/mocks` is imported only by `@/services` (and test setup in `src/test`); the only exception is session code (`@/features/auth`, plus `src/app/(app)/layout.tsx`, `src/app/(auth)/login/page.tsx` and `src/app/(auth)/actions.ts`, which read `organizationModelById`).
  - A feature imports another feature only through its public barrel (`@/features/<x>`), never its internals.
  - Tenant scope (`organizationId`/`unitId`) is stamped by services, never sent by the UI (`TenantScopeFields`).

---

## 4. Verification Commands
Before concluding any task, ensure:
```bash
pnpm --filter @gestarahub/web typecheck  # tsc --noEmit (must be 0 errors)
pnpm --filter @gestarahub/web lint       # eslint (must be 0 errors, 0 warnings)
pnpm test                                # billing engine (node --test) + services (Vitest)
pnpm e2e                                 # browser flows (Playwright, system Chrome, reuses `pnpm dev`)
```
- Business rules are covered by `apps/web/src/services/__tests__` and `packages/core/test`; UI flows by `apps/web/e2e`. When fixing a bug, add the test that reproduces it in the same change.
