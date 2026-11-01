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
- ~~modelo por modalidade ou por curso~~ (entregue em 31/10/2026: modelo por modalidade, abaixo);
- ~~emitir em lote para todos os concluídos de uma turma~~ (entregue em 31/10/2026, §1.4);
- ~~código de verificação no certificado~~ (entregue em 31/10/2026, §1.3);
- assinatura em imagem;
- o aluno baixar o próprio certificado pelo app;
- layout infantil e `{nota}` (depende das notas, seção 2).

**Pontos a decidir:** critério mínimo para emitir (frequência mínima, nota mínima). ~~Guardar o certificado emitido~~: desde 31/10/2026 a emissão fica registrada (§1.3); o desenho segue o modelo em vigor, os dados são os da emissão.

**Cuidado no desenho atual:** os dados do certificado ficam separados do layout, para o gerador entrar sem reescrever a emissão.

### 1.1 Modo avançado do certificado (decisão de 31/10/2026)

**Decisão:** o "modo avançado" é a **arte própria como fundo**, não um editor livre. O espaço manda a arte que já tem e o sistema desenha os textos por cima.

- **Plano:** tudo isso é **Pro** (parecer profissional é do Pro). Scale continua significando várias unidades; um gatilho de Scale dentro do certificado seria modelo por unidade ou marca da rede com o nome da unidade. Nada de addon avulso nem marketplace agora (ver doc 13, "Addons, marketplace e integrações").
- **Etapa 1, "Minha arte" (entregue em 31/10/2026):** 4º layout (`layout: "custom"`, `artwork` no modelo: `fileId`, `textPosition`, `ink`, `hidden`). Imagem PNG ou JPG, A4 deitado, até 2 MB (PDF não: o gerador de PDF não desenha PDF como imagem). Com a arte, o resto do editor continua igual (texto, variáveis, assinaturas, logo). Três ajustes, sem arrastar nada: **posição do texto** (em cima, no centro, embaixo), **cor do texto** (escura ou clara, para arte escura) e **partes que aparecem** (logo, nome do espaço, título, texto, data, assinaturas): quem tem arte com o título já impresso desliga o título. A cor de destaque não vale nesse layout. Prévia ao vivo, como nos outros. A tela (`CertificateSheet`) e o PDF (`certificate-pdf.tsx`) desenham a arte com `object-fit: cover`; o PDF lê a imagem pelo `loadSpaceImage` (só PNG e JPG da pasta do espaço). A arte sobe pelo caminho dos anexos (`uploadArtwork`, `CERTIFICATE_ARTWORK_RULES`). Em outro layout a arte é esquecida ao salvar.
- **Blocos arrastáveis (31/10/2026):** só em "Minha arte", a logo, o bloco do texto (nome do espaço, título, texto e data), as assinaturas e o QR com o código se arrastam na prévia (`artwork.logo|text|signatures|verification`, x e y em % da folha; ausente = lugar padrão: QR no canto inferior direito, os outros no fluxo). Bloco solto sai do fluxo, com a mesma largura que tinha no fluxo (70,56% da folha para texto e assinaturas). No primeiro arrasto, os outros blocos que ainda estavam no fluxo ganham a posição em que estão: nada pula quando um sai. Um clique sem arrastar (menos de 4 px) não muda nada. Tamanhos: `logoSize` (pequena, média, grande) e `qrSize` (pequeno, normal). Tela e PDF usam as mesmas posições; com o QR movido, as assinaturas não sobem. Fora: redimensionar arrastando, girar, fonte e separar título, data e nome do espaço. É a parte da etapa 2 que entrou.
- **Etapa 2, campos no lugar (só se um cliente pedir com caso concreto):** na prévia, cada bloco vira uma caixa que a pessoa arrasta e redimensiona, só no computador; fonte entre 3 ou 4 opções, tamanho e alinhamento por bloco.
- **Fora:** importar `.docx` ou `.pptx` para editar por dentro; editor de HTML ou de código.
- **Ordem do que falta:** nada da lista de 14/10; a etapa 2 (campos no lugar) só com pedido.

### 1.4 Emitir em lote (entregue em 31/10/2026)

No menu ⋮ da turma de curso terminada, "Emitir certificados" emite para todos os alunos com matrícula ativa (quem já tinha fica com o mesmo código) e abre um PDF só, uma folha por aluno, pelo servidor (`/api/documents/certificates/class/<turma>`). Na demonstração, e para quem prefere imprimir, a tela `/classes/<turma>/certificates` lista as folhas com quebra de página. Cancelados ficam de fora do PDF e da tela. Mesmo recorte e mesma guarda da emissão individual (`endedCourseOf`: plano, curso terminado e o professor só nas turmas dele).

### 1.3 Código de verificação (entregue em 31/10/2026)

- **Emissão registrada:** abrir o certificado pela primeira vez grava `issued_certificates` (migração 80): código, matrícula, aluno, curso e os dados daquele momento (`snapshot`); nas próximas aberturas o código é o mesmo e os dados não mudam, mesmo que a turma mude. Por isso `getCourseCertificate` virou gravação. Entra na auditoria ("emitiu o certificado de ...").
- **Código:** `GH-XXXX-XXXX`, 8 caracteres de um alfabeto sem 0, O, 1 e I (`newCertificateCode`, core). Sai no rodapé do certificado (tela e PDF) com "Confira em <endereço>" e um QR Code; a prévia do editor mostra um código de exemplo.
- **Página pública** `/p/certificado/<código>`: confirma que existe e vale, com nome do aluno mascarado ("Ana S."), curso, período, carga horária, frequência e emissão; cancelado diz que não vale; código desconhecido, "não encontrado". Só leitura, nada é gravado (doc product/24 §6). Fora dos buscadores.
- **Cancelar:** na tela do certificado, quem gere turmas cancela com confirmação (sem desfazer); o PDF e a impressão somem e a página passa a dizer "cancelado". Reemitir fica para o suporte (apagar o registro) até alguém pedir na tela.
- **Página para digitar o código** (`/p/certificado`, 31/10/2026): para quem não lê o QR; o rodapé traz o endereço curto embaixo do código. Aceita minúsculas e sem traços.
- **Prévia com aluno real** (31/10/2026): no editor, "Prévia com" troca os dados de exemplo por um concluído (`turmas.listCompletedEnrollments` e `previewCourseCertificate`, só leitura; o professor só vê os cursos dele). "Ver em PDF" segue a mesma escolha. A logo foi para dentro de Aparência.
- **Fora, por ora:** assinatura digital ICP-Brasil (caro e pouco pedido; a página resolve a confiança do dia a dia).

**"Ver em PDF" (31/10/2026):** ao lado da prévia, abre o PDF do modelo em edição com os dados de exemplo (`POST /api/documents/certificates/preview`, sem gravar; só conta real, porque o PDF sai do servidor). Logo e arte só as já salvas.

### 1.2 Modelo por modalidade (entregue em 31/10/2026)

Em Configurações → Certificado, o seletor **"Vale para"** troca entre o modelo do espaço e o de uma modalidade. Modalidade sem modelo próprio abre com o do espaço como ponto de partida; salvar grava o dela (`categories.certificate_template`, migração 79) e os cursos dela passam a sair com ele; as outras seguem com o do espaço. "Usar o modelo do espaço" apaga o da modalidade, com confirmação. Por modalidade, não por curso: a modalidade é estável e o curso pertence a uma; se um espaço pedir por curso, entra como exceção dentro da modalidade. A emissão (`getCourseCertificate`) escolhe o modelo pela modalidade da turma; o PDF segue o mesmo caminho.

### 1.5 Modelos prontos por área e editor mais simples (entregue em 31/10/2026)

Decisão com o usuário (31/10/2026), a partir de dois problemas: as variáveis `{aluno}` pareciam coisa para digitar à mão, e a tela abria tudo de uma vez, sem ponto de partida.

- **Modelo pronto por área** (`CERTIFICATE_PRESETS` em `@gestarahub/core/certificate`, um por área de `business-segment-presets` mais o "Padrão"): layout, cor, título, texto e o cargo de quem assina pelo espaço. O título e o texto são no tom de cada área (lutas falam de disciplina e treino; gastronomia, de técnicas e receitas; idiomas, formal e com aproveitamento), não só o visual. O professor assina com a palavra do espaço (`teacherTitle`). **O espaço que nunca salvou o próprio modelo já emite com o da sua área** (`defaultCertificateTemplate(teacherTitle, classSegment)`; sem área, o genérico de sempre). "Outra área" usa o genérico.
- **Galeria "Comece por um modelo"** no topo da coluna do editor: um cartão por área com a miniatura da folha de verdade (com a logo do espaço), a área do espaço primeiro e marcada como "Sua área". Um clique preenche layout, cor, título, texto, frequência e cargos; logo e arte ficam. Depois de salvar, o bloco vira "Modelos prontos" e fica recolhido. O cartão marcado é o modelo que o formulário reproduz agora (`matchingCertificatePreset`); ajustou à mão, nenhum fica marcado.
- **Variáveis no texto** (`TokenTextArea` em `@/components/form`): as conhecidas aparecem destacadas dentro do campo e as desconhecidas em vermelho; digitar `{` abre a lista para escolher (setas, Enter ou Tab inserem; Escape fecha); os chips viraram botões "Inserir no texto". O campo escreve transparente sobre um fundo com a mesma fonte: cursor, seleção e rolagem continuam do navegador.
- **Blocos recolhidos:** Aparência, Texto e Assinaturas abrem pelo título (acordeão, vários abertos ao mesmo tempo), cada um com uma linha de dica. Erro ao salvar ou ao gerar o PDF abre o bloco do campo com erro. "Minha arte" segue em Aparência; o cartão "Arte de fundo" aparece ao escolhê-lo.
- **"Como funciona?"** ao lado de "Vale para" abre a ajuda, que já traz os artigos desta tela com "Me mostre na tela".
- "Voltar ao texto padrão" volta ao texto da área do espaço.

### 1.6 Certificado de graduação (entregue em 31/10/2026)

Problema: o certificado só existe para turma de curso (início, fim, aulas, frequência). Lutas, dança, música e natação vivem de mensalidade e graduação por faixa, nível, módulo ou fase, e para a graduação o sistema não emite nada: o "Graduar/Avançar" grava o registro na evolução do aluno (`promotionHistory`: etapa anterior e nova, grau, data, exame, examinador, observações) e para por aí.

Decisões (31/10/2026, com o usuário):

- **Segundo tipo de certificado, "Graduação"**, ao lado do de curso. Nasce do registro de graduação do aluno (no máximo um certificado por registro), não da turma. Só em modalidade com trilha ligada; recurso Pro (`certificates`), como o de curso.
- **Emissão sob demanda:** na evolução do aluno, cada graduação do histórico ganha "Certificado" no menu ⋮; depois de Graduar/Avançar, o aviso de sucesso oferece "Ver certificado". O código nasce na primeira abertura, como no curso. Nada é emitido sozinho.
- **Variáveis próprias:** `{aluno}`, `{modalidade}`, `{etapa}` (com a palavra da trilha: "Faixa Azul", "Nível 2", "Módulo 3"), `{etapa_anterior}`, `{grau}` (só trilha de faixas: "2º grau"; vazio sai do texto), `{data}` (data da graduação), `{professor}`, `{empresa}`, `{cidade}`. Sem curso, aulas, frequência e carga horária.
- **`{professor}`** é o examinador informado no Graduar; sem ele, o professor da turma do aluno naquela modalidade; sem turma, vazio (o trecho sai).
- **Modelo separado, com galeria própria:** na aba Certificado, uma escolha no topo entre "Conclusão de curso" e "Graduação" (`PageTabs` ou segmento), cada um com seu modelo, seu "Vale para" por modalidade e seus modelos prontos. Guarda em `organizations.graduation_certificate_template` e `categories.graduation_certificate_template` (mesmo formato `CertificateTemplate`). Presets de graduação por área: lutas ("Certificamos que {aluno} foi graduado à {etapa} de {modalidade} em {data}..."), dança, natação, idiomas e música (nível, módulo ou fase), gastronomia, artes e beleza (módulo); "Padrão" genérico. A galeria e o editor são os mesmos componentes, com o conjunto de variáveis do tipo.
- **Verificação igual:** `issued_certificates` ganha `kind` (`course` | `graduation`) e `promotion_id` (id do registro no histórico; único por organização). A página pública mostra "Graduação: Faixa Azul de Jiu-Jitsu em 12/09/2026" no lugar de curso e período, com o nome do aluno mascarado como hoje. Cancelar funciona igual.
- **PDF e impressão:** mesma folha (`CertificateSheet`) e mesmo PDF, com o texto do modelo de graduação; rota `/api/documents/certificates/graduation/<promotionId>`; tela `/clients/<id>/graduation-certificate/<promotionId>` (ou dentro da evolução), com "Baixar PDF" e "Cancelar certificado".
- **Lote por exame** (todos que graduaram no mesmo dia num PDF só): segunda etapa, depois do individual rodar (anotado em `docs/pendencias.md`).

Fora desta etapa: certificado no acesso do aluno (portal), assinatura em imagem, kids.

**Como ficou (31/10/2026):** `CertificateKind` (`course` | `graduation`) nos contratos; `GraduationCertificate` (dados), `GRADUATION_CERTIFICATE_VARIABLES`, `buildGraduationCertificate`, `GRADUATION_CERTIFICATE_PRESETS` e `validateCertificateTemplate(template, kind)` no core (`renderCertificate` aceita os dois tipos). Migração 81: `organizations.graduation_certificate_template`, `categories.graduation_certificate_template`, e em `issued_certificates` as colunas `kind`, `promotion_id` e `modality_id` (matrícula e turma viram opcionais; um certificado por registro). Serviço `graduationCertificateService` (namespace `clients`: `listGraduations`, `previewGraduationCertificate`, `getGraduationCertificate`, `cancelGraduationCertificate`), `certificatesService` com o `kind` em `getTemplate`, `saveTemplate`, `removeModalityTemplate` e `listModalitiesWithOwnTemplate`. Tela `/clients/<id>/graduation-certificate/<promotionId>`, PDF em `/api/documents/certificates/graduation/<aluno>/<registro>`, "Ver em PDF" com `kind`. Na graduação do aluno (diálogo Graduação), cada registro ganha o link "Certificado" e o aviso do Graduar oferece "Ver certificado". Em Configurações, a aba Certificado abre com "Conclusão de curso | Graduação"; "Vale para", galeria, "Prévia com" (graduações registradas) e variáveis seguem o tipo. Página pública mostra "Graduação", "Vinha de" e "Graduado em".

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

**Código:** regras puras em `packages/core/src/grades.ts` (testes em `packages/core/test/grades.test.ts`); contratos em `packages/contracts/src/assessment.ts`; serviço `apps/web/src/services/grades/` (testes em `services/__tests__/grades.test.ts`); tela em `apps/web/src/features/grades`.

**Fase 2 (não entrou):** recuperação e segunda chamada (maior nota), nota como critério da trilha, `{nota}` no certificado, boletim em PDF, relatórios de desempenho e aviso "nota lançada" no WhatsApp.

### 2.3 Fase A entregue (31/10/2026)

Revisão da seção de avaliações da modalidade, pedida pelo usuário: as quatro escalas cobriam a prova com nota, mas faltavam soma de pontos, recuperação e frequência mínima. Aprovado com a fase B (testes e medidas, seção 2.4) para depois.

- **Escala:** "Apto" virou "Apto ou não".
- **Como fecha o resultado** (`ModalityAssessmentSettings.resultMode`), só nas escalas 0 a 10 e 0 a 100:
  - "Média com pesos" (padrão, como antes);
  - "Soma dos pontos": cada avaliação diz quanto vale (`Assessment.points`, coluna `points`, até o topo da escala); a nota vai de 0 ao que ela vale; o resultado é o total, até o topo ("Total 7,5 de 10"). A mínima vira "Total mínimo para aprovar".
  - O vermelho da soma segue o ritmo: o total contra os pontos já dados (3 de 3 não fica vermelho só porque faltam provas). Uma avaliação sozinha fica vermelha pela proporção do que vale. Faltou conta nos pontos dados (vale zero).
- **Recuperação** (`Assessment.recoveryOf`, coluna `recovery_of`): ao criar uma avaliação, "Recuperação de (opcional)" escolhe outra avaliação da turma que não seja recuperação e ainda não tenha uma. Vale a maior nota de cada aluno; quem faltou na original fica com a da recuperação (segunda chamada). A recuperação herda peso, pontos e etapa, não entra sozinha na conta e aparece no boletim marcada; a original mostra "Vale 7 pela recuperação". O lançamento da recuperação mostra a nota original de cada aluno. Excluir a original leva a recuperação junto.
- **Frequência mínima** (`minAttendancePercent`, 1 a 100, opcional): o boletim mostra a frequência do aluno nas turmas da modalidade (presenças sobre presenças e faltas) e se ficou abaixo. A situação aparece como "Nota acima/abaixo da mínima" e "Frequência X%", e não como "Aprovado", porque o boletim é ao vivo e o período pode não ter acabado.
- **Boletim em PDF:** mesmas regras ("Total ... de 10", coluna "Vale", recuperação no nome e "4 → 7" na nota, frequência no resumo). A coluna do peso deixou de arredondar (peso 1,5 aparecia como 2).
- **Código:** regras puras em `packages/core/src/grades.ts` (`resultOf`, `assessmentAverage`, `withRecovery`, `isGradeBelowPassing`, `validatePoints`, `validateMinAttendance`); serviço `services/grades/gradeRules.ts` (`effectiveItems`, `pointsOf`, `modalityAttendancePercent`); migração 72; testes em `packages/core/test/grades.test.ts`, `services/__tests__/grades-sum-recovery.test.ts` e e2e `notas` (fase A).

### 2.4 Fase B entregue: testes e medidas (31/10/2026)

Para funcional e crossfit, pilates e yoga, natação e esportes, que não tinham onde registrar a evolução em números.

- **Modalidade** (`Category.measurements`, coluna jsonb `categories.measurements`): "Esta modalidade tem testes e medidas" e a lista de medidas, cada uma com nome, unidade (opcional, até 10 caracteres) e "Melhor subir" ou "Melhor descer". Até 20 medidas, sem nome repetido; ligada pede pelo menos uma. Sugestões pela área (`measureSuggestionsFor`): funcional (peso, gordura, cintura, flexões em 1 min, prancha), pilates (flexibilidade, dor de 0 a 10, peso, prancha), natação (25 m e 50 m crawl, 25 m costas, apneia); as outras áreas, uma lista geral. Não liga sozinha em nenhuma área. As medidas novas ganham id no servidor; as que já existiam guardam o id, então renomear não perde a história.
- **Avaliação do aluno** (`StudentMeasurement`, tabela `student_measurements`): data (até hoje), valor por medida (número com até duas casas, pode ser negativo; vazio = não medido; pelo menos uma) e observação. É por aluno numa modalidade, não por turma.
- **Tela "Testes e medidas"** (painel lateral): por modalidade com medidas em que o aluno tem turma ativa ou alguma avaliação. Cada medida mostra a última, "antes X" e a mudança, verde quando melhora pela direção da medida e vermelha quando piora; abaixo, o histórico com editar e excluir (com confirmação). Entra pelo menu do aluno em Alunos e pelo botão "Testes e medidas" na Evolução da ficha, que aparece mesmo sem trilha (pilates e funcional costumam não ter).
- **Permissão:** gravar pede `progression:manage`, como a evolução: dono e gerente em todos os alunos; o professor só nos alunos das turmas dele na modalidade (`assertCanManageProgression`). Ver: o professor só os alunos das turmas dele. Atendente vê, não registra.
- **Banco:** migração 73 (tabela, leitura só do próprio espaço, escrita só pelo servidor, duas etapas exigidas), 74 (a tabela entra na lista de gravação do mundo, `apply_world_changes`) e 75 (entra na exportação dos dados do espaço). Peso e gordura são dado de saúde: ver doc 24, seção 3.1.
- **Auditoria:** "registrou", "editou" e "excluiu testes e medidas de {aluno} · {modalidade}" (tipo "Testes e medidas").
- **Código:** regras em `packages/core/src/measurements.ts` (`validateMeasures`, `normalizeMeasureValue`, `measureProgress`, formato); serviço `apps/web/src/services/measurements`; tela `apps/web/src/features/measurements`; testes em `packages/core/test/measurements.test.ts`, `services/__tests__/measurements.test.ts`, no fluxo de banco e no e2e `medidas`.

## Texto padrão do certificado (24/10/2026)

O padrão diz "... de {inicio} a {fim}, que teve {aulas}, com frequência de {frequencia}." — as aulas são as do curso e a frequência é a real do aluno. "Concluído" segue pelo calendário do curso (frequência mínima fica para quando um espaço pedir). A assinatura usa a palavra da área (Instrutor ou Professor).
