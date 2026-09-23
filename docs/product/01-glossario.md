# Glossario

## Decisao

O GestaraHub deve usar termos simples na interface e termos mais genericos na documentacao conceitual quando isso ajudar a preparar a evolucao do produto.

A linguagem do produto e HIBRIDA:

- A interface usa termos simples e genericos (Clientes, Equipe, Servicos, Agenda), e parte dos rotulos ja muda conforme o **modelo operacional** do tenant: na academia (`classes`), o menu mostra Alunos, Turmas, Calendario, Modalidades, Planos e Mensalidades, e as mensagens/auditoria dizem "aluno" e "modalidade" (`components/layout/nav.ts`, `services/nouns.ts`).
- Rotulos por segmento configuraveis pelo tenant (label overrides) continuam previsao futura.
- Codigo (tipos, enums, campos) e 100% em ingles; a UI e em portugues. Por isso cada termo abaixo indica, quando existe, o nome no codigo.

## Termos de interface: fundacao compartilhada

### Cliente / Aluno (`Client`)

Pessoa atendida pelo negocio.

- No Modelo 1, cliente e quem agenda um servico com um profissional.
- No Modelo 3, o mesmo `Client` aparece como "Aluno" e guarda o vinculo com o plano (`planId`, `planStartDate`, regra de cobranca propria, `dueDay`, `discount`, `membershipStatus`).
- Endereco estruturado opcional (`address`).

### Equipe

Grupo de pessoas que trabalham no negocio. "Equipe" e o rotulo do menu nos dois modelos.

### Profissional / Instrutor (`Professional`)

Pessoa da equipe que realiza atendimentos (Modelo 1) ou conduz aulas (Modelo 3, "Professor / Instrutor").

- "Profissional" e o termo usado no contexto de um agendamento e nas telas de detalhe.
- No Modelo 1, um agendamento tem um profissional responsavel; `serviceIds` indica os servicos que ele realiza (informativo, nao restringe).
- No Modelo 3, `modalityIds` indica as modalidades que o instrutor leciona; so instrutores da modalidade podem ser escolhidos para a turma.

### Cargo (`Role`)

Funcao/especialidade do profissional no negocio (ex.: "Barbeiro Senior"). Entidade da organizacao, **opcional** no profissional (`Professional.roleId`), escolhida numa lista filtravel; cargos sao criados no CRUD de Cargos da tela Equipe. Serve para relatorios.

**Cargo ≠ Perfil.** Cargo nao da acesso a nada; o acesso e definido pelo Perfil do usuario.

### Usuario (`User`)

Quem acessa o sistema. Pertence a uma organizacao, tem um **Perfil** e pode estar vinculado a um profissional (`professionalId`, opcional). Gerenciado em `/users`.

### Perfil (`UserProfile`)

Perfil de acesso (RBAC): `owner` (Proprietario), `manager` (Gerente), `attendant` (Atendente), `professional` (Profissional). Define as permissoes. Ver [06-perfis-permissoes.md](06-perfis-permissoes.md).

### Auditoria (`AuditLogEntry`)

Registro imutavel de quem fez o que e quando (criar, editar, cancelar, remarcar, mudar status, operacoes financeiras etc.), exibido em `/audit`. O Gerente ve uma parte dos eventos.

## Termos de interface: Modelo 1 (atendimento individual)

### Servico (`Service`)

Atividade oferecida pelo negocio, com nome, categoria opcional, duracao, preco (em centavos) e status.

### Categoria (`Category`)

Agrupador de servicos, entidade da organizacao, **opcional** no servico (`categoryId`). Servico sem categoria aparece como "Sem categoria". No Modelo 3, a mesma entidade e usada como Modalidade.

### Agenda

Tela `/schedule`, com duas abas: **Calendario** (Dia, Semana, Mes) e **Lista** (busca e filtros por cliente, profissional, status e periodo). Exibe agendamentos, bloqueios de horario e intervalos dos profissionais.

Antes existia uma tela separada "Agendamentos"; hoje `/appointments` redireciona para `/schedule`.

### Agendamento (`Appointment`)

Compromisso entre cliente, profissional, **um ou mais servicos** (`serviceIds`), data e horario. Duracao e preco sao a soma dos servicos. Possui status e origem.

## Termos de operacao: Modelo 1

### Remarcacao

Mover um agendamento para outro horario e/ou profissional, mantendo cliente e servicos. Guarda o rastro (`rescheduledFrom`, com motivo opcional) e nao conclui o agendamento. Se o agendamento faz parte de uma serie, a remarcacao pergunta "somente esta ocorrencia" ou "esta e as futuras" (unico ponto onde esse escopo existe).

### Bloqueio de horario (`TimeBlock`)

Periodo em que um profissional fica indisponivel (folga, indisponibilidade), com data, inicio, fim e motivo opcional. Horario bloqueado nao aceita agendamento. O almoco nao e bloqueio: e o intervalo do horario de trabalho (`breakStart`/`breakEnd`).

### Recorrencia e Serie (`RecurrenceSeries`)

Repeticao de um compromisso individual: semanal, quinzenal ou mensal, terminando por numero de ocorrencias ou data final (sempre finita). Gera agendamentos ligados por `seriesId`, com origem `recurrence`. Ocorrencias em conflito nao sao criadas e sao informadas ao usuario.

### Status do agendamento (`AppointmentStatus`)

| Codigo | Rotulo |
| --- | --- |
| `pending` | Pendente |
| `confirmed` | Confirmado |
| `in_service` | Em atendimento |
| `completed` | Concluido |
| `canceled` | Cancelado |
| `no_show` | Nao compareceu |

### Origem do agendamento (`AppointmentOrigin`)

`manual` (criado na Agenda) ou `recurrence` (gerado por serie). Previstos para o futuro: `online` e `whatsapp` (ainda nao implementados).

## Termos de interface e operacao: Modelo 3 (turmas)

### Modalidade

Arte marcial, curso ou atividade da academia. No codigo e a mesma entidade `Category`; toda turma exige uma modalidade (`ClassGroup.modalityId`).

### Turma (`ClassGroup`)

Grupo recorrente conduzido por um instrutor titular, com modalidade, capacidade (vagas), encontros semanais (`meetingSlots`: dia da semana + inicio + fim), data de inicio e, opcionalmente, aceite de alunos avulsos com valor da aula avulsa.

### Aula / Sessao (`ClassSession`)

Ocorrencia datada de uma turma. As aulas nao sao cadastradas uma a uma: sao **geradas a partir dos encontros** (`meetingSlots`) no periodo consultado. O Calendario (`/classes/calendar`) mostra a grade semanal.

### Matricula (`Enrollment`)

Vinculo fixo Aluno x Turma (`active`, `paused`, `canceled`). A lista de chamada de uma aula usa as matriculas validas na data daquela aula.

### Lista de espera (`WaitlistEntry`)

Fila de alunos de uma turma lotada. A promocao para matricula e **manual** (e pode passar da capacidade, pois e uma acao consciente).

### Aula avulsa e aula experimental (`ClassReservation`)

Reserva de um aluno em uma aula especifica, sem matricula: `dropin` (avulsa, gera cobranca avulsa quando ha valor) ou `trial` (experimental, sem cobranca).

### Instrutor substituto

Troca do instrutor de uma aula especifica, com motivo opcional, sem mudar o titular da turma. Pode ser desfeita (restaurar titular).

### Presenca (`Attendance`)

Registro por aula e aluno: `present` (presente), `absent` (falta), `justified` (justificada). Justificada nao penaliza a frequencia (`present / (present + absent)`).

### Plano (`Plan`)

Plano de mensalidade com valor (maior que zero) e periodicidade `monthly` (mensal), `biweekly` (quinzenal) ou `weekly` (semanal). O plano e do aluno, nao da turma.

### Mensalidade / Cobranca (`Charge`)

Cobranca do aluno: `membership` (mensalidade do plano) ou `dropin` (aula avulsa). Status `pending`, `paid`, `overdue`, `canceled` (atrasado e calculado na leitura). O pagamento e registrado manualmente com forma de pagamento (`pix`, `cash`, `card`, `other`); nao ha gateway.

### Competencia

Mes de referencia de uma mensalidade (`Charge.competence`, formato `YYYY-MM`), igual ao mes do vencimento. A tela Mensalidades lista e gera cobrancas por competencia.

### Regras de cobranca

Regra padrao da academia (Configuracoes): momento do pagamento (antecipado ou depois do uso), entrada no meio do periodo (proporcional ou mes cheio) e dia de vencimento. Cada aluno guarda a sua. Ver [15-regras-de-cobranca.md](15-regras-de-cobranca.md).

## Termos conceituais internos

### Compromisso operacional

Conceito generico para qualquer evento que ocupe tempo, capacidade, recurso, cliente, equipe ou responsavel. Agendamento, entrega e aula sao tipos de compromisso operacional. Usado so na documentacao.

### Modelo operacional (`OperationalModel`)

Forma como um tipo de negocio organiza seus compromissos. Cada organizacao tem um modelo, que define menu, dashboard e textos:

- `scheduling`: atendimento individual (Modelo 1).
- `classes`: turmas e aulas (Modelo 3, MVP ativo).
- `delivery`: entrega ou encomenda (Modelo 2, tipado, sem telas).

### Segmento

Vertical ou rotulo do negocio (`Organization.segment`, ex.: "Barbearia", "Academia"). Nao confundir com o modelo operacional.

### Rotulos por segmento (label overrides)

Conceito FUTURO de rotulos configuraveis por segmento sem reescrever telas. Hoje existe apenas a troca fixa por modelo operacional (ex.: "Alunos" na academia).

### Organizacao (`Organization`)

Empresa ou conta principal (tenant). O mock tem duas organizacoes, cada uma com seus dados isolados e so o proprietario no seed:

- **Corte Nobre** (`scheduling`, proprietario Marcelo Andrade).
- **Academia X** (`classes`, proprietaria Ana Ribeiro).

A tela de login lista os usuarios de todas as organizacoes; entrar ou trocar de usuario troca a organizacao ativa.

### Unidade (`Unit`)

Local, filial ou nucleo operacional de uma organizacao. Hoje ha uma unidade por organizacao ("Corte Nobre - Matriz", "Academia X - Unidade 1"), com endereco, telefone e horario de funcionamento (varios turnos por dia). Turma, profissional, agendamento, bloqueio, serie, auditoria e mensalidade ja carregam `unitId`, carimbado pelo servidor. Multiunidade fica para a Fase 5.

### Modulo

Conjunto de funcionalidades relacionadas a uma area do produto (Agenda, Turmas, Mensalidades, Usuarios etc.).

### Add-on

Modulo adicional ativavel futuramente (estoque, WhatsApp, relatorios avancados etc.).

### Recurso

Elemento usado ou ocupado por um compromisso. Hoje o recurso principal e o profissional/instrutor; futuramente pode ser sala, cadeira, veiculo ou equipamento.

### Status

Estado atual de uma entidade. Cadastros usam `active`/`inactive` (Ativo/Inativo); agendamentos, matriculas, cobrancas e presencas tem seus proprios status (ver acima).

## Decisoes de vocabulario

- Linguagem hibrida: termos genericos, com troca fixa de rotulos por modelo operacional; label overrides configuraveis ficam para o futuro.
- Menu do Modelo 1: Dashboard, Clientes, Equipe, Servicos, Agenda. Menu do Modelo 3: Dashboard, Alunos, Equipe, Turmas, Calendario, Modalidades, Planos, Mensalidades. Rodape: Usuarios, Auditoria, Configuracoes.
- Usar "Equipe" como rotulo de navegacao e "Profissional" no contexto de um agendamento e em telas de detalhe.
- Usar "Compromisso operacional" apenas na documentacao e em discussoes tecnicas.
- Evitar expor termos como tenant, recurso, add-on e modulo tecnico para usuarios finais.

## Pendencias

- Definir o termo final para "unidade" quando a multiunidade for implementada.
- Definir o conjunto inicial de rotulos por segmento (label overrides) quando o recurso for implementado.
