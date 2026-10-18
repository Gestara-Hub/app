# 20 — Plano: novas formas de cobrança (curso fechado, pacote de aulas, cobrança avulsa)

> **Status:** 14/10/2026. Recomendações da seção 5 **aceitas**. **Fases A (cobrança avulsa), B (curso fechado) e C (pacote de aulas) entregues em 14/10/2026** (regras em [15-regras-de-cobranca.md](15-regras-de-cobranca.md), seções "Cobrança avulsa", "Curso fechado" e "Pacote de aulas"); D pendente. Nasce da abertura para novas áreas (gastronomia, artes, beleza e cursos livres): elas vendem de um jeito que o sistema ainda não cobra.
> Base: regras atuais em [15-regras-de-cobranca.md](15-regras-de-cobranca.md), motor em `packages/core/src/billing.ts`, contratos em `packages/contracts/src/billing.ts` e `class.ts`.

## 1. O que existe hoje

| Forma | Como funciona | Quem usa |
|---|---|---|
| Mensalidade contínua | Plano do aluno (`Client.planId`), mensal, quinzenal ou semanal, gerada todo período pelo motor | Academias, escolas de música e idiomas |
| Aula avulsa | Cobrança por aula (`ChargeKind = "dropin"`), preço da turma | Quem paga por aula |
| Sem cobrança | Aluno sem plano, ou bolsa integral | Bolsistas, projetos sociais |

A turma já aceita data de término (`ClassGroup.endDate`), mas nada na cobrança usa isso.

## 2. O que falta

| Lacuna | Exemplos | O que precisa |
|---|---|---|
| **Cobrança avulsa** | Taxa de matrícula, material, uniforme, kimono, insumos da aula, taxa do exame de faixa, evento | Cobrar qualquer valor de um aluno, com descrição, vencimento e parcelas |
| **Curso fechado** | Curso de confeitaria de 8 encontros, maquiagem, cerâmica, cursinho, oficina de um dia | Turma com começo e fim, valor do curso, à vista ou parcelado; a matrícula gera as parcelas |
| **Pacote de aulas** | 10 aulas de beach tennis, 8 de pilates, aulas particulares, autoescola | Comprar N aulas por um valor, gastar uma por aula, saldo, validade e renovação |

Aula particular 1 a 1 já funciona (turma com 1 vaga) e passa a poder ser paga por pacote.

## 3. Desenho proposto

Princípio: **tudo continua sendo `Charge`.** Mensalidades, financeiro, pagamento online, lembretes de WhatsApp e relatórios já sabem lidar com cobrança; as formas novas só criam cobranças de outros tipos.

- `ChargeKind` ganha `"extra"` (avulsa), `"course"` (parcela de curso) e `"package"` (compra de pacote). Parcelas reaproveitam `cycleIndex`/`cycleTotal` ("2 de 4"). `description` para o texto da avulsa.
- **Turma** ganha a forma de cobrança: `billingMode: "membership" | "course" | "free"`, com `coursePriceCents` e `courseMaxInstallments` no curso. A área do espaço sugere o padrão (gastronomia, artes e beleza: curso).
- **Matrícula em curso** guarda a escolha do aluno (à vista ou N parcelas, 1º vencimento) e gera as parcelas na hora.
- **Pacote**: `LessonPackage` (nome, quantidade de aulas, preço, validade em dias, modalidades em que vale), cadastrado como os planos; `StudentPackage` (compra do aluno: saldo, usadas, vence em, cobrança ligada).
- Mensalidade continua no aluno; curso fica na matrícula; pacote fica no aluno. Um aluno pode ter os três ao mesmo tempo.

## 4. Fases

Cada fase fecha com testes de regra (`packages/core`), de service (Vitest) e de tela (Playwright), como na rodada de 14/10/2026.

| Fase | Entrega | Tamanho |
|---|---|---|
| **A. Cobrança avulsa** ✅ 14/10/2026 | "Nova cobrança" no aluno e em Mensalidades: descrição, valor, vencimento, 1 a 12 parcelas. Aparece em Mensalidades (filtro "Tipo"), no Financeiro e no pagamento online. O lembrete de WhatsApp ficou para a D. Base para B e C. | Pequeno |
| **B. Curso fechado** ✅ 14/10/2026 | Forma de cobrança na turma; matrícula pergunta "à vista ou parcelado" e gera as parcelas; turma terminada encerra a matrícula ("Concluído"); cancelamento cancela só as parcelas futuras; vagas e lista de espera como hoje. Padrão por área. | Médio |
| **C. Pacote de aulas** ✅ 14/10/2026 | Cadastro de pacotes (em Planos); venda ao aluno gera a cobrança; a chamada gasta uma aula; saldo na ficha, na chamada e no aluno; validade; aviso de "última aula" e de vencimento; renovar. Aluno com pacote entra em qualquer aula das modalidades do pacote, como o avulso hoje, mas gastando crédito. | Médio a grande |
| **D. Acabamento** | Modelos de WhatsApp novos ("parcela do curso", "pacote acabando"); "Para fazer hoje" com pacotes acabando; certificado de conclusão do curso (PDF simples no navegador); relatórios por curso e por pacote; repasse de professor incluindo curso e pacote (decisão 5). | Médio |

**Ordem e backend:** fazer A, B e C ainda no mock, antes da fatia 4 do backend (Cobrança, [06-passagem-backend.md](../technical/06-passagem-backend.md)), porque mudam os contratos, que são a especificação da API. As fatias 1 a 3 do backend (login, alunos, turmas) podem começar em paralelo. D pode vir depois.

## 5. Decisões de produto (com recomendação)

| # | Pergunta | Recomendação |
|---|---|---|
| 1 | Curso: aluno que cancela no meio | Parcelas pagas ficam, as futuras são canceladas; sem multa automática (o dono lança uma cobrança avulsa se quiser). |
| 2 | Curso: entrar com o curso em andamento | Pode; valor cheio por padrão, editável na matrícula. |
| 3 | Curso: parcelas | O dono define o máximo de parcelas na turma; o aluno escolhe de 1 até esse máximo; vencimento mensal a partir da data escolhida. |
| 4 | Pacote: o que gasta uma aula | Presença gasta. Falta sem justificativa também gasta, com opção no pacote para não gastar. Falta justificada nunca gasta. |
| 5 | Pacote: validade | Opcional por pacote. Vencido, o saldo é perdido (aviso antes: 7 dias e na última aula). |
| 6 | Pacote: comprar outro com saldo | Pode; o saldo soma e a validade é a do pacote novo. |
| 7 | Repasse do professor (percentual) | Passa a ser "% do que os alunos pagaram": curso pela turma; pacote pelo valor de cada aula dada (preço ÷ aulas). Mensalidade como hoje. |
| 8 | Bolsa e desconto em curso e pacote | Só ajuste manual do valor na matrícula ou na venda; a bolsa automática continua só na mensalidade. |
| 9 | Pagamento online (Pro) | Vale para parcelas, avulsas e pacotes (são cobranças). Pix Automático continua só na mensalidade. |

## 6. Impacto em outras partes

- **Mensalidades:** a tela passa a listar todos os tipos; avaliar renomear para "Cobranças" (o filtro "Tipo" já existe).
- **Financeiro:** entradas novas entram no resumo como as mensalidades; nada novo no cálculo.
- **Configuração inicial e página:** a área sugere a forma de cobrança da primeira turma; a página pode citar "cursos com valor fechado" e "pacotes de aulas" quando B e C existirem.
- **Backend:** tabelas novas (`lesson_packages`, `student_packages`) e campos na turma e na matrícula; o gasto de aula do pacote acontece junto da chamada, na mesma transação.

## 7. Fase A entregue (14/10/2026)

O que foi feito: `ChargeKind` `"extra"`, `Charge.description` e `Charge.installmentGroupId`, `CreateExtraCharge`, `splitInstallments` e `describeCharge` no core, `billingService.createExtraCharge`, diálogo `NewExtraChargeDialog` (Mensalidades e menu do aluno), filtro "Cobranças avulsas", categoria de sistema "Cobranças avulsas" (`extras`) e migração v33.

Decisões tomadas na implementação:

- **Inativar o aluno mantém todas as avulsas em aberto**, inclusive parcelas futuras, mesmo com "Cancelar a cobrança" das mensalidades (a escolha do diálogo é só das mensalidades). Mesmo espírito da decisão 1: o que foi comprado continua devido; para não cobrar, cancela-se a parcela à mão. O diálogo avisa.
- **Sem lembrete de WhatsApp para avulsa** até a fase D (os modelos falam de "mensalidade"). O "Cobrar online" monta o texto próprio ("Segue a cobrança "Kimono"...").
- **Resto dos centavos na primeira parcela**; dia 31 cai no último dia dos meses curtos e volta a 31 (calculado sempre a partir do 1º vencimento). Total menor que o número de parcelas é recusado (parcela de R$ 0 não é cobrança).
- **Só aluno ativo** recebe cobrança avulsa (o inativo é recusado com mensagem no campo Aluno).
- **Rótulo nas auditorias:** "parcela 2 de 3 da cobrança avulsa "Kimono" de Ana" (`describeCharge`, também usado pelo pagamento online).
- **Motivos sugeridos ao cancelar** uma avulsa trocam "Plano errado" por "Lançada por engano".
- Depois de lançar em Mensalidades, a tela abre o mês da primeira parcela quando ele for outro.
- A tela continua com o nome "Mensalidades" (renomear para "Cobranças", seção 6, segue em avaliação).

## 8. Fase B entregue (14/10/2026)

O que foi feito: `ClassBillingMode` e `ClassGroup.billingMode`/`coursePriceCents`/`courseMaxInstallments`, `ChargeKind` `"course"` com `Charge.enrollmentId`, `Enrollment.course` (`EnrollmentCourse`), `CreateEnrollment.course`, read-models `ClassGroupView.isEnded` e `EnrollmentView.isCompleted`/`courseInstallments`; no core, `classBillingMode`, `hasEnded`, `isCourseEnded`, `isFutureOpenInstallment` e o rótulo do curso em `describeCharge`; `turmasService.enroll`/`promoteFromWaitlist` com o pagamento do curso e `cancelEnrollment` com a decisão 1; "Cobrança" no formulário da turma (Mensalidade, Curso com valor fechado, Sem cobrança), bloco "Pagamento do curso" na matrícula e na promoção da lista de espera, resumo do curso no detalhe da turma, selos "Curso", "Encerrado" e "Concluído", filtro "Cursos" em Mensalidades, categoria de sistema "Cursos" (`courses`) e migração v34. Regras completas no doc 15, seção "Curso fechado".

Decisões tomadas na implementação:

- **"Concluído" é derivado na leitura** (`EnrollmentView.isCompleted`: curso com `endDate` antes de hoje e matrícula ativa), não um status gravado. Assim mudar a data de fim do curso corrige sozinho, sem migração nem rotina que "feche" matrículas. A turma ganhou `isEnded` (qualquer turma com fim no passado), que mostra "Encerrado".
- **Curso concluído não perde parcelas:** cancelar a matrícula depois do fim não cancela nada (o curso foi dado). A decisão 1 vale só para quem sai no meio.
- **"Futura" é vencimento depois de hoje:** a parcela que vence hoje continua em aberto, como as vencidas.
- **Curso terminado não recebe matrícula** (o serviço recusa e a tela esconde "Matricular alunos").
- **Fim no mesmo dia do início vale** (oficina de um dia); o plano pedia fim depois do início. Fim antes do início é recusado em qualquer turma.
- **Turma "Sem cobrança" não tem avulso pago** (o formulário esconde o avulso). A aula experimental continua.
- **Curso e sem cobrança limpam o plano legado da turma** (`planId`) ao salvar, e a geração automática ignora o `planId` dessas turmas mesmo em dado antigo: só mensalidade usa o plano da turma.
- **`Termina em` só aparece no curso.** Turma de mensalidade com fim antigo (sem campo na tela) mantém a data; turma que deixa de ser curso perde o fim do curso.
- **A matrícula em curso sempre guarda `installmentGroupId` e `cycleIndex`/`cycleTotal`**, inclusive à vista (1 de 1), para achar as parcelas da matrícula; o rótulo só diz "parcela" quando há mais de uma.
- **Promover da lista de espera agora entra na Auditoria** como matrícula (antes não entrava), porque no curso gera cobrança; a turma de mensalidade registra "matriculou {aluno} na turma {turma}".
- **Cancelar uma matrícula já cancelada é recusado** ("Esta matrícula já foi cancelada."), para um clique duplo não registrar duas vezes.
- **Parcelas padrão na matrícula: à vista**, valor cheio do curso e 1º vencimento hoje; o dono escolhe as parcelas.
- Mensalidades segue com o nome "Mensalidades" (renomear para "Cobranças" segue em avaliação).

## 9. Fase C entregue (14/10/2026)

O que foi feito: contratos `LessonPackage` e `StudentPackage` (+ `StudentPackageView` com `remaining`, `isExpired`, `isUsedUp`, `isLastLesson`, `expiresSoon`, `daysToExpire`), `SellPackage`, `ChargeKind` `"package"` com `Charge.studentPackageId`, `ClassBillingMode` `"package"`, vínculo `"package"` na aula (`ReservationKind` e `SessionRosterKind`), saldo no roster (`packageRemaining`, `packageTotal`, `packageLastLesson`, `noPackage`) e `ClassSessionDetail.packageCandidates`; no core, `packages.ts` (`packageExpiresAt`, `usageReasonFor`, `coversModality`, `modalitiesOverlap`, `packageState`, `isUsableOn`, `pickPackageFor`, `carryOverSources`) e o rótulo do pacote em `describeCharge`; `packagesService` (catálogo, venda com renovação, cancelamento da venda e o gasto na chamada), `turmasService.markAttendance` acertando o pacote e `clearAttendance` novo; aba "Pacotes de aulas" em Planos, "Vender pacote" e "Cancelar pacote" no menu do aluno, selo do pacote na lista de Alunos, "Pacote de aulas" no formulário da turma, saldo e inscrição pelo pacote na chamada, filtro "Pacotes" em Cobranças, categoria de sistema "Pacotes de aulas" (`packages`) e migração v35. Regras completas no doc 15, seção "Pacote de aulas".

Decisões tomadas na implementação:

- **Pacote vale até a compra + a validade** (comprado em 01/10 com 30 dias vale até 31/10, inclusive). Vencido = data da aula depois desse dia.
- **A data que conta é a da aula**, não a de hoje: a chamada atrasada de uma aula de quando o pacote valia gasta normalmente; aula depois do vencimento não usa o pacote. Não há trava pela data da compra (aula dada antes da venda, marcada depois, gasta o pacote).
- **Entre vários pacotes válidos, paga o que vence primeiro** (sem validade por último; empate, o mais antigo). Se esse pacote não gasta na falta, a falta não gasta nada (não procura outro pacote que gaste).
- **Renovação leva o saldo de todos os ativos válidos com modalidade em comum** (pacote de todas as modalidades conta como comum). Vencido ou usado até o fim não renova (fica como está). Desmarcar uma aula gasta de um pacote já renovado devolve a aula **no pacote novo** (o saldo já tinha ido para lá). Cancelar a venda do pacote novo devolve o anterior ao uso.
  - **Revisto em 18/10/2026:** só o **mesmo pacote do catálogo** renova; pacote diferente (mesmo da mesma modalidade ou para todas) fica separado, os dois ativos, e a aula usa o que vence primeiro. Motivo: grupo e particular da mesma modalidade se juntavam e misturavam o preço das aulas (`carryOverSources` recebe o `packageId`; "pacote acabando" só some com nova compra do mesmo pacote).
- **Cancelar a venda só sem aula usada** (como pedido) e **as cobranças pagas ficam**: o dinheiro recebido continua no Financeiro; para devolver, desfaz-se o pagamento em Cobranças. O cancelamento é do sistema ("Pacote cancelado"), não reabre.
- **Cancelar uma cobrança do pacote não mexe no saldo** (a cobrança e o pacote são coisas separadas, como na avulsa); para desfazer a venda, "Cancelar pacote".
- **Valor da venda > 0** (como o curso): cortesia não é pacote; para dar aula grátis, use a experimental.
- **Rótulo da cobrança à vista:** `compra do pacote "10 aulas" de Ana`, e não `pacote "10 aulas" de Ana` como no plano, porque as auditorias escrevem "registrou o pagamento da …" e "cancelou a …" (feminino). Parcelada: `parcela 2 de 3 do pacote "10 aulas" de Ana`. O curso à vista tem o mesmo problema ("da curso") e ficou como estava.
- **Turma de pacote aceita avulso pago e experimental**; eles não gastam o pacote. O aluno com pacote entra em qualquer turma da modalidade pelo vínculo "package", mesmo em turma sem avulso, e, como o avulso, sem checar lotação.
- **Desmarcar presença** (tocar de novo no botão marcado) entrou nesta fase para a chamada poder devolver a aula; vale para todas as turmas.
- **"Cobrança" da turma com 4 opções:** no celular elas ficam 2 por linha (`SegmentedChoiceField` passou a aceitar 4).
- **Pacote acabado ou vencido aparece na lista de Alunos por até 30 dias**, para lembrar de renovar; depois some.
- **Auditoria do gasto de aula:** não há (a chamada não é auditada); a venda, o cancelamento e a inscrição na aula pelo pacote são.

## 10. Fase D entregue (14/10/2026)

**Comunicação**
- Modelos novos: **"Lembrete de cobrança"** (`charge_reminder`, categoria cobrança, 3 dias antes, ligado) para cobrança avulsa, parcela de curso e compra de pacote; **"Pacote acabando"** (`package_ending`, categoria retenção, 7 dias antes, 10:00, ligado). Migração v36 cria os dois por espaço, com o tom da área.
- `{referencia}` é sempre feminino, porque o texto diz "Lembrete da ...": "cobrança Kimono", "parcela 2 de 3 da cobrança Kimono", "matrícula no curso Confeitaria", "parcela 2 de 4 do curso Confeitaria", "compra do pacote 10 aulas".
- `{restante}`: "resta 1 aula", "restam 3 aulas", "vence em 5 dias e restam 2 aulas", "vence hoje e resta 1 aula", "venceu em 12/10". O texto do "Pacote acabando" fala "Sobre seu pacote..." para não dizer "está acabando: venceu".
- "Lembrar no WhatsApp" aparece em toda cobrança em aberto, menos aula avulsa.

**Para fazer hoje: pacotes acabando**
- Entram pacotes ativos de aluno ativo: última aula, vencendo em até 7 dias ou vencidos há até 7 dias. Sai quem já tem pacote mais novo em modalidade em comum.
- Ordem: vencidos, depois quem vence antes, depois última aula. "Avisado" vale qualquer "Pacote acabando" enviado desde a compra. "Vender pacote" só com `billing:manage`.
- **Em aberto:** pacote usado até o fim (0 aulas, ainda válido) não entra. Avaliar incluir, porque é a hora de renovar.

**Certificado (Plano Pro)**
- Recurso `certificates` no Pro e no Scale; no Grátis, "Certificado (Plano Pro)" com cadeado e o aviso do plano. Rota própria, pronta para imprimir em A4 deitado.
- Aulas = encontros da turma entre início e fim; frequência = presenças ÷ (presenças + faltas), sem frequência quando não houve chamada. Assinaturas do instrutor titular e do responsável. Dados separados do texto do modelo (base para o gerador do [doc 21](21-ideias-certificados-e-notas.md)).

**Repasse do professor: "% do que os alunos pagaram"**
- Uma linha por origem ("30% de R$ 200,00 em mensalidades", "em cursos", "em pacotes (2 aulas)"); cada linha arredonda para baixo e o centavo que sobra fica com o espaço (como na D4). Meses fechados antes da mudança mantêm a linha antiga; reabrir recalcula. A chave salva continua `percent_of_memberships`.
- **Curso:** parcela paga conta no mês do vencimento e vai inteira para o professor titular da turma do curso (substituição não muda).
- **Pacote:** cada aula usada no mês (presença ou falta que gasta) vai para quem deu a aula, inclusive o substituto, valendo preço ÷ aulas do pacote (para baixo). Só contam pacotes **totalmente pagos** no momento do cálculo; o mês ainda aberto passa a contar quando o pacote é quitado.
- Aula que passou para outro pacote na renovação mantém o valor do pacote de origem (`carriedFrom`) e só conta se a origem estiver paga; aulas herdadas são usadas antes das novas.
- **Mensalidade:** só é dividida entre os professores das turmas de mensalidade do aluno (curso, pacote e sem cobrança não entram), para o professor do curso não receber duas vezes. Aluno que só está em curso ou pacote continua com a divisão de antes.
- Cobranças avulsas e aulas avulsas não entram.

**Relatórios novos (grátis, operacionais)**
- **Cursos:** por turma de curso no mês: matriculados, concluídos, cancelados, contratado, recebido e em aberto (totais do curso); cartões com "Recebido no mês".
- **Pacotes de aulas:** por pacote: vendidos e aulas vendidas no mês, aulas usadas no mês, saldo de aulas hoje, recebido no mês. Os dois exportam CSV e mostram vazio sem dados.

## 11. Mensalidade e pacote na mesma turma (15/10/2026)

Problema: numa turma de mensalidade, o aluno de pacote matriculado não gastava o pacote, e, sem plano, fazia aula sem cobrança e sem aviso. Só funcionava inscrevendo aula por aula pelo vínculo "package".

O que mudou: a forma da turma vira o padrão, e a **matrícula** pode pagar diferente.

- **`Enrollment.paysWithPackage`** (só em turma de mensalidade): cada presença gasta uma aula do pacote, como na turma de pacote. Saldo e "Sem pacote" aparecem na chamada; a matrícula não gera mensalidade pelo plano legado da turma.
- **Matricular alunos:** quem tem pacote válido da modalidade ganha a escolha "Como paga esta turma" (Mensalidade ou Pacote). Padrão: sem plano, Pacote; com plano, Mensalidade. Quem não tem plano, pacote nem bolsa recebe o aviso "não tem plano nem pacote. A matrícula não gera cobrança" (não bloqueia: pode ser cortesia).
- **Trocar depois:** no menu do aluno na turma, "Pagar com pacote" (só com pacote válido) ou "Pagar com mensalidade", com confirmação e auditoria. Vale daqui em diante; aulas já gastas ou não gastas ficam como estão.
- **Promover da lista de espera** usa o mesmo padrão (sem plano e com pacote, paga com pacote).
- **Selo "Pacote"** na linha do aluno da turma; na ficha do aluno a matrícula aparece como pacote.
- **% do professor:** a turma de mensalidade paga com pacote por aquele aluno não recebe parte da mensalidade dele; a aula entra na linha de pacotes, como na turma de pacote.
- O servidor recusa pagar com pacote sem pacote válido para a modalidade hoje e fora da turma de mensalidade (curso, pacote e sem cobrança já decidem pela turma).
