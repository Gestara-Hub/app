# 16 — Backlog da barbearia (Modelo 1: agendamento)

> ⏸️ **Standby.** Levantamento feito em 23/09/2026 numa revisão de bugs e UI/UX do projeto inteiro. O foco atual do MVP é a academia (Modelo 3), então estes itens ficam registrados para uma próxima rodada do Modelo 1.
>
> Itens que valem para os dois modelos (guarda de rota, login, plural, onboarding, etc.) **não estão aqui**: entram na rodada da academia porque também a afetam.

**Evidência:** 🟢 reproduzido no navegador · ⚪ encontrado na revisão de código, ainda não reproduzido.

---

## Bugs graves

### B1 — Loop infinito de confirmações ao agendar 🟢
- **Onde:** `apps/web/src/features/appointments/components/appointment-form.tsx:186-205`
- **Problema:** cada confirmação reenvia só o próprio "pode" (override) e descarta os anteriores.
- **Cenário:** domingo com a unidade fechada e um profissional sem expediente no domingo. "Agendar fora do expediente da unidade?" → "Agendar fora do horário do profissional?" → volta ao primeiro, sem fim. O agendamento nunca é salvo. O mesmo acontece com o almoço.
- **Sugestão:** acumular as confirmações (`{ ...opts, allowX: true }`) a cada reenvio.

### B2 — Remarcar e séries não aceitam as regras moles ⚪
- **Onde:** `apps/web/src/services/appointmentsService.ts:337` e `:421`; `reschedule-appointment-dialog.tsx:120-130`; `apps/web/src/services/recurrenceService.ts:100-107` e `:140`; `series-form-dialog.tsx:81-83`
- **Problema:** remarcar e criar série validam sem os overrides (`allowBreak`, `allowOutsideHours`, `allowOutsideBusinessHours`), e o dialog só mostra o erro. A série ainda exige que o profissional ofereça o serviço, regra que no agendamento avulso é só informativa.
- **Cenário:** um profissional sem horário cadastrado (o cadastro começa vazio) não consegue ter nenhum agendamento remarcado, e a série dele cria 0 ocorrências com o aviso "todas em conflito". Remarcar para o almoço é barrado, embora criar no mesmo horário seja permitido.
- **Sugestão:** repetir no Remarcar e na série o mesmo fluxo de confirmação do formulário de criação, e alinhar a regra de serviço por profissional.

### B3 — A visão Dia esconde agendamentos existentes ⚪
- **Onde:** `apps/web/src/features/appointments/components/calendar-panel.tsx:137-144` e `:313`; `schedule-day-grid.tsx:34-39`
- **Problema:** só existem colunas para profissionais ativos que atendem naquele dia, e um dia marcado como fechado troca a grade inteira por "Unidade fechada".
- **Cenário:** um agendamento feito com "agendar mesmo assim" num dia de folga ou com a unidade fechada não aparece. Os de profissional inativado também somem. Um horário muito fora do expediente fica cortado pela janela de ±60 min.
- **Sugestão:** criar coluna para quem tem agendamento no dia, mostrar a grade (com aviso) mesmo com a unidade fechada, e ampliar a janela até o primeiro e o último agendamento.

### B4 — Preço e duração do histórico mudam retroativamente ⚪
- **Onde:** `apps/web/src/services/appointmentsService.ts:170-198` (`toView`)
- **Problema:** o total do agendamento é calculado com o preço e a duração **atuais** do serviço.
- **Cenário:** reajustar o corte de R$ 40 para R$ 50 muda a receita de dias passados e o valor de atendimentos já concluídos.
- **Sugestão:** gravar um snapshot de preço e duração por serviço no agendamento (evoluir o contrato) e ler dele.

## Bugs médios

### B5 — Editar só a observação revalida o horário ⚪
- **Onde:** `apps/web/src/services/appointmentsService.ts:298-304`; `appointment-form.tsx:70-72` e `:166-176`
- **Cenário:** se o serviço ou o profissional foi inativado depois, editar só a observação falha ("X está inativo"), e a combo aparece vazia. Se o horário do profissional mudou, surge "Agendar fora do horário?" só por editar a nota. O Editar também troca o profissional sem passar pela trilha de remarcação.
- **Sugestão:** revalidar o horário só quando profissional, serviços ou horário mudarem; incluir os registros atuais nas opções mesmo inativos; tirar o profissional do Editar.

### B6 — Inativar profissional deixa os agendamentos futuros órfãos ⚪
- **Onde:** `apps/web/src/services/professionalsService.ts:173-189`; `inactivate-professional-dialog.tsx:42-51`
- **Sugestão:** a confirmação deve mostrar quantos agendamentos futuros existem e oferecer remarcar ou cancelar (ou bloquear a inativação enquanto houver futuros).

### B7 — Perfil Profissional sem vínculo vê a agenda de todos ⚪
- **Onde:** `apps/web/src/features/auth/scope.ts:13`, usado em `calendar-panel.tsx:115` e `list-panel.tsx:85`
- **Cenário:** um usuário "Profissional" sem `professionalId` (o formulário de usuário desfaz o vínculo quando o nome é digitado à mão) enxerga e altera o status de qualquer agendamento.
- **Sugestão:** sem vínculo = agenda vazia com aviso; o formulário de usuário deve exigir o vínculo para esse perfil.

### B8 — Ações de status sem checar data nem transição ⚪
- **Onde:** `appointment-detail-dialog.tsx:145-146` e `:357`; `appointmentsService.ts:457`
- **Cenário:** "Não compareceu", "Iniciar" e "Concluir" aparecem em agendamentos futuros, e `setStatus` aceita qualquer transição, inclusive cancelar sem motivo.
- **Sugestão:** esconder essas ações antes do horário e validar a máquina de estados no service.

### B9 — Série com data final antes do início ⚪
- **Onde:** `apps/web/src/features/appointments/series-schema.ts:24-30`; `recurrenceService.ts:126`
- **Cenário:** a série é gravada com 0 ocorrências, e o toast diz "todas em conflito", o que não é verdade.
- **Sugestão:** validar `untilDate >= startDate` e não gravar a série quando nada for criado.

## UX

### B10 — Visão Dia desproporcional 🟢
- **Cenário:** com 1 profissional, a coluna ocupa metade da largura e o resto fica vazio. A grade começa às 07:00 com a unidade abrindo às 08:00.
- **Sugestão:** colunas que ocupam a largura disponível, e a janela de horas pelo expediente do dia.

### B11 — Bloqueio de agenda sem saída ⚪
- **Onde:** `schedule-day-grid.tsx` (`BlockCard`); `features/appointments/hooks/use-time-blocks.ts:32-47`; `services/timeBlocksService.ts:67`
- **Cenário:** os hooks de editar e remover bloqueio existem, mas nenhuma tela usa, e o card não é clicável. Um bloqueio criado errado fica para sempre. Criar um bloqueio por cima de agendamentos não gera aviso.
- **Sugestão:** card clicável com Editar e Remover (remover com confirmação) e aviso quando houver agendamentos no intervalo.

### B12 — Semana e Mês não abrem o detalhe; grade sem teclado ⚪
- **Onde:** `schedule-day-grid.tsx:254`, `:338` e `:420`; `list-panel.tsx:289-303`
- **Cenário:** na Semana e no Mês, clicar num agendamento só troca para o Dia. Criar clicando no espaço vazio não funciona pelo teclado. Na Lista, um período invertido passa sem aviso.
- **Sugestão:** itens clicáveis que abram o detalhe, uma ação "Novo aqui" focável e validação do período.

### B13 — Mensagens de série e remarcação pouco úteis ⚪
- **Onde:** `reschedule-appointment-dialog.tsx:113-116`; `series-form-dialog.tsx:99-105`; `appointmentsService.ts:448`
- **Cenário:** "1 ocorrência(s) criada(s); 3 em conflito não foram criadas. Resolva manualmente." sem dizer quais datas.
- **Sugestão:** plural real e um resultado listando as datas e os motivos dos conflitos.
