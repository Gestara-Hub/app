# Regras de cobrança das mensalidades (Modelo 3)

> Decisões de produto já implementadas em 2026-09-22. Substituem as regras de mensalidade de [`11-modelo-3-turmas.md`](11-modelo-3-turmas.md) ("cobrança cheia, sem pro-rata"). O motor técnico está em [`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md).

## Decisao

A academia define **uma regra padrão de cobrança** em Configurações → Regras de Cobrança, aplicada a cada **nova matrícula em plano**. O aluno guarda a própria regra (pode ser personalizada no cadastro) e ela não muda quando a academia muda a regra depois.

A regra tem três partes:

| Parte | Opções (UI) | Código |
| --- | --- | --- |
| Momento do pagamento | **Antecipado** (paga antes das aulas) · **Depois do uso** (paga ao fim do período) | `billingTiming`: `prepaid` · `postpaid` |
| Entrada no meio do período | **Proporcional** (só os dias restantes) · **Mês cheio** (ciclo a partir da entrada) | `midMonthStrategy`: `prorated` · `full_cycle` |
| Dia de vencimento | 1 a 28 (existe em todo mês) | `defaultDueDay` |

Matriz de referência (aluno entra em 20/09, plano mensal de R$ 150, vencimento dia 10):

| Combinação | 1ª cobrança | 2ª cobrança | Cobra em setembro? |
| --- | --- | --- | --- |
| Antecipado + Proporcional | 20/09 · R$ 55 · 20 a 30/09 | 10/10 · R$ 150 · outubro | sim |
| Antecipado + Mês cheio | 20/09 · R$ 150 · 20/09 a 19/10 | 20/10 · R$ 150 · 20/10 a 19/11 | sim |
| Depois do uso + Proporcional | 10/10 · R$ 55 · 20 a 30/09 | 10/11 · R$ 150 · outubro | **não** |
| Depois do uso + Mês cheio | 20/10 · R$ 150 · 20/09 a 19/10 | 20/11 · R$ 150 · 20/10 a 19/11 | **não** |

Demais regras:

- **Plano é do aluno**, não da turma: `Client.planId`, `planStartDate`, `billingStrategy`, `cyclePaymentTiming`, `dueDay`, `discount`. `ClassGroup.planId` é legado.
- **Periodicidades:** mensal, quinzenal (quinzenas de calendário 1–15 e 16–fim) e semanal (**semanas reais**: ciclos de 7 dias a partir da entrada, 4 ou 5 cobranças por mês, sem proporcional).
- **Plano exige valor maior que zero.** Bolsa integral é desconto de 100% no aluno.
- **Desconto** (fixo ou percentual) é aplicado antes do proporcional; nunca deixa o valor negativo.
- **Pausa é da assinatura do aluno** (`membershipStatus: "paused"`), não da matrícula na turma. Aluno pausado, cancelado ou inativo não gera cobrança.
- **Atrasado é calculado na leitura:** cobrança em aberto com vencimento passado aparece como atrasada, sem depender de quando foi gravada.
- **Marcar como pago exige a forma de pagamento** (Pix, Dinheiro, Cartão, Outro), num diálogo que mostra aluno, valor e período de referência.
- **Troca de plano ou de início de vigência** cancela as mensalidades em aberto do arranjo antigo a partir da nova vigência. Pagas ficam como estão; não há crédito proporcional automático.
- **Inativar o aluno** cancela as mensalidades em aberto de períodos que ainda não começaram. O que já foi usado continua em aberto (dívida).
- **"Resetar cobranças"** (ferramenta de teste/correção) pede confirmação e **nunca apaga cobranças pagas**.
- **Gerar cobranças** confirma a competência e é idempotente: um período de uso nunca gera duas cobranças.
- Toda operação financeira entra na **Auditoria** (gerar, pagar, desfazer, cancelar, reabrir, resetar).
- **Reposição de aula foi removida** do escopo (entidade, tela e regras); não voltar sem nova decisão.

## Contexto

Em 22/09/2026 um teste ponta a ponta encontrou 23 bugs, a maioria em Mensalidades: "Depois do uso" gerava cobrança em dobro, quinzenal cobrava a mesma quinzena duas vezes, atraso ficava invisível, reset apagava pagamentos. A causa comum era a regra estar implementada duas vezes (formulário do aluno e geração em lote). A matriz acima foi aprovada pelo dono do produto e virou a especificação dos testes.

## Escopo

- Tela: `apps/web/src/features/settings/components/organization-settings-card.tsx` (Regras de Cobrança, com prévia calculada pelo motor) e `features/turmas/components/billing-view.tsx` (Mensalidades).
- Regras: `packages/core/src/billing.ts` (motor), `apps/web/src/services/billingService.ts` e `clientsService.ts`.
- Testes: `packages/core/test/billing.test.ts`, `apps/web/src/services/__tests__/billing.test.ts`, `apps/web/e2e/mensalidades.spec.ts`.

## Alternativas

- **Cobrança sempre cheia (regra antiga do doc 11):** rejeitada; academias cobram proporcional ou ciclo a partir da entrada, e o "Depois do uso" é comum.
- **Dia de vencimento até 31, caindo no último dia do mês:** mantido só para o dia do aluno no "Mês cheio" (entrada no dia 31); o padrão da academia fica em 1 a 28 para não "andar" ao longo do ano.
- **Semanal com 4 semanas fixas por mês:** rejeitada; deixava os dias 29 a 31 sem cobrança.
- **Perguntar o que fazer com cobranças futuras na troca de plano/inativação:** rejeitada em favor de cancelar automaticamente o que ainda não começou, com aviso no modal.

---

## Atualizações de 23/09/2026 (auditoria de bugs da academia)

Estas regras já estão implementadas.

- **Quem cancelou:** toda cobrança cancelada registra se foi pelo **sistema** (troca de plano, troca de regra, inativação, aluno removido da aula) ou pelo **usuário**. "Reverter" só reabre as canceladas pelo usuário; nas do sistema o botão fica desabilitado com a explicação, para não gerar cobrança em dobro.
- **Geração:** uma mensalidade cancelada **não** impede gerar o mesmo período de novo (ex.: aluno inativado e reativado). Uma mensalidade existente que se **sobrepõe** ao período planejado impede a nova (evita cobrar o mesmo dia duas vezes depois de mudar a regra).
- **Troca de regra do aluno:** mudar o momento do pagamento, a entrada no meio do período ou o dia de vencimento funciona como troca de plano: as mensalidades em aberto de períodos que ainda não começaram são canceladas. Regravar a mesma regra efetiva não cancela nada.
- **Periodicidade do plano:** não pode ser alterada enquanto o plano tiver alunos ativos (crie um novo plano).
- **Inativação no "Depois do uso":** ao inativar, o período já iniciado é cobrado na hora (valor e vencimento do motor); os períodos futuros continuam cancelados. No "Antecipado", pausado ou cancelado nada novo é gerado.
- **Resetar cobranças (ferramenta de teste):** remove só **mensalidades** em aberto ou canceladas da competência. Pagas e aulas avulsas ficam. O número no modal é o que será removido. O botão sai na versão final.
- **Dashboard:** "Mensalidades recebidas" soma só mensalidades. Sem nada gerado no mês aparece "Nenhuma mensalidade gerada no mês".
