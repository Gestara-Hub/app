# Roteiro 02: Pilates e yoga (completo)

**Área:** Pilates e yoga. Vale também para Funcional e crossfit.

**Cobre:**
- área sem trilha;
- regras da mensalidade nas 4 combinações;
- planos mensal, quinzenal e semanal;
- cobrança do aluno: proporcional, desconto com validade, bolsa integral e parcial, pausa e retomada, troca de plano, inativar e reativar;
- tela de Cobranças completa: pagar, comprovante, desfazer, cancelar, reabrir, cobrança avulsa, todos os atrasos, filtros, semanal agrupado;
- Financeiro completo: resumo, lançamentos, repetição, categorias, pagamento do professor;
- Plano Pro: cobrança online, Pix e link, Pix Automático;
- relatórios Cobranças e DRE.

Comece do zero (ver [README](README.md)). Anote a **data de hoje**.

---

## Parte A. Configuração inicial

- [ ] **1.** Nome **Studio Equilíbrio**. Área **Pilates e yoga**.
   - Esperado no passo 3: "Sem etapas de evolução por enquanto. Dá para ligar depois.", com Pilates Reformer e Pilates Solo marcados. Concluir.
- [ ] **2.** Feche as boas-vindas em "Explorar por conta própria".
   - Esperado: destaque "Comece por aqui." no passo atual.
   - Esperado no checklist: **sem** "Falta revisar" em Modalidades e a etapa "Criar planos ou pacotes".
- [ ] **3.** Horários: **Seg a sáb** pelo atalho. Depois ligue Domingo (06:00 às 22:00). Salvar.

## Parte B. Regras da mensalidade (as 4 combinações)

Configurações > Geral > Regras da mensalidade. Para cada combinação, anote a simulação (1ª e 2ª mensalidade, valores e vencimentos). **Não salve** até o passo 5.

| # | Momento | Entrada no meio do mês | Esperado na simulação (aluno entra dia 20, R$ 150,00, dia 10) |
|---|---|---|---|
| 1 | Antecipado | Proporcional | 1ª no dia 20, proporcional aos dias que faltam; 2ª dia 10 do mês que vem, R$ 150,00 |
| 2 | Antecipado | Mês cheio | 1ª dia 20, R$ 150,00 (de 20 a 19 do mês que vem); 2ª dia 20 do mês que vem. O dia vira "Automático (dia da matrícula)" |
| 3 | Depois do uso | Proporcional | nada neste mês; 1ª dia 10 do mês que vem, proporcional |
| 4 | Depois do uso | Mês cheio | 1ª dia 20 do mês que vem, R$ 150,00 |

- [ ] **5.** Volte para **Antecipado + Proporcional**, dia **31**.
   - Esperado: "Nos meses mais curtos, vence no último dia."
   - Teste o dia 32: "Use um dia de 1 a 31."
   - Deixe o dia **5** e confirme.
- [ ] **6.** Mude algo e, sem salvar, clique em **Alunos** no menu.
   - Esperado: "Sair sem salvar?". Clique em "Continuar editando".
   - Troque de aba (Horários).
   - Esperado: "Alterações não salvas". Descarte.

## Parte C. Planos

- [ ] **1.** Planos e pacotes > **Novo plano**:
   - **Pilates 2x semana**, Mensal, **R$ 320,00**;
   - **Pilates Quinzenal**, Quinzenal, **R$ 170,00**;
   - **Pilates Semanal**, Semanal, **R$ 90,00**;
   - **Plano Antigo**, Mensal, R$ 200,00.
   - Esperado: os selos "Mensal", "Quinzenal" e "Semanal", e o preço com "/quinzena" e "/semana".
- [ ] **2.** Salve com o valor 0.
   - Esperado: "Informe um valor maior que zero."
- [ ] **3.** Inative o **Plano Antigo**.
   - Esperado: "Inativar plano?" ("... Quem já tem este plano continua sendo cobrado ...").
   - Esperado: o plano não aparece no cadastro de aluno.
- [ ] **4.** Equipe: **Juliana Prado**, Pilates Reformer e Pilates Solo.
- [ ] **5.** Turma **Reformer Manhã**:
   - Pilates Reformer, Juliana, 6 vagas, hoje 07:00 às 07:50, Mensalidade;
   - permitir avulso, R$ 60,00.

## Parte D. Alunos e cobrança de cada um

Cadastre (telefones (11) 98888-0001 a 0008):

| Aluno | Como paga | Detalhe | Esperado no formulário |
|---|---|---|---|
| **Helena Martins** | Paga mensalidade | Pilates 2x semana | 1ª cobrança proporcional; "Próxima: 05/..." |
| **Sofia Ribeiro** | Paga mensalidade | Pilates Quinzenal | "Dia do vencimento (1ª quinzena)", "Vence nos dias 5 e 20 de cada mês." |
| **Igor Santos** | Paga mensalidade | Pilates Semanal | sem campo de dia: "Vence a cada 7 dias, contando da matrícula." |
| **Bruno Lima** | Bolsista, Parcial | Pilates 2x semana, 50%, motivo "+ Social" | "Plano R$ 320,00 → paga R$ 160,00 (bolsa de 50%)." |
| **Carol Dias** | Bolsista, Integral | sem plano de referência | "As mensalidades aparecem como Isento, sem cobrança." |
| **Davi Rocha** | Paga mensalidade | 2x semana, desconto fixo R$ 50,00, válido até o fim do mês que vem | "Plano R$ 320,00 → paga R$ 270,00." |
| **Elisa Prado** | Paga mensalidade | 2x semana, desconto 100% | "isento (desconto do valor todo)" |
| **Fábio Nunes** | Paga mensalidade | 2x semana, "Personalizar regra deste aluno": Depois do uso + Mês cheio | chip "Regra deste aluno: ..."; 1ª vence no mês que vem |

Testes do formulário:
- [ ] **1.** Bolsa parcial de **100%**.
   - Esperado: "Use de 1% a 99%. Para 100%, escolha bolsa integral."
- [ ] **2.** 1ª cobrança vazia.
   - Esperado: "Informe o valor da 1ª cobrança."
- [ ] **3.** 1ª cobrança 0, com o cálculo maior que zero.
   - Esperado: "Use um valor maior que zero. Para não cobrar, use desconto ou bolsa."
- [ ] **4.** 1ª cobrança de R$ 200.000.
   - Esperado: "Valor muito alto ..."
- [ ] **5.** Desconto fixo de R$ 400 no plano de R$ 320.
   - Esperado: "O desconto passa do valor do plano (R$ 320,00)."

Matricule todos na Reformer Manhã: 8 alunos em 6 vagas, com **Matricular mesmo assim (8)**.

## Parte E. Tela Cobranças

### E1. Visão geral

- [ ] **1.** Cobranças (mês atual).
   - Esperado nos cartões:
     - "Total ativo";
     - "Recebido";
     - "Em atraso";
     - "Cancelado" com o selo "Não cobrado".
   - Esperado nas linhas:
     - Carol com o selo "Bolsista" (isento) e o preço cheio riscado;
     - Bruno com o selo "Bolsa 50%";
     - Elisa isenta;
     - Igor agrupado ("R$ 90,00/semana", "N parcelas", "Ver parcelas"), e ao abrir "N cobranças no mês";
     - Sofia por quinzena;
     - Fábio sem cobrança neste mês.
- [ ] **2.** Filtros:
   - Tipo "Mensalidades";
   - Situação "Isentas" e depois "Pendentes", com a contagem em cada opção;
   - busca "Helena".
   - Volte para "Todos".

### E2. Pagar, comprovante e desfazer

- [ ] **1.** ⋮ da **Helena** > **Marcar pago**:
   - Esperado: "Registrar pagamento", com "Registrar pagamento" desligado até escolher a forma.
   - Pix, "Pago em" **ontem**, anexe um PDF ou imagem como comprovante.
   - Esperado: "Pagamento registrado (Pix)." e a linha "pago via Pix em dd/MM · com comprovante".
- [ ] **2.** Tente "Pago em" amanhã.
   - Esperado: "A data do pagamento não pode ser futura."
- [ ] **3.** Menu da linha paga > **Ver comprovante**: abre o arquivo.
- [ ] **4.** **Desfazer pagamento**.
   - Esperado: "Desfazer pagamento?" e depois "Pagamento desfeito."
   - Pague de novo em Dinheiro, hoje.
- [ ] **5.** Na **Carol** (isenta):
   - Esperado: nenhuma ação.

### E3. Cancelar e reabrir

- [ ] **1.** ⋮ do **Davi** > **Cancelar cobrança**:
   - Esperado: "Cancelar a cobrança?", com o motivo e os chips "+ Plano errado", "+ Cobrança duplicada", "+ Aluno desistiu".
   - Escolha "Cobrança duplicada" > Cancelar cobrança.
   - Esperado: "Cobrança cancelada com sucesso."
- [ ] **2.** Clique em **Reverter**.
   - Esperado: "Reabrir cobrança?" e depois "Cobrança reaberta."

### E4. Cobrança avulsa

- [ ] **1.** **Nova cobrança** com tudo vazio.
   - Esperado: "Selecione o aluno.", "Descreva a cobrança." e "Informe o valor." (o valor começa vazio).
- [ ] **2.** Aluno **Helena**, sugestão "+ Material", **R$ 100,00**, **3x**, vencimento hoje.
   - Esperado: "3x de R$ 33,34 (a primeira) e R$ 33,33: ..." e "3 parcelas lançadas."
- [ ] **3.** Repita "Material" para a Helena.
   - Esperado: "Cobrança repetida?" ("Helena Martins já tem "Material". Lançar outra?"). Clique em Voltar.
- [ ] **4.** "Taxa de matrícula" R$ 50,00 para o **Igor** com vencimento em 2020.
   - Esperado: "Data que já passou: a cobrança entra atrasada." e, ao lançar, "Vencimento no passado?". Lance assim.

### E5. Todos os atrasos

- [ ] **1.** Esperado no mês atual: a faixa "R$ X em atraso de meses anteriores · Ver todos os atrasos" (pela taxa de 2020).
- [ ] **2.** Clique em **Ver todos os atrasos**.
   - Esperado: "Cobranças em atraso de todos os meses, até hoje.", a taxa com vencimento "dd/MM/2020" (com o ano) e "Ver por mês".

### E6. Meses

- [ ] **1.** Vá para o mês que vem.
   - Esperado: as mensalidades do Fábio (depois do uso) e as próximas de todos.
- [ ] **2.** Vá para dois meses à frente.
   - Esperado: "As mensalidades deste mês aparecem quando ele começar."

## Parte F. Mudanças no aluno

- [ ] **1.** **Davi** > Editar: troque o desconto para R$ 30,00.
   - Esperado: "Plano R$ 320,00 → paga R$ 290,00. Vale a partir do próximo período; o atual não muda."
   - Salve. Em Cobranças, a do mês continua R$ 270,00 e a do mês que vem fica R$ 290,00.
- [ ] **2.** **Sofia** > Editar > troque o plano para **Pilates 2x semana**.
   - Esperado: o aviso de troca (o período já pago não é cobrado de novo, ou a 1ª do plano novo). Em Cobranças, as quinzenas futuras aparecem como "Substituídas" (filtro "Substituídas" ou "Mostrar").
- [ ] **3.** **Igor** > Editar > Situação da assinatura **Trancada / Pausada**.
   - Esperado: as semanas futuras canceladas pelo sistema, com "Reverter" desligado e o motivo do sistema.
   - Volte para **Ativa** e confirme que recomeça a cobrar a partir de hoje.
- [ ] **4.** **Plano** > edite **Pilates 2x semana** para R$ 340,00.
   - Esperado: "Mudar o valor do plano?" ("... a partir da próxima mensalidade. As já geradas ficam como estão.").
- [ ] **5.** No mesmo plano, a periodicidade:
   - Esperado: travada, com "Plano com alunos: para mudar, crie outro plano."
- [ ] **6.** **Bruno** > Inativar:
   - Esperado:
     - "Inativar aluno?";
     - "A matrícula em Reformer Manhã será encerrada. Reativar não matricula de novo.";
     - a escolha "Manter para receber" / "Cancelar a cobrança".
   - Escolha **Cancelar a cobrança**.
   - Esperado: "Aluno inativado." e a mensalidade cancelada (pelo usuário, dá para reabrir).
- [ ] **7.** Reative o Bruno.
   - Esperado: "Aluno reativado." Ele não volta para a turma.

## Parte G. Aula avulsa paga e remoção

- [ ] **1.** Reformer Manhã de hoje > Adicionar aluno nesta aula > **Aula avulsa** com o **Fábio**.
   - Esperado: "R$ 60,00", "Aluno avulso adicionado com cobrança gerada."
- [ ] **2.** Em Cobranças, filtro "Aulas avulsas":
   - Esperado: a do Fábio com o selo "Aula Avulsa".
- [ ] **3.** Remova o Fábio da aula.
   - Esperado: a avulsa cancelada pelo sistema.

## Parte H. Financeiro

### H1. Resumo simplificado

- [ ] **1.** Esperado:
   - "Saldo do mês";
   - "Entrou" com "+ R$ X a receber no mês";
   - "Saiu";
   - "Em atraso" com a taxa de 2020 ("R$ ... de meses anteriores") e "Cobrar alunos atrasados".
- [ ] **2.** Clique em "Cobrar alunos atrasados".
   - Esperado: vai para Cobranças em "todos os atrasos".

### H2. Categorias e lançamentos

- [ ] **1.** "Novo lançamento" > Saída > Categoria > **+ Gerenciar categorias**: crie **Aluguel** e **Manutenção**.
- [ ] **2.** Lançamentos:
   - **Aluguel** R$ 2.000,00, vence dia 5, **Repetir todo mês**.
     - Esperado: "Lançamento criado. Ele vai se repetir todo mês."
   - **Conserto do Reformer** R$ 350,00, Manutenção, vence hoje, "Já foi pago" Pix, com comprovante.
   - Entrada "Venda de garrafinha" R$ 40,00 (crie a categoria de entrada "Loja").
- [ ] **3.** Lista:
   - Esperado: a linha agrupada "Mensalidades de {mês}" ("N pagas · N pendentes ...", "Ver em Cobranças"), a de "Aulas avulsas" e a de "Cobranças avulsas".
- [ ] **4.** Aluguel > Editar > mude o valor para R$ 2.100,00.
   - Esperado: "Alterar lançamento que se repete": **Este e os próximos**.
- [ ] **5.** Aluguel > **Encerrar repetição**.
   - Esperado: o texto explica e mostra "Repetição encerrada. N lançamentos cancelados."
- [ ] **6.** Conserto > **Desfazer pagamento** > **Cancelar**.
   - Tente **Excluir** um pago.
   - Esperado: "Lançamento que já foi pago não pode ser excluído. Cancele em vez disso."
- [ ] **7.** Filtros: tipo, situação, categoria e busca.

### H3. Professores

- [ ] **1.** Professores > Juliana > **Configurar pagamento**, com duas partes:
   - "Fixo mensal" R$ 1.000,00;
   - "% do que os alunos pagaram" 30%;
   - dia do pagamento 5.
   - Esperado: "Pagamento configurado." e a Juliana com "Prévia".
- [ ] **2.** Abra a Juliana.
   - Esperado:
     - as etapas "Prévia → Fechado → Pago";
     - o "Cálculo";
     - "Aulas contadas" e "Aulas previstas".
- [ ] **3.** Ajustes:
   - Bônus "Feriado" R$ 100,00;
   - Vale R$ 5.000,00.
   - Esperado: "Os descontos deixam o total do mês negativo."
   - Remova o vale.
- [ ] **4.** **Fechar mês** (o mês atual).
   - Esperado: o aviso de mês em andamento. Confirme: "Mês fechado."
- [ ] **5.** Pagar, com Pix e comprovante.
   - Esperado: a saída entra no caixa (categoria Professores).
- [ ] **6.** Mais ações > **Reabrir mês**.
   - Esperado: "Desfaça o pagamento antes de reabrir o mês."
- [ ] **7.** Desfaça o pagamento e reabra.
- [ ] **8.** Lançamentos:
   - Esperado: a linha "Pagamento de Juliana Prado ({mês}, prévia)" com "Ver professores".
- [ ] **9.** Pagamento atrasado depois do fechamento:
   - [ ] **1.** feche o mês da Juliana;
   - [ ] **2.** em Cobranças, pague uma mensalidade em aberto do mês;
   - [ ] **3.** desfaça esse pagamento.
   - Esperado: "Desfazer pagamento?" avisa "Ela já entrou no pagamento do professor de {mês}, que está fechado: o valor fechado não muda" (se a cobrança tinha sido contada).

### H4. Resumo avançado

Troque "Visão" para **Avançada**. Esperado:
- "Lucro líquido" com margem e "Sobrou" ou "Faltou";
- "Entradas pagas" com "Bolsas concedidas";
- "Inadimplência";
- "Fluxo de caixa dos últimos 6 meses";
- "Receitas e custos por categoria" (clicar leva aos Lançamentos filtrados);
- "Contas a pagar: atrasadas e próximos 7 dias".

## Parte I. Plano Pro: cobrança online e Pix Automático

- [ ] **1.** Configurações > Pagamento online.
   - Esperado: "Disponível no Plano Pro".
- [ ] **2.** Configurações > Plano GestaraHub > **Ativar Pro (demonstração)** > confirme.
   - Esperado: "Plano Pro ativado."
- [ ] **3.** Pagamento online:
   - ligue "Cobrar online";
   - chave Pix **studio@equilibrio.com**;
   - validade "24 horas (recomendado)";
   - Salvar.
   - Esperado: "Pagamento online salvo e ligado."
- [ ] **4.** Cobranças > ⋮ do **Davi** > **Cobrar online** > Pix > Gerar Pix.
   - Esperado:
     - QR ilustrativo;
     - "Pix copia e cola" com "Copiar" ("Código Pix copiado.");
     - "Válido até ...".
- [ ] **5.** **Simular pagamento** > confirme.
   - Esperado: "Pagamento online confirmado."
   - Esperado na linha: "Pago online", sem desfazer, e o ícone explicando que seria um estorno.
- [ ] **6.** Em outro aluno: Link de pagamento > "Gerar outro".
   - Esperado: o código anterior é cancelado.
   - Depois, **Marcar pago** manual: o código em aberto some.
- [ ] **7.** **Helena** > Editar > "Pix Automático":
   - [ ] **1.** **Solicitar Pix Automático** > limite R$ 300,00 (abaixo dos R$ 340,00 do plano) > Enviar solicitação.
      - Esperado: "Aguardando autorização".
   - [ ] **2.** **Simular autorização**.
      - Esperado: "Pix Automático ativo".
      - Esperado: o aviso "O plano (R$ 340,00) passa do limite autorizado..." e, em Cobranças, o selo "Acima do limite do Pix Automático".
   - [ ] **3.** **Revogar**.
- [ ] **8.** Volte ao Grátis no fim ("Voltar ao Grátis").
   - Esperado: "Cobrar online (Plano Pro)" travado.

## Parte J. Relatórios e Painel

- [ ] **1.** Relatórios > **Cobranças e inadimplência** (mês atual):
   - Esperado: colunas Aluno, Vencimento, Valor, Status, Pagamento, Forma, em português ("Pago", "Pix").
   - **Exportar CSV**.
   - Esperado: o arquivo `relatorio-cobrancas-AAAA-MM.csv`, que abre no Excel com valores "250,00" e datas dd/MM/aaaa.
- [ ] **2.** **DRE gerencial**:
   - no Grátis, travado;
   - com o Pro, os totais do mês.
- [ ] **3.** **Imprimir ou salvar PDF**.
   - Esperado: folha clara, sem o menu, mesmo no tema escuro.
- [ ] **4.** Painel:
   - "Mensalidades recebidas" com a dica "R$ X pendente · R$ Y atrasado";
   - "Para fazer hoje" com "N cobranças em atraso" e "Cobrar".

---

## O que vou conferir no JSON

- `organization.settings`:
  - `billingTiming: "prepaid"`, `midMonthStrategy: "prorated"`, `defaultDueDay: 5`;
  - `onlinePayments` ligado com a chave;
  - sem `modalitiesReviewed: false`.
- `plans`:
  - 4 planos, o antigo `inactive`;
  - 2x semana com R$ 340,00 e `period: "monthly"`.
- `clients`:
  - Bruno inativo e depois ativo;
  - Carol com bolsa integral (`scholarship`);
  - Davi com desconto fixo de R$ 30,00 e `validUntil`;
  - Elisa 100%;
  - Fábio com `cyclePaymentTiming: "postpaid"`, `billingStrategy: "full_cycle"`;
  - Igor `membershipStatus` ativo.
- `charges`:
  - isentas (`waived`);
  - semanais do Igor, com as da pausa `canceled` pelo sistema;
  - quinzenas da Sofia `replaced`;
  - avulsas "Material" 3x (R$ 33,34 + 2x R$ 33,33);
  - taxa de 2020;
  - pagamento da Helena com `paidAt`, `method` e `attachments`;
  - Davi `paidVia: "online"`.
- `enrollments`: Bruno `canceled` ("Aluno inativado").
- `reservations`: avulsa do Fábio `canceled`.
- `financialEntries` e `financialRecurrences`: aluguel com repetição encerrada; conserto cancelado; venda de garrafinha.
- `financialCategories`: Aluguel, Manutenção, Loja.
- `teacherPayRules` e `teacherPayouts`: a Juliana com as duas partes; o mês com os ajustes.
- `onlinePayments`: Pix pago e link cancelado.
- `recurringAuthorizations`: Helena `revoked`.
- `organization.subscription.tier: "free"` no fim.
- `auditLog`: pagamentos, cancelamentos, plano, troca do Plano GestaraHub ("Sensível") e "ligou a cobrança online".
