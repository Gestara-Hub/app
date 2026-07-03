---
name: web-feature
description: Scaffold or extend a feature slice in apps/web the project way — feature folder + service + contract types + TanStack Query hooks + route + nav + RBAC guard, respecting the enforced module boundaries. Use when adding or extending a domain screen (e.g. a new page/module or a tab/filter on an existing one).
---

# Build / extend a feature slice (apps/web)

Source of truth: `docs/frontend/01-arquitetura.md` (layers, boundaries, feature org),
`docs/frontend/03-rotas-e-navegacao.md` (routing/nav), `docs/product/06-perfis-permissoes.md`
(RBAC). Memory: [[access-rbac-model]], [[monorepo-packages-boundaries]], [[english-code-standard]].
Mirror an existing slice: `features/clients` / `features/professionals` / `features/services`.

## Anatomy
- `src/features/<x>/components/` — the View + dialogs (client components).
- `src/features/<x>/hooks/` — TanStack Query hooks → see **/web-data**.
- `src/features/<x>/index.ts` — **public barrel**: export ONLY what other features/app consume.
- `src/services/<x>Service.ts` + a `queryKeys.<x>` entry → see **/web-data**.
- Types in `@gestarahub/contracts` → see **/contract**.
- Route: `src/app/(app)/<route>/page.tsx` (RSC shell) renders the View; add nav in `src/components/layout/nav.ts`.

## Rules (enforced by `eslint.config.mjs` — lint fails otherwise)
- Import other features ONLY via their barrel `@/features/<x>`, never internals (`hooks/`, `components/`).
- No `@/mocks/*` in feature/UI code (only `services`; server-side `features/auth` is exempt).
- `components/ui|form|shared` never import features.
- Platform data (clients/professionals/services/categories/roles/users/settings/auth) is consumed by
  workflow features (schedule/dashboard) via the platform barrel.

## Guardrails
- Guard the page with `requirePermission(...)` (server) and gate actions with `useCan('<cap>')` — never `profile === '…'`.
- PT on the UI, English in code/files/keys/enums.
- Forms → **/web-form**. Data/hooks/services → **/web-data**. Where it lives / packaging → **/architect**.
