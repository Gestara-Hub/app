# GestaraHub — Guidelines for Claude Code

## 1. Project Overview & Architecture
GestaraHub is a modern multi-tenant management platform for service businesses, studios, academies, and appointment-based businesses.
- **Monorepo**: pnpm workspaces (`apps/web`, `packages/contracts`, `packages/core`).
- **Frontend Stack**: Next.js (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, React Hook Form, Zod.
- **Packages**: `@gestarahub/contracts` (domain types, enums, `ApiError`) and `@gestarahub/core` (pure logic: `scheduling`, `billing`, `date`, `format`, `api-error`).
- **Mock / Data Seam**: `@/mocks/store` (multi-tenant world persisted in `localStorage`) and `@/services/*Service.ts` simulate the future NestJS API with `simulateRead` and `simulateWrite`.
- **Session**: mocked cookie `gestarahub_session`, route guard in `apps/web/src/proxy.ts` (Next 16), server actions in `apps/web/src/app/(auth)/actions.ts`, per-page RBAC with `requirePermission`.
- **Docs**: `docs/README.md` is the index; ADRs in `docs/technical/`, UI decisions in `docs/frontend/06-decisoes-de-interface.md`, screen/form/mobile standards in `docs/frontend/07-padroes-telas-e-ux.md`, and **recent LP & Onboarding decisions in [`docs/frontend/08-decisoes-landing-page-e-onboarding.md`](docs/frontend/08-decisoes-landing-page-e-onboarding.md)**.

### 1.1. Contexto Estratégico & Decisões Recentes (LP & Setup Inicial)
Consulte **[`docs/frontend/08-decisoes-landing-page-e-onboarding.md`](docs/frontend/08-decisoes-landing-page-e-onboarding.md)** para o histórico completo. Principais diretrizes ativas:
- **Posicionamento**: Sistema 100% gratuito para quem ensina, com suporte nativo duplo: **aulas em grupo (turmas) OU aulas particulares individuais (1 a 1 / VIP)**.
- **Áreas** (10 + "Outra área"): Lutas, Pilates e yoga, Funcional e crossfit, Dança, Música, Idiomas e reforço, Natação e esportes, Gastronomia, Artes e artesanato, Beleza e cursos livres. Fonte única: `lib/business-segment-presets.ts` (+ ícones em `lib/business-segment-icons.ts`).
- **Controle de Progresso**: Trilha configurável (faixas, níveis, módulos ou fases), não restrita a artes marciais.
- **Design & Copy (Crítico para o Usuário)**:
  - Zero poluição visual: layouts minimalistas, sem mockups carregados nem números falsos de marketing.
  - Micro-cópia ultra-concisa (6 a 8 palavras por item, frases diretas de 1 linha).
  - Proibido `line-clamp` cortando palavras no meio com reticências (`...`).
  - Proibido duplicar listas de seleção na mesma tela.
  - Labels de formulário limpas (ex.: `Nome*` colado com tipografia inline, sem gap de flexbox).
- **Landing Page (`features/landing`)**:
  - "A parte chata, a gente resolve": 6 cards de tarefa chata ➔ solução (substituiu o Antes vs. Depois; sem blocos de passos ou métricas).
  - 11 cards de áreas (`LandingSegments`): ícone, nome e exemplos, vindos dos presets.
  - "Veja o sistema por dentro" com 3 abas (Chamada, Cobranças, Ficha do aluno) e, logo depois, "Pagamento online" (`LandingOnlinePayments`): Pix opcional também no plano grátis, sem valores de taxa e com o provedor citado só como "parceiro de pagamentos regulado".
  - 4 Pilares da gestão (`LandingFeatures`).
  - Dúvidas, cadastro no fim e páginas `/terms` e `/privacy`. Sem Planos e sem citar o Pro até definir o preço e a cobrança do WhatsApp e do pagamento online (`LandingPlans` pronto, fora da página).
  - A página só promete o que o produto faz (sem "reposição", que o modelo de turmas não tem).
  - Efeito scroll fluido contínuo com `ScrollReveal` (`once: false`, aceleração GPU) + barra de progresso no topo.
- **Setup Inicial (`/setup` & `BusinessSetupWizard`)**:
  - Uma pergunta por tela (3 passos: Espaço, Área, Aulas), barra de progresso fina, coluna estreita igual nos 3 passos, sem cards nem stepper; botões sempre ativos (erro do passo ao avançar sem o obrigatório).
  - Passo 1: `Nome*` grande + dica, prévia ao vivo, "Tenho mais de um endereço"; Enter avança.
  - Passo 2: lista das 10 áreas + "Outra área"; escolher uma área já avança (Outra área abre nome, "Como seus alunos avançam?", "Como você cobra?" e usa "Continuar").
  - Passo 3: "Aulas de {área}" + confirmação de como os alunos avançam, chips `✓`/`+`, contador e "Concluir".

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
  - List components: `@/components/shared/list` (`SearchInput`, `StatusFilterSelect`, `RecordStatusBadge`, `InitialsAvatar`, `ListContainer`, `ListRow`, `ListSummaryBar`, `ListEmptyState`, `ViewModeToggle`, `ViewModeProvider`, `ViewModeSkeleton`, `ViewModeCoachmark`, `SkeletonCards`, `useViewMode`); row menus in `@/components/shared/list-item-actions-menu` (`ListItemActionsMenu`, `ListItemContextMenu`; an action that opens a dialog keeps focus in it via `keepFocusInOpenDialog`); header "⋮" for rare page actions in `@/components/shared/page-actions-menu` (`PageActionsMenu`); "‹ Voltar" on detail screens in `@/components/shared/back-link` (`BackLink`, doc 07 §1.7); student page = alerts + accordion (doc 07 §1.8); `ModuleEmptyGuide`, `Combobox`, `EntityManagerDialog` in `@/components/shared/*`.
  - Dialogs: `@/components/shared/confirm-action-dialog` (`useConfirmAction`, `ConfirmActionDialog`).
  - Form helpers: `@/components/form` (`DialogFormFooter`, `InputCurrency`, `InputText`, `SelectField`, `ComboboxField`, `SegmentedChoiceField`, `SwitchField`, `FileDropField` + `filesSchema` from `@/lib/files`, `PaymentMethodField`, `InputPhone` (country selector, Brazil +55 default, stores E.164; helpers in `@gestarahub/core/phone`), etc.) and `@/lib/form-errors.ts` (`handleFormApiError`). Payment registration uses `@/components/shared/payment-dialog` (`PaymentDialog`, a right-side drawer like the other forms: method, "Pago em" date and receipts, returned as `PaymentDialogResult`).
  - No ellipsis on names or values: wrap with `min-w-0 break-words` (doc 07 "Ajustes da Prioridade 3"); names with a kind prefix use `withKind` from `@/lib/text` ("Pacote Pacote" never).
  - Teacher scope: services check `@/services/teacherScope` (professional sees and acts only in own classes and substituted sessions; `progression:manage` for graduation and records).
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
  - **Button height**: one height (36px). Text buttons never get `size` or height classes (`h-*`, `py-*`); icon-only buttons use `size="icon"`; `icon-sm`/`icon-xs` only for row actions and remove buttons inside chips/files (doc 07 §1.5).
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

---

## 6. Git Workflow (USER RULE)
- **Never run `git commit` or `git push` on your own.** Only commit or push when the user explicitly asks for it, and only the action requested (a request to commit is NOT a request to push).
- Leave changes in the working tree at the end of a task and tell the user what changed; the user decides when to commit and push.
