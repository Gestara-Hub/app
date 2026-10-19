# Roteiro 05: Outra área com pacote de aulas (completo)

**Área:** Outra área (nome próprio).

**Cobre:**
- configuração inicial com área própria:
  - a sugestão "Usar Lutas";
  - as sugestões de nome;
  - a trilha e a cobrança escolhidas na mão.
- catálogo de pacotes:
  - turmas, validade e regra da falta;
  - inativar e reativar.
- venda de pacote:
  - pelo cadastro e pela lista;
  - parcelas e vencimento no passado;
  - renovação com saldo trazido;
  - pacotes separados;
  - cancelamento.
- uso na chamada:
  - escopo de turmas;
  - o que vence primeiro paga;
  - falta gasta, justificada devolve, Desmarcar devolve;
  - "Sem pacote" e "Última aula do pacote".
- aluno incluído na aula pelo pacote;
- turma de mensalidade com "Pagar com pacote" e "Pagar com mensalidade";
- turma sem cobrança;
- avisos de pacote acabando (Painel, ficha, lista);
- relatório Pacotes de aulas;
- repasse do professor em porcentagem com aulas de pacote;
- Auditoria.

Comece do zero (ver [README](README.md)).

---

## Parte A. Configuração inicial

- [ ] **1.** Nome **Rocha Escalada**. Continuar.
- [ ] **2.** Área: **Outra área**.
   - [ ] **1.** Continuar sem nome.
      - Esperado: erro pedindo o nome da área.
   - [ ] **2.** Esperado: as sugestões "Teatro", "Xadrez", "Fotografia", "Autoescola". Clique em uma: o campo é preenchido.
   - [ ] **3.** Apague e digite **Lutas**.
      - Esperado: "Já existe a área Lutas, com a evolução pronta. Usar Lutas". **Não clique.**
   - [ ] **4.** Troque o nome para **Escalada**.
      - Esperado: a sugestão some.
   - [ ] **5.** "Como seus alunos avançam?": **Níveis**.
   - [ ] **6.** "Como você cobra?": **Pacote de aulas**.
   - [ ] **7.** Continuar.
- [ ] **3.** Aulas:
   - Esperado: "Aulas de Escalada", com "Escalada" já marcada.
   - Desmarque Escalada.
   - Adicione **Boulder** e **Top rope**.
   - Esperado: o contador "2".
   - Concluir.
- [ ] **4.** Painel:
   - Esperado: "Rocha Escalada" no topo e os Primeiros passos.
   - O passo de cobrança fala de pacote.

## Parte B. Primeiros passos

- [ ] **1.** Horários: todos os dias, 06:00 às 22:00.
- [ ] **2.** Modalidades:
   - Esperado: Boulder e Top rope com trilha de **níveis**.
   - "Está tudo certo".
- [ ] **3.** Equipe:
   - **Tiago Rocha**: Boulder e Top rope;
   - **Clara Muniz**: Boulder.
- [ ] **4.** Planos e pacotes > aba Planos:
   - **Mensal Escalada**, R$ 200,00, mensal.

## Parte C. Turmas

Todas com o dia da semana de hoje nos encontros:

| Nome | Modalidade | Professor | Vagas | Horário | Cobrança |
|---|---|---|---|---|---|
| **Boulder Livre** | Boulder | Tiago | 12 | 07:00 às 08:00 | Pacote de aulas |
| **Top rope Iniciante** | Top rope | Tiago | 8 | 09:00 às 10:00 | Pacote de aulas |
| **Treino aberto** | Boulder | Clara | 20 | 11:00 às 12:00 | Sem cobrança |
| **Condicionamento** | Boulder | Clara | 10 | 18:00 às 19:00 | Mensalidade |

## Parte D. Catálogo de pacotes

Planos e pacotes > aba **Pacotes de aulas**.

- [ ] **1.** Esperado, antes do primeiro: "Nenhum pacote de aulas ainda."
- [ ] **2.** Novo pacote, salve vazio.
   - Esperado: "Informe o nome" e o erro da quantidade e do valor.
- [ ] **3.** Crie:

| Nome | Quantidade de aulas | Valor | Validade | Turmas | Falta sem justificativa gasta a aula |
|---|---|---|---|---|---|
| **10 aulas** | 10 | R$ 500,00 | 60 dias | nenhuma ("Todas as turmas") | ligado |
| **4 aulas Top rope** | 4 | R$ 220,00 | 30 dias | só Top rope Iniciante | ligado |
| **5 aulas Boulder** | 5 | R$ 275,00 | 30 dias | só Boulder Livre | **desligado** |
| **Aula única** | 1 | R$ 60,00 | Sem validade | nenhuma | ligado |
| **Pacote antigo** | 8 | R$ 360,00 | 90 dias | nenhuma | ligado |

- [ ] **4.** Esperado: cada cartão mostra "N aulas · vale N dias" (ou "Sem validade") e as turmas.
- [ ] **5.** ⋮ do **Pacote antigo** > **Inativar**.
   - Esperado: "Inativar pacote?" e depois o pacote em "Inativo".
- [ ] **6.** Filtro de situação: confira "Todos os pacotes", ativos e inativos.
- [ ] **7.** Busca "top": só o 4 aulas Top rope.
- [ ] **8.** **Reative** o Pacote antigo e inative de novo (para a venda não mostrar).

## Parte E. Alunos e vendas

- [ ] **1.** Novo aluno **Marcos Vieira**, (11) 95555-1111:
   - Como paga: **Pacote de aulas**, pacote **10 aulas**, À vista.
   - Esperado: "Pacote vendido." junto com o cadastro.
- [ ] **2.** Novo aluno **Paula Reis**, (11) 95555-2222, "Não paga mensalidade". Depois:
   - Lista de alunos > ⋮ da Paula > **Vender pacote**;
   - Esperado: o Pacote antigo não aparece (inativo);
   - **4 aulas Top rope**, Parcelas **2x**, 1º vencimento hoje;
   - Esperado: "Pacote vendido."
- [ ] **3.** Novo aluno **Igor Santos**, (11) 95555-3333, "Não paga mensalidade". Venda dois pacotes:
   - [ ] **1.** **5 aulas Boulder**, à vista, 1º vencimento **ontem**.
      - Esperado: "Vencimento no passado?" e "O 1º vencimento é dd/MM/aaaa e já entra atrasado." > **Vender assim**.
   - [ ] **2.** **10 aulas**, à vista.
      - Esperado: "O pacote 5 aulas Boulder continua valendo." (outro pacote, cada um com seu saldo).
- [ ] **4.** Novo aluno **Sérgio Lopes**, (11) 95555-4444:
   - **Paga mensalidade** no Mensal Escalada;
   - depois, Vender pacote > **10 aulas**, à vista.
- [ ] **5.** Novo aluno **Vera Dias**, (11) 95555-5555, "Não paga mensalidade". Sem pacote.
- [ ] **6.** Novo aluno **Nina Costa**, (11) 95555-6666, "Não paga mensalidade":
   - Vender pacote > **Aula única**.
- [ ] **7.** Lista de alunos:
   - Esperado:
     - o selo do pacote em quem tem ("Restam 10 de 10" e similares);
     - a Nina com "Última aula";
     - "Definir nível" (níveis) em todos.
   - Filtro de pacote, se houver.

## Parte F. Matrículas

- [ ] **1.** **Boulder Livre**: Marcos, Igor, Vera, Nina.
- [ ] **2.** **Top rope Iniciante**: Paula, Marcos.
- [ ] **3.** **Treino aberto**: Marcos, Paula.
- [ ] **4.** **Condicionamento** (mensalidade): Sérgio, Marcos.
   - Esperado: o bloco "Como paga esta turma", com a escolha por aluno entre mensalidade e pacote (para quem tem pacote).
   - Deixe o **Sérgio** na mensalidade e o **Marcos** no pacote.

## Parte G. Chamadas de hoje

### G1. Boulder Livre

- [ ] **1.** Fazer chamada.
   - Esperado antes de marcar:
     - Marcos "10 de 10 aulas";
     - Igor "15 de 15 aulas" (soma dos 2 pacotes que valem no Boulder: 5 aulas Boulder + 10 aulas);
     - Vera "Sem pacote" em âmbar;
     - Nina "Última aula do pacote".
- [ ] **2.** Marque Marcos, Igor e Nina **presentes**; Vera **falta**. Concluir.
- [ ] **3.** Esperado:
   - Marcos "9 de 10 aulas";
   - Igor "14 de 15 aulas" na chamada (e na ficha gastou o **5 aulas Boulder** — `Restam 4 de 5`, pois vence primeiro — mantendo o **10 aulas** em `10 de 10`);
   - Nina sem saldo;
   - Vera continua "Sem pacote" (nada gasto).
- [ ] **4.** ⋮ do **Marcos** > **Desmarcar**.
   - Esperado: volta para "10 de 10 aulas" (a aula volta ao pacote).
   - Marque presente de novo.

### G2. Top rope Iniciante

- [ ] **1.** Paula: ⋮ > **Marcar falta**.
   - Esperado: "3 de 4 aulas" (a falta gasta, pacote com a regra ligada).
- [ ] **2.** ⋮ da Paula > **Justificar falta**.
   - Esperado: volta para "4 de 4 aulas".
- [ ] **3.** Marcos presente.
   - Esperado: gasta o 10 aulas ("8 de 10").
- [ ] **4.** **Adicionar aluno nesta aula** > **Igor**.
   - Esperado: "Tipo de inscrição *" com "Aula avulsa", "Pacote" ("Usa 1 aula do pacote") e "Experimental" ("Cortesia (R$ 0,00)").
   - Escolha **Pacote**.
   - Esperado: "Aluno inscrito pelo pacote."
   - Marque presente.
   - Esperado: gasta o **10 aulas** do Igor (o 5 aulas Boulder não vale no Top rope).
- [ ] **5.** Concluir chamada.

### G3. Treino aberto e regra da falta desligada

- [ ] **1.** Treino aberto: Marcos e Paula presentes.
   - Esperado: sem saldo de pacote nas linhas; nada é gasto (turma sem cobrança).
- [ ] **2.** Boulder Livre de novo: no ⋮ do Igor, troque para **Marcar falta**.
   - Esperado: a falta **não** gasta (o 5 aulas Boulder tem a regra desligada). O saldo volta para "5 de 5".
   - Volte para presente.

### G4. Condicionamento (mensalidade)

- [ ] **1.** Fazer chamada: Sérgio e Marcos presentes. Concluir chamada.
   - Esperado:
     - Marcos com o saldo gasto no pacote;
     - Sérgio sem gasto (paga mensalidade).
- [ ] **2.** Clique em **‹ Voltar** para a tela da turma **Condicionamento** (lista de matriculados) e, no ⋮ do **Sérgio** > **Pagar com pacote**:
   - Esperado:
     - "Pagar com pacote?";
     - "Cada presença de Sérgio Lopes nesta turma passa a gastar uma aula do pacote. Aulas já dadas não mudam."
   - Confirme.
   - Esperado: a aula de hoje, já marcada, não muda.
- [ ] **3.** Ainda na tela da turma **Condicionamento**, no ⋮ do **Marcos** > **Pagar com mensalidade**:
   - Esperado: "As presenças de Marcos Vieira nesta turma deixam de gastar o pacote. A cobrança segue o plano do aluno."
   - Confirme.
   - Esperado: a aula de hoje continua paga com o pacote.

## Parte H. Ficha do aluno e avisos

- [ ] **1.** Ficha do **Marcos** > seção de pacotes:
   - Esperado:
     - "comprado dd/MM/aa", "vale até dd/MM/aa";
     - "N de 10 aulas usadas";
     - **Ver aulas usadas**: a lista com a turma e a data de cada aula.
- [ ] **2.** Ficha da **Nina**:
   - Esperado: o aviso do pacote acabando, com **Vender pacote** (ou Renovar).
- [ ] **3.** Painel:
   - Esperado: "1 pacote acabando" (ou mais), com o nome da Nina.
- [ ] **4.** ⋮ do pacote do **Marcos** > **Renovar**.
   - Esperado:
     - abre a venda já com o pacote **10 aulas**;
     - "O saldo de N aulas do pacote 10 aulas que o aluno já tem passa para este."
   - Venda à vista.
   - Esperado:
     - o pacote novo com "N aulas trazidas";
     - o antigo como "Renovado".
- [ ] **5.** Ficha do **Igor**:
   - Esperado: os dois pacotes separados, cada um com o seu saldo.
- [ ] **6.** ⋮ do pacote **10 aulas** do Igor > **Cancelar pacote**.
   - Esperado: "Cancelar pacote?" e "O pacote 10 aulas é cancelado. As cobranças em aberto dele também; as pagas ficam."
   - Confirme.
   - Esperado: "Pacote cancelado."
   - Esperado na aula de Top rope de hoje: o Igor fica "Sem pacote" (o 5 aulas Boulder não vale lá).

## Parte I. Cobranças dos pacotes

- [ ] **1.** Cobranças, filtro **Pacotes de aulas**.
   - Esperado:
     - Marcos 2 de R$ 500,00 (compra e renovação);
     - Paula 2 de R$ 110,00;
     - Igor R$ 275,00 "Atrasado" e R$ 500,00 "Cancelado";
     - Sérgio R$ 500,00;
     - Nina R$ 60,00.
   - Sérgio também tem a mensalidade do Mensal Escalada.
- [ ] **2.** Pague:
   - Marcos (a primeira), Pix;
   - Paula, a 1ª parcela;
   - Sérgio, Dinheiro.

## Parte J. Repasse do professor

- [ ] **1.** Financeiro > **Professores** > **Tiago Rocha**:
   - regra **Porcentagem**, 30% ("% do que os alunos pagaram").
   - Esperado:
     - a explicação "Mensalidades e cursos das turmas dele e aulas de pacote dadas. Avulsas não entram.";
     - no detalhe, "Aulas de pacote pago que ele deu, pelo valor da aula" (R$ 50,00 por aula no 10 aulas; 30% = R$ 15,00).
- [ ] **2.** Esperado: só entram as aulas de pacote **pago** (Marcos e Paula), não as do Igor (cancelado ou atrasado).

## Parte K. Relatório e auditoria

- [ ] **1.** Relatórios > **Pacotes de aulas**:
   - Esperado: os pacotes vendidos no mês, com as aulas usadas e restantes.
   - Exportar CSV.
- [ ] **2.** Auditoria:
   - Esperado, entre outras:
     - "descontou 1 aula do pacote de Marcos Vieira (presença em Boulder Livre, dd/MM)";
     - "descontou 1 aula do pacote de Paula Reis (falta em Top rope Iniciante, dd/MM)";
     - "devolveu 1 aula ao pacote de Paula Reis (falta justificada em Top rope Iniciante, dd/MM)";
     - "devolveu ..." do Desmarcar do Marcos;
     - a venda, a renovação e o cancelamento dos pacotes;
     - as trocas "Pagar com pacote" e "Pagar com mensalidade".

---

## O que vou conferir no JSON

- `organization`:
  - `classSegment: "custom"`, `customSegmentName: "Escalada"`;
  - `customSegmentProgression: "levels"`, `customSegmentBilling: "package"`.
- `categories`: Boulder e Top rope com trilha de níveis; sem "Escalada".
- `lessonPackages`:
  - 10 aulas `classGroupIds: []`;
  - 4 aulas Top rope só com a Top rope;
  - 5 aulas Boulder com `absenceConsumes: false`;
  - Aula única sem validade;
  - Pacote antigo inativo.
- `classGroups`: duas de pacote, uma `free` e uma de mensalidade.
- `enrollments` do Condicionamento: Sérgio `paysWithPackage: true`, Marcos `false`.
- `studentPackages`:
  - Marcos: o 1º renovado e o novo com as aulas trazidas;
  - Paula: nenhuma aula usada (falta justificada);
  - Igor: o 5 aulas Boulder com 1 uso (Boulder) e o 10 aulas `canceled`;
  - Sérgio: nenhum uso (a aula de hoje já estava marcada antes da troca);
  - Nina: 1 de 1 usada.
- `charges` do tipo `package`: como na Parte I, com os pagamentos e os cancelamentos.
- `attendances`: as chamadas de hoje (Paula `justified`, Vera `absent`).
- `teacherPayRules`: Tiago com porcentagem 30.
- `auditLog`: as linhas da Parte K.
