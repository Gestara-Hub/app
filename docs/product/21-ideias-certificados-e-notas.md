# 21 — Ideias: gerador de certificados e notas dos alunos

> **Status:** 14/10/2026. **Ideias registradas para refinar depois**, não decididas nem planejadas, exceto o gerador de modelo de certificado v1 (seção 1, entregue) e a fase 1 das notas (seção 2.1, entregue). Vieram da fase D do [doc 20](20-plano-novas-formas-de-cobranca.md) e da abertura para novas áreas (cursos livres, idiomas, reforço, profissionalizantes).

## 1. Certificado: Plano Pro e gerador de modelos

**Decidido (14/10/2026):** o certificado de conclusão do curso é recurso **pago** (Pro). No Grátis, a opção aparece com cadeado e o aviso do plano.

**Fase D:** um modelo único, pronto para imprimir ou salvar em PDF pelo navegador: aluno, curso, período, número de aulas e frequência, com linhas de assinatura.

**Entregue (14/10/2026): gerador de modelo, v1.** Um modelo por espaço, em Configurações → Certificado (Plano Pro; no Grátis, a aba mostra o cadeado e "Modelo de certificado no Plano Pro."):
- **Layout:** Clássico (moldura), Moderno (faixa lateral colorida) ou Limpo (só texto e linhas finas).
- **Cor de destaque:** paleta fechada de 6 tons escuros (Grafite, Azul-marinho, Verde, Vinho, Dourado, Roxo), legíveis no papel e na impressão.
- **Título\*** (até 60 caracteres) e **Texto\*** (até 600) com variáveis inseridas por chips no cursor: `{aluno}`, `{curso}`, `{inicio}`, `{fim}`, `{aulas}`, `{carga_horaria}`, `{frequencia}`, `{professor}`, `{empresa}`, `{cidade}`, `{data}` (emissão). Variável desconhecida é recusada ao salvar, com a lista das válidas.
- **Trecho sem valor sai:** como nos modelos de mensagem, mas primeiro só o trecho da frase (entre vírgulas ou depois de " e "); sem conector antes, a frase inteira. Curso de um dia: "de {inicio} a {fim}" vira "em {inicio}". O texto padrão reproduz o da fase D.
- **Carga horária:** soma da duração das aulas do curso (encontros entre o início e o fim, pelo horário da turma): "16 horas", "12h30", "45 minutos". Decidido assim (vem das aulas, não é informada no curso).
- **Assinaturas:** 1 ou 2 linhas com nome (aceita `{professor}` e `{empresa}`) e cargo. Padrão: `{professor}` / Instrutor e `{empresa}` / Responsável.
- **Logo:** imagem até 1 MB, pelo mesmo caminho dos anexos do Financeiro (arquivo no armazenamento de arquivos, IndexedDB no mock; o modelo guarda só o id).
- **Mostrar frequência:** desligada, `{frequencia}` fica sem valor e o trecho sai.
- Prévia ao vivo com dados de exemplo; aviso de alterações não salvas; "Restaurar padrão" com confirmação (apaga o modelo salvo, logo inclusa). Salvar e restaurar entram na auditoria.
- A tela do certificado (`/classes/[id]/certificate/[enrollmentId]`) recebe os dados do aluno e o modelo do espaço juntos e imprime em A4 deitado, sem o menu do app.

**Falta (próximas versões):**
- modelo por modalidade ou por curso (hoje é um por espaço);
- emitir em lote para todos os concluídos de uma turma;
- código de verificação no certificado (página pública que confirma que ele é verdadeiro);
- assinatura em imagem;
- o aluno baixar o próprio certificado pelo app;
- layout infantil e `{nota}` (depende das notas, seção 2).

**Pontos a decidir:** critério mínimo para emitir (frequência mínima, nota mínima); guardar o certificado emitido (histórico) ou gerar sempre na hora (hoje: na hora, com o modelo em vigor).

**Cuidado no desenho atual:** os dados do certificado ficam separados do layout, para o gerador entrar sem reescrever a emissão.

## 2. Notas dos alunos (avaliações)

**Motivo:** várias áreas lançam nota: idiomas (provas por nível), reforço escolar e cursinho, música (prova prática), cursos profissionalizantes, natação e lutas (avaliação técnica em exame). Hoje a evolução tem trilha, registros de aula e metas, mas não tem nota.

**Ideia:**
- **Avaliação** ligada à turma ou à modalidade: nome ("Prova do módulo 2", "Exame de faixa"), data, tipo de nota (0 a 10, 0 a 100, conceito A–E, aprovado/reprovado) e peso.
- **Lançamento pelo professor:** tela parecida com a chamada, uma linha por aluno, rápida no celular.
- **Boletim do aluno:** notas por avaliação, média por módulo ou período, na ficha de evolução (perto de "Registros de aula").
- **Ligação com a trilha:** a nota pode virar critério para avançar ("média mínima 7 para passar de nível"), junto com presença e tempo, que são os critérios de hoje.
- **Ligação com o certificado:** a nota final pode aparecer no certificado e ser critério para emitir.
- **Comunicação:** avisar o aluno ou o responsável quando a nota sair (modelo de mensagem novo).
- **Relatórios:** desempenho por turma e por avaliação.

**Pontos a decidir:** grátis ou Pro (sugestão inicial: lançar notas no Grátis; boletim em PDF, critérios automáticos e relatórios no Pro); escalas por modalidade ou por espaço; recuperação e segunda chamada; quem pode lançar e editar (só o professor da turma? o dono?); o aluno vê as notas no app.

**Encaixe com o que existe:** as palavras seguem a trilha da modalidade (Faixa, Nível, Módulo, Fase); "Avaliação" e "Nota" entram no mesmo padrão. Metas e registros de aula continuam; a nota é um registro estruturado a mais na evolução.

### 2.1 Proposta de implementação (14/10/2026, aprovada com as recomendações; fase 1 entregue)

**Onde liga: por modalidade, não por área nem no setup.** Um mesmo espaço mistura modalidades com e sem prova (escola de música com prova de teoria e aula livre de canto; academia com exame de faixa e funcional). Por isso:
- O editor da modalidade ganha **"Esta modalidade tem avaliações"** (liga/desliga) e a **escala**.
- A área só sugere o padrão das modalidades novas: **ligado** em Idiomas e reforço, Música e Beleza e cursos livres; **desligado** nas outras e em "Outra área". Lutas fica desligado, porque o exame de faixa já é a graduação.
- A configuração inicial **não pergunta** (fica curta); a revisão das modalidades mostra o interruptor.

**Escala por modalidade:** 0 a 10 (padrão, uma casa decimal), 0 a 100, conceito (A a E) ou apto/não apto, com **nota mínima para aprovar** (padrão 6 / 60 / C / apto).

**Avaliação** pertence à **turma**: nome ("Prova do módulo 2"), data, peso (padrão 1) e, opcional, a etapa da trilha a que se refere (módulo, nível). Uma turma pode ter várias.

**Lançamento** parecido com a chamada, pensado para o celular: uma linha por aluno matriculado, campo de nota com teclado numérico (ou botões de conceito/apto), "Faltou" e "Sem nota"; salva por linha; mostra a média da turma.

**Boletim** na evolução do aluno, como um terceiro item ao lado de Graduação e Registros de aula ("Notas"), só nas modalidades com avaliações: lista de avaliações com nota, média ponderada por etapa da trilha e geral, e destaque abaixo da mínima.

**Quem lança:** o professor nas turmas dele (mesmo escopo da chamada); dono e gerente em todas. Nova capacidade `grades:manage`.

**Grátis e Pro (sugestão):**
| Grátis | Pro |
|---|---|
| Ligar avaliações, lançar notas, boletim na tela, média | Boletim em PDF; nota como critério automático na trilha ("média mínima 7 para avançar"); `{nota}` no certificado e nota mínima para emitir; relatórios de desempenho; aviso automático "nota lançada" no WhatsApp |

**Fases:**
1. **Notas básicas:** interruptor e escala na modalidade, avaliações na turma, lançamento, boletim, média, permissões. Testes de regra (média ponderada, escalas, arredondamento) no `packages/core`.
2. **Integrações Pro:** critério na trilha, certificado, PDF, relatório, mensagem.

**Decisões para alinhar:**
1. Ligar por modalidade com padrão da área (recomendado) ou perguntar no setup?
2. Lutas desligado por padrão?
3. Escalas iniciais (0 a 10, 0 a 100, conceito, apto) são suficientes?
4. Recuperação e segunda chamada entram na fase 1? Sugestão: não; o dono lança uma nova avaliação "Recuperação" e a média usa a maior nota (fase 2).
5. A divisão Grátis e Pro acima.

### 2.2 Fase 1 entregue (14/10/2026)

Aprovada com todas as recomendações acima: liga por modalidade com o padrão da área, lutas desligado, as 4 escalas, recuperação fica para a fase 2 e a divisão Grátis/Pro sugerida (a fase 1 é toda Grátis).

**O que entrou:**
- **Modalidade** (`Category.assessments`: `enabled`, `scale`, `passingGrade`): no editor, o bloco "Esta modalidade tem avaliações" com a escala (0 a 10, 0 a 100, A a E, Apto) e "Nota mínima para aprovar" (trocar a escala volta para o padrão dela). A área sugere o padrão das modalidades novas (`BusinessSegmentPreset.assessmentsByDefault`): ligado em Idiomas e reforço, Música e Beleza e cursos livres. O padrão é aplicado no serviço (`categoriesService.create` sem `assessments`), então vale também para as modalidades criadas na configuração inicial, que não ganhou pergunta nova.
- **Turma:** aba **"Avaliações"** no detalhe (só com a modalidade ligada): busca, contador, escala, mínima e média da turma no topo; cada linha com data, peso, etapa, "X de Y lançadas" e a média; "Nova avaliação" no topo da aba; menu ⋮ e botão direito com Lançar notas, Editar e Excluir (com confirmação). Clicar na linha abre o lançamento.
- **Lançar notas:** uma linha por aluno matriculado (ordem alfabética), campo com teclado numérico (`inputMode="decimal"` no 0 a 10, `numeric` no 0 a 100) ou botões A a E / Apto e Não apto, "Faltou" e "Sem nota"; nota abaixo da mínima em vermelho; "Lançadas X de Y" e a média ao vivo no topo. Salva tudo de uma vez (uma entrada de auditoria por lançamento), não por linha.
- **Boletim "Notas":** terceiro item da evolução, ao lado de Graduação e Registros de aula, no menu do aluno (lista de alunos), na lista da turma e na chamada, só quando há modalidade com avaliações. Mostra média geral, média por etapa (palavra da trilha: Nível, Módulo, Fase) e as avaliações com nota, peso, etapa e turma, com destaque abaixo da mínima.
- **Permissão** `grades:manage`: dono, gerente e professor; o professor só nas turmas em que é o instrutor titular. O escopo é aplicado no serviço (`gradesService`, erro `FORBIDDEN`), não só na tela. Ver é `classes:view`. Atendente vê, não lança.
- **Auditoria:** "criou a avaliação", "editou a avaliação", "excluiu a avaliação" e "lançou as notas de {avaliação} da turma {turma}" (tipo "Avaliação").

**Decisões tomadas na implementação:**
- **Notas dentro da avaliação** (`Assessment.grades[]`, uma linha por aluno com `status`, `value`, `updatedAt`, `updatedBy`): um documento por prova, lido e gravado inteiro no lançamento. No banco pode virar tabela própria (`assessment_grades`) sem mudar o contrato da tela.
- **Faltou e Sem nota ficam fora da média** (sem segunda chamada na fase 1). "Sem nota" apaga a linha do aluno.
- **Arredondamento** (metade para cima, só no fim): 0 a 10 com uma casa (6,25 vira 6,3); 0 a 100 inteiro; conceito vira número (A=10, B=8, C=6, D=4, E=2), a média volta para a letra mais próxima (9 ou mais A, 7 B, 5 C, 3 D, abaixo E); apto/não apto mostra a fração de aptos ("75% aptos") e aprova pela maioria (metade ou mais).
- **Média geral** pondera todas as notas da modalidade (não é a média das médias das etapas). **Média da turma** é a média das médias gerais dos alunos matriculados. Avaliação sem etapa (ou de etapa que saiu da trilha) entra em "Sem {etapa}".
- **Aluno que sai da turma:** sai da contagem e da média da turma, mas a nota fica guardada e continua no boletim dele.
- **Peso:** maior que zero, até 100, uma casa decimal.
- **Modalidade desligada depois:** as avaliações ficam guardadas; a aba e o item "Notas" somem até religar.

**Código:** regras puras em `packages/core/src/grades.ts` (testes em `packages/core/test/grades.test.ts`); contratos em `packages/contracts/src/assessment.ts`; serviço `apps/web/src/services/gradesService.ts` (testes em `services/__tests__/grades.test.ts`); tela em `apps/web/src/features/grades`.

**Fase 2 (não entrou):** recuperação e segunda chamada (maior nota), nota como critério da trilha, `{nota}` no certificado, boletim em PDF, relatórios de desempenho e aviso "nota lançada" no WhatsApp.
