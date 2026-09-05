---
name: architect
description: Make and review architecture decisions in apps/web — where code lives, module boundaries, package extraction, RSC vs client, MFE-readiness, and a project review checklist. Use when deciding structure or reviewing a change for boundary/convention violations.
---

# Architecture & boundaries (apps/web)

Source of truth: `docs/frontend/01-arquitetura.md` (layer model + "MFE-readiness" section),
`apps/web/eslint.config.mjs` (the enforced rules). Memory: [[monorepo-packages-boundaries]],
[[frontend-stack]], [[agenda-module]].

## Where code lives
- Domain UI → `features/<x>` (barrel-exported). Shared UI → `components/{ui,form,shared}`. Shell → `components/layout`.
- Data → `services` + hooks. Contract types → `@gestarahub/contracts`. Pure logic → `@gestarahub/core`.
- **Platform** (clients/professionals/services/categories/roles/users/settings/auth) vs **workflow** (schedule/dashboard).

## Enforced boundaries (lint fails if broken)
- Shared (`ui/form/shared`, `lib`, `config`) ≠> features/mocks. Shell may know features, not mocks.
- Features import each other ONLY via barrel; no `@/mocks` in UI (auth server-side exempt).

## When to extract a package
- `contracts` + `core` are packages. Extract more (e.g. `@gestarahub/ui`) only at MFE-split time — Tailwind v4
  cross-package needs a runtime check (**/smoke-web**). Physical extraction later is mechanical (barrels/aliases are already the seams).

## Review checklist (apply to a change)
- Lint boundaries green? RBAC via `can()`/`requirePermission` (never `profile === …`)?
- PT UI / EN code? Soft-rules honored (**/web-form**)? No `@/mocks` in UI? Read-models (not raw rows) to UI (**/web-data**)?
- Shared types in `@gestarahub/contracts` (**/contract**)? Is the decision worth recording → **/adr**?
