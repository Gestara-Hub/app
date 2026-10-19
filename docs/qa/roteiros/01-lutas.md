# Roteiro 01: Lutas (completo)

**Área:** Lutas.

**Cobre:**
- configuração inicial e primeiros passos (boas-vindas, tour, checklist, destaques, revisão das modalidades);
- modalidades com trilha de faixas (faixas por idade e graus);
- planos de mensalidade nas **3 periodicidades** (Mensal, Quinzenal e Semanal), validações, edição e inativação;
- catálogo de **pacotes de aulas** (todas as turmas vs. turma específica, com e sem validade, falta consumindo ou não, inativação);
- equipe e cargos;
- turmas nos **3 modos de cobrança** (Mensalidade, Pacote de aulas e Sem cobrança), validações, conflito de horário, capacidade, mudança de horário, desativar e reativar;
- alunos (cadastro completo, telefone de outro país, duplicado, menor com responsável, descontos percentual e fixo com validade, bolsa parcial e integral, regra personalizada de cobrança);
- venda de pacotes (no cadastro do aluno e pelo menu `⋮`, à vista e parcelado, vencimento no passado, renovação com transferência de saldo e cancelamento);
- matrícula, escolha "Pagar com mensalidade vs. Pacote", lista de espera e promoção;
- chamada completa (mensalidade e pacote: consumo na presença, falta que gasta vs. não gasta, falta justificada e desmarcar devolvendo saldo, "Última aula do pacote", "Sem pacote"), inscrição na aula via Avulsa, Pacote e Experimental;
- tela de Cobranças completa (mensal, quinzenal, semanal agrupado, pacotes, avulsas, pagar com comprovante, desfazer, cancelar e reabrir, todos os atrasos, pausa e troca de plano);
- registro da aula, registros por aluno (metas, pontos fortes, "Para hoje"), graduação e ponto de partida;
- troca de instrutor e calendário;
- perfis de acesso (Gerente, Atendente e Professor);
- Auditoria.

Comece do zero (ver [README](README.md)). Anote a **data de hoje** e o **dia da semana**.

Legenda: **Fazer** é a ação; **Esperado** é o que deve aparecer. Anote cada divergência com o número do passo.

---

## Parte A. Configuração inicial

### A1. Assistente

- [ ] **1.** Você deve estar em "Como se chama o seu espaço?" (1 de 3).
- [ ] **2.** Clique em **Continuar** com o nome vazio.
   - Esperado: "Informe o nome do espaço."
- [ ] **3.** Digite **Academia Tatame**.
   - Esperado: prévia "Assim aparece no topo: Academia Tatame".
- [ ] **4.** Clique em "Tenho mais de um endereço" e preencha a unidade **Centro**.
- [ ] **5.** Aperte **Enter**.
   - Esperado: vai para o passo 2 ("O que você ensina?"), com "2 de 3".
- [ ] **6.** Recarregue a página (F5).
   - Esperado: continua no passo 2, com o nome guardado.
- [ ] **7.** Na lista de áreas, use as setas do teclado: o foco anda pelas áreas. Home vai para a primeira e End para "Outra área".
- [ ] **8.** Clique em **Lutas**.
   - Esperado: avança sozinho para o passo 3.
- [ ] **9.** Passo 3:
   - Esperado: "Aulas de Lutas · Seus alunos avançam por faixas e graus. Dá para trocar depois.", com **Jiu-Jitsu** e **Muay Thai** marcados e "2 selecionadas".
- [ ] **10.** Desmarque e marque o Muay Thai de novo.
- [ ] **11.** Em "Não encontrou sua aula?", digite **jiu-jitsu** e clique em Adicionar.
    - Esperado: não cria outro chip (já existe); o Jiu-Jitsu continua marcado.
- [ ] **12.** Adicione **Defesa Pessoal**.
    - Esperado: o chip novo aparece marcado, com o "x" de remover. Remova-o e adicione de novo.
- [ ] **13.** Clique em **Voltar**, depois de novo em Lutas.
    - Esperado: os chips continuam como estavam.
- [ ] **14.** Clique em **Concluir**.
    - Esperado: vai para o Painel.

### A2. Boas-vindas e tour

- [ ] **1.** Esperado no Painel:
   - diálogo "Bem-vindo ao GestaraHub", com o selo "Turmas e aulas";
   - o diálogo não fecha com Esc nem com clique fora.
- [ ] **2.** Clique em **Fazer o tour guiado**. Percorra com "Próximo" e "Voltar".
   - Esperado: passos "Operação diária", "Financeiro", "Cadastros", "Configurações" (citando "regras da mensalidade") e "Primeiros passos".
- [ ] **3.** Clique em Concluir.
- [ ] **4.** No topo do checklist, clique em **Fazer tour guiado** de novo e feche no X ("Fechar tour").

### A3. Checklist "Primeiros passos"

- [ ] **1.** Esperado: cabeçalho "Primeiros passos", "0 de N concluídos" e "~5 minutos". As fases são:
   - "Fase 1: Configuração";
   - "Fase 2: Pessoas";
   - "Fase 3: Turmas e matrículas".
- [ ] **2.** Esperado: a etapa "Cadastrar modalidades" aparece com o selo **Falta revisar** (Lutas tem trilha).
- [ ] **3.** Esperado: "Criar a primeira turma" aparece travada, com "Requer: ...".
- [ ] **4.** Abra uma tela qualquer pelo menu (ex.: Alunos).
   - Esperado: faixa no topo "Configuração inicial · 1 de N", com "Continuar" pulsando.

### A4. Horários

- [ ] **1.** Clique em **Continuar** na faixa do topo.
   - Esperado: Configurações > Horários.
- [ ] **2.** Clique em **Salvar horários** sem nenhum dia ligado.
   - Esperado: "Ligue pelo menos um dia antes de salvar."
- [ ] **3.** Clique em **Todos os dias**.
- [ ] **4.** Abra **Editar** de Sábado:
   - [ ] **1.** Deixe dois turnos: 08:00 às 12:00 e 12:00 às 16:00 (encostar é permitido).
   - [ ] **2.** Tente um terceiro turno que sobrepõe.
      - Esperado: "Os turnos não podem se sobrepor."
   - [ ] **3.** Remova o terceiro e clique em Aplicar.
- [ ] **5.** Abra **Editar** de Segunda e marque "Aplicar também a" Terça.
   - Esperado: toast "Horários aplicados também a ...".
- [ ] **6.** Deixe todos os dias abertos das **06:00 às 22:00**, incluindo hoje (pode manter o Sábado em dois turnos das 06:00 às 12:00 e 12:00 às 22:00). Clique em Salvar horários.
   - Esperado: "Horários de funcionamento salvos." e a faixa avisa "Etapa concluída! Siga para a próxima."

### A5. Regras da mensalidade

- [ ] **1.** Siga a faixa até Configurações > Geral > Regras da mensalidade.
   - Esperado:
     - "Este é o modelo mais comum. Se servir para você, é só confirmar.";
     - "● Falta confirmar";
     - o botão **Confirmar regras recomendadas** tremendo.
- [ ] **2.** Teste no simulador as 4 combinações (sem salvar ainda):
   - **Antecipado + Proporcional**: 1ª no dia 20 proporcional aos dias que faltam; 2ª dia 10 do mês que vem, R$ 150,00;
   - **Antecipado + Mês cheio**: 1ª no dia 20, R$ 150,00 (de 20 a 19 do mês que vem); dia de vencimento vira "Automático (dia da matrícula)";
   - **Depois do uso + Proporcional**: nada neste mês; 1ª dia 10 do mês que vem, proporcional;
   - **Depois do uso + Mês cheio**: 1ª dia 20 do mês que vem, R$ 150,00.
- [ ] **3.** Volte para **Antecipado + Proporcional**, teste o dia **31** (aviso "Nos meses mais curtos, vence no último dia") e o dia **32** (erro "Use um dia de 1 a 31.").
- [ ] **4.** Volte o dia do vencimento para **10** e clique em **Confirmar regras recomendadas**.
   - Esperado: "Regras da mensalidade confirmadas com sucesso."

### A6. Revisar modalidades

- [ ] **1.** Siga a faixa até Modalidades.
   - Esperado: aviso "Confira as modalidades e confirme" e o botão **Está tudo certo** na faixa.
- [ ] **2.** Abra **Jiu-Jitsu** em Editar e confira:
   - trilha de faixas com as infantis (Branca, Cinza, Amarela, Laranja, Verde, com idade) e as adultas (Azul em diante);
   - graus por faixa.
- [ ] **3.** Feche sem salvar e clique em **Está tudo certo**.
   - Esperado: "Modalidades revisadas."

### A7. Nova modalidade e regras do formulário

- [ ] **1.** Clique em **+ Nova modalidade** e salve com o nome **muay thai**.
   - Esperado: "Já existe uma modalidade com esse nome."
- [ ] **2.** Crie **Boxe**:
   - desligue a trilha;
   - Esperado: as avaliações ficam desligadas por padrão em Lutas.
- [ ] **3.** Edite o **Muay Thai** > Personalizar:
   - [ ] **1.** Remova uma faixa que ninguém usa e salve.
   - [ ] **2.** Troque o "Modelo".
      - Esperado: confirmação "Trocar o modelo da trilha?". Clique em Voltar.
- [ ] **4.** Inative o **Boxe**.
   - Esperado: "Inativar modalidade?" sem citar turmas.
- [ ] **5.** Reative o Boxe.

### A8. Planos e pacotes (mensal, quinzenal, semanal e catálogo de pacotes)

#### A8.1. Aba Planos de mensalidade

- [ ] **1.** Siga a faixa do topo até **Planos e pacotes** (`/classes/plans`).
- [ ] **2.** Clique em **+ Novo plano** e tente salvar vazio / com valor R$ 0,00.
   - Esperado: erro de nome obrigatório e `"Informe um valor maior que zero."`
- [ ] **3.** Crie os planos cobrindo todas as periodicidades:

   | Nome | Periodicidade | Valor | Esperado na lista |
   |---|---|---|---|
   | **Mensal Jiu-Jitsu** | Mensal | **R$ 180,00** | selo `Mensal` e `R$ 180,00/mês` |
   | **Muay Thai Quinzenal** | Quinzenal | **R$ 110,00** | selo `Quinzenal` e `R$ 110,00/quinzena` |
   | **Defesa Pessoal Semanal** | Semanal | **R$ 60,00** | selo `Semanal` e `R$ 60,00/semana` |
   | **Plano Antigo** | Mensal | **R$ 150,00** | selo `Mensal` e `R$ 150,00/mês` |

- [ ] **4.** No `⋮` do **Plano Antigo**, clique em **Inativar**.
   - Esperado: diálogo `"Inativar plano?"` explicando que quem já tem o plano continua sendo cobrado. Confirme.
- [ ] **5.** Teste o filtro de situação (**Ativos**, **Inativos**, **Todos**), reative o **Plano Antigo** e inative-o novamente (para confirmar em C1 que plano inativo não aparece no cadastro de aluno).

#### A8.2. Aba Pacotes de aulas

- [ ] **1.** Mude para a aba **Pacotes de aulas**.
   - Esperado antes do primeiro: estado vazio `"Nenhum pacote de aulas ainda."`
- [ ] **2.** Clique em **+ Novo pacote** e salve vazio.
   - Esperado: `"Informe o nome"`, erro na quantidade de aulas e no valor.
- [ ] **3.** Crie os seguintes pacotes no catálogo (o pacote restrito a uma turma específica será criado em `B4`, logo após criar as turmas):

   | Nome | Aulas | Valor | Validade | Turmas | Falta sem justificativa gasta a aula |
   |---|---|---|---|---|---|
   | **Pacote 10 aulas Livre** | 10 | **R$ 400,00** | 60 dias | nenhuma ("Todas as turmas") | **ligado** |
   | **Aula única** | 1 | **R$ 50,00** | Sem validade | nenhuma ("Todas as turmas") | **ligado** |
   | **Pacote Antigo** | 8 | **R$ 300,00** | 90 dias | nenhuma ("Todas as turmas") | **ligado** |

- [ ] **4.** Esperado: cada linha/cartão mostra `"N aulas · vale N dias"` (ou `"Sem validade"`) e `"Todas as turmas"`.
- [ ] **5.** No `⋮` do **Pacote Antigo**, clique em **Inativar**, confira o filtro de inativos, reative e inative de novo.

### A9. Equipe e cargos

- [ ] **1.** Siga a faixa até Equipe > **Cargos**: crie **Professor** e **Mestre**.
- [ ] **2.** **Novo profissional** sem modalidade.
   - Esperado: "Selecione ao menos uma modalidade que o profissional leciona."
- [ ] **3.** Crie:
   - **Carlos Silva**: cargo Mestre, Jiu-Jitsu, Muay Thai e Defesa Pessoal, telefone (11) 91111-1111;
   - **Rafael Costa**: cargo Professor, Muay Thai e Boxe, telefone (11) 92222-2222.
- [ ] **4.** Crie **Bruno Teste** e inative-o.
   - Esperado: "Inativar profissional?" explica que as turmas atuais mantêm o instrutor.

---

## Parte B. Turmas (Mensalidade, Pacote e Sem cobrança)

### B1. Validações do formulário

Turmas > **+ Nova turma**. Clique em Adicionar vazio.

Esperado:
- "Informe o nome da turma.";
- "Selecione a modalidade da turma.";
- "Selecione o instrutor.";
- "Marque ao menos um dia de encontro."

### B2. Criar turmas

Crie todas com encontro **hoje** (dia da semana atual):

| Nome | Modalidade | Professor | Vagas | Encontros | Cobrança | Avulso |
|---|---|---|---|---|---|---|
| **Jiu-Jitsu Adulto** | Jiu-Jitsu | Carlos Silva | 3 | hoje, 19:00 às 20:30 | Mensalidade | desligado |
| **Jiu-Jitsu Kids** | Jiu-Jitsu | Carlos Silva | 15 | hoje, 17:00 às 18:00 | Mensalidade | **ligado (R$ 40,00)** |
| **Muay Thai Noite** | Muay Thai | Rafael Costa | 10 | hoje, 20:30 às 21:30 | Mensalidade | desligado |
| **Defesa Pessoal Pacote** | Defesa Pessoal | Carlos Silva | 10 | hoje, 18:00 às 19:00 | **Pacote de aulas** | **ligado (R$ 55,00)** |
| **Treino Livre Boxe** | Boxe | Rafael Costa | 20 | hoje, 16:00 às 17:00 | **Sem cobrança** | — |

Testes durante a criação:
- Ao escolher a modalidade Muay Thai, o professor deve filtrar apenas os que ensinam Muay Thai.
- A capacidade **3** da Jiu-Jitsu Adulto é proposital (testa lotação).
- Com Carlos já na Adulto às 19:00, tente criar uma turma de **Carlos** hoje das **19:30 às 20:00**.
  - Esperado: `"Carlos Silva já dá aula ... na turma "Jiu-Jitsu Adulto". Escolha outro horário ou outro professor."`
- Uma turma das **18:00 às 19:00** (encostando no início da 19:00) é permitida.
- Esperado depois de criar: toast `Turma "X" criada com sucesso.` com o botão "Matricular alunos".

### B3. Lista de turmas

- [ ] **1.** Esperado: cada linha mostra `"0 de N alunos"`, o horário, o modo de cobrança (nas de pacote/sem cobrança) e o professor, sem o selo "Ativo".
- [ ] **2.** Busque `"kids"`. Filtre `"Inativas"` (vazio) e volte para `"Ativas"`.

### B4. Pacote restrito a turma específica e sem consumir na falta

- [ ] **1.** Volte em **Planos e pacotes > aba Pacotes de aulas > + Novo pacote** e crie:
   - Nome: **Pacote 4 aulas Defesa**, Quantidade: **4**, Valor: **R$ 180,00**, Validade: **30 dias**;
   - Turmas permitidas: selecione **apenas Defesa Pessoal Pacote**;
   - **Desligue** `"Falta sem justificativa gasta a aula"`.
- [ ] **2.** Esperado: o cartão mostra `"4 aulas · vale 30 dias"` e o vínculo com `"Defesa Pessoal Pacote"`.
- [ ] **3.** Busque `"defesa"` na aba de pacotes: filtra apenas o **Pacote 4 aulas Defesa**. Limpe a busca.

---

## Parte C. Alunos, Periodicidades, Bolsas, Descontos e Venda de Pacotes

### C1. Validações e cadastro completo de alunos

Alunos > **Novo aluno**. Clique em Adicionar vazio.
- Esperado: `"Informe o nome."` e `"Informe o telefone."`
- Confira na lista de planos que o **Plano Antigo** (inativo) **não** aparece.

Testes de validação no formulário antes de salvar:
- [ ] **1.** Data de nascimento de amanhã → `"A data de nascimento não pode ser futura."`
- [ ] **2.** Ano 1900 → `"Confira o ano de nascimento."`
- [ ] **3.** Observações com mais de 1000 caracteres → o campo trava em 1000.
- [ ] **4.** Desconto percentual de 120% → `"O desconto percentual não pode ser superior a 100%."`
- [ ] **5.** Desconto fixo de R$ 250,00 no plano de R$ 180,00 → `"O desconto passa do valor do plano (R$ 180,00)."`
- [ ] **6.** Bolsa parcial de 100% → `"Use de 1% a 99%. Para 100%, escolha bolsa integral."`
- [ ] **7.** 1ª cobrança vazia → `"Informe o valor da 1ª cobrança."`
- [ ] **8.** 1ª cobrança R$ 0,00 (com cálculo > 0) → `"Use um valor maior que zero. Para não cobrar, use desconto ou bolsa."`

Agora cadastre os **8 alunos** abaixo para cobrir todos os cenários de planos, bolsas, descontos e pacotes:

| Nome | Nascimento | Telefone | Como paga | Configuração financeira no cadastro | Esperado no formulário |
|---|---|---|---|---|---|
| **Lucas Ferreira** | 12/05/1995 | (11) 98123-4567 | Paga mensalidade | **Mensal Jiu-Jitsu** (R$ 180,00) | `"Regra do espaço: Antecipado · Proporcional"`, 1ª proporcional vencendo hoje, `"Próxima: dia 10 do mês que vem"` |
| **Ana Souza** | 03/09/1990 | (11) 97654-3210 | Paga mensalidade | **Mensal Jiu-Jitsu**, desconto **10%** | `"Plano R$ 180,00 → paga R$ 162,00."` |
| **Pedro Alves** | 20/03/2016 | (11) 96543-2109 | Paga mensalidade | **Muay Thai Quinzenal** (R$ 110,00) + Responsável **Marta Alves** (`+ Mãe`, (11) 96543-0000) | Aviso `"Menor de idade: cadastre um responsável abaixo."` e `"Vence nos dias 10 e 25 de cada mês."` |
| **Júlia Torres** | 08/11/2001 | `+1 415 555 2671` (teste buscar `"Estados"` ou `"+1"` no seletor de DDI, ou colar com `+1`) | Paga mensalidade | **Defesa Pessoal Semanal** (R$ 60,00) | Seletor de DDI filtra por país/código (e colar `+1...` também troca para EUA); sem campo de dia fixo: `"Vence a cada 7 dias, contando da matrícula."` |
| **Marcos Lima** | 30/06/1988 | (11) 95555-0000 | **Bolsista (Parcial)** | **Mensal Jiu-Jitsu**, bolsa **50%**, motivo `+ Atleta` (ou `+ Social`) | `"Plano R$ 180,00 → paga R$ 90,00 (bolsa de 50%)."` |
| **Carla Mendes** | 15/07/1993 | (11) 94444-1111 | **Bolsista (Integral)** | Sem plano de referência (ou Mensal Jiu-Jitsu) | `"As mensalidades aparecem como Isento, sem cobrança."` |
| **Bruno Rocha** | 22/01/1992 | (11) 94444-2222 | Paga mensalidade | **Mensal Jiu-Jitsu**, desconto **fixo R$ 30,00** válido até o fim do mês que vem + **"Personalizar regra deste aluno"**: Depois do uso + Mês cheio | `"Plano R$ 180,00 → paga R$ 150,00."` e 1ª mensalidade só no mês que vem |
| **Diego Nunes** | 10/10/1996 | (11) 94444-3333 | **Pacote de aulas** | Vender no cadastro o pacote **Pacote 10 aulas Livre** (R$ 400,00), **À vista** | Cria o aluno e já vende o pacote (`"Pacote vendido."`) |

Teste de telefone duplicado:
- Clique em **Novo aluno**, digite **Lucas F.** com o telefone do Lucas `(11) 98123-4567` e tente salvar.
  - Esperado: `"Telefone já cadastrado"` (`"O telefone já é de Lucas Ferreira. Cadastrar mesmo assim?"`). Clique em **Voltar** e cancele.

### C2. Venda de pacotes avulsos, parcelados e vencimento no passado

- [ ] **1.** Na lista de alunos, abra o `⋮` do **Diego Nunes** > **Vender pacote**:
   - Confira que o **Pacote Antigo** (inativo) não aparece.
   - Escolha **Pacote 4 aulas Defesa** (R$ 180,00), à vista, com 1º vencimento **ontem**.
   - Esperado: aviso `"O 1º vencimento é dd/MM/aaaa e já entra atrasado."`, confirmação `"Vencimento no passado?"` > **Vender assim** e aviso de que o **Pacote 10 aulas Livre** continua valendo em paralelo.
- [ ] **2.** No `⋮` da **Carla Mendes** > **Vender pacote**:
   - Escolha **Aula única** (R$ 50,00, sem validade), à vista, vencimento hoje.
   - Esperado: `"Pacote vendido."`
- [ ] **3.** No `⋮` do **Lucas Ferreira** > **Vender pacote**:
   - Escolha **Pacote 10 aulas Livre** (R$ 400,00), **Parcelas: 2x** (2x de R$ 200,00), 1º vencimento hoje.
   - Esperado: `"Pacote vendido."` (Lucas agora tem plano mensal **e** pacote ativo).

### C3. Lista de alunos

- [ ] **1.** Esperado na lista:
   - selos `"Definir faixa"` (tracejado) nos alunos de modalidades com faixa;
   - selos de plano (`"Mensal Jiu-Jitsu · R$ 180,00/mês"`, `"Muay Thai Quinzenal · R$ 110,00/quinzena"`, `"Defesa Pessoal Semanal · R$ 60,00/semana"`, Ana com `"-10%"`, Marcos com `"Bolsa 50%"`, Carla com `"Bolsista"`);
   - selos de pacote no Diego (`"Restam 4 de 4"` / `"Restam 10 de 10"`), Lucas (`"Restam 10 de 10"`) e Carla (`"Última aula"`).
- [ ] **2.** Busque pelo telefone `"98123"` (Lucas). Limpe a busca.
- [ ] **3.** Troque a visualização para **Cartões** e volte para **Lista**.
- [ ] **4.** Confira no menu `⋮` de um aluno: `"Abrir ficha"`, `"Enviar WhatsApp"`, `"Registros de aula"`, `"Graduação"`, `"Nova cobrança"`, `"Vender pacote"`, `"Editar cadastro"`, `"Inativar"`.

---

## Parte D. Matrícula, escolha Mensalidade vs. Pacote, capacidade e lista de espera

- [ ] **1.** **Jiu-Jitsu Adulto** (capacidade 3, cobrança Mensalidade) > **Matricular alunos**:
   - [ ] **1.** Selecione **Lucas**, **Ana** e **Júlia**.
      - Esperado: `"3 de 3 vagas"` e botão `"Matricular 3 alunos"`.
      - Como o **Lucas** tem plano mensal **e** pacote válido, aparece o bloco **"Como paga esta turma"**: deixe o Lucas em **Mensalidade**.
   - [ ] **2.** Matricule os 3.
- [ ] **2.** Abra de novo **Matricular alunos** na **Jiu-Jitsu Adulto**:
   - Esperado: `"turma lotada"` e aviso `"A turma atingiu a capacidade (3 vagas). Você pode pôr os selecionados na lista de espera ou matricular acima da capacidade."`;
   - Lucas, Ana e Júlia aparecem como `"já matriculado"`.
- [ ] **3.** Selecione **Marcos** e clique em **Pôr na lista de espera**.
   - Esperado: `"Adicionado à lista de espera."` e a aba `"Lista de espera 1"`.
- [ ] **4.** Matricule o **Pedro** na Adulto com **Matricular mesmo assim (1)** (teste de lotação).
   - Esperado: o cabeçalho mostra `"Turma lotada"`.
- [ ] **5.** Cancele a matrícula do **Pedro** na Adulto pelo `⋮`.
   - Esperado: `"Cancelar matrícula?"` com `"... As cobranças do aluno não mudam."`
- [ ] **6.** Na aba **Lista de espera**, clique em **Promover** do **Marcos**.
   - Esperado: `"Promover da lista de espera?"`, depois `"Aluno promovido para matrícula."` A aba some quando a lista esvazia.
- [ ] **7.** Na **Muay Thai Noite**, ponha o **Marcos** na lista de espera e remova no botão **X** (`"Remover da lista de espera?"`).
- [ ] **8.** Matricule nas demais turmas:
   - **Jiu-Jitsu Kids**: **Pedro**;
   - **Muay Thai Noite** (Mensalidade): **Lucas** e **Diego** (no bloco *"Como paga esta turma"*, deixe **Lucas** em **Pacote** e **Diego** vem em **Pacote**);
   - **Defesa Pessoal Pacote** (Pacote de aulas): **Diego**, **Carla** e **Bruno** (Bruno não tem pacote — servirá para testar `"Sem pacote"` na chamada);
   - **Treino Livre Boxe** (Sem cobrança): **Diego** e **Lucas**.
- [ ] **9.** Tente matricular a **Ana** numa turma que bate horário com a Adulto (se criar ou editar horário conflitante).
   - Esperado: `"... já possui aula ... na turma ..."`.

---

## Parte E. Chamadas (mensalidade, consumo de pacote, falta e sem cobrança)

### E1. Jiu-Jitsu Adulto (Mensalidade)

- [ ] **1.** Abra a turma **Jiu-Jitsu Adulto**.
   - Esperado:
     - atalho `"Hoje HH:mm · Fazer chamada"`;
     - cabeçalho `"Seg 19:00 · Carlos Silva · Plano ... · Turma lotada"` (os pedaços curtos não quebram no meio).
- [ ] **2.** Clique no atalho **Fazer chamada**.
   - Esperado: `"Toque em quem veio"` e a barra `"0 de 4 presentes"` com `"Todos vieram"` e `"Concluir chamada"`.
- [ ] **3.** Toque no **Lucas** (presente). Toque de novo.
   - Esperado: volta para `"a marcar"` (ainda há gente pendente).
- [ ] **4.** Toque no Lucas de novo (presente) e toque rápido em Ana, Júlia e Marcos (3 toques seguidos).
   - Esperado: os três ficam presentes, sem perder nenhum.
- [ ] **5.** `⋮` da **Ana** > **Marcar falta**.
   - Esperado: `"Faltou"` em vermelho.
- [ ] **6.** `⋮` da **Júlia** > **Justificar falta**.
   - Esperado: `"Justificada"`.
- [ ] **7.** `⋮` do **Marcos** > **Desmarcar**.
- [ ] **8.** Clique em **Concluir chamada**.
   - Esperado: `"Chamada concluída. 1 falta marcada."` (o Marcos) e a barra `"Chamada concluída."`.
- [ ] **9.** Toque no Marcos (agora com falta).
   - Esperado: vira presente.
- [ ] **10.** Teste numa aula futura: Calendário > próxima semana > abra uma aula.
    - Esperado: `"A chamada abre em dd/MM"` e nenhum círculo para tocar.
- [ ] **11.** Endereço de aula que não existe: troque a data na URL da aula para um dia sem encontro (e teste também `2026-02-31`).
    - Esperado: `"Aula não encontrada"`, sem quebrar a tela.

### E2. Jiu-Jitsu Kids (Mensalidade + alerta "Ninguém veio?")

- [ ] **1.** Abra a aula de hoje da **Jiu-Jitsu Kids**:
   - [ ] **1.** Sem marcar ninguém, clique em **Concluir chamada**.
      - Esperado: `"Ninguém veio?"` / `"Os 1 alunos ficam com falta."` Clique em **Voltar**.
   - [ ] **2.** Marque o **Pedro** presente e conclua a chamada.

### E3. Defesa Pessoal Pacote (escopo de pacote, prioridade de vencimento, falta e justificada)

- [ ] **1.** Abra a aula de hoje da **Defesa Pessoal Pacote** > **Fazer chamada**.
   - Esperado antes de marcar:
     - **Diego**: mostra **`"14 de 14 aulas"`** (a chamada soma todos os pacotes do aluno que valem naquela turma: `4 aulas Defesa` + `Pacote 10 aulas Livre`);
     - **Carla**: mostra **`"Última aula do pacote"`** (do pacote **Aula única**);
     - **Bruno**: mostra **`"Sem pacote"`** em âmbar.
- [ ] **2.** Marque **Diego** e **Carla** presentes, e **Bruno** com falta. Conclua a chamada.
   - Esperado:
     - **Diego** na chamada passa para **`"13 de 14 aulas"`** (e na ficha do Diego, quem gasta 1 aula é o **Pacote 4 aulas Defesa** — `Restam 3 de 4` — porque vence em 30 dias, antes do *Pacote 10 aulas Livre* de 60 dias, que permanece `Restam 10 de 10`);
     - **Carla** zera o saldo do **Aula única** (`0 de 1`);
     - **Bruno** continua `"Sem pacote"` (nada consumido).
- [ ] **3.** No `⋮` do **Diego** > **Desmarcar**:
   - Esperado: a aula é devolvida ao pacote e a chamada volta para **`"14 de 14 aulas"`**.
- [ ] **4.** No `⋮` do **Diego** > **Marcar falta**:
   - Esperado: como o **Pacote 4 aulas Defesa** (o primeiro da fila de vencimento) tem `"Falta sem justificativa gasta a aula"` **desligado**, a falta **não** consome aula e o saldo permanece **`"14 de 14 aulas"`**.
   - Volte o **Diego** para **presente** (**`"13 de 14 aulas"`**).

### E4. Muay Thai Noite (Mensalidade paga com Pacote, falta que consome e troca de forma)

- [ ] **1.** Abra a aula de hoje da **Muay Thai Noite** > **Fazer chamada**.
   - Esperado: **Lucas** e **Diego** aparecem com o selo `"Pacote"` e saldo do **Pacote 10 aulas Livre** (`"10 de 10 aulas"` — pois o *Pacote 4 aulas Defesa* do Diego só vale na Defesa Pessoal).
- [ ] **2.** No `⋮` do **Diego** > **Marcar falta**:
   - Esperado: como o **Pacote 10 aulas Livre** tem a regra da falta **ligada**, a falta consome 1 aula (`"9 de 10 aulas"`).
- [ ] **3.** No `⋮` do **Diego** > **Justificar falta**:
   - Esperado: a aula volta para o pacote (`"10 de 10 aulas"`).
- [ ] **4.** Marque o **Lucas** presente (`"9 de 10 aulas"`) e clique em **Concluir chamada**.
- [ ] **5.** Clique em **‹ Voltar** no topo para voltar à tela da turma **Muay Thai Noite** (lista de alunos matriculados):
   - Confira que **Lucas** e **Diego** exibem o selo `"Pacote"` na lista de matriculados.
   - No `⋮` do **Lucas** > **Pagar com mensalidade**:
     - Esperado: confirmação `"As presenças de Lucas Ferreira nesta turma deixam de gastar o pacote. A cobrança segue o plano do aluno."` Confirme.
     - Esperado: a aula de hoje (já paga com o pacote antes da troca) continua registrada no pacote (`9 de 10`).
- [ ] **6.** Ainda na tela da turma **Muay Thai Noite**, no `⋮` do **Lucas** > **Pagar com pacote**:
   - Esperado: `"Cada presença de Lucas Ferreira nesta turma passa a gastar uma aula do pacote. Aulas já dadas não mudam."` Confirme.

### E5. Treino Livre Boxe (Sem cobrança)

- [ ] **1.** Abra a aula de hoje do **Treino Livre Boxe** > marque **Diego** e **Lucas** presentes e conclua.
   - Esperado: nenhuma aula é descontada dos pacotes (turma sem cobrança).

---

## Parte F. Aula avulsa, inscrição por pacote, experimental e remover da aula

- [ ] **1.** Na **Jiu-Jitsu Kids** de hoje, `⋮` > **Adicionar aluno nesta aula**:
   - [ ] **1.** Tipo **"Aula avulsa"** com a **Ana**:
      - Esperado: `"Valor da cobrança R$ 40,00"` e `"Aluno avulso adicionado com cobrança gerada."`
   - [ ] **2.** Tipo **"Experimental"** com o **Marcos**:
      - Esperado: `"Aluno inscrito como experimental."`
   - [ ] **3.** Marque a **Ana** presente.
   - [ ] **4.** No `⋮` da **Ana** > **Remover da aula**:
      - Esperado: `"Remover da aula?"` avisando que a cobrança avulsa em aberto será encerrada (`Encerrado · Saiu da aula`, fora do card Cancelado). Confirme.
   - [ ] **5.** Adicione a **Ana** de novo como **"Aula avulsa"**:
      - Esperado: volta `"a marcar"` (não presente) e reaproveita a cobrança avulsa de R$ 40,00 daquela aula (sem duplicar linha).
- [ ] **2.** Na **Defesa Pessoal Pacote** de hoje, `⋮` > **Adicionar aluno nesta aula** > selecione **Lucas**:
   - Esperado: em `"Tipo de inscrição *"` aparecem **"Aula avulsa"**, **"Pacote"** (`"Usa 1 aula do pacote"`) e **"Experimental"** (`"Cortesia (R$ 0,00)"`).
   - Escolha **Pacote** e confirme (`"Aluno inscrito pelo pacote."`).
   - Marque o **Lucas** presente → gasta mais 1 aula do **Pacote 10 aulas Livre** do Lucas (`"8 de 10 aulas"`).
- [ ] **3.** Na **Jiu-Jitsu Adulto** (sem avulso), abra **Adicionar aluno nesta aula**:
   - Esperado: `"Esta turma não aceita aula avulsa."` e apenas a opção **"Experimental"** (ou Pacote, se o aluno tiver).

---

## Parte G. Renovação e cancelamento de pacote + Tela de Cobranças completa

### G1. Ficha do aluno: uso, renovação e cancelamento de pacotes

- [ ] **1.** Abra a ficha da **Carla Mendes**:
   - Esperado: alerta de pacote acabando/esgotado (`Aula única` com 0 restantes) e no Painel o aviso `"1 pacote acabando"`.
- [ ] **2.** Abra a ficha do **Lucas Ferreira** > seção de pacotes:
   - Confira o selo **`Restam 8 de 10`**, a linha `"comprado dd/MM/aa · vale até dd/MM/aa · todas as turmas"` e clique em **Ver aulas usadas** (mostra Muay Thai Noite e Defesa Pessoal Pacote de hoje).
   - No `⋮` do pacote do Lucas > **Renovar**:
     - Esperado: abre a venda já com **Pacote 10 aulas Livre** e o alerta em destaque âmbar **`"Atenção: renovação de pacote em andamento"`** (`"O pacote Pacote 10 aulas Livre atual será encerrado como Renovado e o saldo de 8 aulas será somado a este novo pacote (total de 18 aulas)."`).
     - Venda **À vista**.
     - Esperado: o pacote antigo fica como `"Renovado"` e o novo mostra `"8 aulas trazidas"` (total 18 aulas disponíveis).
- [ ] **3.** Abra a ficha do **Diego Nunes** > seção de pacotes:
   - Esperado: o cabeçalho mostra `"2 pacotes em uso · 13 aulas restantes"` e ao abrir lista os dois pacotes (**Pacote 4 aulas Defesa** com `Restam 3 de 4` e **Pacote 10 aulas Livre** com `Restam 10 de 10`).
   - No `⋮` do **Pacote 10 aulas Livre** do Diego > **Cancelar pacote**:
     - Esperado: `"Cancelar pacote?"` (`"O pacote Pacote 10 aulas Livre é cancelado. As cobranças em aberto dele também; as pagas ficam."`). Confirme.
     - Esperado: `"Pacote cancelado."`

### G2. Tela de Cobranças (mensal, quinzenal, semanal agrupado, pacotes e avulsas)

- [ ] **1.** Abra **Cobranças** (`/billing`, mês atual).
   - Esperado nos 4 cartões do topo: **Total ativo**, **Recebido**, **Em atraso** e **Cancelado** (que só contabiliza cancelamentos manuais, sem somar cobranças encerradas automaticamente pelo sistema).
   - Esperado nas linhas da lista:
     - **Lucas**: mensalidade proporcional do *Mensal Jiu-Jitsu* + 2 parcelas de R$ 200,00 do 1º pacote + R$ 400,00 da renovação;
     - **Ana**: mensalidade com `-10%` + avulsa ativa de R$ 40,00;
     - **Pedro**: cobrança **Quinzenal** (*Muay Thai Quinzenal*);
     - **Júlia**: cobrança **Semanal** agrupada (`"R$ 60,00/semana"`, `"N parcelas"`, botão **"Ver parcelas"** mostrando `"N cobranças no mês"`);
     - **Marcos**: mensalidade com selo `"Bolsa 50%"`;
     - **Carla**: mensalidade com selo `"Bolsista"` (**Isento**, preço cheio riscado, sem ações no menu) + cobrança de R$ 50,00 do pacote *Aula única*;
     - **Bruno**: sem mensalidade neste mês (regra personalizada *Depois do uso + Mês cheio*);
     - **Diego**: **Pacote 4 aulas Defesa** (R$ 180,00) com status **Atrasado** (vencimento ontem) e **Pacote 10 aulas Livre** (R$ 400,00) como **Cancelado** (ou **Encerrado** nas parcelas futuras).
- [ ] **2.** Teste os filtros de **Tipo** (`Mensalidades`, `Pacotes`, `Aulas avulsas`, `Cobranças avulsas`) e **Situação** (`Pendentes`, `Atrasadas`, `Isentas`, `Canceladas`, conferindo os contadores). Volte para `Todos`.

### G3. Pagar com comprovante, desfazer, cancelar, reabrir e cobrança avulsa manual

- [ ] **1.** No `⋮` da mensalidade do **Lucas** > **Marcar pago**:
   - Esperado: botão `"Registrar pagamento"` desabilitado até escolher a forma.
   - Escolha **Pix**, data **"Pago em"** de **ontem** e anexe um arquivo (PDF ou imagem) como comprovante.
   - Esperado: `"Pagamento registrado (Pix)."` e a linha exibe `"pago via Pix em dd/MM · com comprovante"`.
   - Teste data de pagamento **amanhã** em outra cobrança → `"A data do pagamento não pode ser futura."`
- [ ] **2.** No `⋮` da cobrança paga do Lucas > **Ver comprovante** (abre o anexo) e depois **Desfazer pagamento** (`"Pagamento desfeito."`).
   - Pague de novo a mensalidade do Lucas em **Dinheiro**, hoje.
- [ ] **3.** Pague também a 1ª parcela do pacote do **Lucas** (Pix) e o pacote *Aula única* da **Carla** (Cartão).
- [ ] **4.** No `⋮` da mensalidade do **Marcos** > **Cancelar cobrança**:
   - Escolha o chip `"+ Cobrança duplicada"` > **Cancelar cobrança** (`"Cobrança cancelada com sucesso."`).
   - Depois clique em **Reverter** (`"Reabrir cobrança?"` → `"Cobrança reaberta."`).
- [ ] **5.** Clique em **+ Nova cobrança** no topo:
   - Tente salvar vazio → `"Selecione o aluno."`, `"Descreva a cobrança."` e `"Informe o valor."`
   - Crie para a **Ana**: descrição `+ Material` (**"Kimono"**), **R$ 300,00**, **Parcelas: 3x** (3x de R$ 100,00), 1º vencimento hoje → `"3 parcelas lançadas."`
   - Tente lançar `"Kimono"` de novo para a Ana → confirmação `"Cobrança repetida?"` (`"Ana Souza já tem "Kimono". Lançar outra?"`). Clique em **Voltar**.
   - Lance para o **Pedro**: `"Taxa de matrícula"`, **R$ 50,00**, vencimento em `10/01/2020` → aviso `"Data que já passou: a cobrança entra atrasada."` > confirme em `"Vencimento no passado?"`.
- [ ] **6.** Na tela de Cobranças do mês atual, confira a faixa de alerta **"R$ 50,00 em atraso de meses anteriores · Ver todos os atrasos"**:
   - Clique em **Ver todos os atrasos** → mostra a taxa de `10/01/2020` e a cobrança de ontem do Diego. Clique em **Ver por mês** para voltar.

---

## Parte H. Registro da aula e registros do aluno

- [ ] **1.** Na **Jiu-Jitsu Adulto** de hoje (chamada concluída), clique em **Registrar a aula**:
   - [ ] **1.** Anotação da turma: `"Raspagens da guarda aberta"`.
   - [ ] **2.** Lucas: tom **Evolução**, Anotar `"Boa base"`.
   - [ ] **3.** Júlia (justificada) e Ana (faltou): não aparecem, porque só os presentes entram.
   - [ ] **4.** Salvar registros.
      - Esperado: `"N registros salvos."` e o botão vira `"Editar registro da aula"`.
- [ ] **2.** Abra **Editar registro da aula**.
   - Esperado: os dados voltam preenchidos.
   - Apague a anotação do Lucas e o tom, e salve.
   - Esperado: o registro do Lucas sai, sem duplicar.
- [ ] **3.** Ficha do **Lucas** > Evolução > **Registros de aula**:
   - [ ] **1.** **+ Nova meta** `"Raspagem de gancho"`, quantidade `10`.
      - Esperado: `"Meta adicionada."` e o selo `"0/10"`.
   - [ ] **2.** `"Pontos fortes"`: adicione `"Guarda fechada"` e depois `"guarda fechada"`.
      - Esperado: não duplica.
   - [ ] **3.** Escreva um registro `"Treinou bem"`, clique em **"+ Metas e próxima aula"**, avance a meta `+1` e escreva em `"Para a próxima aula"` **"Revisar kimura"**. Clique em **Registrar**.
      - Esperado: `"Aula registrada."`
- [ ] **4.** Confira na ficha (ou na chamada do próximo encontro da Adulto):
   - Esperado: `"Para hoje: Revisar kimura"` no Lucas.

---

## Parte I. Graduação e ponto de partida

- [ ] **1.** Ficha do **Lucas** > Evolução > **Graduação**:
   - Esperado: jornada com a Faixa Branca atual, metas de aulas e tempo, e o botão **Graduar**.
- [ ] **2.** Graduar > `"Dar o 1º grau"`, data de hoje > **Confirmar graduação**.
   - Esperado: `"Registrado: Faixa Branca · 1º grau."`
- [ ] **3.** Tente de novo com a data de **amanhã**.
   - Esperado: `"A data não pode ser futura."` e o botão desligado.
- [ ] **4.** **Pedro** (10 anos) > Graduação > Graduar > **Escolher outra**:
   - [ ] **1.** Esperado: só faixas infantis da idade. `"Mostrar todas as faixas"` mostra as outras como `"fora da idade"`.
   - [ ] **2.** Escolha **Faixa Amarela** (pula a Cinza).
      - Esperado: `"Pular para Faixa Amarela?"` / `"Pula 1 faixa da trilha."` Confirme.
   - [ ] **3.** Graduar de novo, `"Escolher outra"` > **Faixa Branca**.
      - Esperado: `"Voltar para Faixa Branca?"`. Clique em **Voltar** (não confirme).
- [ ] **5.** **Júlia** > Graduação > **Ajustar ponto de partida** > `"Veio de outro lugar"`:
   - onde aprendia `"Gracie Barra"`, Faixa **Azul**, Grau **2**, graduada em `01/03` deste ano, aulas já feitas `30`;
   - Salvar.
   - Esperado: `"Ponto de partida salvo."`
- [ ] **6.** Lista de alunos.
   - Esperado: os selos de faixa com grau (`"Faixa Azul · 2º grau"`).
- [ ] **7.** Painel > `"Para fazer hoje"`:
   - Esperado: sem `"trocar de faixa pela idade"` (ninguém passou da idade).
   - Teste: edite o nascimento do Pedro para **2009** (17 anos). Volte ao Painel.
   - Esperado: `"1 aluno precisa trocar de faixa pela idade"`, com `"Graduar"`; o selo `"Trocar faixa"` aparece na lista e na ficha.
   - Volte o ano do Pedro para **2016**.

---

## Parte J. Troca de instrutor e calendário

- [ ] **1.** Aula de hoje da **Muay Thai Noite** > `⋮` > **Trocar instrutor**:
   - Esperado: `"Data ... Horário ..."` e `"Instrutor titular da turma: Rafael Costa"`.
   - Escolha **Carlos Silva**, motivo `"Viagem"` > Confirmar alteração.
   - Esperado: se o Carlos tiver aula no mesmo horário, a mensagem de conflito; senão `"Instrutor da aula atualizado com sucesso."` e o cabeçalho `"Substitui Rafael Costa · Viagem"`.
- [ ] **2.** Calendário:
   - Esperado: a aula aparece como `"Carlos Silva (Subst.)"` em âmbar.
   - Filtre por instrutor `"Carlos Silva"`: a aula substituída entra.
- [ ] **3.** `⋮` > **Restaurar titular**.
   - Esperado: `"Instrutor titular restaurado com sucesso."`
- [ ] **4.** Calendário:
   - [ ] **1.** `"Semana anterior"`, `"Hoje"`, `"Próxima semana"`;
   - [ ] **2.** `"Grade"` e `"Lista"`;
   - [ ] **3.** filtro de modalidade.
   - [ ] **4.** Na turma Kids, `⋮` > **Ver aulas no calendário**.
      - Esperado: `"Só as aulas da turma Jiu-Jitsu Kids."` e `"Ver todas"`.

---

## Parte K. Mudança de horário, capacidade e desativação

- [ ] **1.** Edite a **Muay Thai Noite**: mude para **amanhã** (dia da semana) às 20:30.
   - Esperado: a aula de hoje (com chamada) continua no calendário e na frequência com o horário antigo.
- [ ] **2.** Edite a **Jiu-Jitsu Adulto**: capacidade **2**.
   - Esperado: o aviso `"A turma tem N matriculados: com 2 vagas, ela ficará acima da capacidade."` Volte para **3** e salve.
- [ ] **3.** Na lista de turmas, `⋮` da **Muay Thai Noite** > **Desativar**.
   - Esperado: `"Desativar turma?"` e depois:
     - selo `"Inativo"` na lista com o filtro `"Inativas"`;
     - sem `"Matricular alunos"` nem atalho de aula;
     - aulas futuras: `"Aula não encontrada"`.
- [ ] **4.** Abra a turma inativa > **Editar turma** > mude só o nome e salve (depois volte o nome para **Muay Thai Noite**).
   - Esperado: continua inativa.
- [ ] **5.** `⋮` > **Reativar turma**.
   - Esperado: `"Turma reativada."`

---

## Parte L. Perfis de acesso

- [ ] **1.** Usuários > **Novo usuário** (crie todos):

   | Nome | E-mail | Perfil | Profissional |
   |---|---|---|---|
   | Gabi Gerente | gabi@tatame.com | Gerente | |
   | Tati Atendente | tati@tatame.com | Atendente | |
   | Carlos Silva | carlos@tatame.com | Profissional | Carlos Silva |

   - Esperado no Profissional sem profissional: `"Vincule o usuário a um profissional da equipe."`
- [ ] **2.** Crie outro usuário **Profissional** e tente ligar ao Carlos.
   - Esperado: o Carlos não aparece na lista (já tem usuário ativo).
- [ ] **3.** Topo > menu do usuário > `"Trocar usuário / organização (demo)"`:
   - Esperado: cada nome com `"Perfil · Academia Tatame"`.
   - Troque para **Carlos Silva (Profissional)**:
     - menu só com Calendário e Turmas;
     - turmas: só Jiu-Jitsu Adulto, Jiu-Jitsu Kids e Defesa Pessoal Pacote (titular);
     - abrir a URL da Muay Thai: `"Turma não encontrada"`;
     - chamada e registro funcionam nas turmas dele;
     - sem `"Abrir ficha"`.
- [ ] **4.** Troque para **Tati Atendente**:
   - Esperado:
     - sem Painel, Financeiro, Modalidades, Usuários, Auditoria e Configurações;
     - Cobranças só para ver (sem `"Marcar pago"`);
     - consegue matricular, fazer chamada e mandar mensagens;
     - sem Graduação e sem `"Registrar a aula"`.
   - Digite `/finance` na URL.
   - Esperado: volta para o Calendário.
- [ ] **5.** Troque para **Gabi Gerente**:
   - Esperado: tudo menos Configurações. Em Usuários, só vê Atendente e Profissional.
- [ ] **6.** Volte para **Ana Ribeiro**.
   - Em Usuários, edite a si mesma.
   - Esperado: perfil e `"Usuário ativo"` travados.

---

## Parte M. Auditoria

Auditoria. Filtre por tipo Turma, Matrícula, Aluno, Cobrança e Usuário.

Esperado, entre outros:
- `"criou a turma ..."`;
- `"matriculou ..."`;
- `"descontou 1 aula do pacote ..."` e `"devolveu 1 aula ao pacote ..."`;
- a venda, renovação e cancelamento de pacotes;
- as trocas `"Pagar com mensalidade"` e `"Pagar com pacote"`;
- `"colocou Carlos Silva no lugar de Rafael Costa na aula de dd/MM da turma Muay Thai Noite"` e `"voltou Rafael Costa ..."`;
- `"graduou ..."`;
- `"registrou a aula ..."`;
- `"criou o usuário ... (Gerente)"`, com o selo `"Sensível"`;
- `"desativou a turma ..."`.

Abra um evento.
- Esperado: `"Registro imutável: não pode ser editado nem removido."` e `"Copiar registro (JSON)"`.

---

## O que vou conferir no JSON

- `organization`:
  - `classSegment: "martial_arts"`;
  - `settings` com `billingTiming: "prepaid"`, `midMonthStrategy: "prorated"`, `defaultDueDay: 10`;
  - `onboardingCompleted: true`, `modalitiesReviewed: true`.
- `unit`: nome `"Centro"`; `businessHours` com Sábado em dois turnos.
- `categories`: Jiu-Jitsu, Muay Thai e Defesa Pessoal com trilha de faixas; Boxe sem trilha e ativo.
- `plans`:
  - **Mensal Jiu-Jitsu** (`period: "monthly"`, `priceCents: 18000`, `status: "active"`);
  - **Muay Thai Quinzenal** (`period: "biweekly"`, `priceCents: 11000`, `status: "active"`);
  - **Defesa Pessoal Semanal** (`period: "weekly"`, `priceCents: 6000`, `status: "active"`);
  - **Plano Antigo** (`status: "inactive"`).
- `lessonPackages`:
  - **Pacote 10 aulas Livre** (`totalLessons: 10`, `priceCents: 40000`, `validityDays: 60`, `classGroupIds: []`, `absenceConsumes: true`, `status: "active"`);
  - **Pacote 4 aulas Defesa** (`totalLessons: 4`, `priceCents: 18000`, `validityDays: 30`, restrito à turma Defesa Pessoal Pacote, `absenceConsumes: false`, `status: "active"`);
  - **Aula única** (`totalLessons: 1`, `priceCents: 5000`, sem validade, `status: "active"`);
  - **Pacote Antigo** (`status: "inactive"`).
- `professionals`: Carlos (3 modalidades), Rafael (2 modalidades), Bruno inativo.
- `classGroups`:
  - **Jiu-Jitsu Adulto** (capacidade 3, `membership`);
  - **Jiu-Jitsu Kids** (`membership`, `allowDropin: true`, R$ 40,00);
  - **Muay Thai Noite** (`membership`, com `scheduleHistory` do horário antigo até hoje e ativa após reativar);
  - **Defesa Pessoal Pacote** (`billingMode: "package"`, `allowDropin: true`, R$ 55,00);
  - **Treino Livre Boxe** (`billingMode: "free"`).
- `clients`:
  - **Lucas**: plano mensal;
  - **Ana**: plano mensal com desconto 10%;
  - **Pedro**: plano quinzenal + responsável Marta Alves;
  - **Júlia**: plano semanal + telefone `+1415...`;
  - **Marcos**: bolsa parcial 50% (`scholarship`);
  - **Carla**: bolsa integral (`isExempt` / 100%);
  - **Bruno**: desconto fixo R$ 30,00 com validade + regra personalizada (`postpaid`, `full_cycle`);
  - **Diego**: pagador por pacote.
- `enrollments`:
  - Pedro cancelado na Adulto e ativo na Kids;
  - Marcos promovido e ativo na Adulto;
  - Lucas e Diego na Muay Thai Noite com `paysWithPackage: true`;
  - Diego, Carla e Bruno na Defesa Pessoal Pacote;
  - Diego e Lucas no Treino Livre Boxe.
- `waitlist`: Marcos `promoted` na Adulto e `canceled` na Muay Thai.
- `reservations`:
  - Kids: avulsa da Ana (uma `canceled`, uma ativa) e experimental do Marcos;
  - Defesa Pessoal: inscrição via `package` do Lucas.
- `studentPackages`:
  - **Lucas**: 1º pacote `renewed` e novo pacote ativo com 8 aulas trazidas (`carriedOverLessons: 8`);
  - **Diego**: *Pacote 4 aulas Defesa* ativo com 1 aula usada (`lessonsUsed: 1`) e *Pacote 10 aulas Livre* `canceled`;
  - **Carla**: *Aula única* com 1 de 1 usada (`lessonsUsed: 1`).
- `charges`:
  - mensalidades (proporcional do Lucas paga em dinheiro, Ana com -10%, quinzenal do Pedro, semanais da Júlia, Marcos com bolsa 50% reaberta, Carla isenta, Bruno sem cobrança no mês atual);
  - pacotes (2x de R$ 200,00 do Lucas com a 1ª paga via Pix + R$ 400,00 da renovação; R$ 180,00 atrasado do Diego + R$ 400,00 cancelado do Diego; R$ 50,00 da Carla pago em cartão);
  - avulsas (`dropin` da Ana: uma cancelada pelo sistema e uma ativa de R$ 40,00; `extra` "Kimono" da Ana em 3x de R$ 100,00; `extra` "Taxa de matrícula" do Pedro em `2020-01-10`).
- `attendances`:
  - Adulto: Lucas e Marcos (`present`), Júlia (`justified`), Ana (`absent`);
  - Kids: Pedro (`present`), Ana avulsa (`pending`), Marcos experimental (`pending`);
  - Defesa Pessoal: Diego, Carla e Lucas (`present`), Bruno (`absent`);
  - Muay Thai Noite: Lucas (`present`), Diego (`justified`);
  - Treino Livre Boxe: Diego e Lucas (`present`).
- `clients[].progressions`:
  - Lucas com 1º grau, meta 1/10, ponto forte sem duplicar e registro com `nextClassNote`;
  - Pedro na Faixa Amarela;
  - Júlia Faixa Azul 2º grau, `origin` de outro lugar.
- `sessionOverrides`: vazio (titular restaurado).
- `users`: Gerente, Atendente e Profissional ligado ao Carlos.
- `auditLog`: os eventos da Parte M.
