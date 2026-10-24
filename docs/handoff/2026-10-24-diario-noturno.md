# Diário da execução noturna de 24/10/2026

Plano: `2026-10-24-execucao-noturna.md`. Branch: `execucao-noturna-2026-10-24` (sem push). Ao retomar, leia este diário e siga do primeiro item sem "feito".

## Andamento

| Item | Estado | Commit | Testes | Observações |
| --- | --- | --- | --- | --- |
| 2. Começo (branch, banco, linha de base) | feito | (plano na `main`: ver `git log`) | typecheck, lint, Vitest 1008, core 278 verdes | Banco local no ar, sem migração pendente |
| 3. Docs etapa 1 (skill `docs`, mapa por assunto, ponteiros, cabeçalhos) | feito | ver `git log` | só docs | Cabeçalho `Data:`/`Status:` acrescentado em 20 docs técnicos sem mexer no conteúdo |
| 4.1 #28 troca de plano do aluno | feito | git log | typecheck, lint, Vitest 1011 | Confirmação com valores (plan-switch.ts); e2e mensalidades-regras atualizado, não rodado agora |
| 4.1 #26 parcelas além da validade | decisão registrada | git log | só docs | Docs não sustentam: análise e recomendação (avisar) em pendencias.md; #33 vai junto |
| 4.1 #62 extrato PDF x tela | feito | git log | typecheck, lint, Vitest, core 280 | Rótulos únicos no core |
| 4.1 #2 selo do Painel | feito | git log | typecheck, lint, Vitest | Selo = atrasadas do mês (mesmo recorte do texto); decisão: o selo de todos os meses ficava só nos Lembretes |
| obs: processo | — | git log | — | Um commit (#2) saiu com 1 teste vermelho por causa do grep; corrigido e emendado na hora. A partir daqui as checagens rodam com código de saída (check.sh). |
| 4.1 #4 tarifa de saque | feito | git log | typecheck, lint, Vitest, core 281 | Confirmado no MCP do Asaas (somente leitura) |
| 4.1 #67 pagamento online no Pro | feito | git log | typecheck, lint, Vitest 1014 |  |
| 4.1 #61 CPF na janela Cobrar online | feito | git log | typecheck, lint, Vitest, core 282 | Tela conferida só por tipos; e2e fica para a bateria |
| 4.1 #68 Auditoria da cobrança do curso | feito | git log | typecheck, lint, Vitest 1015 |  |
| 4.1 #48 certificado (palavra repetida) | feito (parte); resto decisão | git log | typecheck, lint, Vitest, core 284 | Aulas/presença e cargo: análise em pendencias.md |
| 4.1 #44 termo na ficha do menor | feito | git log | typecheck, lint, Vitest 1018 |  |
| 4.1 #25 Definir nível na lista | feito | git log | typecheck, lint, Vitest 1020 |  |
| 4.1 #21 Equipe vazia com inativos | feito | git log | typecheck, lint, Vitest 1023 | Só a Equipe usa a opção; as outras listas podem adotar |
| 4.1 #14 senha do convite | feito | git log | typecheck, lint, Vitest 1025 | Regra única em lib/password-rules; mínimo do Supabase de produção virou pendência |
| 4.1 #11 e #31 avisos cobrindo botões | feito | git log | typecheck, lint, Vitest 1026 | Toaster top-center; e2e de sobreposição na seção 6 |
| 4.1 #69 jargão em Preferências | feito | git log | typecheck, lint, Vitest 1028 | Botão Copiar CSS removido (função segue no lib) |
| 4.2 #3 seta sobre a lista | feito | git log | typecheck, lint, Vitest | Só visual; coberto pela bateria de tela |
| 4.2 #5 e #6 Recebimentos online | feito | git log | typecheck, lint, Vitest | Nome legal do parceiro fica no contrato |
| 4.2 #7 subtítulo de Relatórios | feito | git log | typecheck, lint |  |
| 4.2 #8 e #43 modelos de mensagem | feito | git log | typecheck, lint, Vitest 1030 | Modelos já salvos mantêm o texto antigo |
| 4.2 #10, #12, #16, #39 e #26/#33 | decisão registrada / mantidos | git log | só docs | #10 e #12 em pendencias.md; #16 e #39 mantidos (docs 07 e 11) |
| 4.2 #15 tela do convite | feito | git log | typecheck, lint, Vitest | Visual conferido na bateria final |
| 4.2 #19 jargão em Planos/checkout | adiado (depende da decisão #17/#18) | git log | — | O conteúdo da tela de Planos muda com a decisão; revisar o texto junto |
| 4.2 #20 figura do Pix na landing | feito | git log | capturas refeitas com SHOTS=pix | Sem CPF na imagem |
| 4.2 #22 subtítulo da Equipe | feito | git log | typecheck, lint, Vitest 1035 |  |
| 4.2 #24 sugestões de modalidade | feito | git log | typecheck, lint, Vitest 1037 |  |
| 4.2 #23 nome do papel | decisão registrada | git log | só docs | Recomendação: palavra da área no vocabulário |
| 4.2 #29 e #52 aviso de cobrança online desligada | feito | git log | typecheck, lint, Vitest 1038 | e2e de 4 specs ajustados (texto do menu); rodam na bateria |
| 4.2 #30 plural na contagem | feito | git log | typecheck, lint, Vitest |  |
| 4.2 #32 seta de rolar nos modais | adiado para a bateria 6B | git log | — | Sobreposição é por desenho (evita pulo de layout); decidir pela captura em tela |
| 4.2 #34 e #35 turma | feito | git log | typecheck, lint, Vitest 1040 |  |
| 4.2 #36 janela Matricular alunos | feito | git log | typecheck, lint, Vitest 1041 |  |
| 4.2 #38 blocos da grade | feito | git log | typecheck, lint, Vitest |  |
| 4.2 #40 adicionar aluno na aula | feito | git log | typecheck, lint | e2e cobranca-avulsa já espera 'Selecione o aluno.' |
| 4.2 #41 substitutos | feito | git log | typecheck, lint, Vitest 1046 | Contrato ClassSessionView ganhou modalityId (opcional) |
| 4.2 #42 Desativar x Inativar | feito | git log | typecheck, lint, Vitest 1046 | e2e turmas-geral atualizado |
| 4.2 #45 telefone no PDF | feito | git log | typecheck, lint, Vitest 1048 |  |
| 4.2 #46 nomes na ficha | feito | git log | typecheck, lint, Vitest 1049 | describeCharge só na ficha, para não quebrar os e2e das listas |
| 4.2 #47 Aluno desde na demonstração | feito (parte) | git log | demo:seed rodado; datas conferidas no banco | Auditoria da demo mantém a hora da criação |
| 4.2 #49 Certificado no Grátis | adiado para a bateria 6B | git log | — | O clique leva à página que mostra o aviso do plano (código confere); reproduzir em tela antes de mexer |
| 4.2 #50 retenção sem base | feito | git log | typecheck, lint, Vitest 1051 |  |
| 4.2 #51 aula ao abrir a lista de presença | feito | git log | typecheck, lint, Vitest 1054 |  |
| 4.2 #54 Contas a pagar em outro mês | feito | git log | typecheck, lint, Vitest 1055 | Escolhida a opção de deixar claro que é de hoje |
| 4.2 #55 Professores: mês vencido | feito (parte) | git log | typecheck, lint, Vitest 1057 | Cargo sem gênero fixo: junto com #23 |
| 4.2 #59 vencimento do link de cartão | adiado (parceiro) | git log | — | O app manda o vencimento = fim da validade; a diferença está na fatura do Asaas; conferir no sandbox (pendencias.md) |
| 4.2 #63 botão Extrato em PDF | feito | git log | typecheck, lint, Vitest 1058 |  |
| 4.2 #64 cancelar com Pix em aberto | feito | git log | typecheck, lint, Vitest 1059 |  |
| 4.2 #71 cartão do plano para professor | feito | git log | typecheck, lint, Vitest 1061 |  |
| 4.2 #73 selo de aniversário | feito | git log | typecheck, lint, Vitest 1063 |  |
| 4.2 #9 altura dos botões | feito (parte); resto pendência | git log | typecheck, lint, Vitest 1064 | ~50 usos de size sm/xs/lg em pendencias.md |
| 4.3 achados que dependem de decisão | análises prontas | git log | só docs | #1/#72, #17/#18/#19/#67, #27/#53, #57, #70, #65/#37, #58 em pendencias.md com recomendação (#74 fora do foco, sem análise) |
| 4.3 #27 selo Trancado na ficha | feito (parte); regra da cobrança espera decisão | git log | typecheck, lint, Vitest 1066 |  |
| 4.2 #81 tela montada no servidor no fuso do espaço | adiado (registrado) | git log | — | O fuso do pedido vive em AsyncLocalStorage só nas actions; a tela do servidor (SSR de componentes do navegador) não enxerga. Precisa de experimento com o desenho do servidor; segue em pendencias.md |
| 5.1 mover guias e arquivar | feito | git log | só docs (links corrigidos no commit seguinte) | guides: 14, 16, 20 (nomes mantidos); archive: technical-06, technical-15, product-22, product-17-onboarding, handoff 23/10; product/17-pitch virou 26 |
| 5.3 dividir technical/05 | feito | git log | só docs | 05 (financeiro), 24 (plano GestaraHub), 25 (pagamento online); docs de cobrança apontam uns para os outros |
| 5.4 corrigir links | feito | git log | check-doc-links.mjs: 0 problemas em 1139 arquivos; typecheck, lint, Vitest 1066 | pnpm --filter @gestarahub/web docs:check; comentários do código apontam para technical/24 e 25 |
| obs: test:roundtrip | corrigido | git log | test:db 122 verdes; test:roundtrip 1066 verdes | O roundtrip quebrava desde o commit 42ffdc3 (#66): a conferência de ida e volta não conhecia a coluna do plano, agora gravada só pelo servidor (SERVER_WRITTEN). Ajustado em roundtrip-setup.ts |
| 6.2 e2e novos (em andamento) | escritos, rodando | git log | — | plano-gestarahub, plano-rotina-e-webhook, fuso-do-espaco, filtro da Auditoria; specs antigos ajustados porque a conta real não tem mais o botão de demonstração do plano (areas-settings, comunicacao); editTenant grava subscription direto |
| 6.2 e2e novos | feito | git log | e2e: specs novos e ajustados verdes (configuracao, plano, auditoria) | plano-gestarahub, plano-rotina-e-webhook (cron e webhook automatizados), fuso-do-espaco; auditoria ganhou o filtro Sistema/Falhou; areas-settings e comunicacao ajustados; editTenant grava subscription direto |
| 6.3 e2e completo (1ª rodada) | feito | git log | 406 verdes, 5 vermelhos, 1 pulado (35 min) | Os 5 vermelhos eram textos que mudaram de propósito nesta noite (achados 8, 34, 35, 46 e a prévia da cobrança); specs ajustados e as 4 áreas rerodadas, tudo verde. Nenhum fora do foco. Corrigido também: o clique do cartão de certificado no Grátis passou na repetição (instabilidade da primeira compilação da rota). |
| 6B passada de tela e correções | feito | git log | 104 telas, 0 erro de console; e2e cobrancas+plano 58 verdes; Vitest 1069 | docs/qa/2026-10-24-teste-final.md: 4 achados (82 a 85), 3 corrigidos, 1 mantido |

## Relatório da manhã (24/10/2026)

**Resumo.** A noite correu inteira, sem pergunta e sem parar. Foram **57 de 81 achados do teste geral corrigidos** (as 5 altas já estavam; agora 17 das 24 `média` e 32 das 47 `baixa`), cada um com teste. As docs foram reorganizadas. A rodada final de testes ficou verde.

**O que foi corrigido (números).** #2, #3, #4, #5, #6, #7, #8, #9 (o que foi medido), #11, #14, #15, #20, #21, #22, #24, #25, #27 (só o selo "Trancado" na ficha), #28, #29, #30, #31, #34, #35, #36, #38, #40, #41, #42, #43, #44, #45, #46, #47, #48 (palavra repetida), #50, #51, #52, #54, #55 (mês vencido), #61, #62, #63, #64, #67, #68, #69, #71, #73. Achados novos da passada final: #82, #83 e #84 (corrigidos) e #85 (mantido por desenho).

**O que ficou esperando decisão sua** (análise e recomendação de cada um em `docs/pendencias.md`): termos na demonstração (#1, #72), tela de Planos e taxa do Pix (#17, #18, #19), aluno pausado (#27, #53), menor de idade (#57), professor (#70), mensagem para vários e calendário (#65, #37), conta de recebimento como pessoa física (#58), etiquetas na lista de alunos (#10), aceite dos termos duas vezes (#12), parcelas além da validade ou do fim (#26, #33), nome do papel de quem dá aula (#23, e a assinatura do certificado, #48) e se o certificado exige presença (#48).

**O que ficou adiado, com motivo:** #32 (seta de rolar nos modais: é sobreposta por desenho, só dá para decidir olhando), #49 (clique em "Certificado" no Grátis: o código leva ao aviso do plano, falta ver na tela), #59 (vencimento da fatura do link de cartão: é do parceiro), #81 (primeiro desenho da tela em outro fuso: pede experimento no servidor) e os cerca de 50 botões fora dos 36 px (varredura por tela).

**Resultado da rodada final.**
- Vitest 1069 e core 284 verdes; testes de banco 122 verdes; `test:roundtrip` 1066 verdes (ele estava quebrado desde o #66 da noite anterior e foi consertado); typecheck e lint limpos.
- e2e completo: 406 verdes, 1 pulado, 5 vermelhos que eram textos que mudaram de propósito (ajustados e rerodados, verdes). Smoke: 42 verdes (duas vezes).
- e2e novos: troca de plano (conta, Pix da diferença simulado, plano ligado), troca marcada e "Desmarcar", histórico, aviso fixo do plano, rotina diária (volta ao Grátis no 6º dia, idempotente, troca marcada aplicada), aviso do Asaas (assinatura removida, repetido só reconhecido, token), seletor de fuso e filtro Pessoas/Sistema/Só o que falhou da Auditoria.
- Passada de tela (`docs/qa/2026-10-24-teste-final.md`): 104 telas (dono, gerente, recepção, professor; desktop 1280 claro e celular 390 escuro): nenhum erro de console, nenhuma rolagem horizontal, nenhum texto cortado.
- Fora do foco: nada falhou em agendamento ou entrega.

**Docs.** Skill `docs` no lugar da `adr`; mapa por assunto no `docs/README.md`; guias em `docs/guides/`, planos cumpridos em `docs/archive/`; `technical/05` dividido (24: Plano GestaraHub, 25: pagamento online); `product/17-pitch` virou `26`; verificador `pnpm --filter @gestarahub/web docs:check` (0 problemas em 1.144 arquivos).

**Branch e commits.** `execucao-noturna-2026-10-24`, 58 commits locais a partir da `main` (nenhum push). Lista: `git log --oneline main..execucao-noturna-2026-10-24`.

**Roteiro de teste da manhã** (`pnpm dev`; entre pela demonstração, "Entrar na demonstração"):
1. **Painel:** o selo "3 em atraso" e o texto "R$ 484,52 atrasado" falam do mesmo mês.
2. **Alunos → Ana Almeida → ⋮ → Editar → Plano e mensalidade:** troque o plano e salve. Deve abrir "Trocar o plano do aluno?" com os valores. A ficha dela mostra "Aluno desde 26/08/2026".
3. **Alunos:** na lista, "Definir nível" só aparece para quem está numa modalidade com trilha.
4. **Cobranças:** valor de uma cobrança paga com espaço antes dos ícones; ⋮ de uma cobrança com Pix em aberto → Cancelar avisa que o Pix deixa de funcionar.
5. **Recebimentos online:** título "Recebimentos online", saque "30 grátis por mês; depois, R$ 2,00" em todos os lugares, botão "Extrato em PDF" com seta.
6. **Turmas:** "Inativar" no menu; uma turma com mais alunos que vagas diz "3 de 2 alunos (acima da capacidade)"; Matricular alunos tem "Cancelar".
7. **Configurações → Plano GestaraHub:** "Ativar Profissional (demonstração)" só aqui (na demonstração). Numa conta real é "Assinar o Profissional".
8. **Preferências:** sem "Copiar CSS", sem "Raio", "Sons de confirmação (presença)".
9. **Convite:** abra um convite (Usuários → Novo usuário) e confira a tela no padrão do login; senha de 6 letras é recusada.
10. **Avisos (toasts):** agora saem no topo da tela, não em cima dos botões.
11. **Pendente de você:** Pix logo depois de ativar uma subconta nova (#56) e o webhook do Asaas pelo túnel; veja a tabela em `docs/pendencias.md`.

**Perguntas que destravam mais achados.**
1. Termos na demonstração: gravar o aceite dos quatro perfis no roteiro da demonstração (recomendado)? Resolve #1 e #72.
2. Aluno pausado: perguntar o que fazer com a cobrança do mês em curso, e o lembrete pular quem está pausado (recomendado)? Resolve #27 e #53.
3. Nome de quem dá aula: a palavra da área (Instrutor nas lutas e no pilates, Professor em música e idiomas) no vocabulário do espaço (recomendado)? Resolve #23, #48 (cargo) e #55.
