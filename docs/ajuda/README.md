# Central de ajuda do GestaraHub (base do assistente)

Artigos curtos, escritos para quem usa o sistema (donos, gerentes, atendentes e professores). O assistente do "Fale com a gente" responde só com base nestes arquivos (`pnpm --filter @gestarahub/web help:build` gera o índice).

Regras para escrever:

- Um assunto por arquivo, título em `#` e seções em `##`. Cada seção vira um trecho que o assistente pode citar.
- Diga **onde fica** (menu e aba), os passos e o que acontece depois. Português direto, sem jargão.
- Só o que o produto faz hoje. Nada de prazo, preço de plano ou promessa.
- Linha `Onde: /rota` logo abaixo do título leva o aluno à tela (opcional).
- Mudou a tela? Atualize o artigo e rode o índice de novo.
- Logo abaixo de cada `##`, uma linha `Resumo: ...` com a descrição curta do card na Ajuda do app (uma frase, sem cortar). Sem ela vale a primeira frase do trecho, que falha em lista numerada.
- Passo que leva a uma tela vira link: `[Alunos](/clients)` ou `[Horários](/settings?tab=horarios)`. Só rota do próprio app. O teste confere que a rota existe.
- Artigo de tela nova: acrescente a rota em `apps/web/src/lib/support/screen-names.ts` (o nome é o do título da página) e rode `pnpm --filter @gestarahub/web help:build`.
- A busca entende sinônimos (mensalidade e plano, aluno e cliente, apagar e excluir...) e uma letra errada; a lista fica em `help-search.ts`. Escreva com as palavras do produto e acrescente o sinônimo lá quando as pessoas buscarem de outro jeito (veja "Uso da ajuda" no painel).

## Guia na tela ("Me mostre na tela")

Seção de ação (criar, pagar, configurar...) pode ter um guia que destaca, passo a passo, o botão, a aba ou o campo na tela de verdade. Fica logo abaixo do `##` (e do `Resumo:`), antes do texto:

```
## Cadastrar um aluno
Guia: /clients
+ botão "Novo aluno": Clique aqui para abrir o cadastro.
+ campo "Nome": Escreva o nome completo do aluno.
+ botão "Adicionar": Quando terminar, clique aqui para salvar.
```

- `Guia: /rota` é a tela onde começa (rota estática do app, pode ter `?tab=`). Se a pessoa está em outra, a ajuda leva até lá. O guia atravessa telas e janelas abertas pelo próprio passo.
- Passo: `+ tipo "rótulo": texto`. Tipos: `botão`, `aba`, `campo`, `menu` (barra lateral), `item` (linha de menu, opção, card) e `texto` (só mostra um título).
- O rótulo é o texto que a pessoa vê na tela (sem acento nem maiúscula; `Nome` casa com `Nome do aluno*`; `Adicionar|Salvar` aceita os dois). Não invente: o teste `help-guides.test.ts` confere que o rótulo existe no código e reprova quando um botão muda de nome.
- `botão`, `aba`, `menu` e `item` avançam sozinhos quando a pessoa clica no destaque; `campo` e `texto` avançam em "Próximo".
- Texto do passo: uma frase, imperativa, até 160 caracteres. De 2 a 6 passos por guia (máximo 8).
- Mudou um botão ou uma aba? Rode `pnpm --filter @gestarahub/web help:build` e `npx vitest run src/lib/support`.
