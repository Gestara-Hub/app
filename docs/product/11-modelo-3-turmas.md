# Modelo 3: Turmas e aulas — especificacao

> 🚀 **STATUS: ATIVO — NÚCLEO OPERACIONAL DO MVP**
> O Modelo 3 é a base do MVP ativo do GestaraHub, sendo validado no tatame com uma academia de Jiu-Jitsu.
> Ver especificações de extensibilidade, neutralidade e nicho em [14-mvp-academia-lutas.md](14-mvp-academia-lutas.md).
>
> Spec dev-ready do Modelo 3. Segue a "Regra de evolucao" ([02-modelos-operacionais.md](02-modelos-operacionais.md)) e o ADR de extensao ([../technical/01-extensao-modelos-operacionais.md](../technical/01-extensao-modelos-operacionais.md)): entra como **modulo separado** (`features/turmas`), reusa a fundacao, **nao** genericiza o nucleo do Modelo 1. Um tenant e de um modelo so — um tenant de turmas **nao** tem a agenda 1:1 do Modelo 1.

## Decisao

Um instrutor conduz turmas com varios alunos, em aulas (sessoes) recorrentes. O aluno se vincula a turma por **matricula** (roster fixo) ou reserva sessoes avulsas (**drop-in**). O produto controla presenca/frequencia, mensalidade (registro/status), reposicao de falta e lista de espera. Termos genericos: **Turma**, **Aluno**, **Modalidade** (sem vertical especifico).

## Escopo do 1o corte

Tudo abaixo entra ja no primeiro corte:

- Turmas + **matricula** (roster).
- **Sessoes/aulas** recorrentes (calendario coletivo), geradas pelo motor de recorrencia.
- **Presenca/frequencia** por sessao.
- **Mensalidade/planos** — registro e status apenas (`pendente/pago/atrasado`), **sem gateway de pagamento** (coerente com o mock do MVP).
- **Reposicao** de aula (falta -> reposicao).
- **Lista de espera** (quando a turma lota).
- Dois tipos de inscricao: **turma fixa** (matricula) e **drop-in** (reserva por sessao).
- Capacidade e **regra mole**: ao lotar, avisa e deixa inscrever mesmo assim; alternativa = por na lista de espera.

Fora deste corte (futuro): gateway/conciliacao de pagamento real, emissao fiscal, multi-unidade, graduacao/faixas automatizadas, relatorios avancados, app do aluno.

## Reuso e fronteiras (ADR 01)

Compartilhado — reusa como esta, sem genericizar:

- **Aluno = `Client`** (o rotulo "Aluno" e so camada de UI; o dado e o mesmo Cliente).
- **Instrutor = `Professional`.**
- **Modalidade = `Category`** (ex.: Judo, Ingles A1, Ballet).
- Organizacao/Unidade, Usuarios/RBAC, sessao/auth, shell (nav/layout), camada de dados mock, e o **motor de recorrencia** de `@gestarahub/core` (gera as sessoes, como ja gera as ocorrencias do Modelo 1).

Novo (modulo `apps/web/src/features/turmas` + contratos): `Turma`, `Matricula`, `Sessao`, `Reserva`, `Presenca`, `Plano`, `Cobranca`, `Reposicao`, `ListaEspera`.

`Appointment` / `Agenda` do Modelo 1 **nao** sao tocados.

## Entidades (esboco de contrato)

Rascunho em estilo `@gestarahub/contracts` (nomes/campos sujeitos a ajuste na implementacao).

```ts
// Turma — grupo recorrente conduzido por um instrutor.
interface Turma {
  id: Id;
  organizationId: Id;
  unitId: Id;
  name: string;                 // "Judo Infantil A"
  modalityId: Id;               // = Category (modalidade)
  instructorId: Id;             // = Professional (instrutor titular)
  enrollment: "fixed" | "dropin"; // matricula no roster OU reserva por sessao
  capacity: number;             // vagas (regra mole ao lotar)
  // Grade recorrente: dias/horarios em que a turma se reune. As sessoes sao
  // geradas destes slots pelo motor de recorrencia, dentro da vigencia.
  meetingSlots: { weekday: Weekday; start: TimeISO; end: TimeISO }[];
  startDate: DateISO;
  endDate?: DateISO;            // sem fim = turma continua (gera janela rolante)
  planId?: Id;                  // plano/mensalidade padrao da turma fixa (herdado na matricula)
  sessionPriceCents?: number;   // preco da aula avulsa (turmas drop-in) -> cobranca avulsa
  status: RecordStatus;         // active | inactive
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// Matricula — vinculo Aluno <-> Turma (turma fixa).
interface Matricula {
  id: Id;
  turmaId: Id;
  studentId: Id;                // = Client
  status: "active" | "paused" | "canceled";
  planId?: Id;                  // default = turma.planId
  enrolledAt: DateTimeISO;
  canceledAt?: DateTimeISO;
  cancellationReason?: string;
}

// Sessao — ocorrencia datada de uma turma (uma aula).
interface Sessao {
  id: Id;
  turmaId: Id;
  date: DateISO;
  start: TimeISO;
  end: TimeISO;
  instructorId: Id;             // titular por padrao; pode ser substituto
  status: "scheduled" | "done" | "canceled";
  canceledReason?: string;
  // Roster efetivo = matriculas ativas da turma (se fixed) + reservas (drop-in).
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

// Reserva — Aluno <-> Sessao (drop-in / aula avulsa).
interface Reserva {
  id: Id;
  sessaoId: Id;
  studentId: Id;
  status: "reserved" | "canceled";
  reservedAt: DateTimeISO;
}

// Presenca — por (Sessao x Aluno). "falta" alimenta frequencia e reposicao.
interface Presenca {
  id: Id;
  sessaoId: Id;
  studentId: Id;
  status: "present" | "absent" | "justified";
  markedAt: DateTimeISO;
}

// Plano — plano de mensalidade (catalogo).
interface Plano {
  id: Id;
  organizationId: Id;
  name: string;                 // "Mensal 2x/semana"
  priceCents: number;
  period: "monthly";            // MVP: mensal
  status: RecordStatus;
}

// Cobranca — valor devido por um aluno (registro/status; sem gateway).
// kind "mensalidade" = plano mensal da turma fixa; "avulsa" = aula drop-in.
interface Cobranca {
  id: Id;
  studentId: Id;
  kind: "mensalidade" | "avulsa";
  turmaId?: Id;
  planId?: Id;                  // mensalidade
  competencia?: string;         // "YYYY-MM" (mensalidade)
  sessaoId?: Id;                // avulsa (a aula reservada)
  dueDate: DateISO;
  amountCents: number;          // cobranca cheia (sem pro-rata)
  status: "pending" | "paid" | "overdue" | "canceled";
  paidAt?: DateTimeISO;
}

// Reposicao — falta -> aula de reposicao.
interface Reposicao {
  id: Id;
  studentId: Id;
  missedSessaoId: Id;
  makeupSessaoId?: Id;          // definido quando o aluno agenda a reposicao
  deadline: DateISO;            // 30 dias corridos apos a falta; passou -> expired
  status: "pending" | "scheduled" | "done" | "expired";
  createdAt: DateTimeISO;
}

// ListaEspera — fila de espera de uma turma lotada.
interface ListaEspera {
  id: Id;
  turmaId: Id;
  studentId: Id;
  position: number;
  status: "waiting" | "promoted" | "canceled";
  createdAt: DateTimeISO;
}
```

Read-models (views) expandem os refs: `TurmaView` com `modality`, `instructor`, `enrolledCount`/`vagasRestantes`; `SessaoView` com `turma`, `instructor` e o roster (matriculados + reservas) com presenca.

## Regras de negocio

**Turma e sessoes**
- A turma gera **sessoes** a partir de `meetingSlots` + vigencia (`startDate`/`endDate`), pelo motor de recorrencia. **Materializacao por janela rolante (~8 semanas a frente)**, estendida conforme o tempo passa e conforme se navega no calendario; turma com `endDate` curto materializa ate o fim.
- Sessao herda `instructorId` da turma; pode ser trocado por sessao (substituto) sem alterar a turma.
- Cancelar uma sessao nao apaga: marca `canceled` (historico), e as faltas dela nao contam contra a frequencia.

**Capacidade (regra mole)**
- `vagasRestantes = capacity - (matriculas ativas | reservas da sessao)`.
- Ao inscrever numa turma/sessao lotada: **avisa e deixa confirmar** ("Turma lotada — inscrever mesmo assim?"), consistente com o override de horario do Modelo 1. Alternativa oferecida no mesmo aviso: **por na lista de espera**.
- Ao liberar vaga (cancelamento de matricula/reserva), o 1o da lista de espera fica elegivel: promocao e **manual** (aviso "1 na lista de espera — promover?"; o staff decide). Sem promocao automatica.

**Matricula (turma fixa)**
- Aluno = Client ativo. Matricula tem status `active/paused/canceled`; `paused` mantem o vinculo mas nao conta como presenca esperada nem gera cobranca.
- Cancelar matricula mantem o historico (nao remove); libera vaga.

**Drop-in (reserva)**
- Reserva vincula Aluno a uma **Sessao** especifica (turma `dropin`). Nao cria matricula. Cancelar reserva libera a vaga.

**Presenca / frequencia**
- Presenca por sessao, por aluno do roster efetivo: `present | absent | justified`.
- Frequencia do aluno = `present / (present + absent)` num periodo/turma. Nao penalizam: `justified` e faltas ja **repostas** (reposicao `done`).
- So sessoes `done` entram no calculo; `scheduled`/`canceled` nao.
- Frequencia e **informativa**: exibe % + historico, com destaque visual para frequencia baixa (limiar fixo, ex.: `<75%`). **Nao bloqueia** nada (sem enforcement).

**Reposicao**
- Uma `absent` (nao justificada) pode gerar uma `Reposicao` `pending`, com `deadline` = **30 dias corridos** apos a falta. O aluno agenda a reposicao numa outra sessao com vaga (via reserva), passando a `scheduled` -> `done`.
- Reposicao `done` **neutraliza a falta original** (deixa de penalizar a frequencia). Passado o `deadline` sem repor, vira `expired` e a falta permanece.

**Mensalidade e cobranca (registro/status)**
- Turma **fixa**: `Plano` (valor/periodo mensal) herdado pela matricula; gera `Cobranca` `kind: "mensalidade"` por aluno x competencia (`YYYY-MM`). **Cobranca cheia** — sem pro-rata no meio do mes. Matricula `paused`/`canceled` **nao gera** cobranca nas competencias afetadas.
- Turma **drop-in**: a reserva gera `Cobranca` `kind: "avulsa"` pelo `sessionPriceCents` da turma (uma por aula reservada).
- `overdue` quando passa `dueDate` sem `paid`. Geracao mensal manual/simulada. **Sem gateway** — so registro/status.

**RBAC**
- Reusa o modelo de perfis/permissoes: proprietario/gerente gerenciam turmas/planos/cobrancas; instrutor ve suas turmas/sessoes e marca presenca; escopo do perfil "instrutor" espelha o "profissional" do M1 (ve so as proprias turmas).

## Fluxos principais

1. **Criar turma** — nome, modalidade, instrutor, tipo (fixa/drop-in), capacidade, grade (dias/horarios), vigencia, plano (fixa) ou preco por aula (drop-in). Ao salvar, materializa as primeiras sessoes.
2. **Matricular aluno** (turma fixa) — seleciona aluno (Client); se lotada -> aviso mole (confirmar ou lista de espera); define/herda plano.
3. **Reservar sessao** (drop-in) — aluno reserva uma sessao especifica; mesma regra de capacidade; gera cobranca avulsa (`sessionPriceCents`).
4. **Gerir sessoes** — ver calendario coletivo; cancelar/mover sessao; trocar instrutor (substituto).
5. **Marcar presenca** — na sessao, lista do roster com present/absent/justified; falta pode abrir reposicao.
6. **Agendar reposicao** — a partir de uma falta pendente (dentro do prazo de 30 dias), escolher uma sessao com vaga.
7. **Promover da lista de espera** — ao abrir vaga, promover manualmente o proximo (vira matricula/reserva).
8. **Cobranca mensal** — gerar/consultar cobrancas da competencia; marcar `paid`; ver inadimplentes.
9. **Pausar/cancelar matricula** — com motivo; libera vaga; para de gerar cobranca.

## Telas

- **Turmas** (lista + filtro por modalidade/instrutor/status) e **Nova/Editar turma**.
- **Detalhe da turma** — dados, grade, roster (matriculados + vagas), plano, sessoes proximas; acoes (matricular, editar, encerrar).
- **Calendario de turmas** (coletivo) — sessoes por dia/semana; clique abre a sessao. (Reusa o conceito de calendario do M1, com "sessao" no lugar de "agendamento" — **novo componente**, nao o grid 1:1.)
- **Detalhe da sessao** — roster + **marcar presenca**; reservas drop-in; trocar instrutor; cancelar sessao.
- **Aluno (perfil)** — reusa o cadastro de Cliente + aba/secao de turmas, **frequencia** e **mensalidades**.
- **Planos** (CRUD simples) e **Mensalidades/Cobrancas** (lista por competencia, inadimplentes, marcar pago).
- **Lista de espera** (por turma).
- **Reposicoes** (pendentes por aluno/turma).

## Estados e mensagens (resumo)

| Entidade | Estados |
| --- | --- |
| Turma | active, inactive |
| Matricula | active, paused, canceled |
| Sessao | scheduled, done, canceled |
| Reserva | reserved, canceled |
| Presenca | present, absent, justified |
| Cobranca | pending, paid, overdue, canceled |
| Reposicao | pending, scheduled, done, expired |
| ListaEspera | waiting, promoted, canceled |

Mensagens-chave: "Turma lotada — inscrever mesmo assim? / Por na lista de espera"; "Aluno ja matriculado nesta turma"; "Reposicao vinculada a sessao de DD/MM"; "Mensalidade de MM/AAAA em atraso".

## Premissas assumidas (confirmar)

- **1 instrutor titular por turma**, com substituto por sessao (nao multi-instrutor por turma).
- **Aluno = Client** e **Instrutor = Professional** reusados; "Aluno/Instrutor" e rotulo de UI.
- **Modalidade = Category** reusada.
- **Sessoes** geradas pelo motor de recorrencia existente (mesma familia da recorrencia do M1), materializadas por janela.
- **Financeiro = registro/status** (sem pagamento real), como todo o mock.
- **Um modelo por tenant**: este tenant nao expoe a agenda 1:1 do M1.

## Decisoes do 1o corte

Fechadas (antes eram pendencias):

- **Reposicao:** prazo de **30 dias corridos** apos a falta; reposicao `done` **neutraliza** a falta na frequencia; sem repor ate o prazo -> `expired`.
- **Cobranca:** **cheia** (sem pro-rata) no meio do mes; matricula pausada/cancelada nao gera cobranca.
- **Drop-in pago:** turma fixa = mensalidade (plano); drop-in = **cobranca avulsa** por aula (`sessionPriceCents`).
- **Lista de espera:** promocao **manual** (staff decide ao abrir vaga); sem automacao.
- **Frequencia:** **informativa** (exibe % + destaque para baixa, ex.: `<75%`); **sem bloqueio**.
- **Sessoes:** materializacao por **janela rolante (~8 semanas)**, estendida conforme navega; `endDate` curto materializa ate o fim.

Fora deste corte (revisitar depois): pro-rata/financeiro avancado, promocao automatica de lista de espera, enforcement de frequencia minima, materializacao "so ao escrever".
