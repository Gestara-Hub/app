---
name: web-form
description: Build a form in apps/web the project way — React Hook Form + Zod, the shared field components, API-error→field mapping, and the soft-confirm pattern. Use for any create/edit dialog or filter form.
---

# Build a form (apps/web)

Source of truth: `docs/frontend/04-design-system.md`, `docs/product/10-estados-e-mensagens.md` (messages).
Field components live in `apps/web/src/components/form/` (barrel `@/components/form`).
Memory: [[ui-conventions-forms-modals]], [[combobox-no-auto-open]]. Reference: `features/appointments/components/appointment-form.tsx`.

## Setup
- `useForm({ resolver: zodResolver(schema), mode: "onSubmit", reValidateMode: "onChange" })`, wrap in `<FormProvider>`.
- Schema in `features/<x>/<x>-schema.ts` (Zod, PT messages). Multi-value fields → `z.array(...).min(1, "…")`.

## Field components (pick by data shape)
| Data | Component |
|---|---|
| Entity that can grow (cliente/profissional/serviço) | `ComboboxField` (searchable) |
| Multiple entities | `MultiSelectField` |
| Small fixed enum | `SelectField` |
| Text / phone / currency / number | `InputText` / `InputPhone` / `InputCurrency` / `InputNumber` |
| Long text | `TextArea` |
| Boolean | `SwitchField` |
All wrap `FieldShell` (label + error). NOTE: clicking the label must NOT open the popup (a11y fix — do not reintroduce; combobox must not auto-open on focus).

## Submit + errors
- Build the payload, call the mutation (**/web-data**). On error: `getFieldErrors(error)` → `form.setError(field, {message})`; else toast `getErrorMessage(error, "…")`.
- Footer: `DialogFooter` with Cancelar (`DialogClose`) + submit ("Criar…/Salvar alterações").

## Values the system fills in (suggested, defaults, following another field) — CRITICAL
`FieldShell` reads `formState.isDirty`, so RHF recomputes `dirtyFields` against the defaults in every form:
a value written with `setValue` (no `shouldDirty`) becomes "dirty" on the next change in ANY other field.
Never gate a suggestion on `getFieldState(x).isDirty` / `dirtyFields.x` after a programmatic `setValue`
(real bug 2026-11-10: event registration amount froze at R$ 0, registrations saved with no charge).
- Suggestion that is not a user edit (space defaults, unit hours, suggested slot): `form.resetField(x, { defaultValue })`. `resetField` does nothing on a field that is not registered yet (collapsed section, closed sheet or tab): `form.register(x)` first; for a group, register each leaf (`address.city`...); a `useFieldArray` list needs `setValue` instead (doc 07 §2.8).
- Suggestion that follows another field and must be saved (amount by days, time zone by state): keep the
  last suggested value in a `useRef`; update only while the field still shows it; `shouldDirty: true` when the
  screen saves only `dirtyFields`. References: `register-drawer.tsx`, `organization-settings-card.tsx`.
- Money field at 0 on a paid flow: soft-confirm ("…sem cobrança?") before submitting.
- Repro without React: `createFormControl` from react-hook-form + `control._proxyFormState.isDirty = true`.
Rule and history: `docs/frontend/07-padroes-telas-e-ux.md` §2.8.

## Soft-confirm ("regra mole")
Never hard-block avoidable-mistake cases (past date, lunch break, destructive). Open an `AlertDialog`
"…mesmo assim?" and proceed on confirm. Reference: `appointment-form.tsx` (`confirmPast`/`confirmBreak`),
`appointment-detail-dialog.tsx` (cancel/no-show). Action-heavy detail modals → primary + "Mais ações" overflow ([[ui-conventions-forms-modals]]).
