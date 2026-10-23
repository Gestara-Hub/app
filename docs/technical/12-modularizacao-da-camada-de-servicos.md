# 12 — Modularização e Fatiamento da Camada de Serviços (Services)

> **Status:** Decidido e planejado em 19/10/2026. Plano de ação para execução sob demanda.
> **Alvo:** `apps/web/src/services/`
> **Execução (21/10/2026):** fases 1 a 4 feitas em 21/10/2026 (`services/classes/`, `services/clients/`, `services/finance/`, `services/billing/`), só movendo código; os arquivos antigos viraram reexportações. Elas entraram na fatia 2 do [doc 15](15-retirada-do-mock-turmas.md), cada uma como primeiro passo do seu domínio; a fase 5 entra na fatia 4. Fase 6 feita em 23/10/2026 (os arquivos que passaram de 300 linhas depois do plano).
> **Contexto relacionado:** [01-extensao-modelos-operacionais.md](01-extensao-modelos-operacionais.md), [06-passagem-backend.md](06-passagem-backend.md) e [08-backend-supabase.md](08-backend-supabase.md).

---

## 1. Contexto e Diagnóstico

Com o avanço do Modelo 3 (Turmas & Aulas) e das fatias do backend no Supabase, a camada de serviços em `apps/web/src/services` passou a concentrar múltiplos subdomínios, lógica de mock em memória e chamadas ao banco Postgres em arquivos monolíticos que ultrapassam mil linhas:

| Arquivo atual | Linhas de Código | Principais Subdomínios Misturados |
|---|---|---|
| `turmasService.ts` | **~1.975** | Turmas, Matrículas, Chamada/Presenças, Aulas Avulsas, Lista de Espera, Substituição de Professor, Certificados |
| `clientsService.ts` | **~1.170** | Cadastro de Alunos, Responsáveis, Graduação/Faixas, Histórico de Promoções, Ficha Médica, Resumo de Evolução |
| `financeService.ts` | **~1.100** | Lançamentos manuais, Materialização de Recorrências, Conciliação, Fluxo de Caixa, Comprovantes anexos |
| `teacherPayService.ts` | **~1.050** | Regras de repasse, Cálculo de comissões/hora-aula, Fechamento mensal, Adiantamentos |
| `billingService.ts` | **~970** | Planos, Geração de Mensalidades, Cobranças avulsas, Baixas manuais, Descontos/Bolsas |

### Causas do Inchaço
1. **Acúmulo de sub-recursos ("God Services"):** Um único arquivo assume o ciclo de vida de 5 a 7 entidades diferentes apenas por pertencerem à mesma área macro.
2. **Coexistência de Mock + Backend (Strangler Fig):** Cada método precisa validar dados, manipular arrays em memória do `store.ts` e orquestrar a persistência no Supabase via `*Backend.ts`.
3. **Mapeamento de Views e Validações embutidos:** Funções que transformam linhas de banco em read-models ricos da UI (`buildClassGroupView`, `buildSessionRoster`, etc.) somam centenas de linhas junto às rotinas de I/O.
4. **Dívida de Nomenclatura:** `turmasService.ts` e termos correlatos em português violam a diretriz de código 100% em inglês estabelecida nas regras do projeto (`AGENTS.md`).

---

## 2. Decisão Arquitetural

Adota-se a **Modularização por Subdomínio com Fachada Retrocompatível (Barrel Pattern)**:

1. **Subdiretórios por Domínio:** Em vez de arquivos únicos na raiz de `src/services/`, cada módulo de grande porte será organizado em sua própria pasta (ex.: `services/classes/`, `services/clients/`, `services/finance/`).
2. **Sub-serviços com Responsabilidade Única (SRP):** Cada arquivo conterá no máximo ~150 a 300 linhas, respondendo por uma única entidade ou responsabilidade coesa.
3. **Fachada de Compatibilidade (`index.ts`):** O arquivo de entrada da pasta reexporta todas as funções individuais e compõe o objeto do serviço legado (ex.: `export const turmasService = { ... }`). 
   > **Garantia de Não-Quebra:** Nenhuma tela, componente React, hook do TanStack Query ou teste existente precisará ser reescrito no momento da refatoração.
4. **Extração de Lógica Pura:** 
   - Algoritmos de cálculo (comissões, parcelamento, regras de graduação) migram para `packages/core`.
   - Mapeamentos de DTO/View são isolados em `*Views.ts`.
   - Validações de payload são isoladas em `*Validation.ts`.
5. **Aposentadoria Futura do Mock:** Quando o Supabase cobrir 100% dos dados, a manipulação de `store.ts` será removida, reduzindo os sub-serviços a orquestradores enxutos. Plano por fatias no [doc 15](15-retirada-do-mock-turmas.md) (21/10/2026).

---

## 3. Modelo Alvo (Exemplo Prático: Turmas & Classes)

Substituição de `turmasService.ts` por:

```
apps/web/src/services/classes/
├── classGroupsService.ts       # CRUD, filtros e busca de turmas
├── enrollmentsService.ts       # Matrículas regulares e parcelamento de cursos
├── attendanceService.ts        # Registro de chamada, presenças e histórico de faltas seguidas
├── reservationsService.ts      # Agendamentos avulsos e aulas experimentais
├── waitlistService.ts          # Gestão da fila de espera e promoção de vaga
├── sessionOverridesService.ts  # Cancelamentos pontuais e substituição de instrutor
├── classViews.ts               # Montagem de read-models (buildClassGroupView, buildSessionRoster)
├── classValidation.ts          # Checagem de conflitos de horário e regras de capacidade
└── index.ts                    # Barrel exports + alias retrocompatível turmasService
```

### Exemplo do `services/classes/index.ts`:

```typescript
import { classGroupsService } from "./classGroupsService";
import { enrollmentsService } from "./enrollmentsService";
import { attendanceService } from "./attendanceService";
import { reservationsService } from "./reservationsService";
import { waitlistService } from "./waitlistService";
import { sessionOverridesService } from "./sessionOverridesService";

// Exportações nomeadas para código novo (100% em inglês)
export {
  classGroupsService,
  enrollmentsService,
  attendanceService,
  reservationsService,
  waitlistService,
  sessionOverridesService,
};

// Fachada unificada retrocompatível (para não quebrar imports existentes de turmasService)
export const turmasService = {
  ...classGroupsService,
  ...enrollmentsService,
  ...attendanceService,
  ...reservationsService,
  ...waitlistService,
  ...sessionOverridesService,
};
```

---

## 4. Plano de Migração em Fases

A execução deve ser realizada de forma incremental, um serviço por vez, com verificação de testes a cada etapa:

### Fase 1: Domínio de Turmas e Aulas (Piloto — Maior Ofensor)
* **Origem:** `apps/web/src/services/turmasService.ts` (~1.975 linhas).
* **Destino:** `apps/web/src/services/classes/*`.
* **Ações:**
  1. Extrair `classViews.ts` e `classValidation.ts`.
  2. Mover submódulos para `classGroupsService`, `enrollmentsService`, `attendanceService`, `reservationsService`, `waitlistService` e `sessionOverridesService`.
  3. Manter o backend real em `turmasBackend.ts` (ou renomear progressivamente para `classesBackend.ts`).
  4. Manter `turmasService` como alias de compatibilidade.
* **Verificação:** Executar testes existentes de turmas (`src/services/__tests__/turmas*.test.ts`) e `pnpm --filter @gestarahub/web typecheck`.

### Fase 2: Domínio de Alunos e Clientes
* **Origem:** `apps/web/src/services/clientsService.ts` (~1.170 linhas).
* **Destino:** `apps/web/src/services/clients/*`.
* **Ações:**
  1. Separar cadastro base em `clientBaseService.ts`.
  2. Isolar evolução/faixas em `clientProgressionService.ts`.
  3. Isolar responsáveis/guardians em `clientGuardiansService.ts`.
  4. Isolar ficha médica e anamnese em `clientMedicalService.ts`.
  5. Barrel compatível `clientsService` em `index.ts`.
* **Verificação:** Executar `clients.test.ts` e checar formulários de aluno.

### Fase 3: Domínio Financeiro & Repasse de Professores
* **Origem:** `apps/web/src/services/financeService.ts` (~1.100 linhas) e `teacherPayService.ts` (~1.050 linhas).
* **Destino:** `apps/web/src/services/finance/*`.
* **Ações:**
  1. Separar lançamentos avulsos em `transactionsService.ts`.
  2. Separar regras de recorrência/materialização em `financeRecurrenceService.ts`.
  3. Separar relatórios de fluxo de caixa em `cashFlowService.ts`.
  4. Mover cálculos de hora-aula e comissão para `packages/core/src/teacher-pay.ts`.
  5. Deixar `teacherPayService.ts` modularizado apenas com fechamento de períodos e I/O.
* **Verificação:** Executar `finance.test.ts` e testes do core.

### Fase 4: Domínio de Cobranças e Planos
* **Origem:** `apps/web/src/services/billingService.ts` (~970 linhas) e `packagesService.ts` (~630 linhas).
* **Destino:** `apps/web/src/services/billing/*`.
* **Ações:**
  1. Isolar gestão de planos em `plansService.ts`.
  2. Isolar mensalidades e conciliação em `chargesService.ts`.
  3. Isolar pacotes de aulas em `packagesService.ts`.
  4. Barrel compatível em `billing/index.ts`.

### Fase 5: Limpeza Pós-Backend (Quando Supabase for 100%)
* **Gatilho:** Conclusão da migração de persistência de todas as fatias para o banco Supabase Postgres.
* **Ações:**
  1. Remoção das rotinas `simulateRead`, `simulateWrite` e sincronização do `store.ts`.
  2. Eliminação definitiva dos aliases em português (`turmasService`).
  3. Atualização dos imports no frontend para apontar diretamente para os serviços específicos em inglês (`classGroupsService`, `attendanceService`).

### Fase 6: Domínios que cresceram depois do plano (feita em 23/10/2026)
* **Por quê:** o plano de 19/10 listou os 5 arquivos gigantes daquele dia. Depois, o pagamento online (Asaas), usuários, relatórios, notas, comunicação e aceites passaram de 300 linhas no padrão antigo.
* **Como:** só movendo código, sem mudar regra. Cada arquivo antigo virou reexportação (nenhum import mudou). Nos arquivos `"use server"` (`*Backend.ts`), as ações foram para arquivos novos também `"use server"`, o apoio síncrono (hash, guarda, endereço do app) foi para um módulo comum só de servidor e o arquivo antigo virou um módulo comum que reexporta (o build de produção confere).
* **Pastas novas:**

| Pasta | De onde veio | Arquivos |
| --- | --- | --- |
| `services/onlinePayments/` | `onlinePaymentsBackend.ts` (1.160), `onlinePaymentsService.ts` (889), `gatewayAccountBackend.ts` (376) | ações (`paymentRecordsActions`, `subaccountActions`, `checkoutActions`, `balanceActions`, `receiptsActions`), regras (`onlinePaymentRules`, `recurringRules`), sub-serviços (`onlineSettingsService`, `onlineChargesService`, `recurringService`), Asaas (`gatewaySetup`, `gatewayCleanup`) e `index.ts` |
| `services/users/` | `usersBackend.ts` (670), `usersService.ts` (436) | `userRecordsActions`, `inviteActions`, `acceptInvitationActions`, `userActionsShared`, `userRules`, `usersService` |
| `services/reports/` | `reportsService.ts` (647) | `reportCatalog`, `courseAndPackageReports`, um construtor por relatório (`operationalReports`, `financialReports`, `retentionReport`) e `reportsService` só despachando |
| `services/grades/` | `gradesService.ts` (481) | `gradeRules`, `assessmentsService`, `reportCardService`, `index.ts` |
| `services/communication/` | `communicationService.ts` (434) | `communicationRules`, `connectionService`, `templatesService`, `messagesService`, `index.ts` |
| `services/legalConsent/` | `legalConsentBackend.ts` (400) | `platformConsentActions`, `minorConsentActions`, `consentShared` |
| `services/subscription/` | `subscriptionBackend.ts` (336) | `subscriptionActions`, `subscriptionCheckoutActions` |
| `services/defaults/` | `defaults.ts` (327) | `financialDefaults`, `messageTemplateDefaults` |
| `services/clients/` | `studentSummaryService.ts` (339) | `studentSummaryRules`, `studentSummaryService` |

* **Ficou como está:** `appointmentsService.ts` (539, agenda da barbearia, modelo adiado) e arquivos entre 300 e 340 linhas com uma função grande só (`subaccountActions`, `server/accountSetup.ts`), que não se separam sem mexer na regra. Arquivos pequenos do domínio (`onlinePaymentsRows.ts`, `onlinePaymentsWebhook.ts`) seguiram na raiz.
* **Código novo:** importa da pasta (`@/services/onlinePayments`, `@/services/reports`...); os shims da raiz saem na fase 5.

---

## 5. Checklist de Verificação por Fase

Antes de considerar cada fase concluída:
- [ ] Nenhum arquivo no novo submódulo ultrapassa **350 linhas**.
- [ ] Nomes de arquivos, funções e variáveis seguem estritamente o padrão em inglês.
- [ ] `pnpm --filter @gestarahub/web typecheck` passa com **0 erros**.
- [ ] `pnpm --filter @gestarahub/web lint` passa com **0 warnings e 0 erros**.
- [ ] Testes automatizados daquela área em `apps/web/src/services/__tests__/` passam sem quebras.
- [ ] Telas correspondentes no navegador continuam funcionando de forma idêntica.

---

## 6. Alternativas Rejeitadas

* **Reescrita Simultânea ("Big Bang"):** Rejeitada. Refatorar todos os serviços de uma vez introduziria riscos altos de regressão e conflitos no Git em pleno período de testes manuais com o design partner.
* **Manutenção do Monólito até o fim do projeto:** Rejeitada. Conforme o backend cresce, a complexidade combinada (Mock + Supabase + Regras) torna o arquivo ilegível para agentes e desenvolvedores.
* **Chamadas Diretas da UI para o Supabase sem Camada de Serviço:** Rejeitada. Quebraria a centralização de regras de negócio, auditoria (`auditLogService`) e tratamento padronizado de erros (`ApiError`).
