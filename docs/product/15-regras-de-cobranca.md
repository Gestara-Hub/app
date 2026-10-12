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
- **Plano exige valor maior que zero.** Bolsa é condição do aluno, não do plano: o bolsista fica no plano normal da turma (ver "Bolsa de estudo" abaixo).
- **Desconto** (fixo ou percentual) é aplicado antes do proporcional; nunca deixa o valor negativo.
- **Pausa é da assinatura do aluno** (`membershipStatus: "paused"`), não da matrícula na turma. Aluno pausado, cancelado ou inativo não gera cobrança.
- **Atrasado é calculado na leitura:** cobrança em aberto com vencimento passado aparece como atrasada, sem depender de quando foi gravada.
- **Marcar como pago exige a forma de pagamento** (Pix, Dinheiro, Cartão, Outro), num diálogo que mostra aluno, valor e período de referência.
- **Troca de plano ou de início de vigência** cancela as mensalidades em aberto do arranjo antigo a partir da nova vigência. Pagas ficam como estão; não há crédito proporcional automático.
- **Inativar o aluno** cancela as mensalidades em aberto de períodos que ainda não começaram. O que já foi usado continua em aberto (dívida).
- **Geração automática** (11/10/2026): as mensalidades do mês atual e do mês consultado (se já chegou) nascem na leitura de Mensalidades, Dashboard e Financeiro; é idempotente e meses futuros ficam vazios até chegarem. Os botões "Gerar cobranças" e "Resetar cobranças" saíram da tela.
- Toda operação financeira feita por uma pessoa entra na **Auditoria** (pagar, desfazer, cancelar, reabrir). A geração automática não entra (é o sistema).
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
- **Geração:** uma mensalidade cancelada **pelo sistema** não impede gerar o mesmo período de novo (ex.: aluno inativado e reativado, troca de regra). Cancelada **pelo usuário** ocupa o período e não é recriada pela geração automática. Uma mensalidade existente que se **sobrepõe** ao período planejado impede a nova (evita cobrar o mesmo dia duas vezes depois de mudar a regra).
- **Troca de regra do aluno:** mudar o momento do pagamento, a entrada no meio do período ou o dia de vencimento funciona como troca de plano: as mensalidades em aberto de períodos que ainda não começaram são canceladas. Regravar a mesma regra efetiva não cancela nada.
- **Periodicidade do plano:** não pode ser alterada enquanto o plano tiver alunos ativos (crie um novo plano).
- **Inativação no "Depois do uso":** ao inativar, o período já iniciado é cobrado na hora (valor e vencimento do motor); os períodos futuros continuam cancelados. No "Antecipado", pausado ou cancelado nada novo é gerado.
- **Resetar cobranças:** removido da tela em 11/10/2026 (a geração é automática). `billingService.clearCharges` segue só para testes.
- **Dashboard:** "Mensalidades recebidas" soma só mensalidades. Sem nada gerado no mês aparece "Nenhuma mensalidade gerada no mês".

## Bolsa de estudo (11/10/2026)

- No cadastro do aluno, "Plano & Mensalidade" começa por **como o aluno paga**:
  - **Paga mensalidade**: plano obrigatório; "Conceder desconto na mensalidade" (fixo ou %) com "Válido até" opcional.
  - **Bolsista**: **Integral** (plano de referência **opcional**: com plano, o valor entra em "Bolsas concedidas"; sem plano, as mensalidades isentas saem todo mês no vencimento padrão, sem valor de referência, e param depois de "Válida até") ou **Parcial** (plano obrigatório, definida por **% de bolsa** ou **valor a pagar**, com a conta ao vivo "Plano R$ 180,00 → paga R$ 90,00 (bolsa de 50%)"). Motivo com sugestões (Atleta, Social, Família de professor, Parceria) e "Válida até".
  - **Não paga mensalidade**: sem plano e sem cobrança (avulso ou experimental), escolhido de forma explícita.
- Bolsa pelo valor a pagar é guardada como bolsa de valor fixo (preço do plano - valor pago); o selo calcula a %.
- Contrato: `StudentDiscount.scholarship` (bolsa é sempre percentual; integral = 100) e `StudentDiscount.validUntil`. O motor (`@gestarahub/core/billing`) aplica o desconto só nos períodos que começam até `validUntil`; depois volta ao valor cheio do plano.
- **Bolsa integral**: a mensalidade nasce com status **"Isento"** (`waived`), R$ 0, selo **"Bolsista"**. Nunca fica pendente nem em atraso, fica fora de "A receber" e da inadimplência e não tem ações (marcar pago, cobrar online, cancelar; o serviço recusa).
- **Bolsa parcial**: mensalidade normal com o valor reduzido e selo **"Bolsa 50%"**.
- Cada mensalidade com bolsa guarda `scholarshipPercent` e `listAmountCents` (valor sem bolsa). O Resumo do Financeiro mostra **"Bolsas concedidas"** (valor do plano - cobrado, com nº de alunos), informativo, fora do caixa.
- Mudar desconto ou bolsa do aluno conta como troca de regra: as mensalidades em aberto (inclusive isentas) de períodos que ainda não começaram são canceladas pelo sistema e a geração recria pelo valor novo.
- Pagamento de professor: "por aluno" conta o bolsista (o professor dá a aula); "% das mensalidades" usa só o pago, então o isento entra com zero.
- Bolsista integral sem plano não herda o plano da turma (a regra de retrocompatibilidade "aluno sem plano em turma com plano" o ignora). Trocar a bolsa ou sair dela cancela as isentas futuras e recria pela regra nova.
- Migração do mock (v26): desconto de 100% vira bolsa integral e mensalidades de R$ 0 em aberto viram "Isento".

## Troca de plano e cobrança em dobro (12/10/2026)

- **Regra 1 (proteção de fundo):** nunca duas mensalidades para os mesmos dias do mesmo aluno, **em qualquer plano** (`membershipPeriodTaken`). Vale para a 1ª cobrança da troca de plano e para a geração automática. Cancelada pelo sistema libera o período; cancelada pelo usuário só ocupa o período no **mesmo plano** (a geração automática não a recria, mas a correção de plano pode cobrar o período no plano novo).
- **Regra 2 (troca de plano):** período atual **em aberto** → é cancelado pelo sistema e o plano novo cobra a partir do início (cobre "plano errado, ainda não pago"). Período atual **pago** → o cadastro sugere o "Início do plano" no dia seguinte ao último período pago e avisa: "O período de 11/10 a 31/10 já foi pago no plano Pro. O plano novo vale a partir de 01/11. Se o plano estava errado, desfaça o pagamento em Mensalidades antes de trocar." Se o início ficar dentro do período pago, ele é pulado (não é cobrado de novo).
- **Regra 3 (motivo do cancelamento):** "Cancelar cobrança" tem o campo **Motivo (opcional)**, texto livre com sugestões (Plano errado, Cobrança duplicada, Aluno desistiu). Fica em `Charge.cancelReason`, aparece na linha cancelada e na Auditoria. Cancelamentos do sistema mostram a nota deles (ex.: "Cancelada na inativação do aluno").
- **Substituída** (12/10/2026): cobrança cancelada pelo sistema porque outra tomou o lugar (troca de plano, data de início, regra de cobrança, desconto ou bolsa) fica com `Charge.replaced` e a nota "Substituída pela troca de ...". Aparece como **"Substituída"** (cinza), **não conta** no card "Cancelado" (não é dinheiro perdido), fica **oculta da lista por padrão** ("N cobranças substituídas... estão ocultas. Mostrar") e tem o filtro "Substituídas". Sem ações (reabrir cobraria em dobro). Canceladas à mão, na inativação e na saída da aula continuam "Cancelada" e contam no card. Migração v28 converte as antigas pelas notas.
- **Reabrir** uma cancelada é recusado quando outra mensalidade já cobre o mesmo período.
- Fora de escopo: cobrar a diferença proporcional num upgrade (seria uma ação separada, "Cobrar diferença").

## Inativação com mensalidades em aberto (12/10/2026)

- Ao inativar, mensalidades de **períodos que ainda não começaram** são sempre canceladas (como antes).
- Se houver mensalidades **em aberto de períodos já iniciados** (pendentes ou atrasadas), o diálogo pergunta: **"Manter para receber"** (padrão: continuam como dívida em Mensalidades) ou **"Cancelar a cobrança"** (canceladas como decisão do usuário, motivo "Aluno inativado", contam no card "Cancelado" e podem ser reabertas). `clientsService.remove(id, { cancelOpenCharges })`.

