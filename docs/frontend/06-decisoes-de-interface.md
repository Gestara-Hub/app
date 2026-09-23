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

## Contexto

Pedido do dono do produto para evitar cliques acidentais em ações sensíveis, preferência pela sidebar escura, e bugs visuais achados no teste de 22/09/2026 (botões destrutivos pretos, faixa branca no macOS, linhas quebradas no celular).

## Escopo

`apps/web/src/components/shared/confirm-action-dialog.tsx`, `components/shared/entity-manager-dialog.tsx`, `lib/theme-customizer.ts`, `app/layout.tsx`, `app/globals.css`, `components/form/segmented-choice-field.tsx`.

## Alternativas

- **Confirmar tudo:** rejeitado; confirmação em excesso acostuma a clicar sem ler.
- **Desfazer via toast ("desfazer" por alguns segundos) em vez de confirmar:** não adotado por ora; exige estado pendente nos services do mock.
- **Sidebar clara como padrão (shadcn neutro):** substituída pela escura por escolha do produto.
