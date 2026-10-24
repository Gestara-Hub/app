# Execução noturna de 24/10/2026: achados em aberto, organização das docs e rodada final de testes

Plano para rodar **sem ninguém por perto**, do começo ao fim. O usuário vai dormir e, de manhã, quer testar o sistema com tudo corrigido.

Leia este arquivo inteiro antes de começar. Releia a seção "Como não travar" sempre que algo der errado.

## 0. Regras que valem a noite toda

- **Só o modelo de turmas.** Esqueça os outros modelos de negócio: agendamento (barbearia, agenda, atendimentos, serviços) e entrega. Isso vale para achados, docs e testes.
  - Não corrija, não teste e não reorganize nada que seja só deles.
  - Código compartilhado pode mudar para corrigir turmas, desde que o typecheck e os testes que já existem continuem passando; não escreva teste novo para os outros modelos.
  - e2e que falhar só em tela de agendamento ou entrega: registre no diário como "fora do foco" e siga.
- **Não pergunte nada:** ninguém vai responder.
  - **Decisão de produto:** não decida. Registre no arquivo do teste geral e em `docs/pendencias.md` ("Esperando decisão sua"), com a análise e a sua recomendação, e siga para o próximo item.
- **Branch e commits:**
  - Trabalhe na branch `execucao-noturna-2026-10-24`, criada a partir da `main`.
  - Um commit por item, local, com a mensagem no padrão dos commits anteriores: `fix(area): ... (QA finding N)`, `docs: ...`, `test(e2e): ...`.
  - **Nunca dê push.** Nunca mexa na `main` depois de criar a branch.
- **Ambiente:**
  - Produção nunca: só o Supabase local e o Asaas sandbox.
  - Nunca mostre nem copie chaves, tokens ou CPF.
  - O MCP de docs do Asaas é só para leitura; nunca use `execute-request`.
- **Regras do projeto (`CLAUDE.md`):**
  - Código em inglês; tela em português simples, sem jargão.
  - Erros com `logError`/`reportError` de `@/lib/log`.
  - "Hoje" sai de `todayISO()`/`dateInSpace()` (doc `technical/22`).
  - Tarefa sem pessoa registra pela Auditoria do servidor (doc `technical/23`).
  - Telas, janelas e formulários seguem a doc `frontend/07`.
- **Migração nova:**
  - Fica em `apps/supabase/migrations`, com os índices pensados pelas consultas e comentados.
  - Aplique com `npx supabase migration up --workdir apps`.
  - Rode `pnpm --filter @gestarahub/web world:schema` se a tabela for do espaço.
- **Testes durante a noite:**
  - **Depois de cada item:** typecheck, lint, Vitest (`pnpm test`) e, se a área mexe no banco, só o teste de banco da área.
  - **Na rodada final (seção 6):** tudo, inclusive o e2e completo. Está liberado esta noite porque o computador está livre.

## 1. Diário (obrigatório)

Crie `docs/handoff/2026-10-24-diario-noturno.md` logo no começo. Atualize o diário **depois de cada item**: o número ou a etapa, o que foi feito, o commit, os testes e as observações.

O diário serve para três coisas:
- Retomar depois que o contexto for resumido ou a sessão cair. **A primeira coisa ao voltar é ler o diário e seguir do próximo item.**
- Registrar o que ficou bloqueado e por quê.
- Montar o relatório da manhã (seção 7).

## 2. Começo

1. **Árvore e branch:** `git status` precisa estar limpo (se não estiver, commite o que for da execução anterior com uma mensagem clara). Depois: `git switch -c execucao-noturna-2026-10-24`.
2. **Banco local:** `pnpm supabase:status`. Fora do ar: `pnpm supabase:start`. Migrações pendentes: `npx supabase migration up --workdir apps`.
3. **Linha de base:** `pnpm --filter @gestarahub/web typecheck`, `pnpm --filter @gestarahub/web lint` e `pnpm test`. Se algo já estiver vermelho, isso é o primeiro item: corrija e commite.
4. **Leitura, nesta ordem:**
   - `AGENTS.md` e `CLAUDE.md`;
   - `docs/pendencias.md`;
   - `docs/qa/2026-10-23-teste-geral.md`: o topo, a seção "Correções", as tabelas por área e as perguntas do fim;
   - `docs/README.md`.

## 3. Organização das docs, etapa 1 (antes dos achados)

Objetivo: cada coisa nova passa a ter lugar certo. Nesta etapa nada é movido.

1. **Skill `docs`:** troque a `.claude/skills/adr` por `.claude/skills/docs` (mantenha o formato de decisão da `adr` dentro dela). Ela diz:
   - **Tipos de doc e onde ficam:**
     - regra de negócio e o porquê em `docs/product/`;
     - como funciona (arquitetura e módulos) em `docs/technical/`;
     - como fazer (passo a passo) em `docs/guides/`;
     - telas e padrões de interface em `docs/frontend/`;
     - testes do sistema em `docs/qa/`;
     - planos para outra sessão em `docs/handoff/`;
     - o que não vale mais em `docs/archive/`.
   - **Ordem antes de escrever:**
     1. procurar o assunto no "Mapa por assunto" do README;
     2. se o assunto já tem doc, acrescentar uma seção;
     3. só criar arquivo para assunto novo, com o próximo número livre da pasta;
     4. atualizar o mapa.
   - **Cabeçalho padrão:** `Data:` · `Status:` (Proposta, Decidido, Feito ou Histórico) · `Código:` (pastas e arquivos principais) · `Testes:`.
   - **Decisão revertida ou doc substituído:** recebe o aviso `> Histórico: substituído por ...` e vai para `docs/archive/` na etapa 2.
2. **Mapa por assunto:** em `docs/README.md`, uma tabela com o assunto, o doc de regras, o doc de funcionamento e onde está no código. Só os assuntos do modelo de turmas; os outros modelos ficam numa linha "Fora do foco (agendamento e entrega)", com os docs como estão. Os assuntos:
   - acesso e segurança;
   - configuração inicial;
   - turmas e chamada;
   - alunos e acesso de alunos;
   - mensalidades e cobranças;
   - pagamento online;
   - Plano GestaraHub;
   - financeiro;
   - relatórios e documentos;
   - comunicação e lembretes;
   - Auditoria e registros;
   - fuso;
   - desempenho;
   - testes;
   - ambiente local.
3. **Ponteiros nas regras do projeto:** uma linha no `CLAUDE.md` (seção 1) e no `AGENTS.md` apontando para a skill `docs`. No `AGENTS.md`, troque o "Current work" (que ainda fala do handoff de 23/10, já concluído) por um ponteiro para este arquivo e para o diário.
4. **Cabeçalho padrão nos docs técnicos:** aplique nos de `docs/technical/` só onde falta Data ou Status, sem reescrever o conteúdo.
5. Commit: `docs: rules for where each doc goes (skill docs), map by subject`.

## 4. Achados em aberto, um por vez

Para cada achado:
1. Leia a linha do achado e o código da área.
2. Escreva o teste que falha sem a correção: Vitest; teste de banco só se a área mexe no banco; e2e só se o achado for de tela e não der para provar com Vitest.
3. Corrija e rode as checagens rápidas.
4. Registre no arquivo do teste geral:
   - uma linha em "Correções", com data e teste (o commit entra no fim do item);
   - "(corrigido)" na gravidade da linha do achado;
   - a linha "Andamento" do topo atualizada.
5. Atualize `docs/pendencias.md` se uma pendência fechou, e a doc da área se a regra mudou.
6. Commite, ponha o hash na tabela "Correções" (no mesmo commit, com `git commit --amend --no-edit` antes de seguir) e anote no diário.

Achado novo no caminho: numere a partir de 82 e ponha na tabela da área. Corrija se for pequeno e da mesma área; senão, registre também em `docs/pendencias.md`.

### 4.1 `média`, nesta ordem
1. **#28:** trocar o plano do aluno refaz a cobrança em aberto sem confirmação. Ação de dinheiro: `useConfirmAction`, dizendo o que muda.
2. **#26:** pacote que vale 90 dias aceita parcelas até 9 meses depois do fim. Se as docs de cobrança (`product/15`, `product/20`) não disserem que as parcelas não passam da validade, é decisão de produto: registre e siga.
3. **#62:** o extrato em PDF de Recebimentos online diverge da tela (forma e saldo).
4. **#2:** o selo do Painel e o texto embaixo contam coisas diferentes.
5. **#4:** os cartões de Recebimentos online se contradizem sobre a tarifa de saque/transferência. Confirme a tarifa no MCP de docs do Asaas (só leitura).
6. **#67:** Configurações → Plano lista "Pagamento online" como recurso do Profissional, mas ele já é do Grátis (`TIER_FEATURES`).
7. **#61:** sem CPF do aluno, "Gerar Pix" mostra só um aviso que some. O erro fica na janela, com o caminho para cadastrar o CPF.
8. **#68:** a Auditoria diz "cancelou a matrícula" quando só a cobrança do curso foi cancelada.
9. **#48:** "concluiu o curso Yoga Flow curso" no certificado (`withKind`).
10. **#44:** a lista marca "Termo pendente", mas a ficha do aluno menor não mostra o alerta nem a ação de enviar o termo.
11. **#25:** "Definir nível" em todo aluno da lista, inclusive sem turma ou em modalidade sem trilha.
12. **#21:** Equipe diz "Nenhum profissional cadastrado" havendo um profissional inativo.
13. **#14:** o convite aceita senha de 6 caracteres; o resto do app pede 8.
14. **#11 e #31:** avisos (toast) por cima do botão do contrato e do rodapé das janelas laterais.
15. **#69:** jargão e inglês em Preferências.

### 4.2 `baixa`, todas as que não dependem de decisão
Pela ordem do arquivo:
- #3, #5 a #10, #12, #15, #16, #19 a #24, #29, #30;
- #32 a #36, #38 a #43, #45 a #47, #49 a #52, #54, #55, #59, #63, #64, #71, #73;
- #81: a tela montada pelo servidor no fuso do espaço (doc `technical/22`, "Limites conhecidos").

Um commit por achado. Achados pequenos da mesma tela podem ir juntos, até 3, citando todos na mensagem.

### 4.3 Não fazer (dependem de decisão do usuário ou estão fora do foco)
- #1 e #72 (termos na demonstração);
- #17 e #18 (tela de Planos e taxa do Pix);
- #27 e #53 (aluno pausado);
- #57 (menor de idade);
- #70 (professor);
- #65 e #37 (mensagem para vários e visões do calendário);
- #58 (conta como pessoa física);
- #74 (barbearia: modelo de agendamento, fora do foco; não registrar análise).

Para cada um, menos o #74, deixe pronta a análise com a opção recomendada, em `docs/pendencias.md`, para o usuário só responder de manhã.

## 5. Organização das docs, etapas 2 e 3 (depois dos achados)

1. **Mover sem perder nada (`git mv`):**
   - para `docs/guides/`: `technical/14` (Asaas MCP), `technical/16` (ambiente local) e `technical/20` (tempo dos testes);
   - para `docs/archive/`: os planos já cumpridos (`technical/06` e `technical/15`, se as fatias estiverem todas feitas; `product/22`) e o que foi substituído (`product/17-onboarding-segmentos-negocio`).
   - **Não mexa** nos docs só de agendamento ou entrega (`product/04`, `product/08`, `product/12`, `product/16`, `frontend/05`, as partes de barbearia de `frontend/00` a `03`): ficam onde estão, sem editar.
   - O handoff de 23/10 vai para `docs/archive/` também.
2. **Número repetido:** resolva o `product/17` duplicado (o pitch fica com o próximo número livre).
3. **Dividir o `technical/05` (523 linhas) por assunto:**
   - financeiro continua no 05;
   - Plano GestaraHub vai para um doc de funcionamento ligado à `product/13` §6;
   - pagamento online vai para um doc próprio.
   - Os docs de cobrança (`technical/02`, `product/15`, `product/19`, `product/20`) passam a apontar uns para os outros, e o mapa do README mostra o caminho.
4. **Links (obrigatório):** depois de mover, procure e corrija toda referência aos caminhos antigos:
   - nas docs (links relativos);
   - em `CLAUDE.md`, `AGENTS.md` e `.claude/skills`;
   - nos comentários do código, que citam "doc technical/NN" e "docs/technical/...".
   - Use `rg` pelos nomes e números antigos. Crie `apps/web/scripts/check-doc-links.mjs`, que acusa link quebrado em `docs/**/*.md` e caminho `docs/...` inexistente no código, e rode até zerar.
5. Commits separados por etapa: `docs: move guides and archive`, `docs: split technical/05 by subject`, `docs: fix links after reorganization`.

## 6. Rodada final de testes (seção "Testes deixados para o fim" de `docs/pendencias.md`)

1. **Checagens:** typecheck, lint, `pnpm test`, todos os testes de banco (`pnpm --filter @gestarahub/web test:db`) e o typecheck do core (`apps/web/node_modules/.bin/tsc -p packages/core/tsconfig.json`).
2. **e2e novos a escrever** (antes de rodar o completo):
   - troca de plano: Planos → janela com a conta → Pix da diferença simulado → plano ligado; troca marcada e "Desmarcar";
   - aviso fixo do plano no topo;
   - "Histórico do plano" em Configurações;
   - seletor de fuso em Configurações → Endereço;
   - filtro "Pessoas / Sistema / Só o que falhou" na Auditoria.
   - Siga o padrão dos specs em `apps/web/e2e` e da doc 20.
3. **e2e completo:** `pnpm e2e`, de 30 a 45 minutos, em segundo plano, com o resultado salvo em arquivo. Falha só em tela de agendamento ou entrega: anote "fora do foco" e não corrija.
   - Teste que falhar: rode de novo só ele.
   - Falha que se repete: corrija se for regressão desta noite ou bug real; senão, registre como achado.
   - A disputa de URL já conhecida (doc 20 e memória `mock-removal-plan`) pode ser instabilidade: rode 2 vezes antes de concluir.
   - Por último, rode `pnpm --filter @gestarahub/web e2e:smoke`.
4. **O que dá para automatizar dos itens "à mão":**
   - **Rotina diária do plano:** com o `pnpm dev` (porta 3000) e o `CRON_SECRET` do `.env.local`, ajuste no banco local a renovação de um espaço de teste e chame `POST /api/cron/daily`. Confira o histórico, a Auditoria e o "Grátis no 5º dia".
   - **Webhook:** mande avisos de teste direto para `http://localhost:3000/api/webhooks/asaas` com o token do `.env.local`. Confira `webhook_events`, o aviso repetido e a Auditoria.
   - **Fica para o usuário:** o Pix logo depois de ativar uma subconta nova (#56) e o webhook vindo do Asaas pelo túnel.
5. Apague da tabela "Testes deixados para o fim" o que foi rodado e passou. Deixe só o que é do usuário, com o passo a passo.

## 6B. Bateria final do sistema todo (depois de tudo corrigido)

Com todas as correções e a rodada da seção 6 feitas, uma última passada no sistema inteiro, só no modelo de turmas.

1. **e2e completo de novo,** desktop e celular (`pnpm e2e`, em segundo plano, com o resultado em arquivo). Falha: rode de novo só ela, corrija se for real e rode outra vez a área afetada.
2. **Teste de tela, tela por tela, no navegador:**
   - **Ambiente:** `pnpm dev` na porta 3000, a ferramenta de navegador da sessão (ou Playwright com tela, se não houver) e uma conta de turmas criada para o teste. Pode usar o espaço de demonstração (`pnpm demo:local`).
   - **Cobertura:** a mesma do teste geral de 23/10 (`docs/qa/2026-10-23-teste-geral.md`, seção de áreas), todas as telas e janelas de turmas:
     - entrada e conta, configuração inicial, Painel e lembretes;
     - cadastros (alunos, equipe, modalidades, turmas), chamada e aulas;
     - mensalidades, cobranças, cobrar online, Recebimentos online, Financeiro, relatórios e documentos em PDF;
     - comunicação, Configurações (inclusive Plano, fuso e Preferências), Planos e troca de plano, Auditoria;
     - os perfis dono, gerente, atendente e professor.
   - **Em cada tela:**
     - desktop 1280 no tema claro e celular 390 no tema escuro;
     - o console sem erro;
     - os textos em português simples, sem jargão, sem palavra cortada e sem lista repetida;
     - os botões seguindo a doc `frontend/07`;
     - os números da tela batendo com os do banco e dos PDFs.
   - **Achados:** registre em `docs/qa/2026-10-24-teste-final.md`, no formato do teste de 23/10 (número a partir de 82, área, o que aconteceu, o esperado, como reproduzir e a gravidade).
3. **Corrigir o que aparecer:**
   - `alta` e `média`: corrija na hora, com teste e commit (mesmas regras da seção 4), e rode de novo o e2e da área.
   - `baixa`: corrija se for pequena; senão, registre em `docs/pendencias.md`.
   - Decisão de produto: registre e siga (seção 0).
   - Repita a passada só nas telas mexidas até não sobrar `alta` nem `média`. São no máximo 3 voltas; depois disso, registre o que restou.
4. **Fechamento:** o `pnpm --filter @gestarahub/web e2e:smoke` mais uma vez, para fechar verde, e o resultado da bateria no diário.

## 7. Relatório da manhã

No fim do diário, escreva para o usuário, em português simples:
- o que foi corrigido (números) e o que ficou bloqueado e por quê;
- o resultado da rodada final e da bateria final (quantos testes, as telas passadas, os achados novos, o que foi corrigido e o que ficou);
- a branch e a lista de commits;
- o **roteiro de teste da manhã**, curto e na ordem: o que abrir, o que clicar e o que esperar, cobrindo as correções da noite e os itens que ficaram para ele;
- as perguntas de produto que destravam mais achados (2 ou 3).

## Como não travar (autocorreção)

- **Checagem vermelha depois de uma correção:**
  - leia o erro inteiro e corrija;
  - até 3 tentativas por item;
  - na terceira falha, desfaça só as mudanças não commitadas deste item (`git restore --staged --worktree` nos arquivos do item; arquivos novos do item com `git clean -f <arquivo>`), anote "bloqueado: motivo" no diário e em `docs/pendencias.md` e siga.
  - Nunca deixe a branch com a checagem vermelha entre um item e outro.
- **Regressão em teste antigo:** a correção quebrou outra coisa. Ajuste a correção, não o teste. Só mude um teste antigo quando a regra mudou de propósito, e diga isso no commit.
- **Banco local:**
  - fora do ar: `pnpm supabase:start`;
  - migração falhando: corrija a migração (nunca edite uma migração já commitada antes desta noite; crie uma nova);
  - banco corrompido: `pnpm setup:local:reset` como último recurso. Apaga os dados locais; o usuário autorizou limpar o banco local. Anote no diário.
- **Servidor:**
  - porta 3000 ocupada por um servidor que você abriu: encerre o seu;
  - comando longo (e2e, banco inteiro): em segundo plano, com o resultado em arquivo, e conferido no fim;
  - comando travado mais de 15 minutos sem saída: encerre e rode só a parte que falta.
- **Contexto resumido ou sessão nova:** leia este arquivo e o diário e siga do primeiro item sem "feito". Nunca refaça um item com commit.
- **Item maior do que parece** (mexe em muitas telas ou pede tabela nova que muda o desenho): faça a parte segura, registre o resto como pendência com o motivo e siga.
- **Dúvida entre duas leituras da regra:** escolha a que as docs da área sustentam e cite a doc no commit. Sem doc que sustente, é decisão de produto (seção 0).
- **Nunca:** push, produção, `git reset --hard` em commits, apagar migração já aplicada, desligar teste para passar, mexer em dados do Asaas fora do sandbox.
