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

---

## 3. Matriz de Equivalência e Neutralidade de Domínio

Para permitir que o modelo evolua para qualquer segmento de turmas sem quebras ou refatorações futuras, os conceitos são mapeados de maneira abstrata no contrato e traduzidos na interface:

| Conceito Operacional | Propriedade no Contrato (Inglês Neutro) | Exibição: Artes Marciais (BJJ) | Exibição: Idiomas / Cursos | Exibição: Dança / Movimento |
| :--- | :--- | :--- | :--- | :--- |
| **Aluno** | `Client` | Aluno / Atleta | Aluno / Estudante | Aluno / Dançarino |
| **Instrutor** | `Professional` | Professor / Sensei | Professor / Teacher | Instrutor / Professor |
| **Modalidade** | `Category` | Modalidade (ex: Jiu-Jitsu, Judô) | Idioma / Curso (ex: Inglês) | Estilo (ex: Ballet, Dança) |
| **Nível do Aluno** | `progression.currentLevel` | **Faixa** (Branca, Azul, Roxa...) | **Nível** (A1, B2, Intermediário) | **Nível** (Iniciante, Avançado) |
| **Sub-nível** | `progression.subLevel` | **Grau** (1 a 4) | **Módulo / Lição** (1 a 4) | **Estágio** (1 a 3) |
| **Responsável** | `guardian` | Pai / Mãe (Kids) | Pai / Mãe (Kids/Teens) | Responsável Legal |
| **Turma** | `ClassGroup` | Turma / Horário de Treino | Turma / Grupo de Estudo | Turma |
| **Público-alvo** | `audience` | Categoria (Kids, Adulto) | Faixa Etária (Kids, Teens) | Categoria |
| **Aula / Treino** | `ClassSession` | Treino / Sessão | Aula | Aula |
| **Lista de Chamada** | `SessionRosterEntry` | Lista do Tatame | Chamada da Sala | Lista de Frequência |
| **Status da Presença**| `AttendanceStatus` | Presente, Falta, Justificada | Presente, Falta, Justificada | Presente, Falta, Justificada |
| **Aula Experimental**| `ReservationKind = "trial"` | Aula Experimental | Aula Demonstrativa | Aula Teste |
| **Mensalidade** | `Plan` / `Charge` | Plano / Mensalidade | Mensalidade / Parcela | Mensalidade / Plano |

---

## 4. Estrutura de Dados Estendida

### A. Aluno (`Client`) com Progressão e Responsável
Em `packages/contracts/src/client.ts`, os novos campos são opcionais para garantir retrocompatibilidade com qualquer outro modelo:

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

### B. Turma (`ClassGroup`) com Segmentação de Público
Em `packages/contracts/src/class.ts`:

```typescript
export type ClassAudience = "all" | "kids" | "adults";

export interface ClassGroup {
  // ... campos existentes (name, modalityId, instructorId, capacity, meetingSlots, etc.)
  audience?: ClassAudience; // segmentação de público
  minLevel?: string;        // restrição de nível mínimo (ex.: apenas a partir da faixa azul)
}
```

### C. Chamada no Tatame (`SessionRosterEntry`)
Para a experiência do professor no tatame ser ágil e informativa:

```typescript
export interface SessionRosterEntry {
  studentId: Id;
  studentName: string;
  kind?: SessionRosterKind; // enrolled | dropin | trial | makeup
  attendance?: AttendanceStatus; // present | absent | justified
  levelDisplay?: string; // ex: "Faixa Azul (2º grau)"
  financialStatus?: "ok" | "overdue"; // indicador visual no tatame
  isMinor?: boolean; // indicador de menor de idade
  guardianPhone?: string; // telefone de contato rápido em emergências
}
```

---

## 5. Fronteiras de Módulos e Isolamento (ADR 01)

- **Fundação Compartilhada:** Organizações, Unidades, Usuários, Permissões/RBAC, Sessão, Layout e Camada de Mock (`store.ts`) continuam comuns a todo o GestaraHub.
- **Isolamento de Modelos:** Nenhuma regra de Jiu-Jitsu ou turmas polui entidades de barbearia (`Appointment`, `Service`, `TimeBlock`).
- **Configuração de Tenant:** Tenants de academias possuem `model: "classes"` e `segment: "Artes Marciais"` ou `"Jiu-Jitsu"`.
- **Tenant Ativo no Ambiente de Mock:** O tenant inicial do mock (`activeOrganizationId` em `seed.ts`) passa a apontar para a organização de academia (`ORG_ACADEMIA`), permitindo testar diretamente a experiência do tatame.

---

## 6. Próximos Passos e Priorização do Tatame

1. **Incorporar sugestões do parceiro de teste:** Receber e priorizar o feedback prático do professor de Jiu-Jitsu.
2. **Implementar a chamada ágil:** Fluxo com poucos cliques para marcar presenças e registrar faltas.
3. **Adicionar graduação no perfil do aluno:** Registro de faixa atual, graus e data de graduação.
4. **Alerta discreto de mensalidade pendente:** Informar o status financeiro diretamente na lista de chamada da aula.
