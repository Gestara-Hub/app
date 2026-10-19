# Roteiro 03: Idiomas e reforço (completo)

**Área:** Idiomas e reforço. Vale também para Dança, Música, Natação e esportes.

**Cobre:**
- landing (deslogado e logado), cadastro, login, 404 e rotas protegidas;
- trilha de níveis;
- notas em todas as escalas (pesos, médias, boletim, data da avaliação);
- ficha do aluno (avisos de faltas seguidas e aniversário, seções, links ?tab=);
- Comunicação completa: assistido, Plano Pro com WhatsApp oficial, modelos, histórico, métricas, parabéns automático;
- Painel (aniversariantes, faltas);
- relatórios Lista de presença, Relação de alunos e Aniversariantes (CSV e impressão);
- Configurações gerais: dados, endereço, tema, sair sem salvar, apagar dados.

---

## Parte A. Landing, cadastro e acesso

### A1. Landing sem sessão

- [ ] **1.** Limpe tudo: Configurações > **Dados** > "Apagar dados da demonstração" > **Apagar tudo**. Ou use o comando do README.
   - Esperado: volta para o login.
- [ ] **2.** Abra `http://localhost:3000/`. Esperado:
   - menu "Parte chata", "O sistema", "Áreas", "Recursos", "Dúvidas";
   - "Entrar" e "Criar conta grátis";
   - a barra de rolagem no topo.
- [ ] **3.** Hero:
   - Esperado: "Chega de caderno e planilha." sem a palavra "planilha." sozinha na linha (teste também no celular).
- [ ] **4.** "O sistema":
   - Esperado: as abas "Chamada", "Cobranças", "Ficha do aluno" com os prints atuais. Troque o tema e os prints mudam.
- [ ] **5.** Celular (largura 390):
   - abra o menu;
   - feche com **Esc**;
   - abra e toque fora: fecha também.
   - Esperado: só "Criar conta" fica sempre à vista.
- [ ] **6.** Rodapé: abra **Termos de uso** e **Política de privacidade**.
   - Esperado: "Última atualização: ...".
- [ ] **7.** Endereço inexistente `/nao-existe`.
   - Esperado: "Erro 404 / Página não encontrada".
- [ ] **8.** Endereço do app sem sessão `/classes`.
   - Esperado: vai para o login (`?from=/classes`).

### A2. Cadastro

- [ ] **1.** "Criar conta grátis" > envie vazio.
   - Esperado: "Informe seu nome." e "Informe seu e-mail."
- [ ] **2.** E-mail inválido.
   - Esperado: "Informe um e-mail válido."
- [ ] **3.** Nome **Mariana Costa**, e-mail **mariana@falafacil.com** > Criar conta grátis.
   - Esperado: "Criando sua conta…" e depois o assistente (/setup).

### A3. Configuração inicial

- [ ] **1.** Nome **Escola Fala Fácil**. Área **Idiomas e reforço**. Concluir com **Inglês** e **Espanhol**.
- [ ] **2.** Volte para `http://localhost:3000/`.
   - Esperado:
     - "Ir para o painel" no topo;
     - no lugar do cadastro, "Você já está na conta de Mariana Costa.", com "Ir para o painel".
- [ ] **3.** Abra `/login` com a sessão aberta.
   - Esperado: vai direto para o Painel.
- [ ] **4.** Abra `/setup` de novo.
   - Esperado: vai para o Painel (a configuração inicial já foi feita).

## Parte B. Configuração e modalidades

- [ ] **1.** Horários: todos os dias, 06:00 às 22:00. Regras: confirme as recomendadas.
- [ ] **2.** Modalidades > **Inglês**:
   - Esperado:
     - trilha de **níveis**;
     - "Esta modalidade tem avaliações" ligado;
     - escala "0 a 10";
     - mínima 6.
   - "Está tudo certo".
- [ ] **3.** Edite o **Espanhol**: escala **A a E**, mínima **C**.
- [ ] **4.** Crie **Redação**:
   - trilha "Módulos";
   - avaliações com escala **Apto**.
   - Esperado: "Aprova quem fica apto."
- [ ] **5.** Crie **Matemática** com avaliações **0 a 100**, mínima 60.
- [ ] **6.** Equipe: **Marina Costa** (Inglês, Espanhol), **Paulo Reis** (Redação, Matemática).
- [ ] **7.** Plano **Mensal Idiomas** R$ 250,00.
- [ ] **8.** Turmas, todas com o dia de hoje:
   - **Inglês Básico A** (Marina, 19:00 às 20:00);
   - **Espanhol Inicial** (Marina, 20:00 às 21:00);
   - **Redação ENEM** (Paulo, 18:00 às 19:00);
   - **Matemática Reforço** (Paulo, 19:00 às 20:00).

## Parte C. Alunos

Cadastre, todos "Paga mensalidade" no Mensal Idiomas:

| Aluno | Nascimento | Telefone | Extra |
|---|---|---|---|
| **Rafael Moura** | 15/08/2010 | (11) 97777-1111 | Responsável **Paula Moura** (Mãe) e **Jorge Moura** (Pai) |
| **Larissa Campos** | **hoje, 1998** (faz aniversário hoje) | (11) 97777-2222 | |
| **Diego Nunes** | **amanhã, 2000** (aniversário amanhã) | (11) 97777-3333 | |
| **Beatriz Lima** | 29/02/2004 | (11) 97777-4444 | |
| **Tomás Rey** | 10/10/2015 | (11) 97777-5555 | sem responsável (só o aviso, não bloqueia) |

- [ ] **1.** Matricule:
   - Rafael, Larissa e Diego em **Inglês Básico A** e **Redação ENEM**;
   - Beatriz e Tomás em **Espanhol Inicial** e **Matemática Reforço**.
- [ ] **2.** Lista de alunos:
   - Esperado:
     - Larissa com "Aniversário hoje" e Diego com "Aniversário amanhã";
     - "Definir nível" (palavra da trilha, não "faixa") para quem não tem nível.
   - Clique num selo "Definir nível" e defina o 1º nível do Rafael em Inglês.
- [ ] **3.** Ficha da **Beatriz** > Cadastro:
   - Esperado: a idade certa. Em ano não bissexto, o aniversário cai em 28/02.

## Parte D. Notas

### D1. Inglês (0 a 10)

- [ ] **1.** Inglês Básico A > aba **Avaliações** > **Nova avaliação**:
   - [ ] **1.** Nome "+ Prova" ("Prova"), data **amanhã**.
      - Esperado: "A avaliação não pode ter data futura."
   - [ ] **2.** Data de hoje, peso **2**.
      - Esperado: "Avaliação criada."
   - [ ] **3.** Crie também "Trabalho", data de hoje, peso **1,5**.
   - [ ] **4.** Teste o peso 0.
      - Esperado: "O peso precisa ser maior que zero."
- [ ] **2.** **Lançar notas** da Prova:
   - [ ] **1.** Rafael **8,5**, Larissa **5**, Diego **Faltou**.
   - [ ] **2.** Teste **11**.
      - Esperado: "A nota vai de 0 a 10."
   - [ ] **3.** Teste **7,55**.
      - Esperado: "Use no máximo uma casa decimal."
   - [ ] **4.** Salve.
      - Esperado: "Notas salvas.", "Lançadas 3 de 3 · Mínima 6" e Larissa destacada abaixo da mínima.
- [ ] **3.** Trabalho: Rafael 9, Larissa 7, Diego "Sem nota".
- [ ] **4.** Esperado na aba:
   - "Média da turma";
   - cada avaliação com "N de M lançadas" e a média em vermelho quando abaixo da mínima.
- [ ] **5.** Ficha do **Rafael** > Evolução > **Notas** (boletim):
   - Esperado: "Média geral" ponderada: (8,5×2 + 9×1,5) ÷ 3,5 = 8,7.
   - Esperado: "Avaliações (2)".
- [ ] **6.** Exclua o "Trabalho".
   - Esperado: "Excluir avaliação?" e depois "Avaliação excluída."

### D2. Espanhol (A a E), Redação (Apto) e Matemática (0 a 100)

- [ ] **1.** **Espanhol**: avaliação "Prova oral", Beatriz **B**, Tomás **D**.
   - Esperado: Tomás abaixo da mínima C.
- [ ] **2.** **Redação**: "Redação 1", Rafael **Apto**, Larissa **Não apto**, Diego Faltou.
   - Esperado: a média em "N% aptos".
- [ ] **3.** **Matemática**: "Simulado", Beatriz **75**, Tomás **59**.
   - Teste 75,5: "Use uma nota inteira."
- [ ] **4.** Aluno matriculado depois da prova:
   - [ ] **1.** Matricule um aluno novo **Nina Alves** no Inglês hoje.
   - [ ] **2.** Edite a "Prova" para a data de **ontem**.
   - [ ] **3.** Abra Lançar notas.
   - Esperado: a Nina não aparece (entrou depois da avaliação).
   - Volte a data da prova para hoje.

## Parte E. Chamada, faltas seguidas e evolução

- [ ] **1.** Inglês Básico A, aula de hoje:
   - Rafael e Larissa presentes, Diego **falta**.
   - Concluir chamada.
- [ ] **2.** Faltas seguidas: o Diego precisa de 3 faltas seguidas em aulas com chamada feita.
   - Se a turma só tem aula hoje, crie mais 2 encontros (outros dias desta semana que já passaram não valem, porque ele foi matriculado hoje).
   - Alternativa: marque falta do Diego em 3 turmas diferentes de hoje.
   - Esperado depois de 3 faltas:
     - na ficha do Diego, "Faltou nas últimas 3 aulas" com "Mandar mensagem";
     - no Painel, "1 aluno com 3 faltas seguidas".
- [ ] **3.** Registrar a aula do Inglês:
   - Rafael **Evolução** "Leitura melhorou";
   - Larissa **Ajustar** "Revisar verbos".
- [ ] **4.** Ficha do Rafael > Evolução > botão **Níveis**:
   - Esperado:
     - a jornada com o nível atual e as metas;
     - os termos "Avançar" e "Avanço", não "Graduar".
   - Avance para o 2º nível, data de hoje.
   - Esperado: "Registrado: ..." e o cartão "Avanço em dd/MM/aaaa".

## Parte F. Ficha do aluno

- [ ] **1.** Ficha da **Larissa**:
   - Esperado: o aviso "Faz aniversário hoje" com **Mandar parabéns**.
- [ ] **2.** Ficha do **Diego**:
   - Esperado:
     - "Faz aniversário amanhã" **sem** o botão de parabéns (só no dia);
     - o aviso das faltas (se E2 deu certo).
- [ ] **3.** Seções:
   - Esperado: Turmas, Cobranças, Evolução, Mensagens e Cadastro, todas fechadas.
   - Abra `/clients/{id}?tab=messages`: abre a seção Mensagens.
   - Teste `?tab=charges` e `?tab=data`.
- [ ] **4.** Turmas:
   - Esperado: "2 turmas · próxima hoje, 19:00" e a frequência de cada uma.
- [ ] **5.** Cadastro do Rafael:
   - Esperado: os dois responsáveis, com o telefone de cada um.
- [ ] **6.** ⋮ da ficha:
   - Esperado: "Editar cadastro", "Enviar WhatsApp", "Nova cobrança", "Vender pacote", "Inativar".
- [ ] **7.** Botão "Voltar":
   - turma > ficha > Voltar: volta para a turma;
   - ficha > turma > ficha > Voltar: volta para a turma, não para a lista de Turmas.

## Parte G. Comunicação (envio assistido, Plano Grátis)

- [ ] **1.** Comunicação.
   - Esperado:
     - "Envio assistido";
     - métricas "Abertas no WhatsApp" e "Recebido depois de lembrete";
     - abas "Mensagens", "Histórico", "Conexão".
- [ ] **2.** Mensagens:
   - Esperado: os grupos "Cobrança (6)", "Relacionamento (5)", "Avisos (3)". No celular, só o primeiro aberto.
- [ ] **3.** "Editar texto" de **Aniversário**:
   - [ ] **1.** Esperado: o contador "N de 900".
   - [ ] **2.** Inclua "{apelido}".
      - Esperado: "{apelido} não existe neste modelo. A frase com ela sai da mensagem."
   - [ ] **3.** Use os chips de variável ("+ Nome do aluno").
   - [ ] **4.** Salve.
      - Esperado: "Mensagem salva."
- [ ] **4.** Ficha da Larissa > **Mandar parabéns**.
   - Esperado:
     - abre o WhatsApp (nova aba) com o texto;
     - o aviso troca para "Enviado hoje às HH:mm";
     - no Painel, "Parabéns enviado".
- [ ] **5.** **Nova mensagem** (topo):
   - [ ] **1.** Aluno **Rafael**.
      - Esperado: os chips de modelo ("Mensalidade a vencer", "Boas-vindas" e outros, e no fim "Aula cancelada", "Mudança de horário", "Feriado ou recesso").
   - [ ] **2.** Escolha "Parabéns pelo avanço".
      - Esperado: "{nivel}" vira o nível novo.
   - [ ] **3.** Troque o aluno para **Larissa** sem mexer no texto.
      - Esperado: o texto do modelo some.
   - [ ] **4.** Escreva "Parabéns pela prova! 🎉".
      - Esperado: "22 de 1000".
   - [ ] **5.** Abrir no WhatsApp.
- [ ] **6.** Histórico:
   - Esperado: as mensagens com "Aberto no WhatsApp".
   - Filtros: tipo **Avisos**, **Relacionamento**, **Avulsa**; situação "Aberto no WhatsApp".
   - Abra uma mensagem.
   - Esperado: "O WhatsApp foi aberto com esta mensagem...".
- [ ] **7.** Conexão (Grátis):
   - Esperado: "Envio assistido" em uso e o painel travado do WhatsApp oficial.

## Parte H. Comunicação no Plano Pro (WhatsApp oficial)

- [ ] **1.** Configurações > Plano GestaraHub > **Ativar Pro**.
- [ ] **2.** Comunicação > Conexão:
   - Esperado: "Cadastre o telefone do espaço em Configurações antes de conectar."
   - Configurações > Geral > Dados do espaço > telefone (11) 3333-4444 > Salvar.
- [ ] **3.** Conexão > **Conectar WhatsApp oficial**.
   - Esperado: "WhatsApp oficial conectado." e a "Franquia do mês 0 de 1000".
- [ ] **4.** "Horário de envio automático":
   - De 20:00 até 08:00: "O início precisa ser antes do fim.";
   - 08:00 até 20:00: "Horário salvo."
- [ ] **5.** Mensagens:
   - Esperado: o interruptor "Automático" nos lembretes e nenhum nos manuais (Aula cancelada e outros).
   - Ligue o automático de **Aniversário**.
- [ ] **6.** Ficha da **Larissa** (ou recarregue a Comunicação).
   - Esperado: o parabéns automático aparece no Histórico como "Entregue" (se já passou do horário do modelo) e a franquia sobe.
- [ ] **7.** Ficha do **Diego** > "Mandar mensagem" do aviso de faltas.
   - Esperado: a confirmação "Enviar para Diego Nunes?" com o texto todo > Enviar.
   - Esperado: "Mensagem enviada para Diego Nunes."
- [ ] **8.** Métricas:
   - Esperado: "Enviadas no mês", "Entregues" e "Lidas" em %.
- [ ] **9.** **Desconectar**.
   - Esperado: "Desconectar o WhatsApp oficial?" e depois volta para o assistido.
- [ ] **10.** Volte ao **Grátis**.

## Parte I. Relatórios

- [ ] **1.** **Lista de presença**:
   - Esperado:
     - as escolhas "Turma" e "Aula" (padrão: a última aula do mês até hoje);
     - "presentes", "faltas", "sem marcação".
   - Troque a turma para Espanhol Inicial.
   - Exportar CSV.
   - Esperado: `relatorio-lista-de-presenca-AAAA-MM-DD.csv`.
- [ ] **2.** **Relação de alunos**:
   - Esperado: os alunos do mês, com o plano e o nível.
   - Troque o mês para o mês passado.
   - Esperado: ninguém (todos foram cadastrados neste mês).
- [ ] **3.** **Aniversariantes do mês**:
   - Esperado: Larissa, Diego (se no mesmo mês) e quem fizer anos no mês.
- [ ] **4.** Imprimir ou salvar PDF em qualquer um, no tema escuro.
   - Esperado: folha clara, com margem, sem o menu.

## Parte J. Configurações gerais

- [ ] **1.** Geral > Dados do espaço:
   - nome com 81 caracteres: "Use até 80 caracteres.";
   - "Área do espaço": troque e volte (não salve).
- [ ] **2.** Endereço > CEP **01310-100** > **Buscar CEP**.
   - Esperado: "Endereço preenchido pelo CEP." (precisa de internet).
   - CEP 00000-000: "CEP não localizado...".
- [ ] **3.** Tema: no topo, **Personalizador de Tema**.
   - Troque a cor de destaque e a cor do menu.
   - Recarregue: continua.
   - "Redefinir padrões".
- [ ] **4.** Botão do tema claro e escuro: troque e confira o contraste dos selos ("Ativo", "Pago", "Atual").

---

## O que vou conferir no JSON

- `users`: a dona com o nome **Mariana Costa** e o e-mail do cadastro.
- `organization`:
  - `classSegment: "languages"`;
  - telefone na unidade;
  - `subscription` de volta ao Grátis.
- `whatsAppConnection`: desconectada, com o horário 08:00 às 20:00.
- `categories`:
  - Inglês (níveis, `zero_ten`, 6);
  - Espanhol (`concept`, C);
  - Redação (módulos, `pass_fail`);
  - Matemática (`zero_hundred`, 60).
- `clients`: Rafael com 2 responsáveis; Beatriz 29/02; Tomás sem responsável; o nível do Rafael.
- `assessments`:
  - Prova (peso 2) com 8,5, 5 e falta; "Trabalho" excluído;
  - "Prova oral" (B, D), "Redação 1" (apto, não apto, falta), "Simulado" (75, 59).
- `attendances`: as faltas do Diego; as presenças de hoje.
- `clients[].progressions`: Rafael no 2º nível com `promotionHistory`; registros `positive` e `attention`.
- `messageTemplates`: Aniversário com o texto editado e o automático ligado.
- `messageLogs`:
  - parabéns da Larissa (`opened`, e `delivered` do automático);
  - "Parabéns pela prova! 🎉";
  - mensagem ao Diego `delivered`.
- `auditLog`: "abriu no WhatsApp ...", "conectou o WhatsApp oficial ...", "lançou as notas ...", "excluiu a avaliação ...".
