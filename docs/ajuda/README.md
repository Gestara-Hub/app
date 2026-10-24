# Central de ajuda do GestaraHub (base do assistente)

Artigos curtos, escritos para quem usa o sistema (donos, gerentes, atendentes e professores). O assistente do "Fale com a gente" responde só com base nestes arquivos (`pnpm --filter @gestarahub/web help:build` gera o índice).

Regras para escrever:

- Um assunto por arquivo, título em `#` e seções em `##`. Cada seção vira um trecho que o assistente pode citar.
- Diga **onde fica** (menu e aba), os passos e o que acontece depois. Português direto, sem jargão.
- Só o que o produto faz hoje. Nada de prazo, preço de plano ou promessa.
- Linha `Onde: /rota` logo abaixo do título leva o aluno à tela (opcional).
- Mudou a tela? Atualize o artigo e rode o índice de novo.
