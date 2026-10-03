# 05 — Módulo Financeiro (academia de luta)

> **Status:** implementado no frontend mockado (27/09/2026), aguardando validação no navegador e testes. Desvios na seção 14.
> **Escopo:** Modelo 3 (`classes`), academias de luta. Contratos neutros (servem para os outros modelos no futuro), mas a navegação e as telas entram só em `classes` nesta rodada.
> **Relacionados:** [13-modelo-de-negocio.md](../product/13-modelo-de-negocio.md) (grátis vs pago), [15-regras-de-cobranca.md](../product/15-regras-de-cobranca.md) (mensalidades), [02-motor-de-cobranca.md](02-motor-de-cobranca.md), [18-pesquisa-dores-e-caminhos.md](../product/18-pesquisa-dores-e-caminhos.md).
>
> Itens marcados **[DECIDIR]** foram aprovados como propostos (seção 13).

---

## 1. Objetivo

Dar ao dono da academia o controle do **dinheiro do próprio negócio**: o que entrou, o que saiu, o que está para entrar e para sair, e o **lucro do mês**, incluindo o **pagamento dos professores**. Também permite **cobrar online** (simulado nesta fase): Pix, link de pagamento e Pix Automático para mensalidade.

Responde às dores da pesquisa: "não sei quanto lucrei", contas misturadas, mensalidade cobrada na mão.

## 2. Fronteiras (o que é e o que não é)

| Continua como está (grátis) | Novo: Financeiro (agora no plano Grátis) | Plano Pro (pago) |
|---|---|---|
| **Mensalidades** (`/classes/billing`): cobranças dos alunos, gerar, marcar pago, reverter. Regras do doc 15. | **Visão do dinheiro do negócio**: entradas manuais, despesas, fluxo de caixa, saldo, previsto, lucro. | **Pagamento online integrado** (Pix, link, Pix Automático) no app e web com baixa automática. |
| **Planos** de mensalidade do aluno (`Plan`). | **Pagamento dos professores** com regras (mensal, por aula, porcentagem) e fechamento manual. | **Lembretes e avisos automáticos via WhatsApp** (redução de inadimplência). |

**Regra de ouro:** o Financeiro **não duplica** as cobranças dos alunos. Elas vivem em `Charge` e são lidas como fonte de entrada. Lançamentos manuais (`FinancialEntry`) cobrem só o que não nasce de uma cobrança de aluno nem de um pagamento a professor.

## 3. Plano do GestaraHub (assinatura) e controle de acesso

### 3.1 Nome

`Plan` já é o plano de mensalidade do aluno. O plano do GestaraHub se chama **assinatura** no código (`Subscription`) e **"Plano GestaraHub"** na tela (Configurações), para não confundir com "Planos" do menu.

### 3.2 Contrato

```ts
// packages/contracts/src/subscription.ts
export type SubscriptionTier = "free" | "pro" | "scale";

/** Recursos pagos, checados junto com a permissão do perfil. */
export type PaidFeature =
  | "online_payments"   // cobrança online (Pix, link, Pix Automático)
  | "messaging"         // Comunicação automatizada (WhatsApp)
  | "reports_advanced"  // Relatórios gerenciais avançados (DRE, churn)
  | "bi";               // Inteligência analítica preditiva
```

`Organization` ganha `subscription?: Subscription` (ausente = `free`).

### 3.3 Matriz tier → recursos

Em `apps/web/src/lib/subscription.ts`, espelhando `lib/permissions.ts`:

```ts
export const TIER_FEATURES: Record<SubscriptionTier, readonly PaidFeature[]> = {
  free: [],
  pro: ["online_payments", "messaging", "reports_advanced"],
  scale: ["online_payments", "messaging", "reports_advanced", "bi"],
};
```

### 3.4 Composição com RBAC

Uma tela paga exige **as duas coisas**: permissão do perfil (`can`) **e** recurso do plano (`hasFeature`).

- **Permissão sem o recurso:** o item de menu aparece **com um cadeado**, e a rota abre a tela "Disponível no Plano Pro" com botão para ver o plano. **[DECIDIR]** mostrar com cadeado (estimula a conversão) ou esconder.
- **Sem a permissão:** o item não aparece e a rota redireciona, como hoje.
- **Guard de rota:** `requirePermission(permission, route)` continua. As páginas pagas também checam o recurso no server (o tier vem da organização da sessão) e, sem o recurso, renderizam a tela de upsell em vez de redirecionar.
- **Service:** as mutations do Financeiro recusam com `ApiError` `FEATURE_NOT_IN_PLAN` (403) quando o tier não tem o recurso (defesa no "servidor", como no backend real).

### 3.5 Demonstração

Configurações ganha a aba **"Plano GestaraHub"**: mostra o plano atual, o que o Pro inclui, e um botão **"Ativar Pro (demonstração)"** / **"Voltar ao Grátis"**. Só o proprietário troca. Fica registrado na Auditoria.

### 3.6 Permissões novas

`Permission` ganha:

| Key | Owner | Manager | Attendant | Professional |
|---|---|---|---|---|
| `finance:view` | ✅ | ✅ | — | — |
| `finance:manage` (lançar, pagar professor, configurar cobrança online) | ✅ | ✅ | — | — |
| `subscription:manage` (trocar o plano GestaraHub) | ✅ | — | — | — |

Atendente continua vendo as Mensalidades (`billing:view`), como hoje. Cobrar um aluno online a partir das Mensalidades exige `billing:manage` **e** o recurso `online_payments`.

## 4. Entradas e saídas

### 4.1 Fontes de dinheiro (sem duplicar)

| Fonte | Entidade | Entra no caixa quando |
|---|---|---|
| Mensalidades e aulas avulsas | `Charge` (existente) | `status = "paid"`, na data de `paidAt` |
| Outras receitas (venda de kimono, seminário, evento, graduação) | `FinancialEntry` `type = "income"` | `status = "paid"`, na data de `paidAt` |
| Despesas (aluguel, contas, material, marketing, impostos) | `FinancialEntry` `type = "expense"` | `status = "paid"`, na data de `paidAt` |
| Pagamento de professores | `TeacherPayout` (seção 5) | `status = "paid"`, na data de `paidAt` |

**Previsto:** o que tem vencimento no período e ainda não foi pago (pending, ou overdue derivado).

### 4.2 Contrato

```ts
// packages/contracts/src/finance.ts
export type FinancialEntryType = "income" | "expense";
export type FinancialEntryStatus = "pending" | "paid" | "canceled"; // overdue é derivado na leitura

export interface FinancialCategory {
  id: Id;
  organizationId: Id;
  type: FinancialEntryType;
  name: string;              // "Aluguel", "Venda de produtos"...
  /** Categoria do sistema: não pode ser apagada nem renomeada. */
  system?: boolean;
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface FinancialEntry {
  id: Id;
  organizationId: Id;
  unitId?: Id;
  type: FinancialEntryType;
  categoryId: Id;
  description: string;       // "Aluguel de outubro", "Kimonos para revenda"
  amountCents: number;       // sempre > 0; o sinal vem do type
  dueDate: DateISO;
  status: FinancialEntryStatus;
  paidAt?: DateTimeISO;
  method?: PaymentMethod;    // reusa o enum das cobranças
  /** Repetição mensal (aluguel, internet). Ver 4.4. */
  recurrenceId?: Id;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export interface FinancialRecurrence {
  id: Id;
  organizationId: Id;
  type: FinancialEntryType;
  categoryId: Id;
  description: string;
  amountCents: number;
  dayOfMonth: number;        // 1..28 (mesma regra do vencimento da academia)
  startCompetence: string;   // "YYYY-MM"
  endCompetence?: string;    // ausente = sem fim
  status: RecordStatus;      // inactive = para de gerar
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type CreateFinancialEntry = Omit<FinancialEntry, "id" | "status" | "paidAt" | "recurrenceId" | "createdAt" | "updatedAt" | TenantScopeFields> & { paidNow?: { method: PaymentMethod } };
export type UpdateFinancialEntry = Partial<Pick<FinancialEntry, "categoryId" | "description" | "amountCents" | "dueDate" | "notes">>;
export interface FinancialEntryFilter { competence?: string; type?: FinancialEntryType; status?: FinancialEntryStatus | "overdue"; categoryId?: Id; search?: string; }
```

### 4.3 Categorias padrão (seed ao criar a organização / ao ativar o módulo)

- **Receitas:** Mensalidades *(sistema, só leitura: representa `Charge` membership)*, Aulas avulsas *(sistema: `Charge` dropin)*, Venda de produtos, Eventos e seminários, Taxa de graduação, Outras receitas.
- **Despesas:** Professores *(sistema: representa `TeacherPayout`)*, Aluguel, Contas (luz, água, internet), Material e equipamentos, Marketing, Impostos e taxas, Outras despesas.

As categorias de sistema aparecem nos relatórios e no resumo, mas não podem ser escolhidas num lançamento manual.

### 4.4 Lançamentos recorrentes

Para despesas fixas (aluguel, internet): o usuário marca "Repetir todo mês" ao criar. O service cria a `FinancialRecurrence` e **materializa** os lançamentos de forma idempotente, do `startCompetence` até o **mês seguinte ao atual** (para aparecer no previsto), sempre que o módulo é lido. Materializar = criar o `FinancialEntry` da competência se ainda não existir para aquele `recurrenceId` (o mesmo padrão idempotente do "Gerar cobranças").

- **Editar um lançamento de série:** pergunta "Só este" ou "Este e os próximos". "Este e os próximos" atualiza a recorrência e os lançamentos **pendentes** futuros.
- **Encerrar a série:** inativa a recorrência e cancela os pendentes futuros.

### 4.5 Regras

- `amountCents > 0`; categoria do mesmo `type` e ativa; data válida.
- **Atrasado** = `pending` com `dueDate < hoje` (derivado, igual às cobranças).
- **Marcar pago:** exige forma de pagamento e grava `paidAt = agora`. **Desfazer pagamento** volta a `pending` (com confirmação).
- **Cancelar** mantém o registro (histórico). Excluir de verdade só se nunca foi pago. **[DECIDIR]** permitir excluir ou só cancelar.
- Toda mutação grava Auditoria (novo `AuditEntityType`: `financial_entry`, `financial_category`, `teacher_payout`, `subscription`).
- Datas comparadas pela **data local** (lição do bug de UTC).

## 5. Pagamento dos professores

### 5.1 Formatos suportados

Um professor tem uma **regra de pagamento** composta de uma ou mais **partes**, somadas no mês:

| Parte | Como calcula no mês | Exemplo |
|---|---|---|
| `fixed_monthly` | valor fixo | R$ 1.500 por mês |
| `per_session` | aulas **dadas** × valor por aula | 16 aulas × R$ 60 |
| `per_student` | alunos ativos nas turmas dele × valor | 25 alunos × R$ 20 |
| `percent_of_memberships` | % das **mensalidades pagas** atribuídas às turmas dele | 40% de R$ 3.000 |

Combinações cobrem os casos comuns (ex.: fixo de R$ 800 + 30% das mensalidades). Ajustes pontuais (bônus, desconto, vale) entram como **ajuste** no fechamento do mês (5.4).

### 5.2 Contrato

```ts
export type TeacherPayComponentKind = "fixed_monthly" | "per_session" | "per_student" | "percent_of_memberships";

export interface TeacherPayComponent {
  kind: TeacherPayComponentKind;
  amountCents?: number;   // fixed_monthly, per_session, per_student
  percent?: number;       // percent_of_memberships (0 < p <= 100)
  /** Restringe a parte a algumas turmas (ex.: % só da turma kids). Ausente = todas as turmas dele. */
  classGroupIds?: Id[];
}

export interface TeacherPayRule {
  id: Id;
  organizationId: Id;
  professionalId: Id;
  components: TeacherPayComponent[];   // pelo menos 1
  paymentDay?: number;                  // dia do mês para o vencimento do pagamento (1..28)
  startCompetence: string;              // vigência
  status: RecordStatus;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}

export type TeacherPayoutStatus = "open" | "closed" | "paid" | "canceled";

export interface TeacherPayoutLine {
  kind: TeacherPayComponentKind | "adjustment";
  label: string;            // "16 aulas × R$ 60,00", "Bônus seminário"
  quantity?: number;        // aulas, alunos
  baseCents?: number;       // base do % (mensalidades pagas)
  amountCents: number;      // pode ser negativo só em adjustment (desconto/vale)
}

export interface TeacherPayout {
  id: Id;
  organizationId: Id;
  professionalId: Id;
  competence: string;         // "YYYY-MM" (mês trabalhado)
  lines: TeacherPayoutLine[];
  totalCents: number;         // soma das linhas (>= 0)
  dueDate: DateISO;           // paymentDay do mês seguinte (padrão: dia 5) [DECIDIR]
  status: TeacherPayoutStatus;
  closedAt?: DateTimeISO;
  paidAt?: DateTimeISO;
  method?: PaymentMethod;
  notes?: string;
  createdAt: DateTimeISO;
  updatedAt: DateTimeISO;
}
```

### 5.3 Regras de cálculo (pura, em `@gestarahub/core/finance`)

`computeTeacherPayout(rule, facts, competence) → TeacherPayoutLine[]`, sem acesso ao store. O service monta os `facts`:

- **Aulas dadas (`per_session`):** sessões da competência com `status = "done"` (fim já passado), cujo **instrutor efetivo** é o professor. A substituição conta para o **substituto**: o titular não recebe aquela aula. Aula cancelada não conta.
- **Alunos ativos (`per_student`):** alunos com matrícula ativa em alguma turma do professor (como titular) **no último dia da competência**. Um aluno em duas turmas do mesmo professor conta **uma vez**. **[DECIDIR]** contar pela média do mês ou pelo último dia (proposta: último dia, mais simples de explicar).
- **Mensalidades atribuídas (`percent_of_memberships`):** mensalidades (`Charge` membership) **pagas** cujo `periodStart` cai na competência, de alunos matriculados em turmas do professor.
  - Se o aluno está em turmas de **mais de um professor**, a mensalidade é **dividida igualmente** entre os titulares das turmas dele. **[DECIDIR]** dividir igual ou por quantidade de aulas.
  - Aulas avulsas não entram, a menos que se decida o contrário.
- `classGroupIds` restringe qualquer parte às turmas listadas.
- Valores em centavos, arredondando para baixo na divisão; a sobra fica com a academia.

### 5.4 Fechamento do mês

1. **Aberto (`open`):** durante o mês, o valor é uma **prévia** recalculada a cada leitura. Os **ajustes** podem ser lançados e removidos a qualquer momento e ficam salvos no registro do mês, sem precisar fechar.
2. **Fechar (`closed`):** o dono revisa os **ajustes** (bônus, desconto, vale adiantado) e fecha. O cálculo **congela** nas linhas, e mudanças posteriores (uma presença corrigida) não alteram o valor. Pode **reabrir** enquanto não estiver pago.
3. **Pagar (`paid`):** exige forma de pagamento, grava `paidAt` e entra no caixa como despesa da categoria "Professores".
4. **Desfazer pagamento** volta para `closed`, com confirmação.

Professor sem regra não aparece no fechamento. Professor inativado continua com os meses já trabalhados.

## 6. Pagamento online (simulado)

### 6.1 O que simula

Nesta fase não há gateway real. Um **adaptador** isola o provedor, para trocar pelo real depois:

```ts
// apps/web/src/services/payments/paymentGateway.ts
export interface PaymentGateway {
  createPix(input: { chargeId: Id; amountCents: number; expiresInMinutes: number }): Promise<PixPayment>;
  createLink(input: { chargeId: Id; amountCents: number }): Promise<PaymentLinkPayment>;
  requestRecurringAuthorization(input: { studentId: Id; maxAmountCents: number }): Promise<RecurringAuthorization>;
}
export const mockPaymentGateway: PaymentGateway; // gera códigos fictícios, sem rede
```

### 6.2 Contrato

```ts
export type OnlinePaymentMethod = "pix" | "link";
export type OnlinePaymentStatus = "awaiting" | "paid" | "expired" | "canceled";

export interface OnlinePayment {
  id: Id;
  chargeId: Id;
  method: OnlinePaymentMethod;
  amountCents: number;
  status: OnlinePaymentStatus;
  pixCopyPaste?: string;     // "copia e cola" fictício
  linkUrl?: string;          // link fictício (página de demonstração)
  expiresAt: DateTimeISO;
  paidAt?: DateTimeISO;
  createdAt: DateTimeISO;
}

export type RecurringAuthorizationStatus = "pending" | "active" | "revoked";

/** Pix Automático: autorização do aluno para débito recorrente da mensalidade. */
export interface RecurringAuthorization {
  id: Id;
  organizationId: Id;
  studentId: Id;
  maxAmountCents: number;
  status: RecurringAuthorizationStatus;
  authorizedAt?: DateTimeISO;
  revokedAt?: DateTimeISO;
  createdAt: DateTimeISO;
}

export interface OnlinePaymentSettings {   // em OrganizationSettings
  enabled: boolean;
  pixKey?: string;           // exibida como dado da academia (simulado)
  defaultExpiresInMinutes?: number; // padrão 1440 (24 h)
}
```

`Charge` ganha `paidVia?: "manual" | "online" | "recurring"`, para saber como foi pago.

### 6.3 Fluxos

- **Cobrar online** (menu da cobrança em Mensalidades): escolhe Pix ou Link. Mostra o código copia-e-cola, um QR ilustrativo e o link, com botão **"Copiar"** e **"Enviar pelo WhatsApp"** (abre `wa.me` com a mensagem pronta; o envio automático fica para o módulo Comunicação).
- **Simular pagamento (demonstração):** botão visível só na demo, que marca o `OnlinePayment` como pago e a cobrança como `paid` com `method = "pix"` e `paidVia = "online"`.
- **Expiração:** `awaiting` com `expiresAt` passado vira `expired` na leitura. Pode gerar um novo.
- **Pix Automático:** no cadastro ou detalhe do aluno, **"Solicitar Pix Automático"** cria a autorização `pending`, e **"Simular autorização"** a ativa. Com autorização `active`, as mensalidades do aluno **com vencimento até hoje** são marcadas pagas na leitura, com `paidVia = "recurring"`, desde que o valor seja ≤ `maxAmountCents`. Acima do limite, fica pendente e mostra um aviso.
- **Requisito real, registrado para o futuro:** o Pix Automático exige CNPJ ativo há pelo menos 6 meses. Na demonstração não há checagem; a tela de configuração mostra o aviso.

### 6.4 Regras

- Só cobranças `pending` ou `overdue` podem ser cobradas online. Pagar manualmente cancela os `OnlinePayment` em aberto da cobrança.
- Cancelar a cobrança cancela os `OnlinePayment` dela.
- Desfazer o pagamento de uma cobrança paga online **não é permitido** na demonstração (seria estorno). **[DECIDIR]**

## 7. Telas

Rota nova `/finance` (menu **"Financeiro"**, ícone de carteira, depois de "Mensalidades"). Permissão `finance:view` e recurso `finance`. Abas por URL (`?tab=`):

### 7.1 Resumo (`?tab=resumo`, padrão)
- **Seletor de mês** (competência), igual ao de Mensalidades.
- **Cartões (4):**
  - **Entrou** e **Saiu** no mês, com a variação contra o mês anterior ("↑ 12% vs set"; sem valor no mês anterior não mostra) e o que está em aberto como subtexto (a receber / a pagar);
  - **Resultado do mês** (entrou − saiu) e, havendo algo em aberto, o **previsto** "com o que está em aberto" (resultado + a receber − a pagar do mês);
  - **Em atraso** com os dois lados: a receber (cobranças vencidas, link para Mensalidades filtrada) e a pagar (contas e professores vencidos, link para Lançamentos com `?type=expense&status=overdue`).
- **Gráfico** entradas × saídas dos últimos 6 meses (barras), com a linha do resultado e o eixo Y com valores. Começa no primeiro mês com movimento (meses zerados no início não aparecem).
- **Por categoria:** entradas e saídas agrupadas, com percentual.
- **Próximos vencimentos** (7 dias): contas a pagar e pagamentos de professores.

### 7.2 Lançamentos (`?tab=lancamentos`)
- Lista das entradas e saídas do mês, **unificada** (cobranças dos alunos aparecem agregadas como "Mensalidades de outubro — 42 pagas / 5 pendentes", com link para Mensalidades, sem listar aluno por aluno aqui). **[DECIDIR]** agregar ou listar individualmente.
- Filtros: tipo (Entradas / Saídas), status (Pago / Pendente / Atrasado / Cancelado), categoria, busca.
- **Novo lançamento:** Entrada ou Saída, categoria, descrição, valor, vencimento, "Já foi pago" (forma de pagamento), "Repetir todo mês".
- Menu da linha: Marcar pago, Desfazer pagamento, Editar, Cancelar (todas as ações com dinheiro confirmam).

### 7.3 Professores (`?tab=professores`)
- Lista dos professores com a regra resumida ("Fixo R$ 800 + 30% das mensalidades") e o **valor do mês** (prévia, fechado ou pago).
- **Configurar pagamento** (por professor): editor de partes (adicionar parte → tipo → valor ou %, turmas opcionais), dia de pagamento, vigência.
- **Detalhe do mês** (por professor): as etapas (Prévia → Fechado → Pago) com o próximo passo, as linhas do cálculo com quantidades ("16 aulas dadas", "25 alunos ativos", "40% de R$ 3.000"), a lista das aulas contadas (incluindo substituições), as aulas ainda previstas no mês, ajustes, e uma ação principal por etapa (Fechar mês ou Pagar; Reabrir e Desfazer pagamento em "Mais ações"). Fechar o mês corrente avisa que o que acontecer até o último dia fica de fora.

### 7.4 Configurações
- **Categorias financeiras:** gerenciar em `EntityManagerDialog` (criar, renomear, inativar; as de sistema ficam travadas).
- **Pagamento online:** ligar/desligar, chave Pix (simulada), validade padrão do Pix, aviso sobre o CNPJ do Pix Automático.
- **Plano GestaraHub:** seção 3.5.

### 7.5 Em outras telas
- **Mensalidades:** ação "Cobrar online" e badge "Pago online" / "Pix Automático" na linha.
- **Aluno:** status do Pix Automático e ações (solicitar, revogar).
- **Dashboard da academia:** o cartão "Mensalidades recebidas" ganha link "Ver financeiro" quando o recurso está ativo.

Estados obrigatórios em todas as telas: carregando (skeleton), vazio com CTA, erro com "Tentar novamente", sem plano (upsell), sem permissão.

## 8. Camada de dados (mock)

- **Store:** `financialCategories`, `financialEntries`, `financialRecurrences`, `teacherPayRules`, `teacherPayouts`, `onlinePayments`, `recurringAuthorizations` no tenant; `organization.subscription`. Subir a versão do seed.
- **Services** (`apps/web/src/services/`), todos com `simulateRead` / `simulateWrite`, escopo carimbado e Auditoria:
  - `financeService`: `getSummary(competence)`, `getMonthlySeries(months)`, `listEntries(filter)`, `createEntry`, `updateEntry(id, payload, scope: "single" | "following")`, `markEntryPaid(id, method)`, `markEntryPending`, `cancelEntry`, `endRecurrence(recurrenceId)`, `listCategories`, `createCategory`, `updateCategory`.
  - `teacherPayService`: `listRules`, `saveRule(professionalId, payload)`, `listPayouts(competence)`, `getPayoutPreview(professionalId, competence)`, `closePayout(id, adjustments)`, `reopenPayout`, `markPayoutPaid(id, method)`, `markPayoutUnpaid`.
  - `onlinePaymentsService`: `createForCharge(chargeId, method)`, `simulatePaid(onlinePaymentId)`, `listForCharge(chargeId)`, `requestRecurring(studentId, maxAmountCents)`, `simulateAuthorize(id)`, `revokeRecurring(id)`.
  - `subscriptionService`: `get()`, `setTier(tier)`.
- **Funções puras** em `packages/core/src/finance.ts`: `computeTeacherPayout`, `attributeMembershipsToTeachers`, `summarizeCashFlow`, `isOverdue`, `competenceOf`. Testadas com `node --test`.
- **queryKeys:** `finance.summary(competence)`, `finance.series(months)`, `finance.entries(filter)`, `finance.categories`, `teacherPay.rules`, `teacherPay.payouts(competence)`, `teacherPay.preview(professionalId, competence)`, `onlinePayments.forCharge(chargeId)`, `subscription`.
- **Invalidação:** marcar uma cobrança como paga (Mensalidades) invalida `finance.*`. Mudanças em presença, matrícula e substituição invalidam `teacherPay.preview`.
- **Feature folder:** `apps/web/src/features/finance/` (barrel `@/features/finance`). O componente de upsell fica em `components/shared/feature-locked.tsx` (sem importar features).

## 9. Auditoria

Registrar com nível de detalhe igual ao das cobranças:
- lançamento criado, editado, pago, desfeito, cancelado;
- recorrência encerrada;
- regra do professor salva;
- pagamento de professor fechado, reaberto, pago, desfeito;
- cobrança online criada e paga;
- Pix Automático solicitado, ativado, revogado;
- plano GestaraHub trocado.

## 10. Fora do escopo desta rodada

- Gateway real, maquininha, split de pagamento, antecipação de recebíveis.
- Conciliação bancária e importação de extrato (OFX).
- Várias contas ou caixas (tudo em um caixa único).
- Nota fiscal.
- **Guardar comprovantes de pagamento.** Os três diálogos de registrar pagamento (mensalidade, lançamento, professor; `PaymentDialog`) já têm o campo "Comprovante (opcional)" (`FileDropField`, imagem ou PDF, até 10 MB cada, no máximo 5; regras em `RECEIPT_FILE_RULES`), validado pelo RHF + Zod. Os arquivos **não são enviados**: o mock recebe só a forma de pagamento. Na fase de backend: upload para storage compatível com S3 com link assinado (nunca público), metadados do anexo (nome, MIME, tamanho, quem enviou, quando) ligados à cobrança, ao lançamento ou ao pagamento do professor, visualização só com `finance:view` e prazo de retenção por LGPD (comprovante pode ter CPF e dados bancários).
- Exportação e relatórios (vão para o módulo **Relatórios**, que lê estes dados).
- Envio automático de mensagens de cobrança (vai para o módulo **Comunicação**).
- Financeiro para os modelos de agendamento e encomenda (contratos já neutros; telas depois).

## 11. Critérios de aceite

1. Com o plano Grátis, "Financeiro" aparece com cadeado e a rota mostra o upsell; com Pro, abre. As mutations recusam sem o recurso.
2. Atendente e Professor não veem o Financeiro; Proprietário e Gerente veem e operam. Só o Proprietário troca o plano.
3. O Resumo de um mês bate com a soma de: cobranças pagas no mês + entradas manuais pagas − despesas pagas − pagamentos de professores pagos.
4. Uma despesa mensal recorrente aparece no mês atual e no seguinte sem duplicar, mesmo lendo a tela várias vezes.
5. Professor "R$ 60 por aula": com 16 aulas dadas no mês e 1 aula dada por um substituto, recebe 15; o substituto recebe 1.
6. Professor "40% das mensalidades": aluno em turmas de dois professores tem a mensalidade dividida igualmente.
7. Mês fechado não muda quando uma presença é corrigida depois; reabrir recalcula.
8. Cobrança online paga (simulada) marca a mensalidade paga com "Pago online" e entra no Resumo.
9. Aluno com Pix Automático ativo tem a mensalidade vencida paga sozinha; acima do limite, fica pendente com aviso.
10. Toda ação com dinheiro pede confirmação e aparece na Auditoria.

## 12. Testes

- **core (`node --test`):** `computeTeacherPayout` para cada tipo de parte e combinações, `attributeMembershipsToTeachers` (divisão igual, arredondamento), `summarizeCashFlow`.
- **services (Vitest):** idempotência da recorrência; bloqueio sem plano (`FEATURE_NOT_IN_PLAN`); fechamento congelando o valor; substituto contando a aula; cobrança online e Pix Automático marcando a cobrança paga; pagar manual cancelando o online em aberto.
- **e2e (Playwright):** upsell no Grátis e troca para Pro; lançar despesa recorrente e ver no Resumo; configurar professor e fechar e pagar o mês; cobrar online e simular pagamento a partir de Mensalidades.

## 13. Decisões para validar

| # | Decisão | Proposta |
|---|---|---|
| D1 | Menu sem o plano | Mostrar com cadeado e upsell (em vez de esconder) |
| D2 | Excluir lançamento | Só cancelar; excluir apenas se nunca foi pago |
| D3 | Alunos ativos (`per_student`) | Contar no último dia do mês |
| D4 | Aluno em turmas de professores diferentes (`percent_of_memberships`) | Dividir a mensalidade igualmente entre os titulares |
| D5 | Aulas avulsas no % do professor | Não entram |
| D6 | Vencimento do pagamento do professor | Dia configurado na regra, no mês seguinte; padrão dia 5 |
| D7 | Cobranças dos alunos na aba Lançamentos | Agregadas por mês, com link para Mensalidades |
| D8 | Desfazer pagamento feito online | Não permitido (seria estorno) |
| D9 | Onde fica o Financeiro no menu | Item próprio "Financeiro", depois de "Mensalidades" |

## 14. Desvios e detalhes da implementação

Registrados durante a fundação (27/09/2026):

- **Tier no server:** o tier vive no store do navegador (localStorage) e o server só enxerga o seed. O client espelha o tier num cookie (`gestarahub_tier`, valor `<organizationId>:<tier>`) pela server action `syncSubscriptionTier`, chamada pelo `SessionProvider` quando o tier da organização difere do que o server usou; depois faz `router.refresh()`. As pages pagas leem com `sessionHasFeature(user, feature)` (`features/auth/get-subscription-tier.ts`). Na fase de backend o cookie some e o tier vem do banco.
- **Ícone do menu:** `WalletCards` (a carteira simples já é das Mensalidades).
- **Contrato, campos extras:** `FinancialCategory.systemKey` (`memberships` / `dropins` / `teachers`) identifica as categorias de sistema; `FinancialEntry.recurrenceCompetence` guarda a competência materializada (idempotência da recorrência); `CreateFinancialEntry.repeatMonthly` marca "Repetir todo mês"; `OnlinePayment.organizationId` opcional (escopo do tenant). `AuditEntityType` ganhou também `teacher_pay_rule` e `online_payment`.
- **Read-models:** `FinanceSummary`, `FinanceMonthPoint`, `FinanceCategoryTotal`, `FinanceEntryView`, `FinanceUpcomingItem`, `TeacherPayoutView`, `TeacherPaySessionFact`, `TeacherPayoutAdjustment`, `SaveTeacherPayRule`.
- **Atrasado no Resumo:** soma o que vence **na competência** e está em aberto com vencimento antes de hoje (não acumula meses anteriores).
- **Regras puras extras** em `@gestarahub/core/finance`: `localDateOf`, `addCompetence`, `competenceRange`, `lastCompetences`, `lastDayOfCompetence`, `dateInCompetence`, `teacherPayoutDueDate`, `entryDisplayStatus`, `summarizeMonthlySeries`, `summarizeByCategory`, `recurrenceDueDate`, `isRuleEffective`, `countedSessions`, `countedStudents`, `membershipBaseCents`, `payoutTotalCents`, `describeTeacherPayRule`. O nome `isOverdue` da seção 8 ficou `isEntryOverdue`.
- **Competência na URL:** o mês do Financeiro é compartilhado entre as abas em `?month=YYYY-MM`.

Registrados na implementação das telas (27/09/2026):

- **Aba "Configurações" no Financeiro** (`?tab=configuracoes`): mostra o card de Pagamento online, porque o gerente (`finance:manage`) não tem acesso a `/settings`. O mesmo card também fica em Configurações > Pagamento online para o proprietário.
- **Prévia do professor no "A pagar":** meses ainda abertos (prévia) do mês anterior e do atual entram no previsto de saídas e nos próximos vencimentos, marcados como "prévia". Fechados e pagos vêm do registro.
- **Pix Automático antes de ler:** toda leitura do Financeiro e de Mensalidades processa primeiro os débitos automáticos (`applyRecurringAutoPayments`), para o Resumo não depender de alguém abrir Mensalidades.
- **Lançamentos:**
  - `cancelEntry` de lançamento pago pede para desfazer o pagamento antes;
  - `deleteEntry` também recusa lançamento de repetição, porque a materialização recriaria o mês (use "Encerrar repetição");
  - `FinanceEntryView.everPaid` e `recurrenceActive` escondem "Excluir" e "Encerrar repetição" quando não se aplicam;
  - com "Repetir todo mês", o vencimento precisa cair entre os dias 1 e 28.
- **Professores:**
  - a assinatura ficou `closePayout(professionalId, competence, adjustments)`;
  - `saveAdjustments(professionalId, competence, adjustments)` salva os ajustes do mês aberto num registro `open` só com as linhas de ajuste (o cálculo segue ao vivo); recusa mês fechado ou pago; total negativo pode ficar salvo, quem recusa é o fechamento; cada mudança vai para a auditoria;
  - reabrir mantém o registro como `open`, com os ajustes salvos;
  - `TeacherPayoutDetail.upcomingSessions` traz as aulas do professor que ainda não terminaram na competência (só para o detalhe; não entram no cálculo);
  - pagar exige o mês fechado; fechar recusa mês que ainda não começou e total negativo;
  - aluno que saiu no meio do mês é atribuído pelas turmas em que esteve no mês;
  - read-models `TeacherPayTeacher`, `TeacherPayDetailSession` e `TeacherPayoutDetail` estão no service (podem subir para os contratos).
- **Pagamento online:**
  - pago por **link** grava `method = "card"`; por **Pix**, `method = "pix"`; os dois com `paidVia = "online"`;
  - só um código válido por cobrança: gerar um novo cancela o anterior em aberto;
  - `cancelCharge` também recusa cobrança paga online ou pelo Pix Automático (seria estorno, como o D8);
  - o Pix Automático vale só para mensalidades, exige o recurso no plano e a opção ligada; `simulateAuthorize` já processa as mensalidades vencidas dentro do limite; uma solicitação aberta por aluno;
  - o copia-e-cola tem formato de Pix, mas termina em `6304DEMO` (inválido de propósito: nenhum banco consegue pagar);
  - Mensalidades lê e mantém na URL `?month=`, `?kind=` e o novo filtro `?status=` (Todos / Pendentes / Atrasadas / Pagas / Canceladas).

**Limites conhecidos e débito técnico:**

- A regra que monta as aulas do mês (id, substituição, status "done") está duplicada entre `turmasService` e `teacherPayService.sessionsDoneIn`. Próximo passo: `turmasService` exportar um helper (ex.: `deriveSessionsBetween(from, to)`) e o cálculo dos professores reusar.
- Turma inativada não guarda a data de inativação; o cálculo conta as aulas até `updatedAt` (aproximação). Resolver com `ClassGroup.inactivatedAt`.
- Não existe cancelamento de aula individual no produto, então a regra "aula cancelada não conta" ainda não tem o que filtrar.
