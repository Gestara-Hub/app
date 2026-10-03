# Decisões de interface já implementadas

> Registro das convenções de UI adotadas depois dos docs 00–05. Onde contradizem aqueles docs, valem estas.

## Decisao

1. **Confirmação em ações críticas.** Ações que mexem com dinheiro, matrícula ou status passam por confirmação: registrar pagamento (diálogo que exige a forma de pagamento), desfazer pagamento, reabrir/cancelar cobrança, gerar e resetar cobranças, cancelar matrícula, promover/remover da lista de espera, remover da aula, todo **Inativar e Reativar**, descartar formulário de aluno preenchido, e salvar horários que deixam aulas fora do expediente. Ações frequentes e fáceis de desfazer (marcar presença, restaurar instrutor titular) ficam em um clique.
   - Implementação: `useConfirmAction()` em `components/shared/confirm-action-dialog.tsx` (`if (!(await confirm({...}))) return;` e renderizar `dialog`), `ConfirmActionDialog` para casos declarativos, `features/turmas/components/register-payment-dialog.tsx` para pagamento.
   - Botão destrutivo usa `AlertDialogAction variant="destructive"`; **não** sobrescrever com `className` (o `asChild` junta classes sem tailwind-merge e o `bg-primary` vence).
2. **Personalizador de tema com sidebar escura por padrão.** `lib/theme-customizer.ts` controla cor base, cor de destaque, raio, fonte, estilo e cor do menu, com presets. O padrão do produto é `menuColor: "inverted"` (sidebar escura no tema claro); o script de boot em `app/layout.tsx` usa o mesmo padrão para não piscar. Com o menu invertido, o logo troca para a versão de fundo escuro (`.sidebar-logo-light/-dark` em `globals.css`). A escolha salva pelo usuário prevalece. Tema claro/escuro via `next-themes` (`attribute="class"`).
3. **Sem rolagem elástica no documento** (`overscroll-behavior-y: none` em `html, body`): no macOS/iOS o efeito revelava o fundo branco como uma faixa sobre a sidebar escura.
4. **Agenda feita à mão** (Dia/Semana/Mês) em `features/appointments/components/calendar-panel.tsx` e `schedule-day-grid.tsx`; `react-big-calendar` foi descartado (ver banner em [`05-agenda-react-big-calendar.md`](05-agenda-react-big-calendar.md)).
5. **Listas legíveis no celular:** quando a linha tem ações largas (valor + botão + menu), elas descem para baixo do texto em telas estreitas (ex.: `billing-view.tsx`). O e2e `mobile.spec.ts` garante que não há rolagem lateral.
6. **Controle segmentado** (`SegmentedChoiceField` em `components/form`) para escolhas de 2–3 opções com descrição curta, no lugar de cards grandes de texto (ex.: Regras de Cobrança).
7. **Alternância Lista / Cards sem flicker no refresh (`useViewMode`, `ViewModeProvider`, `ViewModeSkeleton`).** As telas principais de listagem (`Turmas`, `Modalidades`, `Planos`, `Alunos/Clientes`, `Equipe/Profissionais`) permitem alternar entre **Lista** e **Cards** via `ViewModeToggle` e `useViewMode(storageKey)` (`components/shared/list/view-mode-toggle.tsx`).
   - Para evitar que um refresh (`F5`/`Cmd+R`) mostre primeiro o skeleton de Lista (HTML do servidor) e depois troque para o de Cards na hidratação, o estado é persistido em `localStorage` **e** em cookie (`gestarahub_view_mode_<key>`), lido no servidor em `app/(app)/layout.tsx` (`ViewModeProvider`) e reforçado por script síncrono pré-pintura (`PRE_PAINT_VIEW_MODE_SCRIPT`, em `components/shared/list/view-mode-script.ts`, injetado no `<head>` do root layout `app/layout.tsx`; `<script>` dentro de componente client faz o React 19 avisar) + guard CSS (`html[data-vm-<key>]` e `ViewModeSkeleton` em `globals.css`).
   - **Coachmark contextual (`ViewModeCoachmark`):** em **Alunos** (`clients-list.tsx`), ao atingir 3 ou mais registros pela primeira vez (`gestarahub_coachmark_view_mode_clients`), a listagem muda automaticamente para `Cards` e exibe um coachmark único apresentando a alternância.
8. **Skeletons em alto nível e zero layout shift (`ListSummaryBar` + skeletons por tela).**
   - `ListSummaryBar` recebe `isLoading={isPending}` nas 9 telas de listagem para renderizar um skeleton na altura exata do contador (`"5 turmas cadastradas"`, `"8 alunos cadastrados"`), evitando salto vertical ao finalizar o carregamento.
   - Os skeletons de linha e de card (`TurmaSkeletonCards`, `ClientSkeletonCards`, `PlanSkeletonCards`, `ProfessionalSkeletonCards`) usam **linhas inteiras em alto nível** (sem fragmentar cada badge/ícone interno), preservando a proporção visual (ex.: linha do nome mais larga que a do telefone, status compacto nos cards de aluno, preço alinhado à direita em planos) e um indicador vertical discreto (`h-4 w-1.5 rounded-full` dentro de `size-8`) no lugar do menu `⋮`.
   - `OnboardingTopBanner` checa `isOnboardingAlreadyComplete()` no `localStorage` antes de exibir o skeleton da barra de passo a passo, não piscando quando o cadastro básico já foi concluído.
9. **Modais protegidos contra clique externo e expansão fullscreen no mobile (`DialogContent`).**
   - `closeOnInteractOutside` tem padrão `false` em `components/ui/dialog.tsx` e no modal de boas-vindas — modais só fecham pelo botão `X`, tecla `Escape` ou botões de ação explícitos.
   - O botão **Expandir / Restaurar** (`expandable`) nos modais de formulário usa `sm:max-w-4xl lg:max-w-5xl sm:h-[92vh]` no desktop e ocupa **100% da tela disponível no mobile** (`max-sm:w-screen max-sm:h-dvh max-sm:rounded-none max-sm:border-0`).
10. **Tour Guiado Híbrido no Mobile (`ProductTour`).** No celular (`isMobile` via `useSidebar`), o passo inicial destaca o botão hambúrguer (`[data-sidebar="trigger"]`), abre automaticamente a gaveta do menu (`setOpenMobile(true)`) durante os passos de navegação da sidebar, e fecha (`setOpenMobile(false)`) ao focar elementos da página ou encerrar o tour. `SheetContent` ignora interações externas em `[data-product-tour]` e aplica `border-sidebar-border` para não exibir borda branca no menu escuro.
11. **Combobox com largura fixa e Matrícula rápida (`EnrollStudentsDialog`).**
    - `Combobox` (`components/shared/combobox.tsx`) usa `w-[var(--radix-popover-trigger-width)]` no `PopoverContent` para não mudar de largura conforme o texto digitado, e `CommandEmpty` suporta quebra em múltiplas linhas (`whitespace-pre-line`).
    - `EnrollStudentsDialog` mantém o texto buscado focado e selecionado (`focus()` + `select()`) ao marcar um aluno (permitindo selecionar múltiplos homônimos ou sobrescrever digitando direto), aceita `Enter` quando há 1 resultado disponível e exibe indicador flutuante de rolagem (`"Mais alunos abaixo ⌄"`).

## Contexto

Pedido do dono do produto para evitar cliques acidentais em ações sensíveis e modais, preferência pela sidebar escura, alternância Lista/Cards com descoberta guiada e sem flicker no refresh, e refinamentos visuais e de usabilidade levantados nos testes de 22–25/09/2026.

## Escopo

`apps/web/src/components/shared/confirm-action-dialog.tsx`, `components/shared/list/view-mode-toggle.tsx`, `components/shared/list/list-summary-bar.tsx`, `components/shared/combobox.tsx`, `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/sidebar.tsx`, `features/onboarding/components/product-tour.tsx`, `features/turmas/components/enroll-students-dialog.tsx`, `lib/theme-customizer.ts`, `app/(app)/layout.tsx`, `app/globals.css`.

## Alternativas

- **Confirmar tudo:** rejeitado; confirmação em excesso acostuma a clicar sem ler.
- **Desfazer via toast ("desfazer" por alguns segundos) em vez de confirmar:** não adotado por ora; exige estado pendente nos services do mock.
- **Sidebar clara como padrão (shadcn neutro):** substituída pela escura por escolha do produto.
- **Skeletons hiper-detalhados (um bloco por badge/ícone):** rejeitado por poluir visualmente o carregamento; adotadas linhas inteiras em alto nível com a mesma altura e silhueta do item real.

