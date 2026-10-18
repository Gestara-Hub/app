# Regras de cobrança das mensalidades (Modelo 3)

> Decisões de produto já implementadas em 2026-09-22. Substituem as regras de mensalidade de [`11-modelo-3-turmas.md`](11-modelo-3-turmas.md) ("cobrança cheia, sem pro-rata"). O motor técnico está em [`../technical/02-motor-de-cobranca.md`](../technical/02-motor-de-cobranca.md).

## Decisao

A academia define **uma regra padrão de cobrança** em Configurações → Regras da mensalidade, aplicada a cada **nova matrícula em plano**. O aluno guarda a própria regra (pode ser personalizada no cadastro) e ela não muda quando a academia muda a regra depois.

**Só mensalidade (14/10/2026):** as regras valem apenas para mensalidades (plano do aluno). Cursos, pacotes de aulas, cobranças avulsas e aulas avulsas usam o valor e o vencimento definidos na hora. O cartão em Configurações se chama **"Regras da mensalidade"** e diz isso numa linha: "Só para mensalidades. Curso, pacote e avulso têm valor e vencimento próprios." (texto encurtado em 17/10/2026) Na área de curso, o passo "Definir regras da mensalidade" só aparece nos primeiros passos se houver turma ativa cobrando mensalidade (doc frontend 08, "Primeiros passos pela forma de cobrança").

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
  - **Pacote de aulas** (15/10/2026): ver "Pacote de aulas no cadastro do aluno" abaixo.
  - **Não paga mensalidade**: sem plano e sem cobrança (curso, avulso ou experimental), escolhido de forma explícita.
- As quatro opções aparecem como cartões em grade 2×2 (título + dica curta), em qualquer largura (`SegmentedChoiceField variant="cards"`, semântica de radiogroup). A "Cobrança" da nova turma usa os mesmos cartões.
- Bolsa pelo valor a pagar é guardada como bolsa de valor fixo (preço do plano - valor pago); o selo calcula a %.
- Contrato: `StudentDiscount.scholarship` (bolsa é sempre percentual; integral = 100) e `StudentDiscount.validUntil`. O motor (`@gestarahub/core/billing`) aplica o desconto só nos períodos que começam até `validUntil`; depois volta ao valor cheio do plano.
- **Bolsa integral**: a mensalidade nasce com status **"Isento"** (`waived`), R$ 0, selo **"Bolsista"**. Nunca fica pendente nem em atraso, fica fora de "A receber" e da inadimplência e não tem ações (marcar pago, cobrar online, cancelar; o serviço recusa).
- **Bolsa parcial**: mensalidade normal com o valor reduzido e selo **"Bolsa 50%"**.
- Cada mensalidade com bolsa guarda `scholarshipPercent` e `listAmountCents` (valor sem bolsa). O Resumo do Financeiro mostra **"Bolsas concedidas"** (valor do plano - cobrado, com nº de alunos), informativo, fora do caixa.
- Mudar desconto ou bolsa do aluno conta como troca de regra: as mensalidades em aberto (inclusive isentas) de períodos que ainda não começaram são canceladas pelo sistema e a geração recria pelo valor novo.
- Pagamento de professor: "por aluno" conta o bolsista (o professor dá a aula); "% do que os alunos pagaram" usa só o pago, então o isento entra com zero.
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
- **WhatsApp:** "Lembrar no WhatsApp" com o modelo "Lembrete de cobrança" desde a fase D (seção "Lembretes de WhatsApp das outras cobranças"). O envio do Pix ou link pelo "Cobrar online" funciona, com o texto da avulsa.
- **Tela:** filtro "Tipo" com "Cobranças avulsas" (`?kind=extra`). Linha: nome do aluno; abaixo, a descrição, "parcela 2 de 3" quando parcelada e o vencimento. Entra nos cartões do mês como as aulas avulsas. A busca também acha pela descrição.
- **Financeiro:** categoria de sistema **"Cobranças avulsas"** (`systemKey: "extras"`), linha agregada própria em Lançamentos e soma no Resumo como as demais cobranças. Migração do mock v33 cria a categoria nos espaços que já tinham as categorias padrão.
- **Pagamento do professor:** a avulsa não entra no "% do que os alunos pagaram" (só mensalidade, curso e pacote; doc 05, seção 5.3).
- **Auditoria:** uma entrada por lançamento, `lançou a cobrança avulsa "Kimono" para Ana (R$ 300,00, em 3 parcelas)`; as ações seguintes citam `parcela 2 de 3 da cobrança avulsa "Kimono" de Ana`.
- Testes: `packages/core/test/installments.test.ts`, `apps/web/src/services/__tests__/extra-charges.test.ts` (e a v33 em `migrations.test.ts`), `apps/web/e2e/cobranca-avulsa.spec.ts`.


## Curso fechado (14/10/2026)

Fase B do [plano de novas formas de cobrança](20-plano-novas-formas-de-cobranca.md). Turma com começo e fim e valor fechado (confeitaria de 8 encontros, maquiagem, cerâmica, cursinho, oficina de um dia): a matrícula gera as parcelas.

- **Forma de cobrança da turma** (`ClassGroup.billingMode`): **Mensalidade** (padrão; ausente = mensalidade, como antes: cada aluno paga pelo próprio plano), **Curso com valor fechado** (`course`) ou **Sem cobrança** (`free`). Na nova turma, a área do espaço sugere a forma: gastronomia, artes e artesanato e beleza e cursos livres começam em "Curso com valor fechado"; as demais, em "Mensalidade" (`BusinessSegmentPreset.defaultBillingMode`).
- **Curso:** `Valor do curso*` (> 0, `coursePriceCents`), `Parcelas até` (à vista a 12x, `courseMaxInstallments`) e `Termina em*` (`endDate`, obrigatório; "Curso tem data para acabar."). O fim pode ser no mesmo dia do início (oficina de um dia), nunca antes. Sem cobrança esconde o avulso pago. Curso e sem cobrança não guardam o plano legado da turma (`planId`).
- **Matrícula em curso (linha resumida desde 18/10/2026):** o bloco começa fechado, numa linha com o padrão da turma: "Cobrança de cada aluno: R$ 150,00 à vista, vence hoje · Alterar" ("Cobrança do aluno" com um só). "Alterar" abre os campos; erro de validação ou do serviço abre sozinho. Aberto, o bloco pede `Valor*` (o valor cheio do curso, editável: é o único desconto ou bolsa no curso), `Parcelas` (de 1 até o máximo da turma) e `1º vencimento*` (padrão hoje), com a conta ao vivo: "4x de R$ 200,00: 15/10, 15/11, 15/12 e 15/01." Vale para cada aluno selecionado na matrícula em lote e também ao promover da lista de espera para um curso. A escolha fica na matrícula (`Enrollment.course`: valor, parcelas, 1º vencimento e `installmentGroupId`).
- **Parcelas:** mesmo cálculo da cobrança avulsa (`splitInstallments`): resto dos centavos na primeira, vencimentos mensais no dia do 1º (dia 31 cai no último dia dos meses curtos). Cada parcela é uma `Charge` `kind: "course"` em aberto, com `classGroupId`, `enrollmentId`, `description` = nome da turma, `installmentGroupId`, `cycleIndex`/`cycleTotal` (sempre, inclusive 1 de 1), `competence` = mês do vencimento e `unitId` da turma. Parcela de R$ 0 é recusada.
- **Entrar com o curso em andamento** pode, pelo valor cheio (editável). **Curso que já terminou** não recebe matrícula ("Este curso já terminou (20/09/2026)."); a tela esconde "Matricular alunos".
- **Aluno sai no meio** (cancelar a matrícula): as parcelas **pagas ficam**; as **em aberto que vencem depois de hoje** são canceladas pelo sistema, com o motivo "Matrícula cancelada" (não reabrem); as que vencem hoje ou já venceram **continuam em aberto** como dívida. Sem multa automática (o dono lança uma cobrança avulsa se quiser). A confirmação explica: "As parcelas pagas ficam. As 2 parcelas futuras serão canceladas." O Pix ou link em aberto das parcelas canceladas também é cancelado.
- **Curso concluído:** depois do `endDate`, a matrícula ativa aparece como **"Concluído"** (derivado na leitura, `EnrollmentView.isCompleted`; não é um status gravado) e a turma como **"Encerrado"** (`ClassGroupView.isEnded`, vale para qualquer turma com fim no passado). Cancelar a matrícula de um curso concluído não mexe nas parcelas (o curso foi dado).
- **Mudar a turma não mexe nas matrículas feitas:** editar o valor, as parcelas ou trocar a forma de cobrança vale só para as próximas matrículas.
- **Mensalidades não enxergam o curso:** a parcela não ocupa período (`membershipPeriodTaken`), não é cancelada na troca de plano, regra, desconto ou bolsa, e curso ou turma sem cobrança **nunca** geram mensalidade pelo plano da turma (nem com `planId` legado). Aluno só em cursos não precisa de plano; aluno com plano próprio continua pagando a mensalidade dele.
- **Inativar o aluno mantém as parcelas do curso em aberto** (como a avulsa: o curso foi comprado). O diálogo avisa.
- **Ações em Mensalidades:** as mesmas da avulsa (marcar pago, desfazer, cancelar com motivo, reabrir a cancelada à mão, cobrar online no Pro). **Pix Automático** continua só na mensalidade; "Lembrar no WhatsApp" usa o "Lembrete de cobrança" (fase D). Filtro "Tipo" com **"Cursos"** (`?kind=course`); a linha mostra "Curso {turma} · parcela 2 de 4 · vence 15/11".
- **Financeiro:** categoria de sistema **"Cursos"** (`systemKey: "courses"`), linha agregada própria em Lançamentos e linha "Cursos" no resultado do mês. Migração do mock v34 cria a categoria nos espaços que já tinham as categorias padrão.
- **Pagamento do professor:** o "% do que os alunos pagaram" conta as parcelas de curso pagas (competência do vencimento), inteiras para o titular da turma do curso; a turma de curso não recebe parte da mensalidade do aluno que também tem turma de mensalidade (doc 05, seção 5.3).
- **Auditoria:** `matriculou Ana no curso Confeitaria (R$ 800,00, em 4 parcelas)` (também na promoção da lista de espera para curso); `cancelou a matrícula de Ana no curso Confeitaria e 2 parcelas futuras`; as ações citam `parcela 2 de 4 do curso "Confeitaria" de Ana`.
- Testes: `packages/core/test/courses.test.ts`, `apps/web/src/services/__tests__/courses.test.ts` (e a v34 em `migrations.test.ts`), `apps/web/e2e/curso-fechado.spec.ts`.


## Tela "Cobranças" (14/10/2026)

A tela `/classes/billing` (antes "Mensalidades") passou a se chamar **"Cobranças"**: além das mensalidades, mostra aulas avulsas, cobranças avulsas e parcelas de curso. A rota não mudou. Mudaram o item do menu, o título da tela e os textos que levam até ela ("Ver em Cobranças" no Financeiro, "Acompanhar Cobranças" na comemoração do setup, avisos do cadastro e da inativação do aluno, Pagamento online, onde aparece cada lembrete em Comunicação, tour).

"Mensalidades" continua onde nomeia o **tipo** de cobrança: opção do filtro "Tipo", categoria de sistema do Financeiro, card "Mensalidades recebidas" do Dashboard, planos, regras da mensalidade, "Paga mensalidade" no cadastro do aluno, relatórios e textos da landing. As menções a "Mensalidades" como tela nas seções acima são históricas e valem para "Cobranças".


## Pacote de aulas (14/10/2026)

Fase C do [plano de novas formas de cobrança](20-plano-novas-formas-de-cobranca.md). Comprar N aulas por um valor e gastar uma por aula: 10 aulas de beach tennis, 8 de pilates, aulas particulares.

- **Cadastro** em **Planos → aba "Pacotes de aulas"** (`?tab=packages`; o botão do topo vira "+ Novo pacote"). Campos: `Nome*`, `Quantidade de aulas*` (1 a 200), `Valor*` (> 0), `Validade` (Sem validade, 30, 60, 90 ou 180 dias, 1 ano; o serviço aceita de 1 a 730 dias), `Modalidades` (nenhuma escolhida = todas) e "Falta sem justificativa gasta a aula" (ligado por padrão). Lista com busca, filtro de situação, Editar e Inativar/Reativar. Editar ou inativar vale para as próximas vendas; o que já foi vendido fica como estava (o pacote do aluno copia nome, aulas, validade, modalidades e a regra da falta). Contrato: `LessonPackage`.
- **Pacote de aulas no cadastro do aluno (15/10/2026):** "Plano & Mensalidade" tem a opção **"Pacote de aulas"** (sem plano de mensalidade). No aluno novo, com permissão `billing:manage`, aparecem os campos da venda: `Pacote*` (pacotes ativos; sem nenhum, "Criar pacote" leva a `/classes/plans?tab=packages`), `Valor*` (o do pacote, editável), `Parcelas`, `1º vencimento*` e a conta ao vivo (`paymentSummary`). Ao salvar, o aluno é criado e o pacote vendido pelo mesmo serviço de "Vender pacote" (`packagesService.sellPackage`, que continua validando). Se a venda falhar, o aluno fica salvo e o aviso pede a venda pelo menu. Sem a permissão, a opção só deixa o aluno sem plano. Na edição, a opção mostra o pacote atual com o saldo e a ação **"Vender pacote"** (abre o diálogo de venda, já com o mesmo pacote); salvar o aluno não vende nada. Área de pacote começa nessa opção (`defaultPaymentMode`); aluno salvo sem plano e com pacote em uso também. Validação no Zod (`clientFormSchema`, `isPackageSale`).
- **Venda:** "Vender pacote" no menu do aluno ativo em Alunos (permissão `billing:manage`, a mesma da cobrança avulsa). `Pacote*`, `Valor*` (o do pacote, editável: é o único desconto, decisão 8), `Parcelas` (à vista a 12x), `1º vencimento*` (padrão hoje) e a conta ao vivo, como no curso. Gera o `StudentPackage` (comprado hoje; vence na compra + a validade: comprado em 01/10 com 30 dias vale até 31/10) e as cobranças `kind: "package"` em aberto, com `description` = nome do pacote, `studentPackageId` e, parcelada, `installmentGroupId` e `cycleIndex`/`cycleTotal` (mesmo cálculo da avulsa: `splitInstallments`). Só aluno ativo e pacote ativo.
- **O que gasta uma aula (decisão 4):** presença gasta; falta sem justificativa gasta se o pacote mandar; falta justificada nunca. Uma aula gasta por aluno e aula (`StudentPackage.usages`), refeita a cada chamada: trocar a marcação muda o motivo ou devolve a aula; desmarcar devolve. Gasta quem está matriculado numa turma "Pacote de aulas" ou entrou na aula pelo pacote (vínculo "package", doc 11); avulso e experimental não.
- **Qual pacote paga a aula:** ativo, válido **na data da aula** e com saldo, que cubra a modalidade da turma; entre vários, o que vence primeiro (sem validade por último). A chamada atrasada de uma aula de quando o pacote ainda valia gasta normalmente. Sem pacote com saldo, nada é gasto e a chamada mostra **"Sem pacote"**.
- **Validade (decisão 5):** vencido, o saldo é perdido (não paga mais aula nem passa para outro pacote). Avisos: **"Última aula"** quando resta uma e **"Vence em N dias"** a partir de 7 dias (ou "Vence hoje"); vencido mostra **"Vencido"**.
- **Renovação (decisão 6, revista em 18/10/2026):** só renova quem compra de novo **o mesmo pacote do catálogo** com outro igual ativo, válido e com saldo: o saldo passa para o novo (`carriedOverLessons`, somado em `lessonsTotal`), com a validade do novo, e o antigo fica **"Renovado"** (`status: "renewed"`). O diálogo avisa: "O saldo de 3 aulas do pacote atual passa para este." **Pacote diferente**, mesmo da mesma modalidade (ex.: "10 aulas em grupo" e "4 particulares") ou para todas, **fica separado**: os dois valem, a aula usa o que vence primeiro e o diálogo avisa "O pacote 10 aulas em grupo continua valendo. A aula usa o que vence primeiro." Antes, qualquer pacote com modalidade em comum renovava e misturava os preços das aulas.
- **Cancelar a venda:** "Cancelar pacote" no menu do aluno (com confirmação), só enquanto nenhuma aula foi usada ("O pacote já tem aulas usadas."). Cancela as cobranças em aberto (pelo sistema, motivo "Pacote cancelado", e o Pix ou link delas); as pagas ficam. Se o pacote trouxe saldo de outro, o anterior volta a valer.
- **Vender de novo:** pacote cancelado ou renovado nunca impede outra venda; com pacote em uso, vender de novo o mesmo pacote é renovar (regra 6); outro pacote fica separado. "Vender pacote" fica no menu do aluno, em "Mais ações" da ficha e na barra da aba Pacotes (sempre visível, não só na lista vazia); só exige aluno ativo e `billing:manage`.
- **Saldo na tela:** selo na lista de Alunos ("Pacote 7 de 10" + aviso); quem só tem pacote não mostra "Sem mensalidade". Pacote acabado ou vencido aparece por até 30 dias. Na chamada, "7 de 10", "Última aula" ou "Sem pacote".
- **Ações em Cobranças:** as mesmas da avulsa e do curso (marcar pago, desfazer, cancelar com motivo, reabrir a cancelada à mão, cobrar online no Pro, decisão 9). **Pix Automático** continua só na mensalidade; "Lembrar no WhatsApp" usa o "Lembrete de cobrança" (fase D). Filtro "Tipo" com **"Pacotes"** (`?kind=package`); a linha mostra "Pacote 10 aulas · parcela 2 de 3 · vence 15/11". Cancelar a cobrança não cancela o pacote (o saldo continua; para desfazer a venda, use "Cancelar pacote").
- **Mensalidades não enxergam o pacote:** a cobrança não ocupa período e não é cancelada na troca de plano, regra, desconto ou bolsa; turma "Pacote de aulas" nunca gera mensalidade (nem com `planId` legado). **Inativar o aluno** mantém as cobranças do pacote em aberto e o saldo (o diálogo avisa).
- **Financeiro:** categoria de sistema **"Pacotes de aulas"** (`systemKey: "packages"`), linha agregada própria em Lançamentos e linha "Pacotes de aulas" no resultado do mês. Migração do mock v35 cria as coleções `lessonPackages` e `studentPackages` e a categoria nos espaços que já tinham as categorias padrão.
- **Pagamento do professor:** o "% do que os alunos pagaram" conta cada aula usada no mês pelo valor da aula (preço ÷ aulas compradas), para quem deu a aula (substituto inclusive), só de pacote pago por inteiro; aula trazida na renovação vale o preço da aula do pacote de onde veio (doc 05, seção 5.3).
- **Auditoria:** `criou o pacote 10 aulas (10 aulas, R$ 500,00)`; `vendeu o pacote 10 aulas para Ana (R$ 450,00, em 3 parcelas)` (com renovação: `, com 3 aulas trazidas do pacote anterior`); `cancelou o pacote 10 aulas de Ana e 1 cobrança em aberto`; as ações citam `compra do pacote "10 aulas" de Ana` ou `parcela 2 de 3 do pacote "10 aulas" de Ana`; entrar na aula pelo pacote, `inscreveu Ana na aula de 21/09/2026 da turma Pilates (usa 1 aula do pacote)`. O gasto de aula na chamada não entra (a chamada não é auditada).
- Regras puras em `packages/core/src/packages.ts` (`packageExpiresAt`, `usageReasonFor`, `coversModality`, `packageState`, `pickPackageFor`, `carryOverSources`); serviço `apps/web/src/services/packagesService.ts`. Testes: `packages/core/test/packages.test.ts`, `apps/web/src/services/__tests__/packages.test.ts` (e a v35 em `migrations.test.ts`).


## Lembretes de WhatsApp das outras cobranças (14/10/2026)

Fase D do [plano de novas formas de cobrança](20-plano-novas-formas-de-cobranca.md). Mesma regra do WhatsApp com o número do próprio espaço ([13](13-modelo-de-negocio.md), seção 5): assistido no grátis, oficial no Pro conectado.

- **"Lembrar no WhatsApp"** aparece no menu de toda cobrança em aberto (pendente ou atrasada) em Cobranças, menos a aula avulsa. A mensalidade continua com o lembrete da situação (antes, no dia, atraso, crítico). Avulsa, curso e pacote usam o modelo novo **"Lembrete de cobrança"** (`charge_reminder`): "Olá, {aluno}! Lembrete da {referencia} de {valor} na {empresa}, com vencimento em {vencimento}. Pague pelo link: {link_pagamento}." + o fecho da área ("Bons treinos! 🥋" em lutas, "Boas aulas!" nas demais).
- **`{referencia}`** diz o que é cobrado: "cobrança Kimono", "parcela 2 de 3 da cobrança Kimono", "matrícula no curso Confeitaria" (curso à vista), "parcela 2 de 4 do curso Confeitaria", "compra do pacote 10 aulas", "parcela 1 de 2 do pacote 10 aulas" (`chargeReference`, `apps/web/src/features/communication/message-values.ts`).
- O lembrete fica ligado à cobrança (`MessageLog.chargeId`) e entra no "Recebido depois de lembrete" de Comunicação, como o da mensalidade.
- **"Pacote acabando"** (`package_ending`): "Oi, {aluno}! Sobre seu pacote {pacote} na {empresa}: {restante}. Quer renovar e seguir com as aulas?" (lutas: "seguir treinando"). `{restante}`: "resta 1 aula", "restam 3 aulas", "vence em 5 dias e restam 2 aulas", "vence hoje e resta 1 aula", "venceu em 12/10" (`packageRemainingText`). Sai do bloco "Para fazer hoje" do Dashboard.
- Os dois modelos ficam em Comunicação > Mensagens (texto editável por todos; envio automático e horário só no Pro) e no Histórico. Migração do mock v36 adiciona os dois aos espaços que já tinham modelos, com o texto da área.


## Modelos na mensagem para o aluno (17/10/2026)

A mensagem para um aluno ("Enviar WhatsApp" no menu do aluno em Alunos, "Nova mensagem" na ficha e em Comunicação) mostra **chips "Modelos"** abaixo do campo. Um clique preenche o texto com o nome do aluno e do espaço; dá para editar antes de enviar. O envio registra o tipo do modelo e a cobrança ligada, como os atalhos de cada tela.

**Pela situação do aluno**, nesta ordem (`messageSuggestions`, `apps/web/src/features/communication/message-suggestions.ts`):

| Chip | Quando aparece | Modelo |
|---|---|---|
| "Mensalidade a vencer", "Mensalidade vence hoje", "Mensalidade em atraso" | Mensalidade em atraso ou vencendo em até 7 dias (a mais urgente) | Lembrete da situação, ligado à cobrança |
| "Lembrete de cobrança" | Avulsa, curso ou pacote em atraso ou vencendo em até 7 dias (a mais urgente) | `charge_reminder`, ligado à cobrança |
| "Sentimos sua falta" | 3 faltas seguidas (a mesma conta do Dashboard) | `absence_alert` |
| "Pacote acabando" | Mesma regra do "Para fazer hoje" (`selectEndingPackages`, agora em `apps/web/src/lib/package-ending.ts`) | `package_ending` |
| "Aniversário" | No dia e até 6 dias depois | `birthday_greeting` |
| "Parabéns pelo avanço" | Avanço nos últimos 14 dias (o mais recente) | `level_up`, com `{nivel}` = nome do nível ("Faixa Azul") |
| "Pagamento recebido" | Pagamento nos últimos 7 dias (o mais recente) | `payment_received`, ligado à cobrança; `{referencia}` "mensalidade de outubro" ou a referência do lembrete |
| "Boas-vindas" | Até 7 dias depois do cadastro | `welcome_student` |

**Sempre**, depois desses: "Aula cancelada", "Mudança de horário" e "Feriado ou recesso".

**Modelos novos, só de envio manual** (`payment_received`, `level_up`, `class_canceled`, `schedule_change`, `holiday_notice`): ficam em Comunicação > Mensagens para editar o texto (Avisos é um grupo novo), sem envio automático nem no Pro (o serviço recusa "Este modelo é só de envio manual."), e não contam nas automações ativas. Textos padrão (lutas fala em treino):
- Pagamento recebido: "Oi, {aluno}! Recebemos o pagamento de {valor} da {referencia}. Obrigado!" + o fecho da área.
- Parabéns pelo avanço: "Parabéns, {aluno}! 🎉 Nova conquista na {empresa}: {nivel}. É resultado da sua dedicação." + o fecho da área.
- Aula cancelada: "Oi, {aluno}! A aula de hoje na {empresa} foi cancelada. Desculpe o transtorno, nos vemos na próxima aula!"
- Mudança de horário: "Oi, {aluno}! Aviso da {empresa}: sua turma vai mudar de horário. Novo horário:" (a pessoa completa).
- Feriado ou recesso: "Oi, {aluno}! Aviso da {empresa}: no feriado não teremos aula. Bom descanso e até a volta!"

"Pagamento recebido" é da categoria cobrança, mas não entra no "Recebido depois de lembrete" (que agora conta só os lembretes). Migração do mock v37 adiciona os cinco aos espaços que já tinham modelos, com o texto da área. Avisar a turma toda de uma vez fica para depois (na tela da turma).


## Certificado de conclusão do curso (14/10/2026)

Fase D. **Recurso do Plano Pro** (`certificates`, Pro e Scale).

- No detalhe da turma, a matrícula **"Concluído"** (curso terminado, matrícula ativa) ganha **"Certificado"** no menu da linha, para quem vê a turma (`classes:view`). No Grátis o item aparece com cadeado ("Certificado (Plano Pro)") e abre a tela "Disponível no Plano Pro".
- A página `/classes/{turma}/certificate/{matrícula}` mostra o certificado (A4 deitado) com o nome do espaço, "Certificado de conclusão", "Certificamos que {aluno} concluiu o curso {curso}, de {início} a {fim}, com {N} aulas e frequência de X%.", cidade da unidade e data por extenso, e as linhas de assinatura do instrutor e do espaço. "Imprimir ou salvar em PDF" usa a impressão do navegador.
- **Aulas** = encontros da turma entre o início e o fim. **Frequência** = presenças ÷ (presenças + faltas) das chamadas feitas, como no selo da lista; sem chamada, a frase sai sem frequência. Curso de um dia: "em 05/10/2026".
- O serviço recusa no Grátis (`FEATURE_NOT_IN_PLAN`), curso não terminado ("O certificado sai quando o curso termina.") e matrícula cancelada. Dados (`buildCourseCertificate`) e texto do modelo (`defaultCertificateText`) ficam separados em `packages/core/src/certificate.ts`, para um gerador de modelos no futuro.
