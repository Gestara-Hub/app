# Roteiro 04: Gastronomia (completo)

**Área:** Gastronomia. Vale também para Artes e artesanato e para Beleza e cursos livres.

**Cobre:**
- configuração inicial de área de curso (sem regras da mensalidade);
- turma de curso: validações, valor fechado, parcelas, data de término;
- matrícula: à vista, parcelado, valor diferente, 1º vencimento no passado, várias de uma vez;
- curso lotado, lista de espera e promoção com pagamento;
- cobranças do curso: pagar, desfazer, filtro Cursos;
- cancelar matrícula antes e depois do vencimento;
- rematrícula com dívida anterior ("Cancelar as parcelas anteriores");
- trocar a forma de cobrança com alunos matriculados;
- curso encerrado: "Concluído", certificado no Plano Pro e o modelo do certificado;
- card "Descubra o dia a dia", relatório Cursos.

Comece do zero (ver [README](README.md)).

---

## Parte A. Configuração inicial e primeiros passos

- [ ] **1.** Nome **Doce Escola**. Área **Gastronomia**.
- [ ] **2.** Aulas: deixe **Confeitaria** e **Panificação**, adicione **Cozinha Italiana**. Concluir.
- [ ] **3.** Painel, Primeiros passos:
   - Esperado:
     - **não** aparece o passo das regras da mensalidade (área de curso);
     - o passo de matrícula diz "curso".
- [ ] **4.** Horários: todos os dias, 06:00 às 22:00. Salvar horários.
- [ ] **5.** Modalidades:
   - Esperado: Confeitaria, Panificação e Cozinha Italiana, sem trilha de faixas.
   - "Está tudo certo".
- [ ] **6.** Equipe:
   - **Bruno Chef**: Confeitaria e Panificação;
   - **Giulia Rossi**: Cozinha Italiana.

## Parte B. Turmas de curso

### B1. Validações do formulário

Turmas > Nova turma, cobrança **Curso com valor fechado**:

- [ ] **1.** Salve sem valor e sem "Termina em".
   - Esperado: "Informe o valor do curso." e "Informe quando o curso termina."
- [ ] **2.** "Termina em" antes da "Data de início da turma".
   - Esperado: "O curso não pode terminar antes de começar."
   - Mesmo dia vale (oficina de um dia).
- [ ] **3.** Parcelas: abra a lista.
   - Esperado: de 1x até 12x.

### B2. Turmas do roteiro

Crie, todas com o dia da semana de hoje nos encontros:

| Nome | Modalidade | Professor | Vagas | Horário | Valor | Parcelas | Termina em |
|---|---|---|---|---|---|---|---|
| **Confeitaria Básica** | Confeitaria | Bruno Chef | 12 | 09:00 às 12:00 | R$ 900,00 | até 3x | último dia do mês que vem |
| **Pão Artesanal** | Panificação | Bruno Chef | **2** | 14:00 às 17:00 | R$ 450,00 | até 2x | daqui a 30 dias |
| **Massas Frescas** | Cozinha Italiana | Giulia Rossi | 10 | 19:00 às 22:00 | R$ 600,00 | até 4x | daqui a 15 dias |

- Na **Confeitaria Básica**, mude a "Data de início da turma" para **7 dias atrás**. Isso deixa encerrar o curso ontem na Parte K.
- Esperado: na lista de Turmas, cada curso mostra o valor e "0 de N alunos".

## Parte C. Alunos

Alunos > Novo aluno, todos com "Não paga mensalidade":

| Aluno | Telefone | Nascimento |
|---|---|---|
| **Carla Mendes** | (11) 96666-1111 | 12/03/1990 |
| **João Pedro** | (11) 96666-2222 | 05/07/1985 |
| **Fernanda Lima** | (11) 96666-3333 | 20/11/1995 |
| **Henrique Sato** | (11) 96666-4444 | 01/01/1980 |
| **Lúcia Prado** | (11) 96666-5555 | 14/09/1972 |
| **Otávio Reis** | (11) 96666-6666 | 30/04/2001 |

- Esperado: a lista sem "Definir faixa" nem "Definir nível" (área sem trilha de faixas).

## Parte D. Matrículas na Confeitaria Básica

Confeitaria Básica > **Matricular alunos**, um de cada vez:

- [ ] **1.** **Carla:**
   - Esperado: o resumo "R$ 900,00 à vista, vence hoje".
   - Matricular.
   - Esperado: "Aluno matriculado no curso."
- [ ] **2.** **João:** em "Alterar":
   - 3x, 1º vencimento hoje.
   - Esperado: "R$ 900,00 em 3x, 1ª vence dd/MM" e as três datas, uma por mês.
- [ ] **3.** **Fernanda:** em "Alterar":
   - valor **R$ 800,00**, 2x, 1º vencimento **ontem**.
   - Esperado:
     - a pergunta "Vencimento no passado?";
     - "O 1º vencimento é dd/MM/aaaa e já entra atrasado."
   - Confirme.
- [ ] **4.** **Henrique e Lúcia juntos** (marque os dois):
   - em "Alterar", 2x;
   - Esperado: o texto "Cobrança de cada aluno: ...", para cada um.
   - Esperado: "Matricular 2 alunos".
- [ ] **5.** Teste de parcela mínima:
   - Otávio, valor R$ 0,02, 3x.
   - Esperado: "Cada parcela precisa de pelo menos R$ 0,01."
   - **Não matricule o Otávio aqui**: feche o diálogo.
- [ ] **6.** Turma:
   - Esperado: "5 de 12 alunos".
   - Na linha de cada aluno, nada de faixa ou nível.

## Parte E. Cobranças do curso

- [ ] **1.** Cobranças, filtro **Cursos**.
   - Esperado: 9 parcelas:
     - Carla 1;
     - João 3;
     - Fernanda 2;
     - Henrique 2;
     - Lúcia 2.
   - A 1ª da Fernanda "Atrasado"; as de hoje "Vence hoje"; as próximas aparecem nos meses seguintes.
   - Esperado: a descrição de cada parcela, "Confeitaria Básica 1/3" (ou parecida), com o nome do curso.
- [ ] **2.** ⋮ da 1ª parcela do **João** > **Marcar pago**:
   - Dinheiro, hoje.
   - Esperado: "Pago".
- [ ] **3.** ⋮ da parcela da **Carla** > Marcar pago:
   - Pix, com comprovante (qualquer imagem).
- [ ] **4.** Desfaça o pagamento da Carla.
   - Esperado: a confirmação e a volta para "Vence hoje".
   - Pague de novo, em Pix.
- [ ] **5.** Ficha do **João** > Cobranças:
   - Esperado: as 3 parcelas, 1 paga.
- [ ] **6.** Troque o mês para o mês que vem:
   - Esperado: a 2ª do João, a 2ª da Fernanda, a 2ª do Henrique e a 2ª da Lúcia.

## Parte F. Cancelar matrícula

- [ ] **1.** Confeitaria Básica > ⋮ da **Fernanda** > **Cancelar matrícula**.
   - Esperado:
     - "Cancelar matrícula?";
     - "Fernanda Lima sai da turma.";
     - "A parcela que vence até hoje continua para receber." e "A parcela futura será cancelada."
   - Confirme.
- [ ] **2.** Em Cobranças, pague a 1ª parcela do **Henrique** (Pix, hoje).
- [ ] **3.** Turma > ⋮ do **Henrique** > Cancelar matrícula.
   - Esperado: "As parcelas pagas ficam." e "A parcela futura será cancelada."
   - Confirme.
- [ ] **4.** Cobranças, filtro Cursos:
   - Esperado:
     - Fernanda: a 1ª atrasada continua; a 2ª "Cancelado";
     - Henrique: a 1ª paga; a 2ª cancelada.
- [ ] **5.** Turma:
   - Esperado: "3 de 12 alunos".

## Parte G. Rematrícula com dívida anterior

- [ ] **1.** Confeitaria Básica > Matricular alunos > **Fernanda**.
   - Esperado:
     - o aviso "Fernanda Lima tem R$ 400,00 em aberto da matrícula anterior neste curso.";
     - a caixa **Cancelar as parcelas anteriores**.
- [ ] **2.** Marque a caixa. À vista, valor R$ 900,00. Matricular.
- [ ] **3.** Cobranças:
   - Esperado: a parcela atrasada antiga da Fernanda "Cancelado" e a nova de R$ 900,00 "Vence hoje".
- [ ] **4.** Repita com o **Henrique**, **sem** marcar a caixa.
   - Esperado: não aparece aviso de dívida (a parcela dele foi paga). A matrícula nova gera as parcelas novas.

## Parte H. Curso lotado e lista de espera

- [ ] **1.** **Pão Artesanal** (2 vagas): matricule **Carla** e **João**, à vista.
   - Esperado: "2 de 2 alunos", lotada.
- [ ] **2.** Matricular alunos > **Otávio**.
   - Esperado: ele vai para a **lista de espera** ("Adicionado à lista de espera.").
- [ ] **3.** Adicione também a **Lúcia** na lista de espera.
   - Esperado: a ordem Otávio 1º e Lúcia 2º.
- [ ] **4.** Cancele a matrícula do **João** no Pão Artesanal.
- [ ] **5.** Lista de espera > **Promover** o Otávio.
   - Esperado:
     - "Promover da lista de espera?";
     - depois, o diálogo do pagamento do curso (valor, parcelas, 1º vencimento).
   - Escolha 2x e Matricular.
   - Esperado: "Aluno matriculado no curso."
- [ ] **6.** Cobranças:
   - Esperado: 2 parcelas de R$ 225,00 do Otávio no Pão Artesanal.
- [ ] **7.** Lista de espera:
   - Esperado: só a Lúcia.

## Parte I. Trocar a forma de cobrança com alunos

- [ ] **1.** **Massas Frescas**: matricule o **Otávio** à vista.
- [ ] **2.** Edite a turma e troque a cobrança para **Mensalidade**.
   - Esperado: o aviso "Eles passam a pagar pela mensalidade do plano de cada um."
   - **Cancelar** (não salve).
- [ ] **3.** Troque para **Sem cobrança**.
   - Esperado: "A turma deixa de cobrar das próximas aulas."
   - Cancelar.
- [ ] **4.** Crie uma turma nova **Pizza** (Cozinha Italiana, Giulia, hoje, 19:00 às 21:00) com **Sem cobrança**.
   - Matricule a Lúcia. Ela continua na lista de espera do Pão Artesanal (a lista é por turma).
   - Edite para **Curso com valor fechado** R$ 300,00.
   - Esperado: o aviso "As matrículas atuais não ganham parcelas do curso; só as novas."
   - Salve.
   - Esperado: a Lúcia sem parcela nova em Cobranças.

## Parte J. Chamada e registro de aula

- [ ] **1.** Confeitaria Básica, aula de hoje > Fazer chamada:
   - Carla e João presentes;
   - Lúcia falta.
   - Concluir.
- [ ] **2.** Registrar aula: Carla **Evolução** "Ponto do merengue certo".
- [ ] **3.** Ficha da **Carla** > Turmas:
   - Esperado: as duas turmas (Confeitaria Básica e Pão Artesanal), com a frequência.

## Parte K. Curso encerrado e certificado

- [ ] **1.** Edite a **Confeitaria Básica** e mude **Termina em** para **ontem**.
   - Esperado: o curso termina e os matriculados ficam "Concluído" na lista da turma.
- [ ] **2.** ⋮ da **Carla**:
   - Esperado: "Certificado (Plano Pro)" com o cadeado.
   - Clique.
   - Esperado: a tela pede o Plano Pro.
- [ ] **3.** Configurações > Plano GestaraHub > **Ativar Pro**.
- [ ] **4.** Configurações > aba **Certificado** (modelo):
   - [ ] **1.** Troque o layout: **Clássico**, **Moderno**, **Limpo**.
      - Esperado: a prévia muda, com "Ana Souza" e "Confeitaria Básica" de exemplo.
   - [ ] **2.** Troque a cor (Azul-marinho, Vinho, Verde, Dourado, Grafite).
   - [ ] **3.** Texto: use **Inserir variável** e os chips (Aluno, Curso, Início, Fim, Aulas, Carga horária, Frequência, Professor, Nome do espaço, Cidade, Data de emissão).
   - [ ] **4.** Desligue **Mostrar frequência**.
      - Esperado: "Desligada, o trecho da frequência sai."
   - [ ] **5.** Assinaturas: adicione "Bruno Chef", cargo "Professor".
      - Salvar sem o nome: "Informe o nome".
   - [ ] **6.** Salvar.
      - Esperado: "Modelo de certificado salvo."
   - [ ] **7.** **Restaurar**.
      - Esperado: "Restaurar o modelo padrão?" com "Layout, cor, texto, assinaturas e logo voltam ao padrão."
      - **Cancele** (mantenha o seu).
- [ ] **5.** Confeitaria Básica > ⋮ da **Carla** > **Certificado**.
   - Esperado:
     - "Certificado de conclusão" com o nome da Carla, o curso, as datas, o número de aulas e a carga horária;
     - a assinatura do Bruno.
   - Imprimir ou salvar PDF: folha só com o certificado.
- [ ] **6.** Ficha da **Carla** > Turmas:
   - Esperado: "Concluído" na Confeitaria Básica e a ação "Certificado".
- [ ] **7.** Volte ao **Grátis**.
   - Esperado:
     - Configurações > Certificado travado ("Modelo de certificado no Plano Pro.");
     - o ⋮ da Carla volta para "Certificado (Plano Pro)".

## Parte L. Descubra o dia a dia e relatório

- [ ] **1.** Painel: card **Descubra o dia a dia** (aparece depois dos Primeiros passos).
   - Esperado: itens como "Matricular alunos no curso", "Ver as parcelas do curso", "Registrar um pagamento", "Fazer a primeira chamada", "Mandar um lembrete no WhatsApp", "Registrar a evolução de um aluno", "Ver o resultado do mês".
   - Os que você já fez aparecem marcados.
   - Clique em um item ainda não feito: abre a tela certa.
- [ ] **2.** Relatórios > **Cursos**:
   - Esperado: "Cursos com aulas ou parcelas no mês. Valores do curso inteiro." com as 3 turmas de curso e os valores recebidos e em aberto.
   - Exportar CSV.
   - Imprimir.
- [ ] **3.** Painel:
   - Esperado: o recebido do mês com as parcelas pagas (João R$ 300,00, Carla R$ 900,00, Henrique R$ 450,00).

---

## O que vou conferir no JSON

- `organization.settings`: sem regras de mensalidade pendentes; `subscription` de volta ao Grátis.
- `categories`: Confeitaria, Panificação e Cozinha Italiana.
- `classGroups`:
  - Confeitaria Básica: `billingMode: "course"`, `coursePriceCents: 90000`, `courseMaxInstallments: 3`, `endDate` = ontem;
  - Pão Artesanal: 2 vagas, 45000, 2x;
  - Massas Frescas: continua `course` (a troca foi cancelada);
  - Pizza: virou `course` com 30000.
- `charges` do tipo `course`:
  - Carla: 1 de R$ 900,00 `paid` em Pix com comprovante;
  - João: 3 de R$ 300,00, a 1ª `paid` em dinheiro;
  - Fernanda: 2 de R$ 400,00, ambas `canceled` (a futura no cancelamento e a vencida na rematrícula), e 1 nova de R$ 900,00;
  - Henrique: a 1ª paga, a 2ª `canceled`, e as parcelas novas;
  - Lúcia: 2 parcelas da Confeitaria; nenhuma da Pizza;
  - Otávio: 2 de R$ 225,00 (Pão Artesanal) e 1 de R$ 600,00 (Massas Frescas).
- `enrollments`: a 1ª matrícula da Fernanda e do Henrique `canceled`, as novas ativas; João `canceled` no Pão Artesanal.
- `waitlist`: Lúcia no Pão Artesanal; Otávio removido (promovido).
- `attendances`: chamada de hoje da Confeitaria.
- certificado: o modelo salvo (layout, cor, `showAttendance: false`, assinatura do Bruno).
- `auditLog`: matrículas com parcelas, pagamentos, desfazer pagamento, cancelamentos, promoção da lista de espera, edição da turma.
