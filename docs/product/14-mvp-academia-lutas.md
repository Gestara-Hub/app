# MVP Academia de Lutas (Jiu-Jitsu) e Extensibilidade do Modelo 3

> 🚀 **STATUS: ATIVO — FOCO PRINCIPAL DO MVP**
> Este documento define a estratégia, o escopo operacional e a matriz de extensibilidade para o MVP do GestaraHub, focado na operação de **Academias de Lutas e Artes Marciais (com validação prioritária em Jiu-Jitsu através de design partner no tatame)**.

---

## 1. Decisão e Contexto Estratégico

### Decisão
O primeiro ciclo de lançamento do GestaraHub foca na entrega de um MVP para **Academias de Lutas / Artes Marciais**, operando sob o modelo operacional **`classes` (Modelo 3 — Turmas e Aulas Coletivas)**.

O desenvolvimento e refinamento deste MVP é orientado por um **design partner real** (professor/proprietário de academia de Jiu-Jitsu), garantindo que as dores reais do tatame (chamada rápida, controle de faixas/graus, inadimplência e turmas kids) sejam resolvidas na prática.

O Modelo 1 (Barbearia "Corte Nobre" — agendamento 1:1) permanece tecnicamente implementado no repositório, mas com escopo **congelado** em standby para evitar dispersão de esforços.

### Por que Jiu-Jitsu / Lutas?
O segmento de artes marciais possui as regras operacionais mais rigorosas dentro de negócios com turmas coletivas:
1. **Frequência como requisito de progressão:** O número de presenças determina a aptidão para graus e faixas.
2. **Público misto (Kids e Adultos):** Alta demanda de alunos menores de idade, exigindo contato e gestão financeira através dos pais/responsáveis.
3. **Rotina dinâmica de tatame:** O professor precisa de ferramentas com pouquíssimos cliques para chamada e conferência rápida de situação financeira.

> **Princípio arquitetural:** Um sistema que atende perfeitamente a dinâmica exigente de uma academia de Jiu-Jitsu atende com facilidade outros segmentos de turmas (treinamento funcional, pilates em grupo, dança, natação ou escolas de idiomas).

---

## 2. Regra Estrita de Nomenclatura e Idioma

Seguindo as diretrizes fundamentais do projeto (`AGENTS.md`):

1. **Código-fonte e Modelagem de Dados 100% em Inglês:**
   - Todas as entidades, interfaces, campos, variáveis, enums, métodos e hooks devem ser nomeados em inglês e de forma neutra.
   - Proibido o uso de termos em português ou termos exclusivos de um nicho no banco/contratos (ex.: não usar `faixa`, `grau`, `tatame` ou `bjj`). Utilizar `currentLevel`, `subLevel`, `roster`, etc.

2. **Interface do Usuário (UI) 100% em Português (`pt-BR`):**
   - Todos os rótulos de campos, botões, títulos, crachás de status, diálogos e notificações são apresentados em português brasileiro, adaptando os termos para o vocabulário familiar ao usuário.

**Dívida conhecida (código ainda em português):** a pasta `apps/web/src/features/turmas`, o `turmasService` (e `useCancelReserva`, `cancelReserva`), os aliases de compatibilidade em `packages/contracts` (`Plano`, `CreatePlano`, `Cobranca`, `CobrancaView`, `Reserva`, `ReservaView`...) e campos depreciados (`ClassReservation.cobrancaId`, `ClassGroupView.vagasRestantes`). Os contratos canônicos já estão em inglês (`Plan`, `Charge`, `ClassReservation`, `availableSpots`); a renomeação do módulo fica pendente.

---

## 3. Matriz de Equivalência e Neutralidade de Domínio

Para permitir que o modelo evolua para qualquer segmento de turmas sem quebras ou refatorações futuras, os conceitos são mapeados de maneira abstrata no contrato e traduzidos na interface. Linhas marcadas com *(planejado)* ainda **não existem** no contrato:

| Conceito Operacional | Propriedade no Contrato (Inglês Neutro) | Exibição: Artes Marciais (BJJ) | Exibição: Idiomas / Cursos | Exibição: Dança / Movimento |
| :--- | :--- | :--- | :--- | :--- |
| **Aluno** | `Client` | Aluno / Atleta | Aluno / Estudante | Aluno / Dançarino |
| **Instrutor** | `Professional` | Professor / Sensei | Professor / Teacher | Instrutor / Professor |
| **Modalidade** | `Category` | Modalidade (ex: Jiu-Jitsu, Judô) | Idioma / Curso (ex: Inglês) | Estilo (ex: Ballet, Dança) |
| **Nível do Aluno** *(planejado)* | `progression.currentLevel` | **Faixa** (Branca, Azul, Roxa...) | **Nível** (A1, B2, Intermediário) | **Nível** (Iniciante, Avançado) |
| **Sub-nível** *(planejado)* | `progression.subLevel` | **Grau** (1 a 4) | **Módulo / Lição** (1 a 4) | **Estágio** (1 a 3) |
| **Responsável** *(planejado)* | `guardian` | Pai / Mãe (Kids) | Pai / Mãe (Kids/Teens) | Responsável Legal |
| **Turma** | `ClassGroup` | Turma / Horário de Treino | Turma / Grupo de Estudo | Turma |
| **Público-alvo** *(planejado)* | `audience` | Categoria (Kids, Adulto) | Faixa Etária (Kids, Teens) | Categoria |
| **Aula / Treino** | `ClassSession` | Treino / Sessão | Aula | Aula |
| **Lista de Chamada** | `SessionRosterEntry` | Lista do Tatame | Chamada da Sala | Lista de Frequência |
| **Status da Presença**| `AttendanceStatus` | Presente, Falta, Justificada | Presente, Falta, Justificada | Presente, Falta, Justificada |
| **Aula Experimental**| `ReservationKind = "trial"` | Aula Experimental | Aula Demonstrativa | Aula Teste |
| **Mensalidade** | `Plan` (no aluno: `Client.planId`) / `Charge` | Plano / Mensalidade | Mensalidade / Parcela | Mensalidade / Plano |

---

## 4. Estrutura de Dados Estendida (planejada, ainda não implementada)

> ⚠️ **Nada desta seção existe no código hoje.** `Client` não tem `birthDate`, `guardian` nem `progression`; `ClassGroup` não tem `audience` nem `minLevel`; `SessionRosterEntry` não tem `levelDisplay`, `financialStatus`, `isMinor` nem `guardianPhone`. Os blocos abaixo são a proposta para quando graduação, kids e alerta financeiro na chamada entrarem. O contrato atual está em [11-modelo-3-turmas.md](11-modelo-3-turmas.md).

O `Client` atual já tem, do Modelo 3, os campos de plano e assinatura: `planId`, `planStartDate`, `billingStrategy`, `cyclePaymentTiming`, `dueDay`, `discount` e `membershipStatus` (ver [15-regras-de-cobranca.md](15-regras-de-cobranca.md)).

### A. Aluno (`Client`) com Progressão e Responsável *(planejado)*
Proposta para `packages/contracts/src/client.ts`, com campos opcionais para garantir retrocompatibilidade com qualquer outro modelo:

```typescript
export interface GuardianInfo {
  name: string;
  phone: string;
  relationship?: "mother" | "father" | "guardian" | "other";
}

export interface StudentProgression {
  currentLevel: string;            // "white", "blue" ou texto livre / ID
  subLevel?: number;               // 0 a 4 (graus)
  promotedAt?: DateISO;            // data da última graduação
  attendanceCountAtLevel?: number; // presenças acumuladas no nível atual
}

export interface Client {
  id: Id;
  organizationId: Id;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  birthDate?: DateISO;             // data de nascimento para cálculo de faixa etária
  guardian?: GuardianInfo;         // responsável para menores de idade
  progression?: StudentProgression;// nível atual e graus
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}
```

### B. Turma (`ClassGroup`) com Segmentação de Público *(planejado)*
Proposta para `packages/contracts/src/class.ts`:

```typescript
export type ClassAudience = "all" | "kids" | "adults";

export interface ClassGroup {
  // ... campos existentes (name, modalityId, instructorId, capacity, meetingSlots, etc.)
  audience?: ClassAudience; // segmentação de público
  minLevel?: string;        // restrição de nível mínimo (ex.: apenas a partir da faixa azul)
}
```

### C. Chamada no Tatame (`SessionRosterEntry`)
Hoje a linha da chamada é:

```typescript
export type SessionRosterKind = "enrolled" | "dropin" | "trial"; // matriculado | avulso | experimental

export interface SessionRosterEntry {
  studentId: Id;
  studentName: string;
  kind?: SessionRosterKind;
  attendance?: AttendanceStatus; // present | absent | justified
}
```

Proposta *(planejado)* para a chamada informativa no tatame:

```typescript
export interface SessionRosterEntry {
  // ...campos atuais
  levelDisplay?: string; // ex: "Faixa Azul (2º grau)"
  financialStatus?: "ok" | "overdue"; // indicador visual no tatame
  isMinor?: boolean; // indicador de menor de idade
  guardianPhone?: string; // telefone de contato rápido em emergências
}
```

O antigo `kind: "makeup"` (reposição) saiu: reposição foi removida do escopo.

---

## 5. Fronteiras de Módulos e Isolamento (ADR 01)

- **Fundação Compartilhada:** Organizações, Unidades, Usuários, Permissões/RBAC, Sessão, Layout e Camada de Mock (`store.ts`) continuam comuns a todo o GestaraHub.
- **Isolamento de Modelos:** Nenhuma regra de Jiu-Jitsu ou turmas polui entidades de barbearia (`Appointment`, `Service`, `TimeBlock`).
- **Configuração de Tenant:** O tenant de academia do seed é a "Academia X" (`org-academia-x`), com `model: "classes"` e `segment: "Academia"`. O `segment` é só rótulo; o que muda o app é o `model`.
- **Tenant Ativo no Ambiente de Mock:** O `activeOrganizationId` inicial em `seed.ts` continua sendo a **Corte Nobre**. Na prática quem escolhe o tenant é o login: a tela lista os usuários de todas as organizações e entrar como Ana Ribeiro (proprietária da Academia X) abre a academia. Os dois tenants nascem vazios, só com o proprietário (ver [../technical/03-multi-tenant-e-escopo.md](../technical/03-multi-tenant-e-escopo.md)).

---

## 6. Já Entregue

- **Turmas, matrícula, calendário e chamada** — aulas geradas a partir da grade; chamada rápida (Presente / Faltou / Justificada, um clique), bloqueada para aulas futuras; frequência com destaque abaixo de 75% (ver [11-modelo-3-turmas.md](11-modelo-3-turmas.md)).
- **Planos por aluno** — o plano e a assinatura ficam no aluno (`Client.planId`, `membershipStatus` etc.); plano mensal, quinzenal ou semanal, com valor maior que zero.
- **Regras de cobrança** — antecipado ou depois do uso, proporcional ou ciclo cheio, dia de vencimento, desconto, geração idempotente, pagamento com forma obrigatória. Ver [15-regras-de-cobranca.md](15-regras-de-cobranca.md).
- **Lista de espera** — turma lotada oferece lista de espera ou matrícula acima da capacidade; promoção manual.
- **Aula avulsa e experimental** — avulsa gera cobrança avulsa; experimental não gera.
- **Instrutor substituto** por aula.
- **Validação contra o horário da unidade** — encontros fora do expediente são recusados; mudar o horário da unidade avisa quando deixa aulas de fora. Também há conflito de horário do instrutor e do aluno.
- **Auditoria** das operações de turma, matrícula e de todas as operações financeiras.
- **Testes automatizados** — motor de cobrança, regras dos services e fluxos e2e (turmas, mensalidades, cadastros, configurações, mobile). Ver [../technical/04-estrategia-de-testes.md](../technical/04-estrategia-de-testes.md).

## 7. Próximos Passos e Priorização do Tatame

1. **Incorporar sugestões do parceiro de teste:** Receber e priorizar o feedback prático do professor de Jiu-Jitsu.
2. ~~**Implementar a chamada ágil**~~ — entregue (ver seção 6).
3. **Adicionar graduação no perfil do aluno:** Registro de faixa atual, graus e data de graduação. *Ainda não implementado* (depende dos campos planejados da seção 4 e de uma tela de perfil do aluno, que também não existe).
4. **Alerta discreto de mensalidade pendente:** Informar o status financeiro diretamente na lista de chamada da aula. *Ainda não implementado.*
5. **Turmas kids e responsável:** data de nascimento, responsável e público-alvo da turma. *Ainda não implementado.*
6. **Escopo do instrutor:** perfil de instrutor vendo só as próprias turmas. *Ainda não implementado.*
