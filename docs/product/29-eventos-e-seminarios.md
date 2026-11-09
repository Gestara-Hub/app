# Eventos e seminários (módulo próprio)

Data: 09/11/2026 · Status: Decidido (fases 1 e 2 feitas em 09/11/2026; fases 3 a 5 por fazer) · Código: `packages/contracts/src/event.ts`, `packages/core/src/events.ts`, `apps/web/src/services/events`, `apps/web/src/features/events`, rotas `app/(app)/events`, migração `20261109000091_events.sql` · Testes: `packages/core/test/events.test.ts`, `services/__tests__/events.test.ts`, `services/events/__tests__/events.db.test.ts`; e2e `events` a escrever

## Decisão

Seminários, workshops, aulões e exames com professor convidado entram como um **módulo próprio, "Eventos"**, separado das turmas. O módulo tem cadastro, inscrição, cobrança, chamada e regras próprias. Ele compartilha com as turmas só a fundação (alunos, cobranças, certificados, comunicação, auditoria) e o **Calendário**, onde o evento aparece com card de outra cor.

Alternativa rejeitada: evento como variação da turma (`ClassGroup.kind`). Reaproveitaria mais, mas deixaria a turma cheia de condicionais e travaria regras próprias do evento (inscrição por dia, convidado, inscrição pública). Ver "Alternativas".

## Contexto

Uma academia recebe um sensei de outra cidade para 3 aulas num fim de semana, ou faz um workshop de 1 dia. Hoje isso só cabe como turma com grade semanal e sessões canceladas na mão, com instrutor obrigatório da equipe e mensalidade como padrão. Nada disso é contínuo: tem data de início e fim, cobra uma vez, e o público mistura alunos da casa com visitantes.

## Escopo

**É evento:** qualquer atividade com datas fechadas e inscrição única: seminário, workshop, aulão, exame de faixa coletivo, imersão, apresentação. Dura de 1 dia a algumas semanas.

**Não é evento:** turma com fim (curso), que continua no modelo de turmas com `billingMode: course`; aula avulsa de turma regular; agendamento 1 a 1.

### 1º corte

- Cadastro do evento com datas soltas (um ou mais dias, cada um com início e fim).
- Instrutor da equipe **ou** convidado (nome livre e de onde vem).
- Inscrição de aluno da casa ou de visitante (cadastro rápido só com nome, já existente).
- Cobrança: valor fechado com parcelas, por dia, ou sem cobrança. Lote opcional (preço menor até uma data); o fluxo padrão é sem lote.
- Chamada por dia do evento.
- Financeiro do evento: aba própria com o que entrou, o que falta e as saídas ligadas ao evento; tudo continua indo para o Financeiro geral.
- Evento no Calendário com cor própria, lista "Eventos", card "Próximos eventos" no Painel.
- Certificado de participação (Pro).

### Fica para depois

- Inscrição pública por link (`/p/events/...`), com as regras de rota pública (dados mascarados, sem escrita a partir da página).
- Materiais do evento (apostila, foto) e avaliação pós-evento.

## Entidades (proposta de contrato)

Nomes em inglês no código, como o resto. Tudo com escopo de tenant carimbado pelo serviço.

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `Event` | `name`, `description?`, `modalityId?` (Category), `instructorId?` (Professional) **ou** `guestInstructorName?` + `guestInstructorOrigin?`, `capacity?`, `billingMode: "fixed" \| "per_day" \| "free"`, `priceCents?`, `maxInstallments?` (1 a 12), `dayPriceCents?`, `earlyBirdPriceCents?` + `earlyBirdUntil?` (lote, opcional), `countsForProgression?` (padrão false), `status: RecordStatus` | Situação derivada na leitura: `upcoming`, `ongoing`, `finished`, pela primeira e última data. Um dos dois instrutores é obrigatório. |
| `EventSession` | `eventId`, `date`, `start`, `end`, `status: scheduled \| done \| canceled` | Tabela própria, não compartilha `class_sessions`. Uma linha por dia (ou por bloco do dia, se o evento tiver manhã e tarde). |
| `EventRegistration` | `eventId`, `clientId`, `scope: "full" \| "days"`, `sessionIds?`, `status: confirmed \| waitlist \| canceled`, `amountCents`, `installments`, `registeredAt`, `canceledAt?` | A inscrição é o "matricular" do evento. `days` só com `billingMode: per_day`. Lista de espera quando lota (regra dura, diferente da turma: vaga de evento é física). |
| `EventAttendance` | `sessionId`, `registrationId`, `status: present \| absent`, `markedAt` | Chamada do dia. Sem "falta justificada". |
| `Charge` | ganha `kind: "event"` e `eventId?` | Mesma tabela de cobranças; parcelas geradas pelo mesmo ajudante de parcelamento do curso e da cobrança avulsa. `eventId` liga a cobrança ao financeiro do evento. |
| `FinanceEntry` | ganha `eventId?` | Saída (cachê do convidado, passagem, material) ou entrada manual ligada ao evento. Continua no Financeiro geral como hoje. |

Pacote de aulas e plano de mensalidade **não** valem em evento. Evento nunca gasta aula do pacote nem gera mensalidade.

## Regras de negócio

### Cadastro

- Nome*, datas* (ao menos uma), instrutor* (equipe ou convidado), vagas (opcional; sem vagas = ilimitado).
- Datas podem ser editadas até o dia começar; um dia já feito não muda. Cancelar um dia cancela a chamada daquele dia e avisa os inscritos (lembrete no sino, modelo de mensagem "Dia do evento cancelado").
- Instrutor convidado não é usuário nem profissional: não entra na equipe, não recebe pagamento pelo Financeiro de professores, não tem escopo de acesso. Aparece pelo nome no card, no detalhe e no certificado.
- Instrutor da equipe vê o evento em "Meus eventos" com o mesmo escopo das turmas (vê e faz chamada só no que conduz).

### Inscrição

- Aluno da casa (ativo ou inativo) ou visitante pelo cadastro rápido (nome; telefone opcional). O visitante vira `Client` normal e fica em Alunos: serve para relatórios e para aproveitar o cadastro se ele passar a frequentar. Selo **"Visitante"** derivado (só inscrição em evento, nenhuma matrícula, plano ou pacote) e filtro em Alunos; a situação do cadastro não muda sozinha.
- Inscrição completa ou por dia (só em `per_day`).
- Lotou: entra na lista de espera; promover abre a inscrição com a cobrança.
- Cancelar inscrição: parcelas futuras canceladas, pagas ficam, vencidas continuam (mesma regra do curso). Confirmação obrigatória (ação com dinheiro).
- Inscrição não cria matrícula em turma, não muda plano e não conta como "virou aluno" na conversão de experimental.

### Chamada

- Por dia do evento, mesma tela de chamada das turmas em aparência (presente, ausente, "adicionar quem apareceu").
- Quem aparece sem inscrição: "Adicionar neste dia" cria inscrição `days` daquele dia (com cobrança do dia, se houver).
- Presença em evento **não** entra na frequência mínima da graduação por padrão. O evento tem a opção "Conta para a graduação" (`countsForProgression`), pensada para exame de faixa coletivo; ligada, cada presença conta como uma aula na modalidade do evento.
- Evento não tem experimental. Quem vem conhecer entra como inscrito (pago ou grátis). "Virou aluno" continua sendo matrícula, plano ou pacote em turma.

### Cobrança

| `billingMode` | Tela | O que gera |
| --- | --- | --- |
| `fixed` | "Valor fechado" | `Valor*`, `Parcelas até` (à vista a 12x). Inscrição pergunta valor (editável), parcelas e 1º vencimento e gera as parcelas `Charge.event`. |
| `per_day` | "Por dia" | `Valor do dia*`. Inscrição por dia gera uma cobrança por dia escolhido; inscrição completa soma os dias (editável). |
| `free` | "Sem cobrança" | Nada. |

- **Lote (opcional):** em `fixed`, "Preço até dd/mm" com valor menor. Até essa data a inscrição sugere o valor do lote; depois, o valor cheio. O valor continua editável na inscrição. Sem lote configurado, nada muda na tela.

- Pagamento online (Pix e cartão) igual às outras cobranças, sem regra nova.
- Receita do evento aparece no Financeiro geral como categoria "Eventos" e, ao mesmo tempo, no financeiro próprio do evento.

### Financeiro do evento

Aba "Financeiro" no detalhe do evento, lendo as cobranças com `eventId` e os lançamentos com `eventId`:

- Resumo em até 4 cartões: Arrecadado (pago), A receber (em aberto e vencido, com o vencido em sub), Saídas e Resultado (arrecadado menos saídas).
- Lista das cobranças do evento (inscrito, valor, vencimento, situação) e dos lançamentos de saída (cachê do convidado, passagem, hospedagem, material), com "+ Nova saída" que abre o formulário de lançamento já ligado ao evento.
- Tudo o que é lançado aqui aparece também no Financeiro geral, no mês do lançamento, com a categoria "Eventos" e o nome do evento. Nada fica só no evento.
- Repasse ao convidado é lançamento de saída normal, sem automação no 1º corte.

### Encerramento

- Evento termina sozinho no último dia. Lista mostra "Encerrado"; detalhe não oferece "Inscrever".
- Certificado de participação (Pro): emitido do detalhe para os presentes, com nome do evento, datas, carga horária somada e instrutor (equipe ou convidado).

## Calendário compartilhado

- `turmas-calendar-view` passa a ler também `useEventSessions` da semana e misturar na grade e na lista por horário.
- Card de evento com **cor própria fixa** (não por modalidade, como já decidido para as turmas: cor diz tipo, não categoria): borda esquerda e fundo suaves num tom reservado só a eventos, selo "Evento" e o nome do convidado quando houver. Turma segue neutra.
- Filtro "Mostrar: Turmas e eventos / Só turmas / Só eventos" junto dos filtros atuais de modalidade e instrutor.
- Clicar abre o dia do evento (`/events/[id]/sessions/[sessionId]`), não a aula de turma.

## Telas

| Tela | Rota | Conteúdo |
| --- | --- | --- |
| Lista | `/events` | `SearchInput`, filtro de situação (Próximos, Em andamento, Encerrados), `ListSummaryBar`, cards com datas, instrutor, inscritos/vagas, selo de cobrança. "+ Novo evento" no `PageHeader`. |
| Formulário | drawer | Nome*, Modalidade, Instrutor (segmentado: Da equipe / Convidado), Datas* (lista de dias com início e fim, "+ Adicionar dia"), Vagas, Cobrança (segmentado; em "Valor fechado", "Tenho preço de lote" abre valor e data), "Conta para a graduação" (desligado), Descrição. "Adicionar"/"Salvar". |
| Detalhe | `/events/[id]` | Hero (datas, instrutor, vagas, cobrança) + `PageTabs`: Inscritos, Dias, Financeiro. Ações: Inscrever, Editar, Cancelar evento, Certificados (Pro). |
| Dia do evento | `/events/[id]/sessions/[sid]` | Chamada do dia, "Adicionar neste dia", cancelar o dia. |
| Painel | card "Próximos eventos" | 3 próximos com data e inscritos. |

Padrões do doc frontend/07 valem inteiros (botão 36px, labels com `RequiredMark`, sem reticências, menus ⋮ e de contexto nas linhas).

## Permissões e navegação

- Chaves novas `events:view` e `events:manage`, no mesmo desenho das turmas (Proprietário e Gerente tudo; Atendente vê e inscreve; Professor vê os seus e faz chamada). Documentar no product/06.
- Item "Eventos" no menu Dia a dia, só no modelo de turmas, depois de "Turmas".
- Auditoria: criar, editar, cancelar evento; inscrever, cancelar inscrição; chamada.

## Fases de implementação

| Fase | Entrega | Verificação |
| --- | --- | --- |
| 1. Base (**feita 09/11/2026**) | Contrato, migração (4 tabelas, `Charge.kind` event + `eventId`, `FinanceEntry.eventId`), `services/events` com escopo e permissões, slices no mundo, testes Vitest e db | `pnpm test`, db tests da área |
| 2. Telas (**feita 09/11/2026**) | Lista, formulário, detalhe com abas, dia do evento com chamada, nav e RBAC | typecheck, lint, smoke manual |
| 3. Cobrança e financeiro | Inscrição com valor fechado e parcelas, lote opcional, por dia, cancelamento com regra de parcelas, aba Financeiro do evento, categoria "Eventos" e `eventId` no Financeiro geral | testes do serviço de cobrança |
| 4. Calendário e Painel | Sessões de evento no calendário com cor própria e filtro, card no Painel, lembrete "evento amanhã" no sino | manual |
| 5. Pro | Certificado de participação, relatório do evento (inscritos, presença por dia, financeiro) | manual + teste do relatório |
| 6. Depois | Inscrição pública por link | nova proposta |

Cada fase é uma leva de commits pequenos, um assunto cada.

## Como ficou a fase 1 (09/11/2026)

- **Contrato** (`packages/contracts/src/event.ts`): `Event`, `EventSession`, `EventRegistration`, `EventAttendance`, as leituras `EventView` (situação, horas, vagas, preço sugerido de hoje), `EventRegistrationView` (pago, em aberto, vencido, presenças) e `EventSessionDetail` (chamada do dia). `Charge` ganhou `kind: "event"`, `eventId` e `eventRegistrationId`; `FinancialEntry` ganhou `eventId`; `FinancialSystemCategoryKey` ganhou `events`.
- **Regras puras** (`packages/core/src/events.ts`): situação pelas datas não canceladas, carga horária, lote valendo e preço sugerido (lote, cheio, por dia ou zero).
- **Banco** (migração 91): tabelas `events`, `event_sessions`, `event_registrations` e `event_attendances`, leitura por qualquer membro do espaço e gravação só pelo servidor (`apply_world_changes`); `charges.kind` aceita `event`; a categoria "Eventos e seminários" virou de sistema (`system_key = events`) nos espaços que já a tinham e nos novos; a exportação LGPD leva as tabelas novas.
- **Serviço** (`services/events`, namespace `events` no registro): `list`, `getById`, `listSessions` (período, para o Calendário), `getSessionDetail`, `create`, `update`, `cancelSession`, `cancelEvent`, `listRegistrations`, `register`, `promoteFromWaitlist`, `cancelRegistration`, `markEventAttendance`, `markManyEventAttendance`, `clearEventAttendance`. Recortes por método (`eventSlices`).
- **Permissões:** `events:view` (os quatro perfis; o professor só nos eventos em que é o instrutor) e `events:manage` (dono e gerente). Inscrever, promover e cancelar inscrição usam `enrollment:manage`; a chamada do dia usa `attendance:mark`. Evento de convidado só aparece para quem gere (o convidado não é usuário).
- **Inscrição:** evento cancelado ou já terminado não aceita; aluno inativo não entra; um aluno só uma vez por evento. Lotou: entra como `waitlist`, sem cobrança. Sem `payment`, vale o preço sugerido de hoje à vista vencendo hoje; o valor é editável e pode ser zero (cortesia, sem parcela). Parcelas só na inscrição completa de evento `fixed`, até `maxInstallments`.
- **Por dia** (`per_day`): inscrição `days` com os dias escolhidos gera **uma cobrança por dia**, todas com o mesmo vencimento, descrição "Nome · dd/mm" e `sessionId` do dia; inscrição completa soma os dias. Evento `fixed` ou `free` não aceita inscrição por dia.
- **Cancelar inscrição:** parcelas pagas ficam, as que vencem depois de hoje saem (`canceledBy: system`, Pix e link cancelados), as vencidas e a de hoje continuam. Cancelar o evento faz o mesmo em todas as inscrições e cancela os dias; evento já terminado não cancela.
- **Editar dias:** dia com data até hoje, cancelado ou com chamada feita não sai nem muda; os demais mudam ou saem; dia sem `id` é criado. Dois blocos do mesmo dia não podem se cruzar.
- **Chamada:** presente ou ausente por inscrito e dia, só no dia ou depois, só de inscrição confirmada que cobre o dia (completa, ou por dias com aquele dia). Sem falta justificada. `countsForProgression` está gravado, mas ainda não entra na frequência da graduação (fase 2 ou 3).
- **Lista:** próximos primeiro (pela primeira data), encerrados no fim (do mais recente ao mais antigo); busca pelo nome do evento e do convidado.
- **Ainda não feito:** telas, navegação, Calendário com cor própria, aba Financeiro do evento (as cobranças já carregam `eventId`), selo "Visitante" em Alunos, certificado e relatório.

## Como ficou a fase 2 (09/11/2026)

- **Menu:** "Eventos" no Dia a dia, depois de Turmas, só no modelo de turmas (`events:view`). Rotas em `app/(app)/events` (lista, `[id]`, `sessions/[sessionId]`), guardadas por `requirePermission("events:view")`.
- **Lista** (`EventsView`): busca pelo nome do evento ou do convidado, filtro de situação (Todos, Em breve, Em andamento, Encerrado, Cancelados), `ListSummaryBar`, linhas com nome, modalidade, selo de situação (Em andamento, Encerrado, Lotado, Cancelado), datas ("15/11 a 17/11 (3 dias)"), horas, quem conduz ("(convidado)") e a cobrança. Menu ⋮ e de contexto com Editar e Cancelar evento (`events:manage`). Vazio: guia "Nenhum evento ainda".
- **Formulário** (`EventFormDrawer`, drawer): Nome*, Modalidade, Quem conduz (segmentado Da equipe / Convidado; convidado abre nome* e "De onde vem"), Dias* (linhas com data, início e fim, "+ Adicionar dia"; dia já feito ou cancelado aparece com cadeado e não muda), Vagas (vazio = sem limite), Cobrança em cartões (Valor fechado com Parcelas até e "Tenho preço de lote" abrindo valor e data; Por dia com valor do dia; Sem cobrança), "Conta para a graduação" e Descrição. "Adicionar"/"Salvar" e erros do serviço mapeados por campo.
- **Detalhe** (`EventDetailView`): "‹ Voltar", título com selo e modalidade, linha com datas, horas, quem conduz, vagas, cobrança e "Conta para a graduação"; "Inscrever" (`enrollment:manage`, só evento ativo e não encerrado) e menu ⋮ com Editar e Cancelar evento. Abas: Inscritos (confirmados e cancelados, com "Pago", "R$ x a receber", "R$ x vencido" ou "Sem cobrança" e as presenças), Espera (só quando há alguém; ação Promover) e Dias (data, horário, "Hoje", dia cancelado riscado; clicar abre a chamada; Cancelar dia só em dia futuro).
- **Inscrever** (`RegisterDrawer`): aluno ativo que ainda não está no evento; em evento por dia, "Todos os dias" ou "Só alguns dias" com a lista de dias e o valor de cada um; pagamento com valor sugerido (lote aplicado quando vale) editável, parcelas (só valor fechado e inscrição completa) e vencimento. Evento lotado mostra o aviso e o botão vira "Pôr na espera", sem cobrança. Promover da espera reusa o drawer só com o pagamento.
- **Dia do evento** (`EventSessionView`): "‹ Voltar" para o evento, nome com selo "Evento" (cor própria, roxo), data, horário e quem conduz; "N de M presentes" e "Todos vieram"; linhas com o círculo de presença (toque marca presente, de novo desmarca), menu com Marcar falta e Desmarcar. Dia futuro: "A chamada abre no dia do evento", sem marcação. Dia cancelado: selo e sem marcação.
- **Ainda não feito** (fases 3 a 5): aba Financeiro do evento, cards de evento no Calendário e no Painel, selo "Visitante" em Alunos, certificado e relatório, e2e.

## Decisões (09/11/2026)

1. **Graduação:** presença em evento não conta por padrão; opção "Conta para a graduação" no evento, para exame de faixa coletivo.
2. **Visitante:** fica em Alunos com selo "Visitante" derivado e filtro; a situação do cadastro não muda sozinha.
3. **Convidado:** só o nome (e de onde vem). Não vira profissional nem usuário.
4. **Lote:** entra no 1º corte como configuração opcional; sem lote, o fluxo é o padrão.
5. **Experimental:** evento não tem. Visitante entra como inscrito e fica salvo em Alunos para relatórios e para aproveitar o cadastro se passar a frequentar.
6. **Nome:** "Eventos".
7. **Financeiro do evento:** aba própria no detalhe (arrecadado, a receber, saídas, resultado), com tudo indo também para o Financeiro geral.

## Alternativas

- **Variação da turma** (`ClassGroup.kind: event`, datas soltas no lugar da grade). Menos código e tudo já lido por relatórios e ficha. Rejeitada em 09/11/2026 por decisão do produto: o módulo próprio permite regras completas (inscrição por dia, convidado, lista de espera dura, inscrição pública) sem encher a turma de condicionais.
- **Agendamento (modelo 1)**. Não serve: é 1 a 1, sem inscrição em grupo nem chamada.
