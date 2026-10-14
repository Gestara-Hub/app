# Regras de cobrança das mensalidades (Modelo 3)

> Decisões de produto já implementadas em 2026-09-22. Substituem as regras de mensalidade de [`11-modelo-3-turmas.md`](11-modelo-3-turmas.md) ("cobrança cheia, sem pro-rata"). O motor técnico está em [`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md).

## Decisao

A academia define **uma regra padrão de cobrança** em Configurações → Regras da mensalidade, aplicada a cada **nova matrícula em plano**. O aluno guarda a própria regra (pode ser personalizada no cadastro) e ela não muda quando a academia muda a regra depois.

**Só mensalidade (14/10/2026):** as regras valem apenas para mensalidades (plano do aluno). Cursos, cobranças avulsas e aulas avulsas usam o valor e o vencimento definidos na hora. O cartão em Configurações se chama **"Regras da mensalidade"** e diz isso numa linha: "Valem só para mensalidades. Cursos e cobranças avulsas usam o valor e o vencimento definidos na hora." Na área de curso, o passo "Definir regras da mensalidade" só aparece nos primeiros passos se houver turma ativa cobrando mensalidade (doc frontend 08, "Primeiros passos pela forma de cobrança").

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

- Tela: `apps/web/src/features/settings/components/organization-settings-card.tsx` (Regras da mensalidade, com prévia calculada pelo motor) e `features/turmas/components/billing-view.tsx` (Cobranças).
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
- **Regra 2 (troca de plano):** período atual **em aberto** → é cancelado pelo sistema e o plano novo cobra a partir do início (cobre "plano errado, ainda não pago"). Período atual **pago** → o cadastro sugere o "Início do plano" no dia seguinte ao último período pago e avisa: "O período de 11/10 a 31/10 já foi pago no plano Pro. O plano novo vale a partir de 01/11. Se o plano estava errado, desfaça o pagamento em Mensalidades antes de trocar." Se o início ficar dentro do período pago, ele é pulado (não é cobrado de novo). **Decidido em 14/10/2026:** com plano semanal ou quinzenal, o período que fica metade dentro e metade fora do mês pago também é pulado inteiro (ex.: mensal pago em setembro, semanal com início em 01/09: a semana de 29/09 a 05/10 não é cobrada, e a primeira cobrança é a semana de 06/10). Não há cobrança proporcional dos dias de fora; a tela já sugere o início no dia seguinte ao período pago, o que evita o caso.
- **Regra 3 (motivo do cancelamento):** "Cancelar cobrança" tem o campo **Motivo (opcional)**, texto livre com sugestões (Plano errado, Cobrança duplicada, Aluno desistiu). Fica em `Charge.cancelReason`, aparece na linha cancelada e na Auditoria. Cancelamentos do sistema mostram a nota deles (ex.: "Cancelada na inativação do aluno").
- **Substituída** (12/10/2026): cobrança cancelada pelo sistema porque outra tomou o lugar (troca de plano, data de início, regra de cobrança, desconto ou bolsa) fica com `Charge.replaced` e a nota "Substituída pela troca de ...". Aparece como **"Substituída"** (cinza), **não conta** no card "Cancelado" (não é dinheiro perdido), fica **oculta da lista por padrão** ("N cobranças substituídas... estão ocultas. Mostrar") e tem o filtro "Substituídas". Sem ações (reabrir cobraria em dobro). Canceladas à mão, na inativação e na saída da aula continuam "Cancelada" e contam no card. Migração v28 converte as antigas pelas notas.
- **Reabrir** uma cancelada é recusado quando outra mensalidade já cobre o mesmo período.
- Fora de escopo: cobrar a diferença proporcional num upgrade (seria uma ação separada, "Cobrar diferença").

## Inativação com mensalidades em aberto (12/10/2026)

- Ao inativar, mensalidades de **períodos que ainda não começaram** são sempre canceladas (como antes).
- Se houver mensalidades **em aberto de períodos já iniciados** (pendentes ou atrasadas), o diálogo pergunta: **"Manter para receber"** (padrão: continuam como dívida em Mensalidades) ou **"Cancelar a cobrança"** (canceladas como decisão do usuário, motivo "Aluno inativado", contam no card "Cancelado" e podem ser reabertas). `clientsService.remove(id, { cancelOpenCharges })`.


## Cobrança avulsa (14/10/2026)

Fase A do [plano de novas formas de cobrança](20-plano-novas-formas-de-cobranca.md). Cobrar qualquer valor de um aluno fora da mensalidade: taxa de matrícula, material, uniforme, kimono, taxa do exame de faixa, evento.

- **Onde lançar:** botão **"+ Nova cobrança"** no topo de Mensalidades (escolhe o aluno) e **"Nova cobrança"** no menu do aluno em Alunos (aluno fixo). Exige a mesma permissão de marcar pago (`billing:manage`: proprietário e gerente).
- **Campos:** Aluno*, Descrição* (até 80 caracteres, com sugestões: Taxa de matrícula, Material, Uniforme, Exame de faixa (lutas) ou Exame de graduação (demais áreas), Evento), Valor* (total), Vencimento* (padrão hoje) e Parcelas (à vista ou 2x a 12x). Com parcelas, a tela mostra a conta: "3x de R$ 33,34 (a primeira) e R$ 33,33: 10/10, 10/11 e 10/12."
- **Parcelas:** centavos inteiros; o resto da divisão vai para a **primeira** parcela. Vencimentos mensais no mesmo dia do primeiro; dia que não existe cai no último dia do mês e volta ao dia original depois (31/01, 28/02, 31/03). Cada parcela precisa de pelo menos R$ 0,01. Motor: `splitInstallments` em `packages/core/src/billing.ts`.
- **Modelo:** cada parcela é uma `Charge` com `kind: "extra"`, em aberto, `competence` = mês do próprio vencimento, `description`, e (parcelada) o mesmo `installmentGroupId` e `cycleIndex`/`cycleTotal` ("parcela 2 de 3"). Sem plano, sem período de uso. Só aluno ativo.
- **Ações:** as mesmas das mensalidades: marcar pago (com a forma), desfazer, cancelar com motivo (sugestões: Lançada por engano, Cobrança duplicada, Aluno desistiu), reabrir e cobrar online (Pro, mesmas travas). Atraso é derivado na leitura. Reabrir não checa período de mensalidade.
- **Mensalidades não enxergam a avulsa:** não ocupa período (`membershipPeriodTaken`), não impede a geração automática e não é cancelada na troca de plano, regra, desconto ou bolsa.
- **Inativar o aluno mantém as avulsas em aberto, inclusive as parcelas futuras** (a compra foi feita, a dívida continua). Vale também quando o dono escolhe "Cancelar a cobrança" das mensalidades em aberto: essa escolha é só das mensalidades. O diálogo de inativação avisa: "A cobrança avulsa em aberto continua para receber." Para não cobrar, cancele as parcelas em Mensalidades.
- **WhatsApp:** a avulsa **não tem** "Lembrar no WhatsApp" até a fase D (os modelos falam de "mensalidade"). O envio do Pix ou link pelo "Cobrar online" funciona, com o texto da avulsa.
- **Tela:** filtro "Tipo" com "Cobranças avulsas" (`?kind=extra`). Linha: nome do aluno; abaixo, a descrição, "parcela 2 de 3" quando parcelada e o vencimento. Entra nos cartões do mês como as aulas avulsas. A busca também acha pela descrição.
- **Financeiro:** categoria de sistema **"Cobranças avulsas"** (`systemKey: "extras"`), linha agregada própria em Lançamentos e soma no Resumo como as demais cobranças. Migração do mock v33 cria a categoria nos espaços que já tinham as categorias padrão.
- **Pagamento do professor:** "% das mensalidades" continua só com mensalidades pagas; a avulsa não entra (decisão 7 do doc 20 vale para curso e pacote).
- **Auditoria:** uma entrada por lançamento, `lançou a cobrança avulsa "Kimono" para Ana (R$ 300,00, em 3 parcelas)`; as ações seguintes citam `parcela 2 de 3 da cobrança avulsa "Kimono" de Ana`.
- Testes: `packages/core/test/installments.test.ts`, `apps/web/src/services/__tests__/extra-charges.test.ts` (e a v33 em `migrations.test.ts`), `apps/web/e2e/cobranca-avulsa.spec.ts`.


## Curso fechado (14/10/2026)

Fase B do [plano de novas formas de cobrança](20-plano-novas-formas-de-cobranca.md). Turma com começo e fim e valor fechado (confeitaria de 8 encontros, maquiagem, cerâmica, cursinho, oficina de um dia): a matrícula gera as parcelas.

- **Forma de cobrança da turma** (`ClassGroup.billingMode`): **Mensalidade** (padrão; ausente = mensalidade, como antes: cada aluno paga pelo próprio plano), **Curso com valor fechado** (`course`) ou **Sem cobrança** (`free`). Na nova turma, a área do espaço sugere a forma: gastronomia, artes e artesanato e beleza e cursos livres começam em "Curso com valor fechado"; as demais, em "Mensalidade" (`BusinessSegmentPreset.defaultBillingMode`).
- **Curso:** `Valor do curso*` (> 0, `coursePriceCents`), `Parcelas até` (à vista a 12x, `courseMaxInstallments`) e `Termina em*` (`endDate`, obrigatório; "Curso tem data para acabar."). O fim pode ser no mesmo dia do início (oficina de um dia), nunca antes. Sem cobrança esconde o avulso pago. Curso e sem cobrança não guardam o plano legado da turma (`planId`).
- **Matrícula em curso:** o bloco "Pagamento do curso" pede `Valor*` (o valor cheio do curso, editável: é o único desconto ou bolsa no curso), `Parcelas` (de 1 até o máximo da turma) e `1º vencimento*` (padrão hoje), com a conta ao vivo: "4x de R$ 200,00: 15/10, 15/11, 15/12 e 15/01." Vale para cada aluno selecionado na matrícula em lote e também ao promover da lista de espera para um curso. A escolha fica na matrícula (`Enrollment.course`: valor, parcelas, 1º vencimento e `installmentGroupId`).
- **Parcelas:** mesmo cálculo da cobrança avulsa (`splitInstallments`): resto dos centavos na primeira, vencimentos mensais no dia do 1º (dia 31 cai no último dia dos meses curtos). Cada parcela é uma `Charge` `kind: "course"` em aberto, com `classGroupId`, `enrollmentId`, `description` = nome da turma, `installmentGroupId`, `cycleIndex`/`cycleTotal` (sempre, inclusive 1 de 1), `competence` = mês do vencimento e `unitId` da turma. Parcela de R$ 0 é recusada.
- **Entrar com o curso em andamento** pode, pelo valor cheio (editável). **Curso que já terminou** não recebe matrícula ("Este curso já terminou (20/09/2026)."); a tela esconde "Matricular alunos".
- **Aluno sai no meio** (cancelar a matrícula): as parcelas **pagas ficam**; as **em aberto que vencem depois de hoje** são canceladas pelo sistema, com o motivo "Matrícula cancelada" (não reabrem); as que vencem hoje ou já venceram **continuam em aberto** como dívida. Sem multa automática (o dono lança uma cobrança avulsa se quiser). A confirmação explica: "As parcelas pagas ficam. As 2 parcelas futuras serão canceladas." O Pix ou link em aberto das parcelas canceladas também é cancelado.
- **Curso concluído:** depois do `endDate`, a matrícula ativa aparece como **"Concluído"** (derivado na leitura, `EnrollmentView.isCompleted`; não é um status gravado) e a turma como **"Encerrado"** (`ClassGroupView.isEnded`, vale para qualquer turma com fim no passado). Cancelar a matrícula de um curso concluído não mexe nas parcelas (o curso foi dado).
- **Mudar a turma não mexe nas matrículas feitas:** editar o valor, as parcelas ou trocar a forma de cobrança vale só para as próximas matrículas.
- **Mensalidades não enxergam o curso:** a parcela não ocupa período (`membershipPeriodTaken`), não é cancelada na troca de plano, regra, desconto ou bolsa, e curso ou turma sem cobrança **nunca** geram mensalidade pelo plano da turma (nem com `planId` legado). Aluno só em cursos não precisa de plano; aluno com plano próprio continua pagando a mensalidade dele.
- **Inativar o aluno mantém as parcelas do curso em aberto** (como a avulsa: o curso foi comprado). O diálogo avisa.
- **Ações em Mensalidades:** as mesmas da avulsa (marcar pago, desfazer, cancelar com motivo, reabrir a cancelada à mão, cobrar online no Pro). **Pix Automático** continua só na mensalidade; **sem lembrete de WhatsApp** até a fase D. Filtro "Tipo" com **"Cursos"** (`?kind=course`); a linha mostra "Curso {turma} · parcela 2 de 4 · vence 15/11".
- **Financeiro:** categoria de sistema **"Cursos"** (`systemKey: "courses"`), linha agregada própria em Lançamentos e linha "Cursos" no resultado do mês. Migração do mock v34 cria a categoria nos espaços que já tinham as categorias padrão.
- **Pagamento do professor:** "% das mensalidades" continua só com mensalidades pagas; o curso entra na fase D (decisão 7 do doc 20).
- **Auditoria:** `matriculou Ana no curso Confeitaria (R$ 800,00, em 4 parcelas)` (também na promoção da lista de espera para curso); `cancelou a matrícula de Ana no curso Confeitaria e 2 parcelas futuras`; as ações citam `parcela 2 de 4 do curso "Confeitaria" de Ana`.
- Testes: `packages/core/test/courses.test.ts`, `apps/web/src/services/__tests__/courses.test.ts` (e a v34 em `migrations.test.ts`), `apps/web/e2e/curso-fechado.spec.ts`.


## Tela "Cobranças" (14/10/2026)

A tela `/classes/billing` (antes "Mensalidades") passou a se chamar **"Cobranças"**: além das mensalidades, mostra aulas avulsas, cobranças avulsas e parcelas de curso. A rota não mudou. Mudaram o item do menu, o título da tela e os textos que levam até ela ("Ver em Cobranças" no Financeiro, "Acompanhar Cobranças" na comemoração do setup, avisos do cadastro e da inativação do aluno, Pagamento online, onde aparece cada lembrete em Comunicação, tour).

"Mensalidades" continua onde nomeia o **tipo** de cobrança: opção do filtro "Tipo", categoria de sistema do Financeiro, card "Mensalidades recebidas" do Dashboard, planos, regras da mensalidade, "Paga mensalidade" no cadastro do aluno, relatórios e textos da landing. As menções a "Mensalidades" como tela nas seções acima são históricas e valem para "Cobranças".

