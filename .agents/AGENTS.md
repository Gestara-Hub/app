# GestaraHub — Guidelines for AI Agents (Antigravity, Claude, Cursor)

> **Current state (30/10/2026):** work happens on `main` (`painel-admin` and the overnight branch were merged and deleted on 30/10; nothing is pushed until the user asks). What is decided and still to do, the tests left for the final round, the decisions waiting for the user and the pre-production checklist are in [`docs/pendencias.md`](docs/pendencias.md); the "Mapa por assunto" of [`docs/README.md`](docs/README.md) says where each subject lives. The overnight run of 24/10 is finished (report in [`docs/handoff/2026-10-24-diario-noturno.md`](docs/handoff/2026-10-24-diario-noturno.md)). `CLAUDE.md` has the full, current rules (this file is a summary). `.agents/` (read by Antigravity) is a copy of this file and of `.claude/skills`: refresh it with `pnpm agents:sync` after changing either.

## 1. Project Overview & Architecture
GestaraHub is a modern multi-tenant management platform for service businesses, studios, academies, and appointment-based businesses.
- **Monorepo**: pnpm workspaces (`apps/web`, `apps/admin` painel interno do GestaraHub, `packages/contracts`, `packages/core`).
- **Frontend Stack**: Next.js (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, React Hook Form, Zod.
- **Packages**: `@gestarahub/contracts` (domain types, enums, `ApiError`) and `@gestarahub/core` (pure logic: `scheduling`, `billing`, `date`, `format`, `api-error`).
- **Mock / Data Seam**: `@/mocks/store` (multi-tenant world persisted in `localStorage`) and `@/services/*Service.ts` simulate the future NestJS API with `simulateRead` and `simulateWrite`.
- **Session**: mocked cookie `gestarahub_session`, route guard in `apps/web/src/proxy.ts` (Next 16), server actions in `apps/web/src/app/(auth)/actions.ts`, per-page RBAC with `requirePermission`.
- **Docs**: `docs/README.md` is the index; ADRs in `docs/technical/`, UI decisions in `docs/frontend/06-decisoes-de-interface.md`, screen/form/mobile standards in `docs/frontend/07-padroes-telas-e-ux.md`, and recent LP & Onboarding decisions in `docs/frontend/08-decisoes-landing-page-e-onboarding.md`.
- **Where each doc goes:** skill `docs` (`.claude/skills/docs`): look the subject up in the "Mapa por assunto" of `docs/README.md` first, add a section if it exists, create a file only for a new subject; "do later" items also go in `docs/pendencias.md`.

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
  - Public routes (no login: `/p/...`, `/consent/...`, anything opened by a link that travels on WhatsApp): personal data leaves the server only masked, with `@gestarahub/core/privacy` (`maskPersonName` "Ana S.", `maskCpf` "***.982.247-**", `maskBirthDate` year only, `maskPhone` last 4 digits); never prefill a form with personal data, and never write to a record from a public page (doc `docs/product/24-diretrizes-exclusao-e-lgpd.md` §6).
  - Form helpers: `@/components/form` (`DialogFormFooter`, `InputCurrency`, `InputText`, `SelectField`, `ComboboxField`, `SegmentedChoiceField`, `SwitchField`, `FileDropField` + `filesSchema` from `@/lib/files`, `PaymentMethodField`, etc.) and `@/lib/form-errors.ts` (`handleFormApiError`). Payment registration dialogs use `@/components/shared/payment-dialog` (`PaymentDialog`).
- **Navigation**: `apps/web/src/components/layout/nav.ts` (`MAIN_NAV`, `FOOTER_NAV`, filtered by operational model and permission).
- **Boundaries** (enforced by `apps/web/eslint.config.mjs`):
  - `@/components/ui`, `@/components/form`, `@/components/shared`, `@/lib` and `@/config` must NEVER import from `@/features` or `@/mocks`.
  - `@/mocks` is imported only by `@/services` (and test setup in `src/test`); the only exception is session code (`@/features/auth`, plus `src/app/(app)/layout.tsx`, `src/app/(auth)/login/page.tsx` and `src/app/(auth)/actions.ts`, which read `organizationModelById`).
  - A feature imports another feature only through its public barrel (`@/features/<x>`), never its internals.
  - Tenant scope (`organizationId`/`unitId`) is stamped by services, never sent by the UI (`TenantScopeFields`).

---

## 4. Verification & Testing Workflow (USER RULE)
- **Do NOT run automated test suites (`pnpm test`) or Playwright (`pnpm e2e` / browser automation) automatically** unless explicitly requested by the user.
- **Workflow**: Make requested changes directly and quickly. Keep track of all changes made during the session. At the conclusion or milestone, suggest to the user whether new tests should be created or existing suites run.
- When verification is requested or before concluding, standard commands are:
```bash
pnpm --filter @gestarahub/web typecheck  # tsc --noEmit (0 errors)
pnpm --filter @gestarahub/web lint       # eslint (0 errors, 0 warnings)
```

---

## 5. Git Workflow (USER RULE)
- **Never run `git push` on your own.** Push only when the user explicitly asks for it; a request to commit is NOT a request to push.
- **Commit:** Claude Code commits on its own after the checks pass (user rule of 30/10/2026, `CLAUDE.md` §6). Other agents commit only when the user asks: leave changes in the working tree and tell the user what changed.

---

## 6. Code Search & Performance Rule (USER RULE)
- **NEVER search/grep across broad directories that contain build artifacts, caches, or binaries** (such as `apps/web/`, `.next/`, `.next-e2e/`, `node_modules/`, `dist/`, `test-results/`, `playwright-report/`).
- When searching code with `grep` or `rg`, **always restrict the path to source directories only**:
  - `apps/web/src/`
  - `apps/web/e2e/`
  - `packages/contracts/src/`
  - `packages/core/src/`
  - `docs/`

## 7. Asaas Documentation via MCP
- The Asaas API docs are available as an MCP server (`https://docs.asaas.com/mcp`, public, HTTP). Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`) and VS Code (`.vscode/mcp.json`) pick it up from the repo; Antigravity, Codex and Claude Desktop need a one-time user config. Setup per tool and the usage rule in [`docs/guides/14-asaas-mcp.md`](docs/guides/14-asaas-mcp.md).
- **Read-only.** Use it to look up endpoints, fields and guides. Never call its `execute-request` tool: real calls go through `apps/web/src/services/payments/` with the `ASAAS_*` env vars, and API keys never appear in prompts, code, logs or PRs.

## 8. Local Environment
- `pnpm setup:local` brings up the local Supabase, applies pending migrations, fills the missing Supabase variables in `apps/web/.env.local` and prepares the daily cron (CRON_SECRET + Vault). `pnpm setup:local:reset` starts from scratch (wipes local data). Details in [`docs/guides/16-ambiente-local.md`](docs/guides/16-ambiente-local.md).
