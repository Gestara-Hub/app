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
