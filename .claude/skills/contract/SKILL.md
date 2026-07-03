---
name: contract
description: Add or evolve a domain contract in @gestarahub/contracts (entities, read-models, Create/Update types, enums, error codes) and keep the mock service + seed (+ future API) in sync. Use when back and front share a new field, entity, or model change.
---

# Domain contract (@gestarahub/contracts)

Source of truth: `docs/frontend/02-camada-de-dados-mock.md`. Memory: [[monorepo-packages-boundaries]].
The contract is the single source of truth that the **mock (now)** and the **NestJS API (later)** both implement.

## Add / evolve a type
- Entity type + a **`*View` read-model** (relations expanded, totals) + `Create*`/`Update*` (usually `Omit`/`Partial`).
- Enums as string unions. Error codes in `ApiErrorCode`.
- Export from the package barrel (`packages/contracts/src/index.ts`).

## Keep in sync — one change usually touches all of these
1. `@gestarahub/contracts` — the type.
2. `services/<x>Service.ts` — `toView`, validation, create/update (**/web-data**).
3. `mocks/seed.ts` — seed the new field; **bump `SEED_VERSION`** in `mocks/store.ts` if the shape changed.
4. Forms/displays that read it (**/web-form**).
5. Later: the NestJS DTO/entity mirrors this contract (**/api-endpoint**, when `apps/api` exists).

Worked example: the 1:n `serviceId → serviceIds[]` change touched contracts + services + seed + forms + displays
(commit `bb898ec`). Verify at runtime → **/smoke-web**.
