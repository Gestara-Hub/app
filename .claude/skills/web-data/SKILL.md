---
name: web-data
description: Write or evolve the apps/web mock service layer — the seam that imitates the future NestJS API. simulateRead/Write, read-model views, ApiError codes + PT messages, queryKeys, and TanStack Query hooks. Use when adding a data operation, query, or a new entity's data layer.
---

# Data layer (apps/web mock services)

Source of truth: `docs/frontend/02-camada-de-dados-mock.md`, `docs/product/10-estados-e-mensagens.md`.
Memory: [[monorepo-packages-boundaries]]. Reference: `services/appointmentsService.ts`.
This layer is the **swap point** for the real NestJS API — keep signatures/types stable.

## Service (`src/services/<x>Service.ts`)
- Read: `simulateRead(() => …)`; write: `simulateWrite(() => …)`. Only services touch `@/mocks/store`.
- Return **read-models** via a `toView()` (relations expanded, totals computed) — never raw store rows to the UI.
- Validate + throw `apiError(code, msg, { fields, httpStatus })` or `validationError([...])` using
  `ApiErrorCode` + doc-10 PT messages (helpers in `@gestarahub/core/api-error` and `@/mocks/helpers`).
- Types from `@gestarahub/contracts` → see **/contract**.

## Query keys (`src/lib/queryKeys.ts`)
- `<entity>: { all, list(filter), detail(id) }`. Invalidate `all` after mutations (partial-matches list+detail).

## Hooks (`features/<x>/hooks/use-*.ts`)
- `useQuery` over the service; `useMutation` with `onSuccess: qc.invalidateQueries({ queryKey: queryKeys.<x>.all })`.
- UI/components call **hooks**, never services directly.

## Seed
- Deterministic seed in `mocks/seed.ts`. Changing an entity's **shape** → bump `SEED_VERSION` in `mocks/store.ts` (resets localStorage on load).

Verify at runtime → **/smoke-web**.
