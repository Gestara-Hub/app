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
