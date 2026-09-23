# Modelo 3: Turmas e aulas — especificacao

> 🚀 **STATUS: ATIVO — NÚCLEO OPERACIONAL DO MVP**
> O Modelo 3 é a base do MVP ativo do GestaraHub, sendo validado no tatame com uma academia de Jiu-Jitsu.
> Ver especificações de extensibilidade, neutralidade e nicho em [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md).
>
> Este documento descreve o Modelo 3 **como esta implementado** (revisado em 22/09/2026). Segue a "Regra de evolucao" ([02-modelos-operacionais.md](02-modelos-operacionais.md)) e o ADR de extensao ([../technical/01-extensao-modelos-operacionais.md](../technical/01-extensao-modelos-operacionais.md)): e um **modulo separado** (`apps/web/src/features/turmas`, service `turmasService`, rotas `/classes/*`), reusa a fundacao e **nao** genericiza o nucleo do Modelo 1. Um tenant e de um modelo so — um tenant de turmas (`model: "classes"`) **nao** tem a agenda 1:1 do Modelo 1.
>
> Mensalidades: a fonte de verdade e [15-regras-de-cobranca.md](15-regras-de-cobranca.md) (motor em [../technical/02-motor-de-cobranca.md](../technical/02-motor-de-cobranca.md)).

## Decisao

Um instrutor conduz turmas com varios alunos, em aulas (sessoes) recorrentes. O aluno entra na turma por **matricula** (roster fixo) ou participa de uma aula especifica como **avulso** (pago) ou **experimental** (cortesia). O produto controla presenca/frequencia, mensalidades por plano do aluno (registro/status) e lista de espera. Termos genericos: **Turma**, **Aluno**, **Modalidade** (sem vertical especifico).

## Escopo do 1o corte

Implementado:

- Turmas com grade semanal (`meetingSlots`) + **matricula** (roster).
- **Aulas** geradas na leitura a partir da grade (calendario coletivo).
- **Presenca/frequencia** por aula.
- **Planos e mensalidades** — plano no **aluno**, regra de cobranca da academia, registro e status (`pending/paid/overdue/canceled`), **sem gateway** (ver doc 15).
- **Aula avulsa** (gera cobranca avulsa) e **aula experimental** (sem cobranca) numa aula especifica.
- **Lista de espera** com promocao manual.
- **Instrutor substituto** por aula.
- Capacidade como **regra mole**: ao lotar, avisa e deixa matricular mesmo assim; alternativa = por na lista de espera.

**Reposicao de aula foi removida do escopo.** Nao existe entidade, tela nem regra de reposicao (falta -> reposicao); nao voltar sem nova decisao de produto (ver doc 15).

Fora deste corte (futuro): gateway/conciliacao de pagamento real, emissao fiscal, multi-unidade, graduacao/faixas, relatorios avancados, app do aluno, cancelar/mover uma aula especifica.

## Reuso e fronteiras (ADR 01)

Compartilhado — reusa como esta, sem genericizar:

- **Aluno = `Client`** (o rotulo "Aluno" e so camada de UI; o dado e o mesmo Cliente). O **plano e a assinatura ficam no aluno** (`Client.planId` e campos associados).
- **Instrutor = `Professional`** (com `modalityIds` = modalidades que leciona; obrigatorio ao menos uma no tenant de turmas).
- **Modalidade = `Category`** (ex.: Judo, Ingles A1, Ballet).
- Organizacao/Unidade (inclusive o horario de funcionamento da unidade), Usuarios/RBAC, sessao/auth, shell (nav/layout), camada de dados mock e Auditoria.

Novo (contratos em `packages/contracts/src/class.ts` e `billing.ts`): `ClassGroup`, `Enrollment`, `ClassSession` (gerada), `ClassSessionOverride`, `Attendance`, `ClassReservation`, `WaitlistEntry`, `Plan`, `Charge`.

`Appointment` / `Agenda` do Modelo 1 **nao** sao tocados. O motor de recorrencia do M1 **nao** e usado: as aulas sao derivadas direto de `meetingSlots`.

Divida conhecida: o modulo ainda tem nomes em portugues no codigo (`features/turmas`, `turmasService`, aliases `Plano`/`Cobranca`/`Reserva`); ver [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md).

## Entidades (contrato atual)

Resumo dos contratos reais (campos de auditoria `createdAt`/`updatedAt` omitidos quando obvios).

```ts
// Turma — grupo recorrente conduzido por um instrutor.
interface ClassGroup {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;                  // "Jiu-Jitsu Adulto Noite"
  modalityId?: Id;               // = Category (obrigatorio no formulario)
  instructorId: Id;              // = Professional (titular)
  enrollmentType?: "fixed" | "dropin"; // @deprecated — toda turma e regular
  capacity: number;              // vagas (regra mole)
  planId?: Id;                   // LEGADO — o plano agora e do aluno
  allowDropin?: boolean;         // aceita avulsos nas aulas (ausente = true)
  sessionPriceCents?: number;    // valor da aula avulsa
  meetingSlots: { weekday: Weekday; start: TimeISO; end: TimeISO }[];
  startDate: DateISO;
  endDate?: DateISO;             // no contrato, ainda nao exposto no formulario
  status: RecordStatus;          // active | inactive
}

// Matricula — vinculo Aluno <-> Turma. Sem plano (o plano e do aluno).
interface Enrollment {
  id: Id;
  classGroupId: Id;
  studentId: Id;                 // = Client
  status: "active" | "paused" | "canceled"; // "paused" existe no tipo, mas nada o usa
  enrolledAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancellationReason?: string;
}

// Aula — NAO e armazenada: gerada na leitura a partir de meetingSlots.
interface ClassSession {
  id: Id;                        // "<classGroupId>~<YYYY-MM-DD>~<HH:mm>"
  classGroupId: Id;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  instructorId: Id;              // titular ou substituto (override)
  status: "scheduled" | "done" | "canceled"; // derivado: data passada = done; "canceled" nao e produzido
}

// Troca de instrutor de UMA aula (unica coisa persistida por aula alem da presenca).
interface ClassSessionOverride {
  sessionId: Id;
  instructorId?: Id;
  reason?: string;
}

// Presenca — por (aula x aluno).
interface Attendance {
  id: Id;
  sessionId: Id;
  studentId: Id;
  status: "present" | "absent" | "justified";
  markedAt: DateTimeISO;
}

// Participacao numa aula especifica (avulso ou experimental).
interface ClassReservation {
  id: Id;
  classGroupId: Id;
  sessionId: Id;
  studentId: Id;
  kind?: "dropin" | "trial";     // ausente = dropin
  chargeId?: Id;                 // cobranca avulsa (so dropin com valor > 0)
  status: "reserved" | "canceled";
  reservedAt: DateTimeISO;
}

// Lista de espera de uma turma.
interface WaitlistEntry {
  id: Id;
  classGroupId: Id;
  studentId: Id;
  position: number;
  status: "waiting" | "promoted" | "canceled";
  createdAt: DateTimeISO;
}

// Plano (catalogo).
interface Plan {
  id: Id;
  organizationId: Id;
  name: string;
  priceCents: number;            // > 0 (bolsa integral = desconto de 100% no aluno)
  period: "monthly" | "biweekly" | "weekly";
  status: RecordStatus;
}

// Cobranca — mensalidade ou aula avulsa (registro/status; sem gateway).
interface Charge {
  id: Id;
  organizationId: Id;
  unitId?: Id;
  studentId: Id;
  kind: "membership" | "dropin";
  planId?: Id;                   // membership
  classGroupId?: Id;
  competence?: string;           // "YYYY-MM" do vencimento
  periodStart?: DateISO;         // periodo de uso pago (membership)
  periodEnd?: DateISO;
  sessionId?: Id;                // dropin
  dueDate: DateISO;
  amountCents: number;
  status: "pending" | "paid" | "overdue" | "canceled"; // overdue derivado na leitura
  paidAt?: DateTimeISO;
  method?: "cash" | "pix" | "card" | "other";
  cycleIndex?: number;
  cycleTotal?: number;
  isProrated?: boolean;
  proratedDays?: number;
  notes?: string;
}
```

Campos do **aluno** (`Client`) que pertencem ao Modelo 3: `planId`, `planStartDate`, `billingStrategy` (`prorated | full_cycle`), `cyclePaymentTiming` (`prepaid | postpaid`), `dueDay`, `discount` (`{ type: "percentage" | "fixed"; value; reason? }`) e `membershipStatus` (`active | paused | canceled`).

Read-models: `ClassGroupView` (`modalityName`, `instructorName`, `planName`, `enrolledCount`, `availableSpots`), `EnrollmentView` (nome, status do aluno e frequencia: `presentCount`, `absentCount`, `attendanceRate`), `ClassSessionView` (turma, modalidade, instrutor efetivo, titular, `isSubstitute`, `substitutionReason`), `ClassSessionDetail` (+ `capacity`, `availableSpots`, `allowDropin`, `sessionPriceCents` e `roster: SessionRosterEntry[]` com `kind: "enrolled" | "dropin" | "trial"` e `attendance`), `ChargeView` (`studentName`, `planName`, `planPeriod`, `className`).

## Regras de negocio

**Turma e aulas**
- As aulas sao **geradas na leitura** (`turmasService.listSessions`) para cada dia do intervalo pedido em que a turma ativa tem encontro, respeitando `startDate` e `endDate`. Nao ha materializacao nem janela rolante.
- O id da aula e deterministico (`<classGroupId>~<data>~<HH:mm>`), e so a presenca, as reservas e a troca de instrutor se ancoram nele.
- Status da aula e derivado da data: antes de hoje = `done`; hoje ou depois = `scheduled`. **Nao existe cancelar nem mover uma aula especifica** (ainda nao implementado).
- **Instrutor substituto**: `ClassSessionOverride` troca o instrutor so daquela aula, com motivo opcional; restaurar o titular remove o override.
- **Encontros validados contra o horario de funcionamento da unidade** (quando configurado): encontro fora do expediente, em dia fechado ou sem turno e recusado ao salvar a turma. Salvar um horario de funcionamento que deixa aulas de fora pede confirmacao ("Há aulas fora do novo horário") e as aulas continuam no calendario ate a turma ser ajustada.
- **Conflito de instrutor**: o mesmo instrutor nao pode ter duas turmas ativas com encontros sobrepostos no mesmo dia da semana.
- **Desativar/reativar turma** (soft delete, com confirmacao e Auditoria). Turma inativa nao gera aulas no calendario (inclusive as passadas deixam de ser listadas); matriculas e presencas ficam gravadas.

**Capacidade (regra mole)**
- `availableSpots = capacity - matriculas ativas` (na turma); na aula, `capacity - tamanho do roster`.
- Ao matricular numa turma lotada: o dialogo avisa ("A turma atingiu a capacidade...") e oferece **"Pôr na lista de espera"** ou **"Matricular mesmo assim (N)"**. O service devolve `CLASS_FULL` ("Turma lotada (N vagas).") se chamado sem `allowOverCapacity`.
- Ao liberar vaga, **nao ha aviso** automatico ("vaga aberta") — ainda nao implementado. A promocao da lista de espera e **manual** e pode exceder a capacidade.
- A reserva de aula avulsa/experimental **nao valida capacidade** no service; a UI so esconde o botao quando a turma nao aceita avulsos e a aula esta lotada.

**Matricula**
- Aluno = `Client`. Nao pode haver matricula ativa duplicada ("Aluno já matriculado nesta turma.").
- **Conflito de horario do aluno**: matricula recusada se ele ja tem matricula ativa em outra turma ativa com encontro sobreposto (`CLASS_SCHEDULE_CONFLICT`).
- Cancelar matricula (com confirmacao) mantem o registro (`canceled`, `canceledAt`, motivo) e libera vaga. **A mensalidade nao muda**: ela depende do plano do aluno, nao da matricula.
- **Nao existe pausar matricula.** Pausa e da assinatura do aluno (`Client.membershipStatus = "paused"`), que para de gerar cobranca.

**Aula avulsa e experimental**
- Adicionadas numa aula especifica ("Adicionar aluno nesta aula"). Aluno matriculado na turma nao pode reservar ("Aluno já está matriculado nesta turma."); reserva duplicada e recusada.
- **Avulsa** (`kind: "dropin"`): se o valor (`sessionPriceCents`) for maior que zero, cria `Charge` `kind: "dropin"` com vencimento na data da aula e `unitId` da turma, e guarda `chargeId`.
- **Experimental** (`kind: "trial"`): nao gera cobranca.
- Remover da aula cancela a reserva e a cobranca avulsa ainda nao paga.

**Presenca / frequencia**
- Chamada por aula, para o roster da data: matriculados **vigentes naquela data** (matriculados ate o dia e nao cancelados antes dele), quem ja tem presenca marcada na aula e as reservas ativas.
- Status: `present` ("Presente"), `absent` ("Faltou"), `justified` ("Justificada"). Um clique, sem confirmacao.
- **Chamada bloqueada em aula futura** ("A chamada só pode ser feita no dia da aula ou depois.").
- Frequencia do aluno na turma = `present / (present + absent)` sobre **todas as presencas ja marcadas** dele naquela turma (sem recorte de periodo). `justified` nao penaliza.
- Frequencia e **informativa**: badge no detalhe da turma, com destaque quando `< 75%`. **Nao bloqueia** nada.

**Mensalidade e cobranca**
- Resumo: o plano e do **aluno**; a academia define a regra padrao (antecipado ou depois do uso; proporcional ou ciclo cheio; dia de vencimento 1 a 28), herdada e personalizavel no aluno; a 1a cobranca nasce no cadastro; "Gerar cobranças" cria as da competencia de forma idempotente; atrasado e derivado na leitura; pagar exige forma de pagamento; aluno pausado, cancelado ou inativo nao gera cobranca. **Detalhes e matriz de exemplos em [15-regras-de-cobranca.md](15-regras-de-cobranca.md)** (antes: "cobranca cheia, sem pro-rata" — substituido).
- Aula avulsa: cobranca `dropin` por aula, como acima.
- Retrocompatibilidade: aluno sem plano proprio matriculado em turma com `planId` legado ainda e cobrado pela regra da academia.

**Auditoria**
- Entram: criar/editar/desativar/reativar turma, matricular, cancelar matricula, reservar/remover da aula e todas as operacoes financeiras.
- Ainda nao entram: presenca, lista de espera (entrar, promover, remover) e troca de instrutor.

**RBAC**
- Permissoes: `classes:view`, `classes:manage`, `enrollment:manage`, `attendance:mark`, `billing:view`, `billing:manage` (ver [06-perfis-permissoes.md](06-perfis-permissoes.md)).
- **Ainda nao implementado:** escopo do instrutor "ve so as proprias turmas". Quem tem `classes:view` ve todas as turmas e aulas.

## Fluxos principais

1. **Criar turma** — nome, modalidade, instrutor, capacidade, data de inicio, encontros (dias/horarios) e, opcionalmente, permitir avulsos + valor da aula avulsa. Nao ha plano na turma.
2. **Matricular alunos** — selecao multipla; se lotada, "Pôr na lista de espera" ou "Matricular mesmo assim (N)".
3. **Adicionar avulso/experimental numa aula** — avulso gera cobranca avulsa; experimental e cortesia.
4. **Trocar instrutor de uma aula** — substituto com motivo opcional; restaurar titular.
5. **Fazer a chamada** — Presente / Faltou / Justificada, no dia da aula ou depois.
6. **Promover da lista de espera** — manual, com confirmacao.
7. **Mensalidades** — cadastrar aluno com plano (1a cobranca), gerar competencia, registrar pagamento, desfazer/cancelar/reabrir, resetar competencia. Ver doc 15 e [09-fluxos-principais.md](09-fluxos-principais.md) (Fluxos 12 a 16).
8. **Cancelar matricula** — com confirmacao; libera vaga; nao mexe na mensalidade.
9. **Pausar assinatura** — no cadastro do aluno (`membershipStatus`), nao na matricula.

## Telas

- **Turmas** (`/classes`) — lista com busca e filtro de status; Nova/Editar turma; desativar/reativar.
- **Detalhe da turma** (`/classes/[id]`) — abas Matriculados (com frequencia) e Lista de espera; acoes matricular, cancelar matricula, promover/remover da espera.
- **Calendario** (`/classes/calendar`) — aulas da semana (grade ou lista), filtros de modalidade e instrutor; clique abre a aula.
- **Detalhe da aula** (`/classes/sessions/[sessionId]`) — roster + chamada; adicionar avulso/experimental; remover da aula; trocar instrutor.
- **Modalidades**, **Planos** (CRUD simples) e **Mensalidades** (lista por competencia, totais, gerar, pagar, desfazer, cancelar, reabrir, resetar).
- **Alunos** — o cadastro de Cliente com a secao de plano e assinatura.
- **Ainda nao implementado:** perfil do aluno com turmas, frequencia e mensalidades num so lugar; a lista de espera so existe dentro do detalhe da turma.

## Estados e mensagens (resumo)

| Entidade | Estados |
| --- | --- |
| Turma | active, inactive |
| Matricula | active, canceled (`paused` no tipo, sem uso) |
| Aula | scheduled, done (derivados da data) |
| Reserva | reserved, canceled |
| Presenca | present, absent, justified |
| Cobranca | pending, paid, overdue (derivado), canceled |
| Assinatura do aluno | active, paused, canceled |
| Lista de espera | waiting, promoted, canceled |

Mensagens-chave (texto real): "Turma lotada (N vagas)."; "Matricular mesmo assim (N)" / "Pôr na lista de espera"; "Aluno já matriculado nesta turma."; "[Aluno] já possui aula [Dia] (HH:mm-HH:mm) na turma "[Turma]"."; "[Instrutor] já tem aula [Dia] HH:mm-HH:mm em "[Turma]"."; "A chamada só pode ser feita no dia da aula ou depois."; "Informe um valor maior que zero.". Lista completa, com confirmacoes, em [10-estados-e-mensagens.md](10-estados-e-mensagens.md).

## Premissas assumidas (confirmar)

- **1 instrutor titular por turma**, com substituto por aula (nao multi-instrutor por turma).
- **Aluno = Client** e **Instrutor = Professional** reusados; "Aluno/Instrutor" e rotulo de UI.
- **Modalidade = Category** reusada.
- **Aulas derivadas da grade**, nao armazenadas.
- **Financeiro = registro/status** (sem pagamento real), como todo o mock.
- **Um modelo por tenant**: este tenant nao expoe a agenda 1:1 do M1.

## Decisoes do 1o corte

Fechadas:

- **Plano no aluno**, nao na turma (`ClassGroup.planId` e legado).
- **Cobranca:** regra da academia com antecipado/depois do uso e proporcional/ciclo cheio — ver doc 15 (antes: cobranca cheia, sem pro-rata).
- **Avulso pago e experimental:** avulso = cobranca `dropin` por aula; experimental sem cobranca.
- **Lista de espera:** promocao **manual**; sem automacao.
- **Frequencia:** **informativa** (% + destaque `<75%`); **sem bloqueio**.
- **Aulas:** geradas na leitura a partir da grade (antes: materializacao por janela rolante de ~8 semanas).
- **Reposicao:** removida do escopo (antes: prazo de 30 dias, neutralizava a falta).

Fora deste corte (revisitar depois): cancelar/mover aula, aviso de vaga aberta, promocao automatica, escopo do instrutor, perfil do aluno, frequencia por periodo, enforcement de frequencia minima, gateway de pagamento.
