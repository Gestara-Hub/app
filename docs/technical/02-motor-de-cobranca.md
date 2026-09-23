# Motor de cobrança único

> Implementação técnica das regras de [`../product/15-regras-de-cobranca.md`](../product/15-regras-de-cobranca.md). Decidido e implementado em 2026-09-22.

## Decisao

Toda a regra de cálculo de mensalidades vive em **um módulo puro**, `packages/core/src/billing.ts` (export `@gestarahub/core/billing`), sem acesso a store. Três consumidores chamam as mesmas funções:

1. O cadastro do aluno (1ª cobrança): `apps/web/src/features/clients/components/client-form.tsx`.
2. A geração em lote: `billingService.generateCharges` (e a 1ª cobrança em `clientsService`).
3. A prévia de Configurações: `features/settings/components/billing-rules-preview.tsx`.

Modelo do motor:

- O plano é dividido em **períodos de uso** consecutivos a partir da entrada; cada período vira uma cobrança.
- **Antecipado** vence no início do período; **Depois do uso** vence no vencimento seguinte ao fim do período.
- **Competência = mês do vencimento** (`Charge.competence`).
- Cada cobrança guarda o período que paga (`Charge.periodStart`/`periodEnd`). A **deduplicação** usa aluno + plano + `periodStart` (cobranças antigas sem período caem no fallback competência + ciclo).
- API: `resolveMembershipTerms` (regra do aluno sobre a da academia), `firstCharge`, `upcomingCharges`, `chargesDueIn(terms, competence)` (devolve também `cycleIndex`/`cycleTotal`), `applyDiscount`, `dayInMonth`.

Regras técnicas associadas:

- **Status atrasado derivado na leitura** (`effectiveStatus` em `billingService`); o valor gravado não é confiável ao longo do tempo.
- Serviços que mexem em cobranças de outro domínio chamam helpers síncronos do `billingService` (`cancelOpenMembershipCharges`, `studentMembershipTerms`) dentro da própria escrita. No backend isso vira transação.

## Contexto

O formulário e a geração tinham implementações independentes que divergiram (cobrança dupla no pós-pago e no quinzenal, 1ª cobrança do pós-pago no mês errado). Com um motor único, a divergência deixa de ser possível, e o mesmo módulo é importável pelo backend NestJS sem mudanças.

## Escopo

- Código: `packages/core/src/billing.ts`.
- Testes do motor (matriz aprovada, fevereiro, ano bissexto, dia 31, semanas reais): `packages/core/test/billing.test.ts`, rodados por `pnpm test`.
- Contratos: `Charge.periodStart`, `periodEnd`, `unitId`; `ChargeView.planPeriod`; `CreateClientInitialCharge.periodStart/periodEnd` (`packages/contracts/src/billing.ts`, `client.ts`).

## Alternativas

- **Corrigir cada sintoma no service e no formulário:** rejeitado; mantinha duas fontes de verdade.
- **Motor dentro de `apps/web`:** rejeitado; o backend precisará da mesma regra, e `packages/core` já é o lugar da lógica pura (como `scheduling.ts`).
- **Gravar o status "atrasado" por rotina:** adiado para o backend (rotina agendada); no mock, derivar na leitura é suficiente e correto.
