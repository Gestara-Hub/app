# Graduação em grupo e troca de turma

Data: 13/11/2026 · Status: Decidido; etapas 1 a 3 feitas em 13/11/2026, etapa 4 a fazer · Código: etapa 1 em `packages/core/src/progression.ts` (`promotionReadiness`, `stageGradeChecks`), `services/grades/stageGrades.ts`, `StudentModalityOverviewItem.stageGrades`; etapa 2 em `enrollmentsService.moveStudents`, `features/turmas/components/move-students-drawer.tsx`, migração `20261113000098_enrollment_moved_to.sql`; etapa 3 em `clients.listPromotionCandidates`, `clients.promoteStudents`, `features/clients/components/graduate-many-drawer.tsx`; base das outras em `features/clients/components/student-graduation-dialog.tsx` (Apto), `features/clients/components/graduate-panel.tsx`, `services/clients/clientProgressionService.ts` (`promoteStudent`), `services/classes/enrollmentsService.ts`, `services/classes/enrollmentCreation.ts`, `features/events`, `packages/core/src/grades.ts` · Testes: `packages/core/test/progression.test.ts`, `services/__tests__/progression-readiness.test.ts`, `services/__tests__/move-students.test.ts`, `services/__tests__/graduate-many.test.ts`, `services/world/__tests__/flows2.db.test.ts` (mudar de turma no banco)

## Decisão

Subir vários alunos de uma vez e trocar alunos de turma sem cancelar e matricular de novo. Três decisões do dono (13/11/2026), todas na recomendação:

1. **"Mudou para {turma}" é diferente de cancelamento.** Trocar de turma fecha a matrícula antiga com esse motivo, sem contar como saída do aluno em relatórios nem aparecer como "cancelou a matrícula" na Auditoria.
2. **"Conta para a graduação" vira "Evento de graduação".** A opção do evento (`countsForProgression`, gravada mas nunca ligada à frequência) passa a marcar o evento como exame ou cerimônia de graduação. Presença em evento continua fora da frequência da graduação.
3. **Aluno não apto pode ser graduado com confirmação.** O selo "Apto" orienta e vem marcado, mas não bloqueia. Quem não está apto vem desmarcado, e o professor pode incluir confirmando (conselho de classe, exame do mestre).

## Contexto

Hoje a graduação é só individual: menu do aluno, Graduação, Graduar (`promoteStudent`, um registro no histórico por vez). Trocar de turma exige cancelar a matrícula e criar outra.

Análise por área (trilha padrão em `lib/business-segment-presets.ts` e `lib/progression-tracks.ts`):

| Área | Trilha padrão | Como sobem na prática | Momento coletivo |
| --- | --- | --- | --- |
| Lutas (inclui capoeira) | Faixas com grau, presença e tempo | Exame ou cerimônia com várias turmas, examinador às vezes de fora, taxa do evento e da federação; capoeira tem o batizado; graus no fim da aula | Forte, no evento e na turma |
| Idiomas e reforço | Níveis por presença (CEFR com prova) | O módulo termina e a turma sobe, pela nota | Forte, na turma |
| Natação e esportes | Etapas por presença | Avaliação periódica, troca de nível | Médio, na turma |
| Dança | Níveis por presença | A turma sobe no ano letivo, às vezes com banca | Médio, na turma |
| Música | Módulos | Quase tudo 1 a 1 | Fraco, o individual resolve |
| Gastronomia, Artes, Beleza | Módulos, cobrança por curso | Avançar é concluir o curso; o certificado de conclusão já sai em lote | Quase nenhum |
| Pilates e yoga, Funcional | Sem trilha | Não sobem | Nenhum |

Conclusão: a **turma** é a entrada que serve a todas as áreas com trilha; o **evento** é o extra das lutas. Em natação, dança e idiomas, subir de nível costuma significar trocar de turma, por isso "Mudar de turma" entra junto.

A mensalidade fica no aluno (`Client.planId`), não na matrícula: trocar de turma de mensalidade, pacote ou sem cobrança não mexe em dinheiro. Só a turma de curso tem cobrança na matrícula (`Enrollment.course`).

## Escopo

Quatro etapas, nesta ordem:

### 1. Regra única de "Apto" (com notas)

- Sai da tela (`student-graduation-dialog.tsx`) para uma função pura, usada no Graduar individual, no lote da turma, no atalho do evento e no Painel.
- Apto = critério da trilha cumprido (aulas, tempo ou os dois, desde a última graduação).
- Com avaliações ligadas na modalidade (doc 21 §2), também precisa de **média da etapa atual ≥ nota mínima** (`passingGrade`, com a recuperação já contando a maior nota, `averagesByLevel`) e **frequência ≥ mínima** (`minAttendancePercent`), quando a modalidade exige.
- Trilha com prova (`manual_exam`, ex.: CEFR) e avaliações ligadas: vale só a nota e a frequência.
- Quem não está apto mostra o motivo em uma linha: "Média 5,8, mínima 6", "Frequência 68%, mínima 75%", "Faltam 6 aulas".
- Fecha o item "nota como critério da trilha" da fase 2 das notas (doc 21 §2.2).

**Como ficou (13/11/2026):**

- **Regra pura** `promotionReadiness` em `@gestarahub/core/progression`: devolve `ready` e o que falta em frases curtas ("Faltam 6 aulas", "Falta 1 mês", "Média 5,8, mínima 6", "Sem nota neste nível", "Frequência 68%, mínima 75%"). `stageGradeChecks` monta as linhas de média e frequência para a tela (escala 0 a 10 e 0 a 100: "Média 7,5 · mínima 6"; soma: "Total 3 de 6 · mínimo 6 de 10"; conceito: "Média B · mínima C"; apto ou não: "Avaliações Apto").
- **Notas da etapa** (`studentStageGrades`, `services/grades/stageGrades.ts`): avaliações da modalidade marcadas com o nível atual, mais as sem etapa (ou de etapa que saiu da trilha) desde a última graduação, cada uma com a melhor recuperação. Frequência só quando a modalidade tem mínima; sem chamada não reprova (igual ao boletim).
- **Visão da graduação**: `getProgressionOverview` leva `stageGrades` em cada modalidade com avaliações ligadas.
- **Tela**: no modal Graduação, o selo "Apto" usa a regra e as linhas de média e frequência aparecem abaixo do progresso; trilha por prova com notas diz "Pelas notas". No Graduar, a meta mostra as mesmas linhas e o aviso "Ainda não atingiu a meta" segue a regra. `GoalRow` e `StageGradeRows` ficaram em `progression-ui.tsx`.
- **Sem notas**: nada muda para quem não usa avaliações (lutas, por padrão).

### 2. "Mudar de turma"

- Entradas: ⋮ do aluno na turma (um aluno) e a barra do "Selecionar alunos" da turma (vários).
- Drawer: turma de destino (mesma modalidade primeiro), data (hoje), e "Subir de nível junto" (marcado quando a turma de destino é de nível acima; registra a graduação com a regra do Apto).
- Em um passo: a matrícula antiga fecha como "Mudou para {turma}" (decisão 1) e a nova abre na mesma data. Lotação do destino avisa como na matrícula.
- Turma de curso fica fora desta etapa: o próximo módulo é um curso novo com preço novo, então "mudar" é rematricular com a cobrança (segunda etapa, quando houver pedido).

**Como ficou (13/11/2026):**

- **Gravação:** a matrícula antiga fica `status: "canceled"` (encerrada), com `canceledAt`, motivo "Mudou para {turma}" e `movedToClassGroupId` (coluna `enrollments.moved_to_class_group_id`, migração 98). Por quê: "encerrada" já é o que todas as telas, contas e relatórios leem para tirar o aluno da turma; um status novo obrigaria a revisar cada `status !== "canceled"`. A marca diz que foi mudança, não saída.
- **Serviço** `turmas.moveStudents({ fromClassGroupId, toClassGroupId, studentIds, promote? }, { allowOverCapacity? })` (`enrollment:manage`): tudo ou nada, confere antes de gravar: turma de destino ativa e diferente, sem curso na origem nem no destino, cada aluno ativo na origem, ninguém já no destino ("Bia já está em Natação B."), choque de horário sem contar a turma que o aluno deixa, pacote que vale na turma nova (quem paga com pacote segue assim), e vagas ("Natação B tem 1 vaga livre para 2 alunos.", `CLASS_FULL`, a tela confirma "Mudar mesmo assim").
- **Auditoria:** uma linha por aluno, "mudou Ana da turma Natação A para Natação B" (nem "cancelou a matrícula", nem "matriculou").
- **Subir de nível junto:** desligado por padrão, porque a turma não tem nível próprio e o sistema não sabe se o destino está acima. Ligado, cada aluno vai para o próximo nível inteiro da trilha da modalidade de destino (sem grau, pulando os de outra idade; `nextLevelFor`), com a data de hoje e a observação "Mudou para a turma {turma}"; quem já está no último nível fica como está. Só aparece com trilha no destino e para quem tem `progression:manage`. A gravação é a mesma do Graduar (`recordPromotion`).
- **Tela:** na turma, ⋮ do aluno "Mudar de turma" e, em "Selecionar alunos", o botão "Mudar de turma" na barra (fora em turma de curso e em turma inativada). Drawer à direita: nomes de quem sai, "Turma de destino*" com busca (mesma modalidade primeiro; cada opção com as vagas ou "lotada"; curso fora), "Subir de {nível} junto" e "Mudar de turma". Aviso: "Ana mudou para Natação B." ou "3 alunos mudaram para Natação B; 2 subiram de nível."
- **Ficha do aluno:** em Turmas, a matrícula encerrada por mudança mostra "Mudou para {turma} em dd/mm" no lugar de "Saiu em".
- **Relatório de retenção:** por turma, quem mudou não conta como saída da turma de origem; no total do espaço o aluno segue ativo (tem a matrícula nova).

### 3. "Graduar vários" na turma

- Na barra do "Selecionar alunos": "Graduar". Caso "a turma inteira sobe": seleciona todos, desmarca quem repete e, se quiser, renomeia a turma ("Básico 1" para "Básico 2"); ninguém troca de turma.
- Uma linha por aluno: etapa atual, passo sugerido (grau ou próximo nível, `computeNextPromotionStep`), selo Apto ou o motivo, e "Escolher outro".
- Em comum: data, examinador e observação. "Graduar N alunos" confirma; cada aluno ganha o registro normal no histórico e uma linha na Auditoria.

**Como ficou (13/11/2026):**

- **Entrada:** na turma, "Selecionar alunos", botão "{Graduar/Avançar}" na barra, só com trilha na modalidade da turma e para quem tem `progression:manage`.
- **Leitura** `clients.listPromotionCandidates(modalidade, alunos)`: a modalidade com a trilha resolvida e, por aluno, o progresso, as aulas desde a última graduação e as notas da etapa (o mesmo cálculo da visão da graduação, `progressFacts`). A tela calcula o passo e o "Apto" com as funções do Graduar individual (`computeNextPromotionStep`, `nextLevelFor`, `promotionReadiness`).
- **Drawer** "{Graduar/Avançar} alunos": uma linha por aluno com caixa de marcar, o nível de hoje → o passo. Com grau e próximo nível possíveis, um seletor ("2º grau" ou "Faixa Azul"); com um só, o selo. Embaixo, "Apto para graduar" em verde ou o que falta em âmbar ("Faltam 6 aulas · Média 5,8, mínima 6"); no último nível, "Último nível da trilha" sem caixa. Quem está apto vem marcado. Em comum: data (sem futura), "Quem graduou/avaliou" e observação. O botão "{Graduar} N alunos" confirma, e a confirmação avisa quantos não estão aptos.
- **Gravação** `clients.promoteStudents({ modalityId, date, examiner?, notes?, items })`: tudo ou nada; data não futura, nível da trilha e grau válidos, nada igual ao de hoje ("Bia já está em Iniciante."); cada aluno pela mesma gravação do Graduar (`recordPromotion`), com aulas e meses no nível. Confere cada aluno com `assertCanManageProgression` (professor só os dele).
- **Simplificações:** renomear a turma ("Básico 1" para "Básico 2") fica em "Editar turma", sem campo a mais no drawer. "Escolher outra" (pular, voltar, transferência) segue só no Graduar individual; no lote, as opções são o próximo grau ou o próximo nível.

### 4. Evento de graduação (lutas)

- Opção **"Evento de graduação"** no formulário do evento (decisão 2), só com modalidade de trilha.
- **Valor:** o aluno paga um valor só (evento e federação), com lote e parcelas como hoje; o valor já é editável por aluno na inscrição (kids, faixa preta).
- **Repasse à federação:** campo opcional "Repasse por aluno". A aba Financeiro do evento mostra "Repasse à federação: N × R$ x" e o botão "Lançar repasse" cria a saída do evento (categoria Eventos). Nada é lançado sozinho.
- **Inscrever:** atalho "Aptos de {modalidade} (N)" que marca quem já está apto; o professor inclui outros.
- **Aba Graduação** no detalhe do evento: os inscritos presentes, passo sugerido, selo Apto e a situação da cobrança ("Pago", "R$ x a receber"). Data e examinador vêm do evento (dia e quem conduz). Graduar quem ainda deve pede confirmação, sem bloquear.
- **Certificados (Pro):** "Emitir certificados" gera um PDF com todos que graduaram no evento (fecha o item "certificado de graduação em lote por exame" das pendências).

## Alternativas

- **Aba Graduação em todo evento com modalidade de trilha, sem opção:** descartada; a opção também muda o Inscrever (aptos) e o Financeiro (repasse).
- **Bloquear quem não está apto:** descartado; o professor decide (decisão 3).
- **Valor por faixa no evento:** fora por enquanto; o valor editável na inscrição cobre. Volta se o professor de jiu-jitsu que testa o sistema pedir.
- **Lançar o repasse sozinho ao graduar:** descartado; a federação cobra de jeitos diferentes, o espaço lança quando pagar.
- **Nível próprio na turma:** fora; o nome da turma já diz o nível e a graduação fica no aluno.
