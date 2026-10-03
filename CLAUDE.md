# GestaraHub — Guidelines for Claude Code

## 1. Project Overview & Architecture
GestaraHub is a modern multi-tenant management platform for service businesses, studios, academies, and appointment-based businesses.
- **Monorepo**: pnpm workspaces (`apps/web`, `packages/contracts`, `packages/core`).
- **Frontend Stack**: Next.js (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, React Hook Form, Zod.
- **Packages**: `@gestarahub/contracts` (domain types, enums, `ApiError`) and `@gestarahub/core` (pure logic: `scheduling`, `billing`, `date`, `format`, `api-error`).
- **Mock / Data Seam**: `@/mocks/store` (multi-tenant world persisted in `localStorage`) and `@/services/*Service.ts` simulate the future NestJS API with `simulateRead` and `simulateWrite`.
- **Session**: mocked cookie `gestarahub_session`, route guard in `apps/web/src/proxy.ts` (Next 16), server actions in `apps/web/src/app/(auth)/actions.ts`, per-page RBAC with `requirePermission`.
- **Docs**: `docs/README.md` is the index; ADRs in `docs/technical/`, UI decisions in `docs/frontend/06-decisoes-de-interface.md`, and screen/form/mobile standards in `docs/frontend/07-padroes-telas-e-ux.md`.

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
  - List components: `@/components/shared/list` (`SearchInput`, `StatusFilterSelect`, `RecordStatusBadge`, `InitialsAvatar`, `ListContainer`, `ListRow`, `ListSummaryBar`, `ListEmptyState`, `ViewModeToggle`, `ViewModeProvider`, `ViewModeSkeleton`, `ViewModeCoachmark`, `SkeletonCards`, `useViewMode`); row menus in `@/components/shared/list-item-actions-menu` (`ListItemActionsMenu`, `ListItemContextMenu`); `ModuleEmptyGuide`, `Combobox`, `EntityManagerDialog` in `@/components/shared/*`.
  - Dialogs: `@/components/shared/confirm-action-dialog` (`useConfirmAction`, `ConfirmActionDialog`).
  - Form helpers: `@/components/form` (`DialogFormFooter`, `InputCurrency`, `InputText`, `SelectField`, `ComboboxField`, `SegmentedChoiceField`, `SwitchField`, `FileDropField` + `filesSchema` from `@/lib/files`, `PaymentMethodField`, etc.) and `@/lib/form-errors.ts` (`handleFormApiError`). Payment registration dialogs use `@/components/shared/payment-dialog` (`PaymentDialog`).
- **Navigation**: `apps/web/src/components/layout/nav.ts` (`MAIN_NAV`, `FOOTER_NAV`, filtered by operational model and permission).
- **Boundaries** (enforced by `apps/web/eslint.config.mjs`):
  - `@/components/ui`, `@/components/form`, `@/components/shared`, `@/lib` and `@/config` must NEVER import from `@/features` or `@/mocks`.
  - `@/mocks` is imported only by `@/services` (and test setup in `src/test`); the only exception is session code (`@/features/auth`, plus `src/app/(app)/layout.tsx`, `src/app/(auth)/login/page.tsx` and `src/app/(auth)/actions.ts`, which read `organizationModelById`).
  - A feature imports another feature only through its public barrel (`@/features/<x>`), never its internals.
  - Tenant scope (`organizationId`/`unitId`) is stamped by services, never sent by the UI (`TenantScopeFields`).

---

## 4. Screen, Form, Modal & Mobile UX Standards (MANDATORY)
Read **[`docs/frontend/07-padroes-telas-e-ux.md`](docs/frontend/07-padroes-telas-e-ux.md)** before creating or editing any screen, dialog, or form. Key rules:
- **Screen Layout (`*-view.tsx`)**:
  - Primary creation button (`+ Nova turma`, `+ Novo lançamento`, `+ Novo aluno`) always lives in the top-right `PageHeader`, never hidden inside secondary tabs.
  - Top KPI summary grid has a **maximum of 4 cards** (`lg:grid-cols-4`). Group secondary metrics as `sub` text rather than adding a 5th/6th card. Never `truncate` monetary values or category names.
  - Every list screen/tab must render `SearchInput` + filters + `ListSummaryBar` (with `isLoading={isPending}`) above `ListContainer`.
  - Every row/card must wrap with `ListItemContextMenu` (right-click) and render `ListItemActionsMenu` (`⋮`) on the right.
- **Modal Form Structure (`Dialog` + `DialogBody` + `DialogFormFooter`)**:
  - Header (`DialogHeader shrink-0`) and Footer (`DialogFormFooter shrink-0`) are fixed; fields scroll inside `<DialogBody className="space-y-4">`.
  - **Footer Button Labels (STRICT)**:
    - Create mode (`!isEdit`): **`"Adicionar"`** (pending: `"Salvando..."`)
    - Edit mode (`isEdit`): **`"Salvar"`** (pending: `"Salvando..."`)
    - Cancel button: **`"Cancelar"`**
  - **No `"Ex.: ..."` in placeholders**: Use direct instructions (`"Informe o nome da modalidade"`, `"Descreva o lançamento"`). For quick examples, use clickable suggestion chips below the input.
  - Auxiliary entity management (e.g., `+ Gerenciar categorias`) goes inline in the `SelectField` label header (`flex items-center justify-between`), opening a stacked dialog.
- **Mobile UX (iOS Safari & Chrome)**:
  - Inputs (`<input>`, `<textarea>`, `<CommandInput>`) must use `text-base md:text-sm` (`16px` on mobile) to prevent iOS auto-zoom.
  - Never auto-focus inputs on touch devices (`pointer: coarse`) or when the first field is `date`/`time`.
  - Never call `crypto.randomUUID()` directly (fails on non-HTTPS LAN `http://192.168.x.x`); use `newId()` from `@/mocks/helpers`.

---

## 5. Verification & Testing Workflow (USER RULE)
- **Do NOT run automated test suites (`pnpm test`) or Playwright (`pnpm e2e` / browser automation) automatically** unless explicitly requested by the user.
- **Workflow**: Make requested changes directly and quickly. Keep track of all changes made during the session. At the conclusion or milestone, suggest to the user whether new tests should be created or existing suites run.
- When verification is requested or before concluding, standard commands are:
```bash
pnpm --filter @gestarahub/web typecheck  # tsc --noEmit (0 errors)
pnpm --filter @gestarahub/web lint       # eslint (0 errors, 0 warnings)
```
- Full suites, only when the user asks:
```bash
pnpm test                                # billing engine (node --test) + services (Vitest)
pnpm e2e                                 # browser flows (Playwright, system Chrome, reuses `pnpm dev`)
```
- Business rules are covered by `apps/web/src/services/__tests__` and `packages/core/test`; UI flows by `apps/web/e2e`.
