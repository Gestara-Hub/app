# Rodada de testes completa (18/10/2026)

Teste exploratório do modelo de turmas em 5 frentes, mais a suíte automática completa. Nada foi corrigido nesta rodada: o objetivo é ter a lista para corrigirmos.

- **Como foi feito:** 5 agentes testaram em paralelo, cada um com navegador próprio (Playwright, Chrome), dados isolados, relógio em 22/09/2026 e viagens no tempo, em desktop (1280) e celular (390 e 360), parte no modo escuro. Cada achado tem passos, esperado e obtido.
- **Frentes:** ONB (landing, cadastro, configuração inicial, as 10 áreas + Outra área), COB (regras da mensalidade, Cobranças, Financeiro, repasse), TUR (turmas, chamada, calendário, espera, curso, pacotes, aluno em várias turmas), ALU (alunos, ficha, evolução, notas, comunicação), ACE (perfis, rotas, relatórios, auditoria, planos, varredura de layout).
- **Fora do escopo:** modelo de agenda (barbearia) e entrega; Safari/iOS real; WhatsApp e Pix reais (só simulados).
- **Prints e specs** de cada frente ficaram na pasta temporária da sessão (`scratchpad/qa/<frente>/`); o detalhe de cada achado está no Apêndice.

## Números

| Frente | Achados | Alta | Média | Baixa |
|---|---|---|---|---|
| ONB cadastro e configuração inicial | 33 | 5 | 10 | 18 |
| COB cobranças e financeiro | 32 | 7 | 9 | 16 |
| TUR turmas, chamada e pacotes | 30 | 8 | 10 | 12 |
| ALU alunos, ficha e comunicação | 39 | 2 | 15 | 22 |
| ACE acessos, relatórios e layout | 44 | 6 | 15 | 23 |
| **Total** | **178** | **28** | **59** | **91** |

Nenhum achado bloqueante: todos os fluxos planejados puderam ser testados. Juntando os repetidos entre frentes, ficam cerca de 160 problemas distintos.

## Testes automáticos

- **Core e Vitest:** tudo passando (204 + 857).
- **E2E (392 testes de navegador):** na primeira rodada, com a máquina disputada pelos 5 agentes, 100 falharam. Rodando de novo só esses, **82 passaram**: eram tempo esgotado ao abrir páginas (servidor de teste compilando sob carga), não bugs.
- **Os 18 que seguem falhando são testes desatualizados**, não problemas da aplicação. Corrigir na rodada de correções:
  - 12 (`areas-setup`, `configuracao-inicial`) procuram o erro do campo com `getByRole('alert')` e acham também o anúncio de rota do Next (`__next-route-announcer__`). Basta mirar o erro pelo id do campo.
  - 2 (`areas-setup`) procuram chips "Boxe" e "Ballet Clássico" com o nome antigo do setup.
  - 1 (`configuracoes`) espera o pulso antigo (`animate-attention-ring`) em "Regras da mensalidade"; hoje é o destaque com o botão tremendo.
  - 1 (`ficha-aluno`) espera "Sem mensalidade" no Cadastro de bolsista integral sem plano; a tela mostra a bolsa.
  - 2 de celular (`mobile`, `mobile-areas`) usam a âncora `#modalidades` (hoje `#areas`) e o texto antigo do título ("estúdios de pilates e yoga").
- **Erro de hidratação** apareceu nos logs (servidor em outubro, navegador congelado em setembro). No uso real ele ocorre quando servidor e navegador estão em dias diferentes; está na Prioridade 1 (itens 25 e 26).


## Prioridade 1: dados errados, dinheiro e fluxos quebrados

Corrigir primeiro. Cada item junta os achados repetidos entre frentes.

**Situação (18/10/2026): os 26 itens foram corrigidos**, com as decisões de produto abaixo. Regras nas docs 06, 11 e 15; testes de serviço novos em `money-rules`, `permissions-scope`, `packages` e `migrations`. Os testes de navegador desatualizados (lista acima) foram ajustados, mas a suíte e2e ainda não rodou de novo.

### Dinheiro
1. **Mensalidades de meses não visitados nunca nascem** (COB-01). O atraso total muda conforme os meses que alguém abre (R$ 300, R$ 450; dívida real R$ 750). Gerar na leitura todos os períodos desde a última gerada até hoje.
2. **Pix Automático quita mensalidades antigas** (COB-04). Autorizar paga na hora julho, agosto e setembro vencidos. Só vencimentos a partir da autorização.
3. **Desconto maior ou igual ao plano gera dívida de R$ 0,00** (COB-03), que vira "Atrasado" com menu de cobrar. Validar e tratar 100% como isento.
4. **Comprovante de "Marcar pago" é descartado** (COB-02). O diálogo pede o arquivo e o código não repassa.
5. **Repasse do professor perde pagamento atrasado depois do fechamento** (COB-05); desfazer pagamento de mês fechado não avisa.
6. **Rematrícula no curso cobra de novo e mantém as parcelas vencidas** (COB-06): R$ 1.400 por um curso de R$ 800.
7. **Pagamento sem data** (COB-10): tudo entra como hoje, e o caixa de setembro e outubro fica errado.
8. **Retomar assinatura pausada no meio do mês cobra o mês inteiro já atrasado** (COB-08).

### Chamada e pacotes
9. **Toques rápidos na chamada são perdidos sem aviso** (ALU-01, TUR-01). Com 300 ms entre toques, 2 de 6 ficam sem marcação. Marcação otimista e fila por aluno.
10. **Remover da aula não apaga a presença** (TUR-02): re-adicionar volta "Presente" sem gastar o pacote (aula de graça).
11. **Mudar o horário da turma esconde as aulas passadas** (TUR-03): "Aula não encontrada", e a frequência segue contando as presenças escondidas.
12. **Aula que não existe abre e aceita chamada** (TUR-14, ACE-17, ACE-31): dia sem encontro, antes do início, data inválida derruba a tela. Gasta pacote.
13. **Qual pacote paga a aula** (TUR-06, TUR-07, TUR-09, TUR-10):
    - aula em grupo gasta o pacote de particulares ("o que vence primeiro");
    - turma sem cobrança e curso oferecem "Pelo pacote" e gastam aula paga;
    - pacote comprado depois da aula paga a chamada atrasada;
    - saldo e "acabando" olham só um pacote ("Última aula" com outro pacote intacto).
    Precisa de decisão de produto (ver "Decisões").
14. **Experimental ou avulso que depois se matricula vira "matriculado" nas aulas passadas** (TUR-13); remarcar gasta o pacote.
15. **Conflito de horário ignora início e fim** (TUR-04, TUR-05): curso encerrado bloqueia o próximo curso do professor e a matrícula do aluno em outra turma no mesmo horário.

### Cadastro, sessão e dados
16. **Duas abas abertas: a gravação de uma apaga a da outra** (ACE-02). Um aluno criado some quando a outra aba cria um plano.
17. **Dona trancada fora depois de trocar nome e e-mail** (ACE-01): o login filtra por nome e e-mail fixos.
18. **/setup reabre depois de concluído e sobrescreve o espaço** (ONB-04); **"Entrar" com sessão ativa manda o dono ao /setup** (ONB-05).
19. **Revisão das modalidades sem saída** (ONB-02) quando o passo atual é outro.
20. **Área sem mensalidade pede "Confirmar regras" e acusa alterações não salvas** (ONB-03).
21. **Turma desativada continua aceitando matrícula**, abre aula futura e mantém avulso cobrado (TUR-12).
22. **WhatsApp oficial envia parabéns em dobro e manda cobranças com um toque, sem confirmação** (ALU-02); no assistido o aviso não muda depois de enviar (ALU-16).

### Permissões
23. **Atendente abre a DRE e o churn em Relatórios** (ACE-03) sem `finance:view`.
24. **Graduação sem checagem de permissão**: atendente e professor graduam, inclusive na turma de outro (ACE-05).

### Hidratação (também derruba parte do e2e)
25. **Telas que calculam "hoje" no servidor quebram quando servidor e navegador estão em dias diferentes** (ACE-09): servidor em UTC e usuário no Brasil depois das 21h, ou na virada do mês. O tema se perde (barra lateral clara). Mesma causa de boa parte das falhas do e2e (seletor de mês "Setembro" × "Outubro").
26. **Financeiro na visão "Avançada" quebra a hidratação em todo carregamento** (COB-11): lê o localStorage na primeira renderização.

## Prioridade 2: regras e experiência

**Situação (18/10/2026): os itens abaixo foram corrigidos.** Regras nas docs 06, 11 e 15 e na frontend/07; testes de serviço novos em `reports-sheets`, `finance`, `users`, `turmas`, `packages`, `progression`, `communication` e `settings`. A suíte e2e ainda não rodou (fica para o fim das correções).

- **Relatórios:**
  - Lista de Presença sempre na primeira turma, sem escolher turma nem aula (ACE-04).
  - Churn com números incoerentes (ACE-13).
  - "Projeção financeira" prometida e inexistente (ACE-12).
  - CSV em inglês e com formato técnico (ACE-14).
  - Relação de alunos ignora o mês (ACE-30).
- **Plano Scale aparece como Grátis** (ACE-11). **Dashboard diz "Todas as mensalidades quitadas" com atrasadas** (ACE-10).
- **Configurações:** sair pelo menu perde alterações sem aviso (ACE-19); horários com todos os dias fechados passam depois da 1ª vez (ONB-10).
- **Assistente:**
  - Recarregar perde o progresso (ONB-06).
  - Aulas repetidas com caixa ou acento contam mas não são criadas (ONB-07).
  - Outra área começa vazia com aviso (ONB-12).
  - Tour com textos longos e mensalidade em área de curso (ONB-13).
  - Sem limite no nome do espaço (ONB-15).
  - Nome do espaço não aparece no topo (ONB-01).
- **Chamada e turma:**
  - "Concluir chamada" com 0 presentes marca falta em todos sem confirmar (TUR-17).
  - Trocar a forma de cobrança com matriculados não avisa (TUR-15).
  - Textos de data do registro ("Aula de há 6 dias") e registro em aula futura (TUR-16).
  - "Registrar a aula" duas vezes duplica (ALU-06).
  - "Para hoje" nunca expira (ALU-05).
- **Evolução:**
  - Graduação aceita data futura (ALU-07).
  - Chip de avanço sem o grau (ALU-08).
  - Trocar tipo de trilha leva o grau (ALU-15).
  - Selo "Trocar faixa" não aparece na ficha e na lista (ALU-14).
  - Selo "Definir faixa" para quem é de módulos ou níveis (ALU-04).
  - Registro de aula de aluno sem nível cria "Faixa Branca" (ALU-26).
- **Aniversário:**
  - "Mandar parabéns" na véspera envia "Parabéns pelo seu dia" (ALU-09).
  - 29/02 em ano não bissexto com idade errada (ALU-10).
- **Telefone estrangeiro** cortado e com 55 na frente (ALU-11). **Cadastro duplicado sem aviso** (ALU-12). **Modelo aceita 5000 caracteres e o envio só 1000** (ALU-13).
- **Voltar** (ALU-17, TUR-24): turma › ficha › mesma turma › Voltar vai para Turmas. A pilha de navegação desempilha também ao ir para a frente.
- **Cobranças e Financeiro:**
  - Mudar valor do plano muda todos sem aviso (COB-12).
  - Resumo e Lançamentos não batem nas saídas e "próximos 7 dias" mostra vencidas (COB-15).
  - Vencimento no passado sem aviso (COB-16).
  - 1ª cobrança 0 ou vazia trocada em silêncio (COB-09).
- **Usuários:** dois usuários ligados ao mesmo profissional (ACE-08). **Auditoria** sem WhatsApp, troca de instrutor e presença (ACE-18).
- **Matricular alunos no celular com turma lotada:** os dois botões se sobrepõem (TUR-08).

## Prioridade 3: layout e texto (agrupado por tema)

**Situação (18/10/2026): os itens abaixo foram corrigidos no código**, junto com os de layout e texto que não estavam em nenhuma prioridade (ACE-15, ACE-27, ACE-33, ACE-34, ACE-37, ACE-44, ALU-37, COB-18, COB-19, ONB-24). Padrões na frontend/07 ("Ajustes da Prioridade 3"). Layout e contraste foram ajustados sem abrir o navegador: conferir na rodada de e2e. Ficou de fora: a segunda parte do COB-23 ("Cancelar a cobrança" com duas mensalidades) e o ALU-27.

**Achados sem prioridade que seguem abertos** (regra, bug ou UX, não de layout): ALU-20, ALU-23, ALU-25, ALU-27, ALU-28, ALU-32, ALU-36, ALU-39, COB-22, COB-25, COB-26, COB-29, COB-30, COB-31, COB-32, ONB-14, ONB-18, ONB-22, ONB-27, ONB-30, ONB-31, ONB-32, TUR-19, TUR-20, TUR-26, TUR-28, ACE-36 (vínculo mantido ao trocar o perfil), ACE-42 (doc 06) e ACE-43 (assinatura do cookie, no backend).

- **Reticências cortando texto** (proibido pelo doc 08):
  - nomes longos em Alunos, Cobranças, Matricular, Calendário, Dashboard e Trocar usuário (ALU-18, ACE-22, TUR-21, ACE-23);
  - rótulo do plano "R$ 150,00/..." e "Porcentagem sobre a men..." (COB-13);
  - Registrar a aula (TUR-18, ALU-35).
- **Valores cortados:**
  - cards do Financeiro a 1024 e 1280 e rolagem lateral (COB-07);
  - simulação das regras no celular (ONB-11, COB-14);
  - Lançamentos e Professores no celular (ACE-06, ACE-20);
  - documento do relatório no celular (ACE-16).
- **Rolagem lateral e cortes no celular:** Configurações > Geral em 360 (ACE-21, ONB-09); abas cortadas em Financeiro e Configurações (ONB-20, COB-27); cabeçalhos da turma e da aula quebrando no meio (TUR-30); Dashboard "Aulas de / hoje" (ACE-24).
- **Rodapés de diálogo fora do padrão no celular:**
  - Mensagem, Graduação, Adicionar aluno nesta aula e Nova cobrança (ALU-22, TUR-22, ACE-26);
  - "Voltar" no lugar de "Cancelar" (COB-23, ACE-26).
- **Chips e alvos de toque:** chips de 24px no setup (ONB-21), nome longo vazando do chip (ONB-08), tons sem rótulo em Registrar a aula (ALU-35, TUR-18).
- **Contraste:** selos "Ativo", "Pago" e "Aula Avulsa" no claro, "Atual" no escuro, KPIs claros no escuro (ACE-39, ACE-16); "Comece por aqui." no escuro (ONB-19).
- **"&", inglês e jargão:**
  - "GESTÃO DE TURMAS & AULAS", "checklist", "tour", "Retenção & Churn", "Visualizar & Exportar", "Plano & Mensalidade", "Close" no botão de fechar (ONB-16, ACE-28, ALU-30, ALU-31);
  - CSV e relatórios com "pix", "paid", "33.9%" (ACE-14, ACE-29).
- **"Ex.:" no placeholder e títulos em maiúsculas** em Configurações (ONB-28, ACE-38, COB-24).
- **Textos a ajustar:**
  - "(1 vagas)", "parcela vencida" para a que vence hoje, "Paula (substituto)" (TUR-29);
  - "Atualizada em" (ONB-25), "de 08:00 às 18:00" (ONB-29);
  - login prometendo agenda e serviços (ACE-35);
  - auditoria chamando tudo de "Mensalidade" (ACE-32);
  - três formatos de ocupação: "3/10 vagas", "3 de 10 vagas", "3/10 alunos" (ACE-40);
  - "Pacote Pacote 10 aulas" (ALU-19);
  - lembrete crítico sem valor (COB-28);
  - textos do Financeiro (COB-20);
  - tour (ONB-13);
  - checklist (ONB-17).
- **Pequenas UX:**
  - Seção Mensagens vazia com dois botões (ALU-21).
  - Comunicação longa no celular (ALU-34).
  - Histórico sem filtro "Avisos" (ALU-24).
  - Foco atrás do diálogo aberto pelo ⋮ (ACE-25).
  - Seleção em lote com "Cancelar" ao lado de "Cancelar matrícula" (TUR-23).
  - "Ver aulas no calendário" sem filtro da turma (TUR-25).
  - Alerta "Sem pacote" piscando (TUR-27).
  - Menu da landing não fecha com Esc (ONB-23).
  - Botão "Criar conta grátis" com 44px (ONB-26).

## Decisões de produto (respondidas em 18/10/2026)

1. **Qual pacote paga a aula** (TUR-06, TUR-07, TUR-09, TUR-10):
   - O pacote **vale em certas turmas**: no cadastro do pacote, o dono escolhe em quais turmas ele vale (ex.: "4 particulares" só na turma Particular). Sem escolha, vale em todas as turmas de pacote e de mensalidade.
   - Entre os pacotes que servem para a aula, continua o que vence primeiro.
   - Turma sem cobrança e curso **não aceitam pacote**.
   - O pacote só paga aulas **a partir da data da compra**.
2. **Escopo do professor** (ACE-07, ACE-05, ALU-29): o professor vê e atua (chamada, registros, graduação, notas) **só nas turmas em que é titular** e nas aulas em que foi colocado como substituto pelo "Trocar instrutor" (que vale para a aula única, não para a turma).
3. **Inativar aluno** (ALU-03, TUR-11): **encerra as matrículas**, com uma mensagem antes deixando o usuário ciente.
4. **Atendente envia mensagens** (ACE-41): **pode**. Ajustar o comentário em `permissions.ts` e o doc 06.
5. **Telefone** (ALU-11): **seletor de país** com 🇧🇷 +55 como padrão, máscara por país, reconhece "+DDI" ao colar, grava no formato internacional (E.164) e o WhatsApp usa esse número. Biblioteca `libphonenumber-js`. Os números já gravados são tratados como Brasil.
6. **Dia de vencimento** (ALU-33, COB-21): **até 31 em tudo** (espaço, aluno e Financeiro). Dia 29, 30 ou 31 cai no último dia nos meses mais curtos.

## Apêndice: todos os achados por frente

As seções abaixo são a lista completa de cada frente, com tipo, gravidade e sugestão.

### QA ONB (landing, cadastro, configuração inicial, primeiros passos)

33 achados: 0 bloqueantes, 5 altos, 10 médios, 18 baixos. Prints na pasta temporária da sessão. Nenhuma correção feita. Sem erros de console nos fluxos concluídos.

#### Alta
- ONB-01 (bug) Passo 1 promete "Assim aparece no topo: {nome}", mas o topo mostra unit.name (vazio sem unidade) e o nome do espaço não aparece em lugar nenhum; no celular nada (hidden sm:flex). Sugestão: mostrar o nome do espaço no topo (unidade ao lado). shots/setup-d-04-dash-martial_arts.png
- ONB-02 (bug) Modalidades: aviso amarelo manda clicar "Está tudo certo" no aviso de cima, que só existe quando modalidades é o próximo passo (reviewOnPage); revisão fica sem saída. Sugestão: botão no aviso amarelo quando o banner não o mostra. shots/dash-d-05-modalidades-revisar.png
- ONB-03 (regra) Área sem mensalidade (curso/pacote/sem cobrança): Geral mostra "Falta confirmar" + "Confirmar regras recomendadas" tremendo e acusa "Alterações não salvas" ao trocar de aba sem mexer (isBillingUnconfirmed entra no useReportDirty). Também na área de mensalidade antes de confirmar. shots/set-d-10-curso-geral.png, set-d-11-curso-trocar-aba.png
- ONB-04 (regra) /setup abre vazio depois de concluído; refazer sobrescreve nome e área, mistura modalidades, volta "Falta revisar" e reabre boas-vindas. Sugestão: com onboardingCompleted, redirecionar ao Dashboard. shots/nav-d-03-setup-de-novo.png
- ONB-05 (bug) "Entrar" ou /login com sessão ativa leva o dono ao /setup (login/page.tsx decide no servidor com o mundo semeado, não o localStorage). Sugestão: decidir no cliente (como SetupGuard).

#### Média
- ONB-06 (UX) Recarregar no meio do assistente volta ao passo 1 vazio; Voltar do navegador sai para a landing. Sugestão: rascunho no sessionStorage e passo na URL.
- ONB-07 (bug) Aulas repetidas com caixa/acento viram chips separados ("10 selecionadas") mas só 7 são criadas; erro engolido (catch {}). "Judo" ao lado de "Judô". Sugestão: normalizeText ao adicionar.
- ONB-08 (layout) Nome de aula longo vaza do chip (h-6 fixo). Sugestão: min-h-6 + py-0.5 ou limite.
- ONB-09 (layout) Configurações > Geral: resumo "nome • unidade" passa da borda do card com nome longo; seta do acordeão sai no celular. Sugestão: min-w-0 + break-words.
- ONB-10 (regra) Depois da 1ª vez, salvar horários com todos os dias fechados passa sem aviso e o passo de horário volta (regra "Ligue pelo menos um dia" só antes do 1º salvar). Sugestão: aplicar sempre.
- ONB-11 (layout) Simulação das regras da mensalidade no celular corta valores ("R$ 55,", "R$ 15("), tabela 479px em 284px. Sugestão: blocos empilhados no celular.
- ONB-12 (UX) Outra área: passo 3 começa vazio com "0 selecionadas" e aviso amarelo misturando aula/modalidade/turma. Sugestão: campo em destaque, nome da área como 1ª aula sugerida, aviso só após interagir.
- ONB-13 (texto) Tour guiado: frases longas (24 palavras), lista 3 itens mas destaca 4, "Planos" vs "Planos e pacotes", travessões, cita "regras da mensalidade e permissões" em área de curso. Sugestão: reescrever TOUR_STEPS_CLASSES em uma linha por passo e por forma de cobrança.
- ONB-14 (layout) Toast "Horários de funcionamento salvos." cobre "Confirmar regras recomendadas". Sugestão: fechar toast ao navegar ou toasts no topo.
- ONB-15 (regra) Sem limite no nome do espaço/unidade/cadastro (319 caracteres + emoji aceitos; quebra layouts e infla o cookie). Sugestão: max 80.

#### Baixa
- ONB-16 (texto) "&" e inglês: "GESTÃO DE TURMAS & AULAS", "Turmas & Matrículas", "checklist", "tour", "HIIT & Cardio", "Concluir na Dashboard", "Ballet Clássico" vs "Balé".
- ONB-17 (texto) Checklist: "regime padrão (pré/pós-pago)" vs "Antecipado/Depois do uso"; "Primeiros passos da sua unidade"; descrição longa.
- ONB-18 (UX) "Falta revisar níveis e metas" em modalidades sem trilha (Pilates, Funcional, Outra área sem avanço).
- ONB-19 (layout) Balão "Comece por aqui." cobre o título da fase, baixo contraste no escuro; "Etapa concluída!" cobre ícones do topo no celular.
- ONB-20 (layout) Abas de Configurações cortadas ("Dado") com pontos de alteração, sem sinal de rolagem.
- ONB-21 (UX) Chips do passo 3 com 24px no celular; "x" é span role=button dentro do botão, title sem o nome da aula.
- ONB-22 (UX) Lista de áreas sem navegação por setas; foco perdido ao trocar de passo.
- ONB-23 (UX) Menu do celular da landing não fecha com toque fora nem Esc.
- ONB-24 (layout) Hero no celular deixa "planilha." sozinha (falta text-balance).
- ONB-25 (texto) Termos "Atualizada em" (texto compartilhado com Privacidade).
- ONB-26 (layout) "Criar conta grátis" do cadastro com 44px (h-11).
- ONB-27 (UX) Rota inexistente sem sessão vai para /login em vez de 404.
- ONB-28 (texto) Configurações: placeholder "Ex.: Matriz Centro (opcional)", erro "Informe o nome da área." (setup diz "Informe o que você ensina."), "Nome da organização", "Identificação do Negócio".
- ONB-29 (texto) "Horário diferente de 08:00 às 18:00?" (deveria "das").
- ONB-30 (UX) Boas-vindas: Esc fecha de vez, clique fora não.
- ONB-31 (UX) Outra área chamada "Lutas" vira área personalizada sem trilha (sugerir a área da lista).
- ONB-32 (UX) Landing não reconhece quem está logado; novo cadastro troca nome e e-mail do dono atual.
- ONB-33 (bug) Falha ao concluir o assistente só faz console.error, sem mensagem (só por leitura de código).

#### Cobertura
Landing, cadastro (casos limite), as 10 áreas, Outra área nas 16 combinações (avanço x cobrança), casos improváveis do assistente, boas-vindas, tour, checklist, horários, regras, "Descubra o dia a dia", troca de área nas Configurações, desktop e celular, escuro em parte. Não testado: aviso de cookies (sem chave do PostHog no :3000), perfis não-dono no assistente, Safari/iOS real.

### QA COB (regras da mensalidade, Cobranças, Financeiro, pagamento de professores)

32 achados: 0 bloqueantes, 7 altos, 9 médios, 16 baixos. Prints na pasta temporária da sessão, specs 01..17, logs *.log. Nenhuma correção feita.

#### Alta
- COB-01 (regra) Mensalidades de meses em que ninguém abriu o app nunca são geradas: atraso varia com a navegação (R$ 300, depois R$ 450 ao abrir novembro; dívida real R$ 750). Sugestão: gerar na leitura todos os períodos desde o início (ou a última gerada) até o mês atual.
- COB-02 (bug) Comprovante anexado em "Marcar pago" (Cobranças) é descartado: use-charge-actions.tsx onConfirm={(method) => pay(chargeToPay, method)} ignora receipts.
- COB-03 (regra) Desconto maior ou igual ao plano (R$ 200 em plano de R$ 150, ou 100%) gera R$ 0,00 pendente que vira "Atrasado R$ 0,00" com menu de cobrar. Sugestão: validar, 100% vira isento, mostrar a conta.
- COB-04 (regra) Pix Automático autorizado quita na hora as mensalidades vencidas antes da autorização (julho a setembro). Sugestão: só vencimentos a partir da autorização em applyRecurringAutoPayments.
- COB-05 (regra) Mensalidade paga com atraso depois do fechamento do professor não conta em mês nenhum; desfazer pagamento de mês fechado não avisa. Sugestão: entrar no próximo mês aberto; avisar ao desfazer.
- COB-06 (regra) Rematricular no curso cobra o valor cheio de novo e mantém as parcelas vencidas anteriores (R$ 1.400 por curso de R$ 800), sem aviso. Sugestão: mostrar parcelas em aberto e oferecer abater ou cancelar.
- COB-07 (layout) Cards do Financeiro cortam valores (R$ 12.345 a 1024 px) e geram rolagem lateral a 1280 (Avançada) e 390 px. Sugestão: fonte responsiva, min-w-0, nunca cortar valor.

#### Média
- COB-08 (regra) Retomar assinatura pausada em 20/11 cobra novembro inteiro, já atrasado, sem prévia. Sugestão: proporcional a partir da volta.
- COB-09 (bug) 1ª cobrança "0" ou vazia vira o valor da prévia em silêncio; R$ 999.999.999,99 e R$ 0,01 passam; "-5" vira R$ 0,05.
- COB-10 (regra) Pagamento sem data: entra sempre como hoje (Cobranças e Financeiro). Sugestão: campo "Pago em" (padrão hoje).
- COB-11 (bug) Financeiro com "Avançada" salva quebra a hidratação a cada carregamento (useState lê localStorage). Sugestão: ler em useEffect. (Erro de hidratação real, não do relógio.)
- COB-12 (UX) Mudar o valor do plano muda todos os alunos atuais sem aviso.
- COB-13 (layout) Reticências cortando valores e nomes: rótulo do plano "R$ 150,00/..." (com travessão), "Porcentagem sobre a men...", "Pagamento de Carlos Silva (agosto,...", nomes longos em Cobranças no celular.
- COB-14 (layout) Simulação das regras no celular corta valores. (Mesmo que ONB-11.)
- COB-15 (UX) Resumo e Lançamentos não batem nas saídas (prévia do professor só entra fechada); "Próximos 7 dias" lista contas vencidas há semanas.
- COB-16 (UX) Vencimentos no passado aceitos sem aviso (avulsa em 2020, curso com parcelas antes de começar).

#### Baixa
- COB-17 (UX) Reativar aluno não diz quando volta a cobrar.
- COB-18 (texto) "Todos os atrasos" mostra vencimento sem ano.
- COB-19 (texto) Simulação "Mês cheio" diz "30 dias" com ciclo de 31.
- COB-20 (texto) Financeiro: selo "2026-09", maiúsculas de título, "Lucro líquido R$ 0,00 Superávit", "100% recebido" sem cobranças, "Sub-parcelas do ciclo (5)", faixa "Modo de visualização".
- COB-21 (regra) Lançamento recorrente não aceita vencimento depois do dia 28.
- COB-22 (UX) Dia do vencimento ignorado no quinzenal sem explicação e obrigatório sem efeito no semanal.
- COB-23 (texto) "Voltar" no lugar de "Cancelar" (Registrar pagamento); "Cancelar a cobrança" com 2 mensalidades.
- COB-24 (texto) "Ex.: Matriz Centro (opcional)". (Mesmo que ONB-28 e ACE-38.)
- COB-25 (UX) Linha paga sem data nem acesso ao comprovante; selo "Cancelado" riscado.
- COB-26 (layout) Erro do dia de vencimento quebra em 3 linhas sob campo de 80 px.
- COB-27 (layout) Abas cortadas no celular e no desktop (Financeiro, Configurações). (Relacionado ONB-20, ACE-06.)
- COB-28 (texto) Lembrete crítico sem valor e sem fecho; avulsa atrasada diz "com vencimento em".
- COB-29 (regra) Ajuste de desconto do professor maior que o total aceito, lista mostra R$ 0,00 e trava "Fechar mês".
- COB-30 (UX) Periodicidade do plano parece editável com alunos ativos (erro só ao salvar).
- COB-31 (UX) Cobrança avulsa igual lançada duas vezes sem alerta.
- COB-32 (UX) Mudar desconto/bolsa no meio do mês sem dizer a partir de quando vale.

#### Cobertura
Regras (dias limite, 4 combinações), prévia no cadastro, tempo passando (meses pulados, descontos, bolsas, trocas de plano, pausa, quinzenal/semanal, aluno em mensalidade e pacote), Cobranças (filtros, busca, URLs, atrasos, pagar, desfazer, cancelar, reverter), avulsa 1x a 12x, curso (linha resumida, cancelar, rematricular), Pro (link online, Pix Automático, textos WhatsApp), Financeiro nas duas visões e tamanhos, Professores (regras, ajustes, fechamento). Não testado: venda/renovação de pacote pela tela, relatórios, editar recorrente, categorias, professor com substituto, expiração do Pix, escuro.

### QA TUR (turmas, aulas, chamada, calendário, espera, curso, pacote)

30 achados: 0 bloqueantes, 8 altos, 10 médios, 12 baixos. Prints na pasta temporária da sessão, dados em evidence-observations.log. Nenhuma correção feita.

#### Alta
- TUR-01 (bug) Toques rápidos na chamada são perdidos sem aviso (300 ms: 2 de 6 sem marcação; 80 ms: 2º ignorado); círculo verde leva ~840 ms (sem atualização otimista; tapRow retorna com attendanceBusy). Mesmo achado que ALU-01. Sugestão: marcação otimista e fila por aluno.
- TUR-02 (bug) Remover da aula não apaga a presença: re-adicionar volta "Presente" com 0 aulas gastas (aula de graça); avulso volta presente com cobrança nova. cancelReservation mantém Attendance. Sugestão: apagar a presença ao remover.
- TUR-03 (bug) Mudar horário da turma esconde aulas passadas ("Aula não encontrada"); calendário redesenha semanas passadas no horário novo; presenças escondidas seguem contando na frequência e nos pacotes. Sugestão: aula com dado gravado continua existindo; grade nova vale daqui para frente.
- TUR-04 (regra) Curso encerrado bloqueia o próximo curso do mesmo professor no mesmo horário (findInstructorConflicts ignora início e fim). Sugestão: conflito só com períodos sobrepostos.
- TUR-05 (regra) Curso concluído bloqueia matricular o aluno em outra turma no mesmo horário (também turma que só começa no futuro). Sugestão: ignorar turmas encerradas e considerar início/fim.
- TUR-06 (regra) Aula em grupo gasta o pacote de particulares ("o que vence primeiro"), sem como escolher. Sugestão: dono define em que turmas cada pacote vale (ou escolhe na matrícula); vencimento só desempata.
- TUR-07 (regra) Turma "Sem cobrança" e curso oferecem "Pelo pacote" e gastam aula de pacote pago. Sugestão: "Pacote" só em turma de mensalidade ou de pacote.
- TUR-08 (layout) "Matricular alunos" com turma lotada no celular: "Pôr na lista de espera" e "Matricular mesmo assim (2)" se sobrepõem. Sugestão: empilhar em largura total.

#### Média
- TUR-09 (regra) Pacote comprado depois da aula paga a chamada atrasada (isUsableOn não olha a data da compra). Sugestão: pacote só paga aulas a partir da compra.
- TUR-10 (UX) Saldo e avisos de pacote olham só o que vence primeiro ("Última aula do pacote" e Dashboard "acabando" com outro pacote intacto; lista "Pacote 4 de 4" com 25 aulas em três pacotes). Sugestão: saldo somado ou pacote em uso nomeado; "acabando" sobre todos os válidos.
- TUR-11 (regra) Aluno inativo continua na turma/chamada, conta vaga e recebe presença no "Todos vieram". (Relacionado ALU-03.)
- TUR-12 (bug) Turma desativada parece ativa, aceita matrícula, aula futura abre e avulso futuro segue cobrado. Sugestão: selo "Inativa" com Reativar, sem matrícula, cancelar reservas/avulsos futuros.
- TUR-13 (bug) Experimental/avulso que depois se matricula vira "matriculado" nas aulas passadas; remarcar gasta pacote. Sugestão: reserva vence matrícula iniciada depois da aula.
- TUR-14 (bug) Aula que não existe abre e aceita chamada (dia sem encontro, antes do início); gasta pacote. Sugestão: validar dia, início, fim e turma ativa no detalhe e no serviço.
- TUR-15 (UX) Trocar forma de cobrança com matriculados salva sem aviso (pacote: todos "Sem pacote" e seguem com mensalidade; curso: sem parcelas; curso para mensalidade apaga a data de fim). Sugestão: confirmar dizendo o que muda.
- TUR-16 (texto) Registro de aula: "Aula de há 6 dias", "Aula de em 6 dias" (aula futura aceita registro), "Informe o que foi treinado hoje" em aula de ontem. Sugestão: data curta e esconder registro em aula futura.
- TUR-17 (UX) "Concluir chamada" com 0 presentes marca falta em todos sem confirmar (gasta pacote e entra em "Sentimos sua falta"). Sugestão: confirmar quando ninguém presente.
- TUR-18 (layout) "Registrar a aula" no celular: nomes cortados com "…", placeholder cortado, tons sem rótulo, ainda com avatares. (Relacionado ALU-35.)

#### Baixa
- TUR-19 (bug) "Pagar com mensalidade" e remarcar aula antiga devolve a aula ao pacote.
- TUR-20 (UX) Editar turma mostra instrutor/modalidade inativos como vazios mas salva mantendo; "Inativar modalidade?" não cita turmas em uso.
- TUR-21 (layout) Calendário corta nome de turma ("Confeitaria Bási…") e filtro ("Todas as modalidad").
- TUR-22 (layout) "Adicionar aluno nesta aula" no celular: rodapé fora do padrão, rótulo "Confirmar inscrição" (padrão "Adicionar").
- TUR-23 (UX) Seleção em lote: "Cancelar" ao lado de "Cancelar matrícula". Sugestão: "Sair da seleção".
- TUR-24 (bug) Voltar depois de "Abrir a turma" pela aula vai para Turmas (navigation-history; mesmo que ALU-17).
- TUR-25 (UX) "Ver aulas no calendário" abre todas as turmas (sem filtro da turma).
- TUR-26 (UX) Alertas que não pedem ação: curso encerrado com "Presença baixa" e vagas; turma sem cobrança com "Pagamento atrasado" de outra cobrança; lista com "Ativo" em todas as linhas sob filtro "Ativas"; "3/1 vagas".
- TUR-27 (UX) Alerta "Sem pacote" pisca ~250 ms ao abrir a turma (antes de carregar pacotes).
- TUR-28 (UX) Turma sem aula nos 14 dias não diz quando começa; turma sem encontros sem "Sem horário".
- TUR-29 (texto) "(1 vagas)"; "parcela vencida" para a que vence hoje; dois erros no valor 0 do curso; "(ex: Sábado ou manhã)"; vazio fala em mensalidades em curso/pacote/sem cobrança; certificado Grátis repete título; "Paula Souza (substituto)"; "pacote atual" sem nome com três pacotes.
- TUR-30 (layout) Cabeçalhos no celular quebram no meio ("3 / de 10 vagas", "Carlos / Silva"); barra da chamada em duas linhas com vazio à direita.

#### Cobertura
Telas da turma nas 4 formas de cobrança, edição (cobrança, capacidade, horário, início futuro, sem encontros, instrutor/modalidade inativos, desativar), matrícula em lote, espera, curso (meio, cancelar, encerrado, certificado), chamada (todas as marcações, datas, avulso, experimental, pacote, substituto, registros, Para hoje), pacotes (combinações, validade, uso fora da turma de pacote), calendário e Voltar. Desktop e celular. Não testado: perfis sem permissão, toque real/iOS, desempenho com muitos registros.

### QA ALU (Alunos, ficha, evolução, notas, comunicação)

39 achados: 0 bloqueantes, 2 altos, 15 médios, 22 baixos. Prints na pasta temporária da sessão (relativos a esta pasta). Nenhuma correção feita no código.

#### Alta
- ALU-01 (bug) Chamada: toque feito enquanto a marcação anterior grava é ignorado sem aviso. 4 toques a ~100 ms marcam só 2 (tapRow faz `if (attendanceBusy) return`; latência do mock 350 ms). Sugestão: marcação otimista e fila de gravações. shots/08-fast-taps.png
- ALU-02 (bug) WhatsApp oficial: parabéns automático sai e a ficha ainda oferece "Mandar parabéns"; um toque envia o segundo, sem confirmação. "Cobrar", "Avisar", "Mandar mensagem" também enviam com um toque no oficial. Sugestão: marcar aviso como enviado e confirmar envio no oficial. shots/12-ficha-official.png, shots/12-send-official.png

#### Média
- ALU-03 (regra) Inativar não encerra matrícula: segue na chamada, ocupa vaga, pacote ativo, ficha mostra "próxima hoje". Sugestão: perguntar no diálogo se encerra as matrículas. shots/13-*.png
- ALU-04 (texto) Selo "Definir faixa" na lista para alunos de módulos/níveis/fases (usa vocabulário da área, não da trilha). Sugestão: useClientVocabulary. shots/01-list-desktop.png
- ALU-05 (regra) "Para hoje" nunca expira: nota de 14/09 aparece em 15, 16, 21, 22/09; de 01/08 aparece 7 semanas depois. Sugestão: só na primeira aula após o registro. shots/08-records-para-hoje.png
- ALU-06 (bug) "Registrar a aula" duas vezes duplica registros; botão não indica que já foi registrada. Sugestão: um registro por aluno e aula, reabrir em edição. shots/14-*.png
- ALU-07 (bug) Graduação aceita data futura digitada (salva 2027, "Desde 05/2027"). Sugestão: validar no form e no serviço. shots/08-grad-future.png
- ALU-08 (texto) "Parabéns pelo avanço" e resumo da Evolução omitem o grau ("Faixa Branca" em vez de "Faixa Branca · 1º grau").
- ALU-09 (regra) Aniversário amanhã: "Mandar parabéns" envia "Parabéns pelo seu dia" na véspera; chip do diálogo usa outra janela (até 6 dias depois). Sugestão: mesma janela no aviso e no chip.
- ALU-10 (bug) 29/02 em ano não bissexto: em 28/02 mostra "hoje, 26 anos em 29/02" (idade errada e data inexistente). Sugestão: regra de 28/02 de lib/birthdays. shots/05-feb29-on-0228.png
- ALU-11 (regra) Telefone estrangeiro: máscara corta dígitos e o link do WhatsApp prefixa 55 (5514155551234). Sugestão: aceitar "+DDI" e não prefixar 55. shots/03-phone-foreign.png
- ALU-12 (UX) Cadastro duplicado (mesmo nome e telefone) sem aviso. Sugestão: confirmação mole com telefone igual.
- ALU-13 (bug) Modelo aceita 5000 caracteres; envio limita a 1000; chip preenche texto que não envia. Sugestão: limite 1000 com contador no editor.
- ALU-14 (UX) Selo "Trocar faixa" pela idade não aparece na ficha nem na lista (só turma, aula, Dashboard, diálogo).
- ALU-15 (bug) Trocar tipo de trilha leva o grau junto ("Iniciante • 2ª etapa") e zera nível sem aviso. Sugestão: zerar subnível e avisar.
- ALU-16 (UX) Aviso da ficha não muda depois de enviar (assistido); dá para reenviar sem sinal. Sugestão: "Enviado hoje às HH:mm".
- ALU-17 (bug) Voltar: turma > ficha > mesma turma > Voltar vai para /classes (navigation-history faz pop também na navegação para frente quando o destino é a penúltima rota). Sugestão: pop só no popstate.

#### Baixa
- ALU-18 (layout) Nome longo truncado com "..." em Cartões (desktop) e Lista (celular).
- ALU-19 (texto) "Pacote Pacote 10 aulas", "curso Curso de Defesa" (prefixo repetido).
- ALU-20 (UX) Sem WhatsApp válido: menu da cobrança mostra "Lembrar no WhatsApp" e dá erro; "Nova mensagem" abre com envio desabilitado. Esconder ações sem número.
- ALU-21 (UX) Seção Mensagens vazia com dois "Nova mensagem" e busca/filtro inúteis.
- ALU-22 (layout) Rodapé de diálogos ("Mensagem para", "Registrar graduação") no celular fora do padrão de 2 colunas.
- ALU-23 (layout) Avisos da ficha no celular com arranjo diferente entre cartões; ghost buttons parecem texto solto.
- ALU-24 (UX) Histórico da Comunicação sem filtro "Avisos" (caem em "Avulsa").
- ALU-25 (bug) Métricas: "Abertas no WhatsApp" conta mensagem com falha; "Recebido depois de lembrete" diz "Mensalidades" mas soma qualquer cobrança.
- ALU-26 (regra) Registro de aula de aluno sem nível cria "Faixa Branca" com data de graduação.
- ALU-27 (texto) "Sem trilha de evolução" com motivo errado; apagar níveis em uso some nível sem aviso.
- ALU-28 (regra) Notas: avaliação em data futura aceita; aluno matriculado depois entra no lançamento de prova anterior.
- ALU-29 (regra a confirmar) Professor faz chamada/registro/graduação na turma de outro professor (notas bloqueadas). Docs 11 e 21 divergem.
- ALU-30 (texto) "Plano & Mensalidade"; separadores "•" e "—" misturados no cadastro.
- ALU-31 (texto) Botão fechar dos diálogos com nome acessível "Close" (inglês).
- ALU-32 (UX) Cadastro aceita 1900 ("126 anos"), bebê "0 anos", observações sem limite.
- ALU-33 (regra) Dia de vencimento do aluno aceita 31; do espaço só até 28.
- ALU-34 (UX) Comunicação no celular: 14 cartões, ~4.400 px de rolagem. Sugestão: grupos em sanfona.
- ALU-35 (layout) "Registrar a aula" no celular: placeholder cortado "(opcion"; tons só bolinhas sem rótulo.
- ALU-36 (UX) "Escolher outra" regride ou pula faixas sem confirmar.
- ALU-37 (texto) Pacotes: selo "Pacote 1 de 10" ao lado de "9 de 10 aulas usadas".
- ALU-38 (UX) Limite de mensagem sem contador; emoji conta 2.
- ALU-39 (UX) Variável desconhecida no modelo some sem aviso.

#### Cobertura
Testado em 1280x900 e 390x844 (parte com toque): lista/cartões, cadastro (casos limite), editar/inativar/reativar, ficha (avisos, seções, ?tab=, Voltar em 7 caminhos), evolução (4 tipos de trilha, graduação, idade, registros, Para hoje), notas, comunicação (modelos, edição, nova mensagem, chips, histórico, Pro/oficial, parabéns automático). Não testado: anexos no cadastro (não há campo), trilha alterada pela tela Modalidades (feito por injeção), WhatsApp real, CEP só uma vez, modo escuro, modelo agenda, certificado, Pix Automático.

### QA ACE (usuários e perfis, rotas, relatórios, auditoria, configurações e planos, varredura celular e escuro)

44 achados: 0 bloqueantes, 6 altos, 15 médios, 23 baixos. Prints na pasta temporária da sessão (471), logs NN-*.log. Nenhuma correção feita.

#### Alta
- ACE-01 (bug) Dona trocando nome e e-mail fica trancada fora: login-form.tsx filtra por name "Ana Ribeiro" ou e-mail fixo; lista vazia sem mensagem. Sugestão: filtrar por id/organização.
- ACE-02 (bug) Duas abas: a gravação de uma apaga a da outra (aluno criado na aba A some quando a aba B cria um plano; cópia em memória regravada). Sugestão: reler o localStorage antes de gravar e ouvir o evento storage.
- ACE-03 (regra) Atendente abre DRE e churn em Relatórios no Pro sem finance:view; catálogo mostra os 8. Sugestão: exigir finance:view e esconder.
- ACE-04 (bug) Lista de Presença usa sempre store.classGroups[0], sem escolher turma/aula; status do mês inteiro; mês antes de a turma começar mostra todos "Ausente"; "1 Presentes"; coluna Faixa "—". Sugestão: seletor de turma e aula.
- ACE-05 (regra) Atendente e professor graduam (professor na turma de outro); menu "Graduação" sem checagem de permissão. Sugestão: permissão de evolução com escopo das notas.
- ACE-06 (layout) Financeiro > Lançamentos no celular: descrição some ("Au…" / some em 360), selo por baixo do valor, "Ver em Cobranças" ocupa metade, abas cortam "Professores".

#### Média
- ACE-07 (regra) Professor vê e faz chamada nas turmas de outros (doc 06 lista como pendente). (Relacionado ALU-29.)
- ACE-08 (bug) Dois usuários ligados ao mesmo profissional.
- ACE-09 (bug) Servidor e navegador em dias diferentes (UTC x Brasil depois das 21h): hidratação falha, perde data-menu-color/data-theme-color (barra lateral clara, tema some). Sugestão: "hoje" só no cliente ou no fuso da organização; reaplicar atributos do tema em efeito. (Mesma causa das 77 falhas "Hydration failed" do e2e.)
- ACE-10 (bug) Dashboard: "Todas as mensalidades quitadas" com mensalidades atrasadas (revenueHint só olha pendentes); selo conta 3, "Para fazer hoje" fala em 4.
- ACE-11 (bug) Plano Scale aparece como Grátis na aba Plano (cadeados, "Ativar Pro" rebaixaria). isPro = tier === "pro".
- ACE-12 (regra) Relatórios e aba Plano prometem "projeção financeira" que não existe; revenue_forecast e teacher_performance mostram "Não foi possível carregar".
- ACE-13 (bug) Análise de churn incoerente ("Início 0, Novas +5, Retenção 100%"; março com alunos que não existiam; "100.0%").
- ACE-14 (texto) CSV com "active/paid/overdue/pix", datas ISO, "250.00" (Excel pt-BR não lê), nome de arquivo com tipo em inglês.
- ACE-15 (layout) Relatórios: mês "September 202" cortado; busca e mês com 12px no celular (zoom iOS); filtros saem pela direita.
- ACE-16 (layout) Documento do relatório no celular: botão sai do cartão, rolagem lateral em 360, colunas cortadas, KPIs claros no escuro (contraste 2,0).
- ACE-17 (bug) Aula em dia sem encontro abre a chamada (aula fantasma). (Mesmo que TUR-14.)
- ACE-18 (regra) WhatsApp e troca de instrutor não entram na Auditoria (presença/falta também não, mesmo gastando pacote).
- ACE-19 (bug) Configurações: sair pelo menu com alteração não salva perde tudo sem aviso.
- ACE-20 (layout) Financeiro > Professores no celular corta nomes ("Carlos ...", "Pagament...").
- ACE-21 (layout) Configurações > Geral cria rolagem lateral em 360 (seta de Regras sai do cartão; abas cortam). (Relacionado ONB-09.)

#### Baixa
- ACE-22 (layout) Nomes longos com "…" em Alunos, Cobranças, Matricular, Nova cobrança, Calendário, Dashboard, menu Trocar usuário. (Relacionado ALU-18, TUR-21.)
- ACE-23 (layout) Calendário: filtros cortam texto no desktop. (Mesmo que TUR-21.)
- ACE-24 (layout) Dashboard no celular: "Aulas de / hoje" espremido; botões colados.
- ACE-25 (UX) Foco fica atrás do diálogo aberto pelo menu ⋮ (Registrar pagamento, Vender pacote).
- ACE-26 (UX) Rodapés fora do padrão: Registrar pagamento usa "Voltar"; Nova cobrança no celular com "Adicionar" passando da margem; Valor começa em "R$ 0,00".
- ACE-27 (layout) Cobranças no desktop: cabeçalho quebra e "Nova cobrança" fica sob o seletor de mês.
- ACE-28 (texto) Catálogo de relatórios: cita DRE no Grátis, "Retenção & Churn", "Operacional" repetido, botões 12px, atendente vê "Visualizar & Exportar".
- ACE-29 (texto) Documentos com "pix", "33.9%", "-R$ 0,00", "Responsável: Administração" fixo.
- ACE-30 (bug) Relação de alunos ignora o mês escolhido.
- ACE-31 (bug) Data inválida na URL da aula derruba a tela ("Algo deu errado", RangeError).
- ACE-32 (texto) Auditoria chama toda cobrança de "Mensalidade".
- ACE-33 (texto) Auditoria vazia fala em agendamentos e acessos; travessão no subtítulo.
- ACE-34 (layout) Menu "Trocar usuário" sem perfil, nomes alinhados à direita e truncados, dois "Carlos Silva".
- ACE-35 (texto) Login promete agenda, serviços e clientes ("Gestão completa do seu negócio — agenda..."), fora do posicionamento atual.
- ACE-36 (texto) Trocar Profissional por Atendente mantém vínculo e fala em "agenda dele".
- ACE-37 (texto) Confirmação de cancelar cobrança longa, título sem "?".
- ACE-38 (texto) Configurações: "Ex.: Matriz Centro (opcional)" e títulos em maiúsculas. (Mesmo que ONB-28.)
- ACE-39 (layout) Contraste baixo em selos ("Ativo"/"Pago" 3,31; "Aula Avulsa" 2,94; "Atual" no escuro 2,77).
- ACE-40 (texto) Três formatos de ocupação: "3/10 vagas", "3 de 10 vagas", "3/10 alunos (7 vagas)". Sugestão: "3 de 10 alunos".
- ACE-41 (regra a confirmar) Atendente envia mensagens com communication:view (comentário diz "vê histórico e status").
- ACE-42 (texto) Doc 06 desatualizado (login, matriz sem communication/reports, sem graduação).
- ACE-43 (regra) Cookie de sessão sem assinatura vale no servidor até o cliente corrigir (limitação do mock; resolver no backend).
- ACE-44 (layout) Impressão do relatório: cabeçalho colado na borda e fundo escuro.

#### Cobertura
4 perfis, 19 rotas por URL direta, menus por perfil, usuários (validações, vínculos, inativar), sessão (cookies inválidos/forjados, rebaixamento), relatórios (10 tipos, CSV, impressão), auditoria, configurações em Grátis/Pro/Scale, duas abas, fuso diferente, varredura de 26 telas e 8 diálogos em 390/360 claro e escuro e desktop. Não testado: detalhe imutável da auditoria, modelo agenda, WhatsApp oficial e Pix de ponta a ponta, certificado emitido, iPhone real.
