# Design System

## Decisao

O GestaraHub adota shadcn/ui + Tailwind CSS v4 + Radix como design system. O estilo do registry e `new-york` e a base color e `neutral` (ver `components.json`). O tema e centralizado em variaveis CSS do shadcn em `src/app/globals.css` (`:root` para o modo claro e `.dark` para o escuro), expostas ao Tailwind v4 via `@theme inline`, e ajustavel por um **personalizador de tema** (`src/lib/theme-customizer.ts` + `src/components/theme/theme-customizer.tsx`).

A marca e do **produto** (logo GestaraHub na sidebar), sem white-label por tenant; o nome da unidade aparece na topbar. A paleta ambar "Corte Nobre" dos primeiros rascunhos foi rejeitada em favor do tema neutro do shadcn. A sidebar e **escura por padrao** (ver [`06-decisoes-de-interface.md`](06-decisoes-de-interface.md)).

A interface e um painel operacional de alta densidade, desktop-first mas utilizavel no celular (o e2e `mobile.spec.ts` garante que nao ha rolagem lateral).

Referencias oficiais:

- shadcn/ui: https://ui.shadcn.com/docs (tema: https://ui.shadcn.com/docs/theming)
- Tailwind CSS v4: https://tailwindcss.com/docs
- React Hook Form: https://react-hook-form.com/
- Zod + @hookform/resolvers: https://github.com/react-hook-form/resolvers
- sonner: https://sonner.emilkowal.ski/

## Contexto

- O frontend e mockado (ver `docs/frontend/00-estrategia-frontend.md`).
- Os estados e textos das telas vem de `docs/product/10-estados-e-mensagens.md`; este documento define COMO sao apresentados.
- shadcn/ui nao e lib de runtime: os componentes sao copiados para `src/components/ui/` (o ESLint relaxa algumas regras de hooks so nessa pasta). Radix (`radix-ui`), `cmdk`, `sonner` e `lucide-react` sao as dependencias reais.
- Convencoes de UI adotadas depois deste doc (confirmacoes, tema, mobile, controle segmentado) estao em `docs/frontend/06`; onde divergirem, vale o 06.

## Escopo

- Tema: variaveis CSS do shadcn + personalizador.
- Cores de status.
- App shell: sidebar + topbar.
- Componentes compartilhados (`components/shared`, `components/form`) e convencoes de shadcn.
- Formularios: React Hook Form + Zod.
- Responsividade.

## Fora de escopo

- Tematizacao por organizacao / white-label (rejeitado por ora).
- Microtexto e copy (doc 10).

## Tema: variaveis CSS e personalizador

`src/app/globals.css` segue o padrao shadcn/Tailwind v4: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@custom-variant dark (&:is(.dark *))`, bloco `@theme inline` mapeando `--color-*`/`--radius-*` para as variaveis, e os valores em `:root`/`.dark`.

O personalizador grava o estado no localStorage (`gestarahub:theme-generator-state`) e o aplica como atributos no `<html>`, que o `globals.css` usa para sobrescrever as variaveis:

| Atributo | Opcoes (`lib/theme-customizer.ts`) |
| --- | --- |
| `data-base-color` | `zinc`, `slate`, `stone`, `gray`, `neutral` |
| `data-theme-color` | cor de destaque (`zinc`, `blue`, `green`, `violet`, `rose`...) |
| `data-theme-radius` | `0`, `0.3`, `0.5`, `0.75`, `1.0` |
| `data-menu-color` | `default`, `inverted` (sidebar escura no tema claro), `subtle` |
| `data-menu-accent` | `subtle`, `bold` |
| `data-font` | fonte (Geist por padrao; outras via Google Fonts) |
| `data-style` | `default`, `mira`, `nova`, `vega` |

Tambem ha presets (`THEME_PRESETS`). O padrao e zinc / raio 0.5 / `menuColor: "inverted"` / Geist; um script de boot em `app/layout.tsx` aplica os atributos antes da hidratacao para nao piscar. Com o menu invertido, o logo troca para a versao de fundo escuro (`.sidebar-logo-light/-dark`).

Modo claro/escuro: `next-themes` (`ThemeProvider` em `lib/providers.tsx`, `attribute="class"`, `defaultTheme="light"`, `enableSystem={false}`), com botao "Alternar modo claro/escuro" na topbar.

Regra de ouro: **a UI consome sempre classes do tema (`bg-primary`, `text-muted-foreground`, `border-border`...), nunca hex literal em componente.** `cn` (`src/lib/utils.ts`, clsx + tailwind-merge) compoe classes condicionais.

## Cores de status

- `globals.css` declara pares `--status-<status>-solid` / `-surface` (pending, confirmed, in-service, completed, canceled, no-show) e `--status-blocked-surface`/`-border`, mas hoje nenhum componente os consome.
- Os badges usam classes Tailwind por status, com variante `dark:`: `features/appointments/components/appointment-status-badge.tsx` (`AppointmentStatusBadge`, exportado pelo barrel de `appointments`) e `RecordStatusBadge` (`components/shared/list`) para ativo/inativo.
- Regras: status sempre com rotulo textual (cor nunca sozinha; rotulos em `src/lib/labels.ts`); estados "passados" (`completed`, `canceled`) ficam neutros.
- Bloqueio de horario nao e status de agendamento e tem aparencia neutra propria na agenda.

## App shell (sidebar + topbar)

Montado em `src/app/(app)/layout.tsx` com `SidebarProvider` (bloco `sidebar` do shadcn) + `AppSidebar` + `SidebarInset` (`AppTopbar`, banner de onboarding, conteudo). Login fica fora do shell (`PublicAuthShell`).

### Sidebar

- `components/layout/app-sidebar.tsx`: itens de `MAIN_NAV` e, no rodape, `FOOTER_NAV` (`components/layout/nav.ts`), filtrados por modelo (`navForModel`) e permissao (`can`). Ver `docs/frontend/03`.
- Barbearia (`scheduling`): Dashboard, Clientes, Equipe, Serviços, Agenda. Academia (`classes`): Dashboard, Alunos, Equipe, Turmas, Calendário, Modalidades, Planos, Mensalidades. Rodape: Usuários, Auditoria, Configurações.
- Colapsavel para icones; estado persistido no cookie `sidebar_state`. Em telas estreitas vira off-canvas.

### Topbar

- `components/layout/app-topbar.tsx`: `SidebarTrigger`, nome da unidade, alternar claro/escuro, personalizador de tema, menu do usuario (perfil, "Trocar usuário / organização (demo)", "Sair").

### Area de conteudo

- `PageHeader` (`components/layout/page-header.tsx`) com titulo, descricao e acoes.
- Densidade de painel: preferir mais linhas a mais respiro.

## Componentes compartilhados

### Listas (`@/components/shared/list`)

`SearchInput`, `StatusFilterSelect`, `RecordStatusBadge`, `InitialsAvatar`, `ListContainer`, `ListRow`, `ListSummaryBar`, `ListEmptyState`.

Em arquivos proprios de `components/shared/`:

- `list-item-actions-menu.tsx`: `ListItemActionsMenu` (kebab) e `ListItemContextMenu` (clique direito), ambos a partir de uma lista de `ListItemAction`.
- `list-card.tsx` (`ListCard`), `list-item-card.tsx` (`ListItemCard`).
- `module-empty-guide.tsx` (`ModuleEmptyGuide`): estado vazio de modulo com CTA.
- `combobox.tsx` (`Combobox`): select com busca. Nao abre nem foca o filtro sozinho ao receber foco.
- `entity-manager-dialog.tsx` (`EntityManagerDialog`): gestao de cadastros simples (nome + status), usado por cargos e categorias.
- `confirm-action-dialog.tsx`: `useConfirmAction()` (imperativo: `if (!(await confirm({...}))) return;` e renderizar `dialog`) e `ConfirmActionDialog` (declarativo). Quando confirmar esta em `docs/frontend/06`.

Cada lista cobre os estados do doc 10: carregando (`Skeleton`), com dados, vazio sem dados (CTA), vazio por filtro/busca e erro ("Tentar novamente").

### Formularios (`@/components/form`)

Exports reais de `components/form/index.ts`: `FieldShell`, `InputText`, `InputPhone`, `AutocompleteField`, `TextArea`, `InputNumber`, `InputCurrency`, `DateField`, `TimeField`, `SelectField`, `ComboboxField`, `MultiSelectField`, `SwitchField`, `SegmentedChoiceField`, `DialogFormFooter`, `AddressFields`, `CollapsibleSection`.

Convencoes:

- Entidade -> `ComboboxField`; enum pequeno e fixo -> `SelectField`; 2–3 opcoes com descricao curta -> `SegmentedChoiceField`.
- `InputCurrency` exibe reais e guarda centavos (`priceCents`, `amountCents`); nunca negativo.
- React Hook Form 7 + Zod 4 (`zodResolver`), schemas em `features/<x>/*-schema.ts`, `mode: "onSubmit"` + `reValidateMode: "onChange"`.
- Erros da API: `handleFormApiError(error, form, fallbackMessage)` (`src/lib/form-errors.ts`) mapeia `ApiError.fields` para os campos ou mostra toast.
- Regras moles (fora do horario, almoco, turma lotada): o form captura o codigo do `ApiError`, pede confirmacao e reenvia com o override. Ver a skill `web-form`.

## Convencoes de componentes (shadcn/ui)

### Button

- Primaria: `default`. Secundaria: `outline`/`secondary`. Discreta: `ghost`. Destrutiva: `destructive`, sempre atras de confirmacao.

### Dialog / AlertDialog

- Criar/editar acontece em `Dialog` sobre a lista/detalhe (sem rota dedicada), com `DialogFormFooter`.
- Confirmacoes em `AlertDialog`; botao destrutivo com `AlertDialogAction variant="destructive"` (nao sobrescrever com `className`, ver doc 06).
- Escopo de serie ("Somente esta" / "Esta e as futuras") antes da confirmacao final.
- Modais de acao: acao primaria + menu "Mais ações"; conteudo de detalhe em layout "hero".

### Badge, Card, DropdownMenu, Breadcrumb

- Badge de status com rotulo. Card para indicadores e blocos de detalhe. Acoes por linha em `ListItemActionsMenu`. `Breadcrumb` disponivel em `components/ui`.

### Toaster (sonner)

- `<Toaster />` no root layout. `toast.success` / `toast.warning` / `toast.error` / `toast.info` para feedback efemero; nao substitui validacao de campo, confirmacao nem estado de erro de lista.

## Responsividade

Desktop-first, breakpoints padrao do Tailwind v4.

- Sidebar off-canvas em telas estreitas (`use-mobile`).
- Linhas de lista com acoes largas descem as acoes para baixo do texto em telas estreitas (ex.: `billing-view.tsx`).
- Agenda: modo dia e o mais util no celular; semana/mes a partir de telas maiores.
- Sem rolagem elastica no documento (`overscroll-behavior-y: none`).

## Convencoes de uso do tema

- Consumir sempre classes/variaveis do tema; nunca hex literal em componente.
- Tema num unico `globals.css`, importado no root layout; Providers em `lib/providers.tsx`.
- Novos componentes compartilhados vao em `components/shared` (nunca importam de `features` nem de `mocks`; regra do ESLint).

## Pendencias

- Resolvidas: paleta (neutra + personalizador), modo escuro (ativo via `next-themes`), icones de navegacao (`nav.ts`).
- Abertas: passar os badges de status a consumir as variaveis `--status-*` (ou remover as variaveis); validar contraste AA dos badges no modo escuro.
