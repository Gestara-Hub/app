# Eventos e seminários (módulo próprio)

Data: 09/11/2026 · Status: Feito (fases 1 a 5 em 09/11/2026; selo "Visitante" em Alunos em 11/11/2026; inscrição pelo link, ingresso e leitura sem internet em 12/11/2026) · Código: `packages/contracts/src/event.ts`, `packages/core/src/events.ts`, `apps/web/src/services/events`, `apps/web/src/features/events`, rotas `app/(app)/events`, migração `20261109000091_events.sql` · Testes: `packages/core/test/events.test.ts`, `services/__tests__/events.test.ts`, `services/events/__tests__/events.db.test.ts`; e2e `events` a escrever

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
| `Event` | `name`, `description?`, `modalityId?` (Category), `instructors` (lista de quem conduz, desde 10/11/2026: cada item `{ id, professionalId? }` da equipe **ou** `{ id, guestName, guestOrigin? }` convidado), `capacity?`, `billingMode: "fixed" \| "per_day" \| "free"`, `priceCents?`, `maxInstallments?` (1 a 12), `dayPriceCents?`, `earlyBirdPriceCents?` + `earlyBirdUntil?` (lote, opcional), `countsForProgression?` (padrão false), `status: RecordStatus` | Situação derivada na leitura: `upcoming`, `ongoing`, `finished`, pela primeira e última data. Ao menos uma pessoa em `instructors`. `EventSession.instructorIds?` diz quem conduz cada bloco (vazio = todos). |
| `EventSession` | `eventId`, `date`, `start`, `end`, `status: scheduled \| done \| canceled` | Tabela própria, não compartilha `class_sessions`. Uma linha por dia (ou por bloco do dia, se o evento tiver manhã e tarde). |
| `EventRegistration` | `eventId`, `clientId`, `scope: "full" \| "days"`, `sessionIds?`, `status: confirmed \| waitlist \| canceled`, `amountCents`, `installments`, `registeredAt`, `canceledAt?` | A inscrição é o "matricular" do evento. `days` só com `billingMode: per_day`. Lista de espera quando lota (regra dura, diferente da turma: vaga de evento é física). |
| `EventAttendance` | `sessionId`, `registrationId`, `status: present \| absent`, `markedAt` | Chamada do dia. Sem "falta justificada". |
| `Charge` | ganha `kind: "event"` e `eventId?` | Mesma tabela de cobranças; parcelas geradas pelo mesmo ajudante de parcelamento do curso e da cobrança avulsa. `eventId` liga a cobrança ao financeiro do evento. |
| `FinanceEntry` | ganha `eventId?` | Saída (cachê do convidado, passagem, material) ou entrada manual ligada ao evento. Continua no Financeiro geral como hoje. |

Pacote de aulas e plano de mensalidade **não** valem em evento. Evento nunca gasta aula do pacote nem gera mensalidade.

## Regras de negócio

### Cadastro

- Nome*, datas* (ao menos uma), quem conduz* (uma ou mais pessoas, cada uma da equipe ou convidada), vagas (opcional; sem vagas = ilimitado).
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
- Presença em evento **não** entra na frequência mínima da graduação. Desde 13/11/2026 a opção do evento é "Evento de graduação" (`graduation`, com o repasse opcional à federação `federationFeeCents`): aba Graduação, aptos no Inscrever e repasse no Financeiro ([product/30](30-graduacao-em-grupo-e-troca-de-turma.md) §4). A antiga "Conta para a graduação" (`countsForProgression`) nunca foi ligada e saiu.
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
- **Com os conceitos das telas de dinheiro (12/11/2026, pedido do dono):** os 4 cartões são `StatCard` com o link que filtra a lista (Recebido "Ver pagas", A receber "Ver a receber", Saídas "Ver saídas" desce até os lançamentos, Resultado "Ver no Financeiro"). As cobranças das inscrições seguem a tela de Cobranças: busca "Buscar aluno...", abas A receber, Em atraso, Pagas, Isentas e encerradas (quando há) e Todas com contagem, e a mesma linha (iniciais, nome com link para a ficha, "venceu 10/11 · 2 dias" em vermelho no lugar do selo, valor à direita e as ações de Cobranças). Os lançamentos do evento seguem o Financeiro: ícone de entrada ou saída, "Saída · vence 10/11", valor com sinal e ⋮ "Abrir no Financeiro" (no mês do vencimento), sem selo. As funções da linha de cobrança (`cleanSingleSubtitle`, `renderSubtitle`, `statusRepeatsTab`) saíram de `billing-view.tsx` para `charge-parts.tsx` e servem às duas telas. Teste: `e2e/eventos.spec.ts`, "aba Financeiro…" (cartões, abas, atraso sem selo, busca, marcar pago atualizando os cartões e "Abrir no Financeiro"), no computador e no celular (13/11/2026).

### Encerramento

- Evento termina sozinho no último dia. Lista mostra "Encerrado"; detalhe não oferece "Inscrever".
- Certificado de participação (Pro): emitido do detalhe para os presentes, com nome do evento, datas, carga horária somada e instrutor (equipe ou convidado).

## Calendário compartilhado

- `turmas-calendar-view` passa a ler também `useEventSessions` da semana e misturar na grade e na lista por horário.
- Card de evento com **cor própria fixa** (roxo, reservado só a eventos): borda esquerda e fundo suaves, selo "Evento" e o nome do convidado quando houver. Desde 10/11/2026 a aula de turma ganha a cor da sua modalidade (faixa à esquerda e fundo leve, pela ordem de criação das modalidades, paleta de 8 tons sem roxo; `features/turmas/modality-colors.ts`), com a bolinha da cor no filtro de modalidade. Na grade (10/11/2026), "Evento" e a ocupação ("8/12", "Lotada" em âmbar, "12 inscritos") ficam na linha do horário, o dia de hoje é marcado só pelo círculo no número, dia sem nada fica com 1/3 da largura, o que já terminou esmaece e o que está acontecendo ganha um anel na cor da modalidade. Próximo passo: campo de cor na modalidade, escolhido no formulário.
- Filtro "Mostrar: Turmas e eventos / Só turmas / Só eventos" junto dos filtros atuais de modalidade e instrutor.
- Clicar abre o dia do evento (`/events/[id]/sessions/[sessionId]`), não a aula de turma.

## Telas

| Tela | Rota | Conteúdo |
| --- | --- | --- |
| Lista | `/events` | `SearchInput`, filtro de situação (Próximos, Em andamento, Encerrados), `ListSummaryBar`, cards com datas, instrutor, inscritos/vagas, selo de cobrança. "+ Novo evento" no `PageHeader`. |
| Formulário | drawer | Nome*, Modalidade, Instrutor (segmentado: Da equipe / Convidado), Datas* (lista de dias com início e fim, "+ Adicionar dia"), Vagas, Cobrança (segmentado; em "Valor fechado", "Tenho preço de lote" abre valor e data), "Evento de graduação" (desligado; só com modalidade de trilha) e "Repasse à federação por aluno", Descrição. "Adicionar"/"Salvar". |
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
| 3. Cobrança e financeiro (**feita 09/11/2026**) | Inscrição com valor fechado e parcelas, lote opcional, por dia, cancelamento com regra de parcelas, aba Financeiro do evento, categoria "Eventos" e `eventId` no Financeiro geral | testes do serviço de cobrança |
| 4. Calendário e Painel (**feita 09/11/2026**, sem o lembrete do sino) | Sessões de evento no calendário com cor própria e filtro, card no Painel; lembrete "evento amanhã" no sino ficou para depois | manual |
| 5. Pro (**feita 09/11/2026**) | Certificado de participação, relatório do evento (inscritos, presença por dia, financeiro) | manual + teste do relatório |
| 6. Inscrição pelo link (**feita 12/11/2026**) | Inscrição pública, vaga garantida, ingresso, leitor e leitura sem internet | Vitest, db e e2e (`eventos-inscricao-link`) |

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
- **Chamada:** presente ou ausente por inscrito e dia, só no dia ou depois, só de inscrição confirmada que cobre o dia (completa, ou por dias com aquele dia). Sem falta justificada. A presença não entra na frequência da graduação (o evento de graduação usa a presença só para saber quem pode graduar, [product/30](30-graduacao-em-grupo-e-troca-de-turma.md) §4).
- **Lista:** próximos primeiro (pela primeira data), encerrados no fim (do mais recente ao mais antigo); busca pelo nome do evento e do convidado.
- **Ainda não feito:** telas, navegação, Calendário com cor própria, aba Financeiro do evento (as cobranças já carregam `eventId`), selo "Visitante" em Alunos, certificado e relatório.

## Como ficou a fase 2 (09/11/2026)

- **Menu:** "Eventos" no Dia a dia, depois de Turmas, só no modelo de turmas (`events:view`). Rotas em `app/(app)/events` (lista, `[id]`, `sessions/[sessionId]`), guardadas por `requirePermission("events:view")`.
- **Lista** (`EventsView`): busca pelo nome do evento ou do convidado, filtro de situação (Todos, Em breve, Em andamento, Encerrado, Cancelados), `ListSummaryBar`, linhas com nome, modalidade, selo de situação (Em andamento, Encerrado, Lotado, Cancelado), datas ("15/11 a 17/11 (3 dias)"), horas, quem conduz ("(convidado)") e a cobrança. Menu ⋮ e de contexto com Editar e Cancelar evento (`events:manage`). Vazio: guia "Nenhum evento ainda".
- **Formulário** (`EventFormDrawer`, drawer): Nome*, Modalidade, Quem conduz (segmentado Da equipe / Convidado; convidado abre nome* e "De onde vem"), Dias* (cabeçalho Data, Início e Fim uma vez e linhas simples separadas por divisória, sem card por linha; no celular a data fica em cima e os horários embaixo; "+ Adicionar dia"; dia já feito ou cancelado aparece com cadeado e não muda), Vagas (vazio = sem limite), Cobrança em cartões (Valor fechado com Parcelas até e "Tenho preço de lote" abrindo valor e data; Por dia com valor do dia; Sem cobrança), "Evento de graduação" (só com modalidade de trilha; abre "Repasse à federação por aluno") e Descrição. "Adicionar"/"Salvar" e erros do serviço mapeados por campo.
- **Detalhe** (`EventDetailView`): "‹ Voltar", título com selo e modalidade, linha com datas, horas, quem conduz, vagas, cobrança e "Evento de graduação" (com a aba Graduação desde 13/11/2026); "Inscrever" (`enrollment:manage`, só evento ativo e não encerrado) e menu ⋮ com Editar e Cancelar evento. Abas: Inscritos (confirmados e cancelados, com "Pago", "R$ x a receber", "R$ x vencido" ou "Sem cobrança" e as presenças), Espera (só quando há alguém; ação Promover) e Dias (data, horário, "Hoje", dia cancelado riscado; clicar abre a chamada; Cancelar dia só em dia futuro).
- **Inscrever** (`RegisterDrawer`, "Inscrever alunos"): vários alunos de uma vez, no mesmo seletor da matrícula em turma (`StudentMultiSelect` em `@/components/shared`: busca por nome ou telefone, chips dos escolhidos, quem já está inscrito ou na espera aparece desabilitado com o motivo). O bloco "Cobrança do aluno" (ou "Cobrança de cada aluno") segue o formato do curso: Valor, Parcelas e 1º vencimento numa linha, com "Vale para cada aluno". As inscrições saem em sequência (cada uma reavalia a lotação; quem passar da vaga vai para a espera) e o aviso resume "N inscritos e M na lista de espera", nomeando quem não entrou. Em evento por dia, "Todos os dias" ou "Só alguns dias" com a lista de dias e o valor de cada um; pagamento com valor sugerido (lote aplicado quando vale) editável, parcelas (só valor fechado e inscrição completa) e vencimento. Evento lotado mostra o aviso e o botão vira "Pôr na espera", sem cobrança. Promover da espera reusa o drawer só com o pagamento.
- **Dia do evento** (`EventSessionView`): "‹ Voltar" para o evento, nome com selo "Evento" (cor própria, roxo), data, horário e quem conduz; "N de M presentes" e "Todos vieram"; linhas com o círculo de presença (toque marca presente, de novo desmarca), menu com Marcar falta e Desmarcar. Dia futuro: "A chamada abre no dia do evento", sem marcação. Dia cancelado: selo e sem marcação.
- **Ainda não feito** (fases 3 a 5): aba Financeiro do evento, cards de evento no Calendário e no Painel, selo "Visitante" em Alunos, certificado e relatório, e2e.

## Como ficou a fase 3 (09/11/2026)

A cobrança da inscrição (valor fechado com parcelas, lote, por dia, cancelamento com a regra do curso) já veio na fase 1. A fase 3 fechou o financeiro próprio do evento:

- **Aba "Financeiro"** no detalhe do evento (`EventFinanceTab`), só para quem tem `billing:view`. Quatro cartões: Arrecadado (parcelas pagas), A receber (pendentes e vencidas, com "R$ x já venceu" em âmbar), Saídas (lançamentos de saída ligados ao evento, fora os cancelados; outras entradas manuais aparecem na legenda) e Resultado (recebido mais entradas pagas menos saídas pagas).
- **Cobranças das inscrições:** lista com aluno, situação, valor, parcela e vencimento, com as mesmas ações das Cobranças (registrar pagamento, cobrar online, cancelar) pelo `useChargeActions`.
- **Lançamentos do evento:** lista dos lançamentos com `eventId` e "+ Nova saída" (`finance:manage`), que abre o formulário de lançamento do Financeiro já ligado ao evento (`FinanceEntryFormDialog` com `eventId`; a descrição do drawer diz "Lançamento do evento X. Entra no Financeiro geral também."). Editar, pagar ou cancelar continua no Financeiro geral, que mostra "evento X" na linha.
- **Serviço:** `events.getEventFinance(eventId)` (`EventFinanceView`), permissão `billing:view`, recorte com as cobranças do evento, lançamentos e o que a leitura das cobranças usa. `ChargeFilter.eventId` filtra as Cobranças por evento; `FinancialEntry.eventId` é validado na criação (evento tem de existir). As cobranças de evento já entram no caixa pela categoria de sistema "Eventos e seminários".
- **Ainda não feito** (fases 4 e 5): cards de evento no Calendário e no Painel, selo "Visitante" em Alunos, certificado e relatório.

## Como ficou a fase 4 (09/11/2026)

- **Calendário:** aulas e dias de evento no mesmo formato (`CalendarEntry`, em `features/turmas/calendar-entries.ts`), na grade e na lista. O card de evento tem cor própria fixa (roxo suave, `violet`) e "(convidado)" no nome de quem conduz; a aula tem a cor da modalidade. **Legenda (11/11/2026):** uma linha acima da grade com as modalidades da semana e a cor de cada uma (substituiu o seletor de modalidade) e "Evento" em roxo. Cada item liga e desliga e dá para marcar vários (`?modality=Judô,Muay Thai`, Evento marcado é `?show=events`); sem nada marcado mostra tudo, e "Mostrar todas" limpa. Cada item mostra os cards da sua cor: Evento traz todos os eventos (mesmo os ligados a uma modalidade) e a modalidade só as aulas dela. Marcado ganha borda e ✓, os outros ficam apagados. e, na grade, "Apagado = já passou" com um card em miniatura apagado (40%; ao passar o mouse, "Clique neles para ver a chamada"). Na grade o card de evento não escreve mais "Evento" (o roxo e a legenda dizem; o leitor de tela continua lendo), e com mais de uma pessoa conduzindo mostra a primeira e "+N" (todos no `title`). Hoje (11/11/2026): círculo cheio no número do cabeçalho (o selo "Hoje" escrito foi testado e retirado) e, na coluna de hoje, a linha de "agora" (bolinha, hora e traço na cor de atraso) antes do primeiro horário que ainda não começou, ou no pé da última faixa depois do último; atualiza a cada minuto. A grade não é proporcional ao tempo: a linha separa o que já foi do que vem. As linhas laterais da coluna (sombra na célula) saíram porque não apareciam no Safari do iPhone. O seletor "Mostrar: Turmas e eventos / Só turmas / Só eventos" saiu em 11/11/2026: "só eventos" é o botão Evento da legenda (`?show=events`, usado pelo link de Eventos); `?show=classes` ainda funciona pela URL, sem botão. Os filtros de modalidade (pela legenda) e instrutor valem para os dois. Vindo de uma turma ("Ver aulas no calendário"), só as aulas dela, sem eventos. Clicar no card de evento abre o dia do evento. O hook `useCalendarEventSessions` fica em `features/turmas` para não criar ciclo com `features/events`, que já importa turmas.
- **Painel:** card "Próximos eventos" (`UpcomingEventsCard`), logo abaixo das aulas de hoje, com até 3 eventos em breve ou em andamento (nome, selo, datas, quem conduz e inscritos) e o atalho "Ver eventos". Sem evento à vista, o card não aparece.
- **Não feito nesta fase:** lembrete "evento amanhã" no sino (o motor de lembretes nasce dos modelos de mensagem; fica junto da fase 5 ou de uma rodada de comunicação).

## Como ficou a fase 5 (09/11/2026)

- **Certificado de participação** (Plano Profissional, recurso `certificates`): mesma folha, modelo e código de verificação do certificado de curso (doc 21 §1.3). Sai para inscrição confirmada com presença em ao menos um dia, depois que o evento termina. O snapshot é um `CourseCertificate` com o nome do evento em `courseName`, a inscrição em `enrollmentId` e o evento em `classGroupId`; `IssuedCertificate.kind = "event"` com `eventRegistrationId` e `eventId` (migração 92, um certificado por inscrição). Carga horária = soma dos dias que a inscrição cobre (todos, ou só os escolhidos); frequência = presenças sobre esses dias.
- **Texto:** o modelo do espaço (ou da modalidade) é o do curso; quando o título e o texto ainda são o padrão ou um modelo pronto da área, o evento usa "Certificado de participação" e "Certificamos que {aluno} participou de {curso}, de {inicio} a {fim}, com carga horária de {carga_horaria}, conduzido por {professor}."; texto editado pelo espaço fica como está. A página pública `/p/certificado/<código>` mostra "Evento" no lugar de "Curso" e conta em dias.
- **Telas:** no detalhe do evento encerrado, a linha do inscrito com presença ganha "Certificado" (`/events/[id]/certificate/[registrationId]`, com Baixar PDF na conta real ou imprimir na demonstração, e Cancelar certificado para quem gere) e o menu ⋮ ganha "Certificados" (todos num PDF pelo servidor, `/api/documents/certificates/event/[eventId]`, ou a tela `/events/[id]/certificates`). Sem o recurso, tela "Disponível no Plano Profissional".
- **Serviço:** `events.listEventCertificateCandidates`, `getEventCertificate` (abrir emite), `issueEventCertificates` (lote) e `cancelEventCertificate` (`events:manage`); o professor só nos eventos que conduz.
- **Relatório "Eventos e seminários"** (`events_summary`, Pro, `finance:view`): cada evento com algum dia no mês, com dias, quem conduz, situação, inscritos, presença (presenças sobre inscritos x dias feitos), arrecadado, a receber, saídas e resultado; totais no topo. PDF e CSV pelo mesmo caminho dos outros relatórios.
- **Fora:** selo "Visitante" em Alunos (decisão 2), lembrete "evento amanhã" no sino e inscrição pública por link continuam em "Fica para depois".

## Mais de uma pessoa conduzindo (10/11/2026, decidido com o dono)
Seminário com um sensei por dia, aulão com dois professores no mesmo bloco, um de manhã e outro à tarde.
- **Cadastro:** "Quem conduz" é uma lista (+ Adicionar quem conduz). Cada linha é "Da equipe" (escolhe o profissional) ou "Convidado" (nome e de onde vem). A mesma pessoa da equipe não entra duas vezes.
- **Por dia:** com duas ou mais pessoas na lista, cada dia ganha chips "Conduz:" com os nomes. Nenhum marcado = todos conduzem o bloco. Manhã e tarde continuam sendo dois blocos, cada um com sua escolha.
- **Onde aparece:** lista, cartões e painel mostram o curto ("Kenji (convidado)", "Ana e Kenji", "Ana e mais 2"); detalhe, dia da chamada e a lista do Calendário mostram todos do bloco, convidado marcado; a grade do Calendário mostra o primeiro e "+N" (todos ao passar o mouse). A busca acha por qualquer nome.
- **Professor da equipe:** vê o evento se está na lista; no Calendário e na chamada, só os blocos que conduz.
- **Certificado:** quem conduziu os dias da inscrição. **Relatório:** todos, convidado marcado.
- **Editar:** quem conduziu um dia já feito não sai da lista (o dia guarda quem conduziu). Quem sai deixa a escolha dos dias que ainda vão acontecer.
- **Banco:** `events.instructors` (jsonb) e `event_sessions.instructor_ids` (jsonb), migração 94. Sem tabela nova, como `event_registrations.session_ids`. As colunas de uma pessoa só (`instructor_id`, `guest_instructor_*`) saíram depois de copiadas para a lista.
- **Financeiro:** sem mudança; o cachê de cada convidado é uma saída ligada ao evento.

## Decisões (09/11/2026)

1. **Graduação:** presença em evento não conta por padrão; opção "Conta para a graduação" no evento, para exame de faixa coletivo. **Revista em 13/11/2026:** a opção vira "Evento de graduação" (aba Graduação, aptos no Inscrever, repasse à federação) e a presença em evento segue fora da frequência; ver [product/30](30-graduacao-em-grupo-e-troca-de-turma.md) §4 (feito em 13/11/2026).
2. **Visitante:** fica em Alunos com selo "Visitante" derivado e filtro; a situação do cadastro não muda sozinha.
3. **Convidado:** só o nome (e de onde vem). Não vira profissional nem usuário.
4. **Lote:** entra no 1º corte como configuração opcional; sem lote, o fluxo é o padrão.
5. **Experimental:** evento não tem. Visitante entra como inscrito e fica salvo em Alunos para relatórios e para aproveitar o cadastro se passar a frequentar.
6. **Nome:** "Eventos".
7. **Financeiro do evento:** aba própria no detalhe (arrecadado, a receber, saídas, resultado), com tudo indo também para o Financeiro geral.

## Alternativas

- **Variação da turma** (`ClassGroup.kind: event`, datas soltas no lugar da grade). Menos código e tudo já lido por relatórios e ficha. Rejeitada em 09/11/2026 por decisão do produto: o módulo próprio permite regras completas (inscrição por dia, convidado, lista de espera dura, inscrição pública) sem encher a turma de condicionais.
- **Agendamento (modelo 1)**. Não serve: é 1 a 1, sem inscrição em grupo nem chamada.

## Selo "Visitante" em Alunos (11/11/2026)

- Derivado, nada é gravado no aluno: inscrição em evento não cancelada (confirmada ou na espera) e nenhum outro vínculo, em qualquer situação: sem matrícula, plano, pacote nem aula experimental. Quem passa a frequentar perde o selo sozinho.
- Na lista de Alunos (linha e cartão), ao lado do "Experimental"; o filtro "Aula experimental" ganhou "Visitantes" (`?visitor=1` abre filtrado).
- Código: `visitorIds()` e `listVisitorIds()` em `services/clients/clientBaseService.ts`, filtro `ClientFilter.visitor`, recorte `visitorsWorld` em `clientSlices.ts`, `VisitorBadge`. Teste: `services/__tests__/clients-visitors.test.ts`.

## Proposta: inscrição pública por link (12/11/2026)

Status: **Aprovada e feita em 12/11/2026** (ver "Como ficou" no fim). Fase 6 da tabela de fases.

### O que resolve
Hoje só a equipe inscreve, pela tela do evento. Um seminário aberto ao público depende de alguém do espaço anotar nome e telefone de cada interessado (WhatsApp, Instagram) e cadastrar um por um. O link deixa a própria pessoa se inscrever e, no evento pago, já pagar.

### Como seria, em uma linha
O espaço liga "Aceitar inscrições pelo link" no evento, copia o link e divulga. A pessoa abre, vê o evento, preenche nome e WhatsApp, aceita os termos e, se for pago, paga ali mesmo. Ela entra em Alunos como "Visitante" (ou é ligada ao aluno que já existe) e aparece nos inscritos com a marca "Pelo link".

### Decisões (com a recomendação)

| # | Decisão | Recomendação | Alternativas |
| --- | --- | --- | --- |
| P1 | **Inscrição direta ou pedido para aprovar** | **Direta**: a inscrição nasce confirmada (ou na espera, se lotou). O espaço cancela se precisar, pela regra de sempre. | Pedido que o espaço aprova: mais controle, mas cria uma fila para alguém olhar todo dia e a pessoa fica sem resposta. |
| P2 | **Exceção à regra das páginas públicas** (doc 24 §6: página pública não grava no cadastro) | **Exceção controlada, só nesta página**: ela só **cria** (aluno visitante novo e a inscrição), nunca **muda** um cadastro existente. Telefone que já é de um aluno do espaço liga a inscrição a ele, sem tocar no cadastro dele e sem mostrar nada dele na página. Nada vem preenchido. | Não gravar e só mandar um aviso para a equipe cadastrar: anula o ganho. |
| P3 | **Quem pode se inscrever** | **Qualquer pessoa**, com Nome*, WhatsApp* e E-mail* (e-mail obrigatório desde 12/11/2026: leva o link do ingresso; no menor, é o do responsável e fica no cadastro dele). Sem conta e sem senha. | Só alunos da casa, com login: exige a área do aluno (doc 23), que ainda não existe. |
| P4 | **Menor de idade** (**decidido em 12/11/2026: sim**) | Pergunta "É menor de 18 anos?". Se sim, pede o nome e o WhatsApp do responsável e o **aceite do responsável** com o mesmo texto do termo do menor (o nome digitado e a hora ficam como prova, como em `/consent/minor`). | Bloquear menores no link: corta exatamente o público de seminário infantil. |
| P5 | **Evento pago: quando a vaga fica garantida** (**decidido em 12/11/2026: opção no evento, "Na inscrição" (padrão) ou "Com o pagamento", reserva de 30 min**) | Opção no cadastro do evento, ver "Garantia da vaga". Em qualquer forma, a cobrança é à vista com o lote aplicado sozinho, e com recebimentos online a página segue direto para o Pix ou cartão. Sem recebimentos online, "O pagamento é combinado com o espaço". Sem parcelas pelo link. | Uma forma só para todos os eventos. |
| P6 | **Evento por dia** | A pessoa escolhe os dias (ou todos) e vê o valor somado. | Só inscrição completa pelo link: mais simples, mas o evento por dia existe para isso. |
| P7 | **Lotou** | Entra na **lista de espera**, sem cobrança, com a mensagem "Você está na lista de espera; o espaço avisa se abrir vaga". A página mostra "Últimas N vagas" só quando faltam 5 ou menos, e "Lotado, entre na lista de espera" quando lota. | Fechar o link ao lotar: perde o interessado. |
| P8 | **Quando o link aceita** | Chave por evento "Aceitar inscrições pelo link" (desligada no começo), com "até dd/mm" opcional. Fecha sozinho em evento encerrado, cancelado ou depois da data. Link fechado mostra o evento e "Inscrições encerradas". | Link sempre aberto em todo evento: o espaço não controla. |
| P9 | **LGPD e WhatsApp** | Aceite obrigatório: "Li e aceito que {espaço} use meus dados para esta inscrição" com link da Privacidade (guardado com data e IP, como os outros aceites). Caixa separada e opcional "Aceito receber mensagens do espaço pelo WhatsApp", que grava a autorização do aluno (doc 27 §9) com "Na inscrição pelo link". | Uma caixa só para tudo: mistura a inscrição com a autorização de mensagens, o que a Meta e a LGPD pedem separado. |
| P10 | **O que a página mostra** | Nome do espaço, nome e descrição do evento, dias e horários, quem conduz (nome; convidado com "de onde vem"), endereço da unidade, valor (lote, cheio ou por dia) e vagas na regra do P7. Nenhum dado de aluno ou inscrito. Prévia bonita ao colar no WhatsApp (título, datas e nome do espaço). | Lista de inscritos na página: expõe dado pessoal; fora. |
| P11 | **Abuso** | Código do link aleatório (não o id do evento); até 10 inscrições por IP por hora e 3 por telefone por evento; campo-armadilha escondido para robô; telefone com DDD válido; mesmo telefone no mesmo evento responde "Você já está inscrito" sem mostrar detalhes. Sem CAPTCHA de terceiro no começo. | CAPTCHA (Turnstile, reCAPTCHA): mais um fornecedor e cookie; fica para se houver abuso. |
| P12 | **Aviso ao espaço** | Lembrete no sino "Nova inscrição pelo link" (com o nome) e linha na Auditoria com o autor "Inscrição pelo link". Nos inscritos, a marca "Pelo link". | E-mail a cada inscrição: barulhento; o resumo diário pode levar isso depois. |
| P13 | **Plano** (**decidido em 12/11/2026: só no Profissional**) | Inscrição pelo link e ingresso são recursos do **Plano Profissional**. No Grátis, a chave aparece com "Disponível no Plano Profissional". Ao construir, entram nas listas dos planos: `plans-view.tsx`, `subscription-checkout-view.tsx`, `subscription-checkout-dialog.tsx`, `landing-plans.tsx` e a doc `product/13` (só quando existir: a tela só promete o que o produto faz). | Em todos os planos (era a recomendação): traz gente nova, mas o dono preferiu como argumento de venda. |
| P14 | **Divulgação** | No detalhe do evento: "Copiar link", "Enviar pelo WhatsApp" (texto pronto com o link) e QR code para imprimir no cartaz. | Só o link: o QR code é pedido comum em academia. |

### Garantia da vaga (proposta para a conversa do P5, 12/11/2026)

Uma opção no cadastro do evento pago, no bloco de Cobrança: **"Vaga garantida"**.

| Opção | Como funciona | Quando serve |
| --- | --- | --- |
| **Na inscrição** (padrão) | A pessoa se inscreve e a vaga é dela na hora. A cobrança fica em aberto e ela paga quando puder (o link segue para o Pix ou cartão). O ingresso sai com "Pagamento pendente" e vira "Confirmado" quando o pagamento cai. | Evento da casa, público conhecido, pagamento na porta ou combinado. Funciona também sem recebimentos online. |
| **Com o pagamento** | A inscrição nasce **reservada** por um tempo (15, 30 ou 60 minutos; padrão 30, o prazo do Pix). Enquanto reservada, ocupa a vaga. Pagou no prazo: confirma e sai o ingresso. Não pagou: a reserva cai sozinha, a cobrança é cancelada e a vaga volta. A página mostra o tempo que falta. | Evento aberto ao público, com vaga disputada e risco de quem se inscreve e não aparece. Só com recebimentos online ligados (sem eles, a opção fica desligada e explica por quê). |

Pontos que valem para as duas:
- **A opção vale para o link.** A equipe, pela tela do evento, continua inscrevendo direto (decide na hora, como hoje).
- **Evento grátis** ignora a opção: a vaga é garantida na inscrição.
- **Lista de espera:** quando uma reserva cai e há gente na espera, o sino avisa "Abriu vaga em {evento}" para a equipe promover (sem promoção automática no começo).
- **Dados:** `Event.seatGuarantee: "on_signup" | "on_payment"` e `holdMinutes`; a inscrição ganha a situação `reserved` com `holdUntil`. A rotina de hora em hora (a dos pagamentos online) e a própria leitura do evento derrubam as reservas vencidas; o aviso do pagamento (webhook do parceiro) confirma.
- **Por que não uma terceira forma "genérica":** as duas cobrem os casos e o padrão (na inscrição) é o comportamento de hoje. Um campo livre de regra seria difícil de explicar na tela.

### Ingresso com QR code (pedido do dono, 12/11/2026)

Toda inscrição confirmada ganha um **ingresso**: um cartão com os dados do evento e um QR code que a equipe lê na entrada para confirmar que a pessoa está inscrita naquele evento e naquele dia. Ler o ingresso **marca a presença do dia**: a entrada vira a própria chamada.

| # | Decisão | Recomendação | Alternativas |
| --- | --- | --- | --- |
| T1 | **Quem recebe** | Toda inscrição **confirmada**, venha do link ou da equipe (desde 12/11/2026 a reservada já tem o código, para a página da inscrição; o QR e a entrada só valem confirmada). Quem está na espera não recebe; recebe ao ser promovido. Inscrição cancelada invalida o ingresso. | Só quem se inscreveu pelo link: a recepção teria dois jeitos de conferir a entrada. |
| T2 | **O que o cartão mostra** | Nome do espaço, nome do evento, dias e horários que a inscrição cobre (todos ou os escolhidos), local, quem conduz, **nome do inscrito mascarado** ("Ana S. L.", regra das páginas públicas), situação ("Confirmado" ou "Pagamento pendente") e o QR code com o código curto escrito embaixo (para digitar se a câmera falhar). | Nome completo no cartão: o ingresso circula por WhatsApp e print; a regra das páginas públicas vale. |
| T3 | **O que o QR guarda** | Um **endereço** (`/p/i/<código>`), com código aleatório e longo próprio do ingresso (não o id da inscrição). Qualquer câmera de celular abre, inclusive a do iPhone, sem aplicativo. Sem login, a página só mostra o cartão e se o ingresso vale. | Só o código, lido por um leitor dentro do app: precisa de biblioteca de leitura nova e não abre na câmera comum. Pode vir depois como "Ler ingressos" (ver T6). |
| T4 | **Leitura pela câmera comum (reserva)** | A pessoa da equipe aponta a câmera do celular **logada no GestaraHub** (com `attendance:mark`): a mesma página mostra o resultado grande e o botão **"Confirmar entrada"**, que marca presente no dia de hoje. O professor só nos eventos que conduz. | Marcar presença sozinho ao abrir o link: qualquer um com o print marcaria presença. |
| T5 | **O que a leitura responde** (**decidido em 12/11/2026: quem não pagou entra com o aviso**) | Verde "Pode entrar" (inscrição confirmada que cobre o dia de hoje); âmbar "Já entrou hoje às 19h02" (segunda leitura do mesmo ingresso no dia: protege contra print repassado); âmbar "Pagamento pendente: R$ 150,00", com "Confirmar entrada" e "Registrar pagamento" lado a lado; vermelho "Inscrição cancelada", "Este dia não está na inscrição", "Ingresso de outro evento" ou "O evento não é hoje". | Bloquear a entrada de quem não pagou: a decisão de deixar entrar é do espaço na hora, por isso o aviso com as duas ações. |
| T6 | **Leitor dentro do app** (**decidido em 12/11/2026: já na primeira versão**) | No dia do evento, **"Ler ingressos"** abre a câmera dentro do app e lê um atrás do outro, sem trocar de tela. Para quem está na fila: lê, mostra o resultado grande por 2 segundos com o som de presença (o mesmo da chamada) e **confirma a entrada sozinho** quando está tudo certo ("Pode entrar"), com "Desfazer" na faixa. Para quando há algo a decidir: "Pagamento pendente" e "Já entrou hoje" param a leitura e esperam o toque ("Confirmar entrada", "Registrar pagamento" ou "Próximo"). Campo "Digitar código" para ingresso amassado ou tela quebrada. Contador "32 de 45 entraram". A biblioteca de leitura carrega só nessa tela (o resto do app não fica mais pesado). A câmera comum (T4) continua funcionando como reserva, por exemplo para quem não está logado no celular da porta. | Só a câmera comum: funciona, mas são três toques por pessoa (abrir a câmera, abrir o link, confirmar) e a fila trava. |
| T7 | **Como chega na pessoa** | Pelo link: o ingresso aparece logo depois da inscrição (e do pagamento), com "Salvar ingresso" (imagem para guardar no celular) e "Enviar para o meu WhatsApp". Pela equipe: na linha do inscrito, "Ver ingresso" e "Enviar ingresso" pelo WhatsApp (assistido, ou oficial com a autorização do aluno, doc 27 §9). | E-mail automático: muitos inscritos não têm e-mail no cadastro; pode somar depois. |
| T8 | **Sem internet na porta** (**pedido do dono em 12/11/2026: a lista fica no celular de quem lê**) | Ver "Leitura sem internet" logo abaixo. | Conferir só com internet e cair na chamada por nome sem sinal: era a proposta anterior; não serve para porta de evento, onde o sinal costuma cair. |
| T9 | **Plano** | Plano Profissional, junto com a inscrição pelo link (P13, decidido). | — |

### Leitura sem internet (12/11/2026)

**Como funciona para quem está na porta:**
1. Antes de abrir a porta, com internet, a pessoa entra no dia do evento e toca **"Preparar para usar sem internet"**. O celular baixa a lista do dia: inscrições confirmadas e reservadas que cobrem o dia, o código de cada ingresso, o nome, a situação do pagamento (com o valor em aberto) e quem já entrou. Aparece "Lista pronta: 45 inscritos, atualizada às 18h40".
2. **Sem sinal, o "Ler ingressos" continua funcionando**: confere o ingresso pela lista guardada, mostra o mesmo resultado (Pode entrar, Pagamento pendente, Já entrou hoje, Dia fora da inscrição) e confirma a entrada no próprio celular.
3. As entradas ficam numa fila no aparelho, com o aviso no topo "Sem internet · 12 entradas para enviar". Quando a conexão volta, sobem sozinhas numa gravação só. Ninguém precisa fazer nada.
4. **Com internet**, a lista se atualiza sozinha a cada minuto (quem se inscreveu pelo link na última hora também entra) e as entradas sobem na hora.

**Regras:**
- **Dinheiro só com internet:** sem sinal, "Registrar pagamento" fica desligado. Quem não pagou entra com o aviso (T5) e o pagamento é registrado depois, com a cobrança em aberto como hoje.
- **Duas portas sem internet:** o mesmo ingresso lido em dois celulares sem sinal passa nos dois (um não vê o outro). Ao sincronizar, vale a primeira entrada e a segunda aparece para a equipe como "Entrada repetida de Ana S. às 19h05, na porta de Carla". Com internet, a segunda leitura já responde "Já entrou hoje".
- **O que fica no celular:** só a lista daquele dia do evento. O código do ingresso fica guardado embaralhado (hash), então a lista copiada do aparelho não serve para montar ingresso falso. A lista some ao fim do dia do evento e ao sair da conta. Quem pode baixar é quem pode fazer a chamada do evento (`attendance:mark`; o professor, só nos eventos que conduz).
- **Pessoa inscrita depois do download, sem internet:** o ingresso não está na lista e a leitura responde "Ingresso não encontrado nesta lista (atualizada às 18h40)", com "Confirmar entrada mesmo assim", que vai na fila e é conferido ao sincronizar.

**O que isso exige do app** (primeira vez que o GestaraHub funciona sem internet):
- **Service worker** só para a tela de leitura do evento: guarda a tela e o código dela no aparelho, para abrir mesmo sem sinal. O resto do app segue como hoje.
- **Lista e fila no aparelho** (IndexedDB), com a sincronização quando a conexão volta.
- **iPhone:** o Safari apaga os dados de site pouco usado. Por isso o passo 1 é feito no dia do evento, e a tela avisa se a lista guardada é de outro dia.
- Essa base é a mesma da "chamada sem internet" que está nas pendências do PWA (doc technical/10). Construída aqui, serve depois para a chamada das turmas.

**Dados do ingresso:** `EventRegistration.ticketCode` (aleatório, único, criado ao confirmar). A entrada grava a presença do dia (`EventAttendance` presente) com `checkedInAt` e `checkedInBy`, para a segunda leitura responder "Já entrou hoje às ...". A página `/p/i/<código>` segue a regra das páginas públicas: dados mascarados e nenhuma gravação sem login.

### Dados (proposta de contrato)
- `Event.publicSignup?: { enabled: boolean; code: string; until?: DateISO }` (coluna `public_signup` jsonb) e índice único no `code`.
- `EventRegistration.source: "staff" | "public_link"` (padrão `staff`) e `EventRegistration.ticketCode` (ingresso).
- `EventAttendance.checkedInAt?` e `checkedInBy?` (entrada pelo ingresso).
- Aceite da inscrição em `legal_consents` com um tipo novo `event_signup` (data, IP, texto aceito); o do responsável segue o modelo do termo do menor.
- Rotas públicas `/p/e/<código>` (inscrição) e `/p/i/<código>` (ingresso), e uma ação de servidor sem login, com as travas do P11, que monta o próprio contexto do espaço a partir do código (como a fatura pública).

### Fases
1. **Base:** contrato e migração, serviço da inscrição pública (criar visitante ou ligar ao aluno, inscrição, cobrança à vista, espera, travas), testes de serviço e de banco (inclusive "não muda cadastro existente" e "não devolve dado de outro aluno").
2. **Página e divulgação:** `/p/e/<código>` (celular primeiro), aceites, menor de idade, ida para o pagamento, prévia no WhatsApp; no detalhe do evento, a chave, copiar, WhatsApp e QR code.
3. **Ingresso:** código na inscrição confirmada, cartão (tela, imagem para salvar), "Ler ingressos" no dia do evento (leitor dentro do app, entrada confirmada sozinha quando está tudo certo), `/p/i/<código>` com o resultado da leitura e "Confirmar entrada" para a equipe logada (reserva), "Ver ingresso" e "Enviar ingresso" nos inscritos; testes das respostas do T5 (inclusive "já entrou hoje" e print repassado).
4. **Sem internet:** "Preparar para usar sem internet", service worker da tela de leitura, lista e fila no aparelho, sincronização, entrada repetida entre portas; testes com a rede desligada no navegador.
5. **Avisos e testes:** lembrete no sino, Auditoria, marca "Pelo link", e2e de ponta a ponta (grátis, pago com Pix de teste, lotado, menor, link fechado, ingresso lido na entrada).

### Perguntas para o dono
Tudo decidido em 12/11/2026: menor de idade pelo link com o aceite do responsável (P4); "Vaga garantida" como opção do evento (P5); só no Plano Profissional (P13); quem não pagou entra com o aviso (T5); leitor dentro do app já na primeira versão (T6), funcionando sem internet (T8). As demais decisões seguem a recomendação. Status: **feita em 12/11/2026**.

## Como ficou: inscrição pelo link, ingresso e leitura sem internet (12/11/2026)

Construído no mesmo dia da aprovação, nas cinco fases da proposta. Recurso do Plano Profissional (`event_signup`).

**Cadastro do evento** (bloco "Inscrição pelo link" do formulário): chave "Aceitar inscrições pelo link" (no Grátis, "Disponível no Plano Profissional"), "Inscrições até" (opcional) e, em evento pago com recebimentos online ligados, "Vaga garantida" (Na inscrição / Com o pagamento) e "Reserva de" 15 min, 30 min ou 1 h. O código do link nasce no servidor e continua o mesmo ao desligar e religar (`applySignupSettings` em `services/events/eventsService.ts`). Sem recebimentos online, a vaga é sempre garantida na inscrição.

**Divulgação** (detail do evento, `EventSignupLink`): "Inscrições pelo link abertas" com o endereço, "Copiar link", "Enviar pelo WhatsApp" (texto pronto) e "QR code" (janela com o QR e "Baixar imagem" em alta resolução para o cartaz).

**Página pública `/p/e/<código>`** (`app/(marketing)/p/e/[code]`): espaço, evento, dias e horários, quem conduz (convidado com a origem), endereço da unidade, descrição, valor (lote quando vale), "Últimas N vagas" (5 ou menos) ou "Lotado". Formulário: Nome*, WhatsApp*, E-mail, "É menor de 18 anos" (abre nome e WhatsApp do responsável e troca o texto do aceite), dias no evento por dia, aceite obrigatório e "Aceito receber mensagens do espaço pelo WhatsApp" (opcional, grava a autorização do aluno, doc 27 §9). Resultado: confirmada (com "Pagar agora" para a fatura `/p/c/<cobrança>` quando o espaço cobra online, e "Ver ingresso"), vaga reservada com o tempo que falta, lista de espera ou "Você já está inscrito". Link fechado mostra o evento e o motivo.

**Servidor** (`services/server/eventPublicSignup.ts`): travas do P11 (campo-armadilha, tamanhos, WhatsApp com DDD, 10 por IP e 3 por telefone e evento por hora). Roda no espaço com um contexto sem pessoa (`systemTenantContext`, autor "Inscrição pelo link" na Auditoria). Aluno ativo com o **mesmo nome e o mesmo telefone** (sem diferença de acento, maiúscula ou espaço, `sameName` em `@/lib/text`) liga a inscrição sem mexer no cadastro; só o telefone não basta (12/11/2026: quem digitava o número de outra pessoa via o nome dela na fatura do parceiro e entrava no histórico dela). Nome diferente ou pessoa nova vira visitante (a equipe junta os cadastros, se for a mesma pessoa); menor entra sem telefone próprio, com o responsável (financeiro) e a autorização do termo registrada pelo aceite (`confirmed_whatsapp`, prova com texto, data e IP). A prova do aceite fica na inscrição (`signup_evidence`).

**Vaga só com o pagamento** (`registerInWorld` e `releaseExpiredReservations`): a inscrição nasce `reserved` com `holdUntil`; reserva valendo ocupa vaga (`seatHolders`), a vencida não. Pagou (baixa manual ou aviso do parceiro, `confirmPaidEventReservationInDb`): confirma e cria o ingresso. A rotina de hora em hora derruba as vencidas, com as cobranças e o Pix (`services/events/eventReservationsCron.ts`). Cancelar uma reserva tira também a cobrança de hoje.

**Ingresso**: toda inscrição confirmada ganha `ticketCode` (12 caracteres, do mesmo gerador dos ids). Página `/p/i/<código>`: cartão com o nome mascarado, situação, dias, local, quem conduz, QR e o código em grupos de 4 ("Mostre na entrada"); "Salvar ingresso" (imagem PNG em `/p/i/<código>/image`, abre sem internet) e "Enviar para o meu WhatsApp". Equipe logada no mesmo espaço com a chamada vê o resultado da leitura e "Confirmar entrada" (reserva do leitor). Na lista de inscritos: "Ver ingresso" e "Enviar ingresso".

**Leitor dentro do app** ("Ler ingressos" no dia do evento, `TicketScanner`): câmera traseira com a biblioteca `jsqr` (carrega só nessa tela), leitura a cada 250 ms, o mesmo código ignorado por 4 s. "Pode entrar" confirma sozinho com o som da chamada e "Desfazer"; "Pagamento pendente", "Reserva sem pagamento", "Já entrou hoje às ..." e os recusados (cancelada, espera, dia fora da inscrição, evento não é hoje, outro evento, não encontrado) param e esperam "Confirmar entrada", "Registrar pagamento" (janela de pagamento) ou "Próximo". "Digitar código" para ingresso amassado. Contador "N de M entraram". A entrada grava presença com `checkedInAt` e `checkedInBy` (`services/events/eventCheckInService.ts`). O site passou a permitir a câmera para ele mesmo (`Permissions-Policy: camera=(self)` no `next.config.ts`).

**Sem internet** ("Preparar para usar sem internet"): baixa a lista do dia (`getCheckInList`: código em SHA-256, nome, valor em aberto, quem já entrou) para o IndexedDB e liga o service worker `public/checkin-sw.js` (só a tela do dia do evento, rede primeiro, e os arquivos `/_next/static` que o servidor marca como `immutable`). **Correção de 12/11/2026:** a primeira versão guardava todo `/_next/static`; no desenvolvimento esses arquivos vêm com `no-cache` e o nome não muda com o código, então o navegador que tinha preparado a leitura sem internet ficava com JS e CSS velhos (CSS sem as classes novas no Safari, e a página recarregando sem parar em todo o app, com a barra de carregamento da aba sempre ligada). Agora só o `immutable` é guardado (produção, onde o nome muda a cada versão; e as fontes) e a versão nova do service worker apaga o cache antigo ao ativar (`checkin-*-v1`). Sem sinal, a leitura confere pela lista, marca no aparelho e põe na fila ("Sem internet · N entradas para enviar"); ingresso fora da lista pode entrar "mesmo assim" e é conferido no envio. Com a conexão de volta, a fila sobe numa gravação (`syncOfflineCheckIns`): vale a primeira entrada; a de outra porta volta como "Entrada repetida"; o código que não vale volta recusado. A lista se atualiza a cada minuto com internet e sai do aparelho ao sair da conta. Aberta sem sinal, a tela do dia mostra o nome do evento, "Sem internet · usando a lista das HH:mm" e "Ler ingressos".

**Avisos**: no sino, "evento com inscrição nova pelo link" (48 h) e "evento com vaga aberta e lista de espera" (com "Promover", abre a aba Espera). Inscritos com a marca "Pelo link" e "Reservada até HH:mm".

**Planos**: a inscrição em evento por link, com ingresso, entrou nas listas do Profissional (Planos, checkout em tela e em janela, aba Plano das Configurações e os planos da landing).

**Banco**: migração 97 (`events.public_signup`, `seat_guarantee`, `hold_minutes`; `event_registrations.status` aceita `reserved`, mais `source`, `hold_until`, `ticket_code` único e `signup_evidence`; `event_attendances.checked_in_at` e `checked_in_by`).

**Testes**: `services/__tests__/events-public-signup.test.ts` (link e vaga garantida no cadastro, reserva e pagamento, ingresso, entrada, leitura sem internet e envio da fila), `services/events/__tests__/publicSignup.db.test.ts` (página sem dado de aluno, visitante novo, aluno existente sem mudar o cadastro, menor, travas, ingresso mascarado), e2e `eventos-inscricao-link.spec.ts` (inscrição, ingresso, espera, menor, link fechado, sino, entrada com pagamento pendente).

**Não coberto por teste automático** (nas pendências): a câmera de verdade lendo o QR, o modo avião no celular com o service worker, o Safari do iPhone e a confirmação da reserva pelo aviso do parceiro com um Pix de teste.

## Página da inscrição e e-mail do ingresso (12/11/2026, pedido do dono)

**Problema:** a confirmação aparecia na própria página do evento, sem endereço. Atualizar a página voltava ao formulário e o ingresso sumia; a página de pagamento não voltava para o ingresso; na "vaga só com o pagamento", nada levava a pessoa ao ingresso depois de pagar.

**Como ficou:**
- **O ingresso é a página da inscrição.** Inscrição confirmada ou reservada vai direto para `/p/i/<código>?nova=1` (o endereço fica; atualizar não perde nada). No topo: "Inscrição confirmada, {nome}" ou "Vaga reservada, {nome}" com o prazo correndo, "Falta pagar R$ X" e **"Pagar agora"** (com o pagamento online ligado), e "Guarde este endereço: ele é o seu ingresso". Enquanto falta pagar, a página se atualiza sozinha a cada 15 s (visível): ao pagar, o QR aparece. Reserva vencida mostra "A reserva venceu". Componente `TicketStatus` (`app/(marketing)/p/i/[code]/ticket-status.tsx`); dados em `PublicTicketView` (`pendingCents`, `payChargeId`, `holdUntil`, `reservationExpired`).
- **A reserva ganha o código na hora** (muda o T1): o endereço existe desde a inscrição; o QR e a entrada só valem confirmada (a leitura responde "reservada"). Ao pagar, o mesmo código vira o ingresso (`confirm` em `eventRegistrationsService.ts` e o aviso do parceiro em `onlinePaymentsWebhook.ts`, que mantém o código).
- **A página de pagamento volta para o ingresso:** cobrança de inscrição em evento mostra "Ver ingresso" em todas as telas (escolha, Pix gerado, pago); a tela de pago diz "Sua inscrição em {evento} está paga". No cartão, quem paga na página do parceiro volta pelo "voltar" do navegador; a volta automática (`callback.successUrl` do Asaas) exige o domínio cadastrado na conta do parceiro e fica para a publicação (`pendencias.md`).
- **O aparelho lembra:** reabrir o link do evento no mesmo aparelho mostra "Você se inscreveu neste aparelho" com o nome mascarado e "Ver ingresso"; o título do formulário vira "Inscrever outra pessoa" (até 5 por evento, só código e nome mascarado no navegador; `signup-memory.ts`).
- **E-mail com o link do ingresso:** o e-mail é **obrigatório** (decidido pelo dono em 12/11/2026, com a dica "Enviamos o link do ingresso para ele"; o servidor confere presença e formato). No menor, o campo vira "E-mail do responsável", fica no cadastro do responsável e o e-mail sai para ele com "Participante: {nome}". A inscrição confirmada ou reservada manda "Seu ingresso: {evento}" com os dias, o que falta (nada, pagar ou pagar no prazo da reserva) e o botão "Ver meu ingresso" (`sendEventTicketEmail` em `lib/email/mailersend.ts`). Sai depois de gravar; falha no envio não desfaz a inscrição, só não mostra "Também enviamos para o seu e-mail". **Em desenvolvimento e nos e2e não envia: imprime a mensagem inteira no terminal do servidor** ("[e-mail não enviado: desenvolvimento]"), de onde se pega o link. Não depende do WhatsApp configurado.
- "Já inscrito" passou a dizer que o link está no e-mail da inscrição.

**Testes:** `lib/email/__tests__/event-ticket-email.test.ts` (texto, o que falta, HTML escapado), `services/__tests__/events-public-signup.test.ts` (código na reserva, o mesmo ao pagar), `publicSignup.db.test.ts` (e-mail enviado, reserva com valor, prazo e "Pagar agora") e `e2e/eventos-inscricao-link.spec.ts` (endereço do ingresso, atualizar, aparelho lembra, equipe abrindo o link).

## Um QR para todos os dias (12/11/2026, decidido com o dono)

**Pergunta:** evento de mais de um dia deveria ter um QR por dia, já que cada dia marca a presença?

**Decisão: um QR por inscrição, valendo em cada dia.** A leitura sempre acontece dentro de um dia do evento ("Ler ingressos" no dia) e marca a presença daquele dia: o mesmo QR lido no dia 1 marca o dia 1, no dia 2 marca o dia 2; de novo no mesmo dia, "Já entrou hoje"; num dia que a pessoa não comprou, "Este dia não está na inscrição". Um QR por dia não protege mais (quem quisesse passar o ingresso a outra pessoa passaria o QR daquele dia do mesmo jeito; o que protege é a equipe conferir o nome na leitura) e confunde: três imagens para salvar, qual mostrar, três links no e-mail. Só faria sentido se cada dia pudesse ir para uma pessoa diferente, e a inscrição é de uma pessoa.

**O que deixa isso claro:**
- **No ingresso**, todos os dias do evento com a situação de cada um: "Entrou às 09:02" (leitura do ingresso), "Presente" (marcado na chamada), "Hoje" ou "Não incluso" (dia fora da inscrição, em cinza). Embaixo do QR: "Vale para os 3 dias. Mostre na entrada de cada dia." (`PublicTicketView.days` com `included`, `attended`, `enteredAt` no fuso do espaço e `isToday`; a imagem para salvar mostra só os dias da inscrição).
- **Na leitura**, o dia que está sendo marcado, numa linha embaixo do nome: "Terça, 22/09 (dia 2 de 3)", só em evento de mais de um dia (`TicketCheckResult.day`, `dayPosition` em `@gestarahub/core/events`, `ticketDayLabel`). Sem internet, a lista do dia leva a posição (`CheckInList.dayPosition`/`dayTotal`) e a conferência no aparelho mostra o mesmo.
- **No e-mail**, em evento de mais de um dia: "Use o mesmo ingresso em todos os dias: mostre o QR code na entrada de cada dia."

**Testes:** `packages/core/test/events.test.ts` (`dayPosition`), `services/__tests__/events-public-signup.test.ts` (o mesmo QR marca cada turno, "já entrou" no mesmo, "não é hoje" no outro, lista sem internet com a posição, o rótulo do dia), `publicSignup.db.test.ts` (dias no ingresso) e `event-ticket-email.test.ts` (frase do e-mail).
