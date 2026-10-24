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
