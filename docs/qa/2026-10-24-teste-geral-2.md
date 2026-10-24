# Teste geral 2: web e painel admin (24/10/2026)

Data: 2026-10-24. Status: Feito (e2e no fim, ver "Rodada automática").
Código: `apps/web`, `apps/admin`. Testes: Vitest, testes de banco, e2e Playwright e roteiros de navegador contra o Supabase local e o Asaas sandbox.

Feito por agente (Claude), sozinho, com o dono ausente. Navegador real (Chrome do sistema, sem janela) contra `next dev` (web na 3200 com `MAILERSEND_API_KEY` vazia, para os links saírem no log; painel na 3001), Supabase local e o **Asaas sandbox de verdade** (conta principal e subconta criadas pela própria tela). Nada de produção.

## O que foi percorrido

- **Rodada rápida:** typecheck e lint (web e painel), Vitest do web (1112) e do painel (33), testes do `packages/core` (293), testes de banco do web (36 arquivos, 146 testes) e do painel (11 arquivos, 79 testes).
- **Painel, entrada:** login com erro por campo (React Hook Form), senha errada, cadastro do aplicativo autenticador, papéis (menu e telas proibidas por papel: proprietário, suporte, financeiro, leitura), todas as telas em desktop e celular sem rolagem horizontal.
- **Painel, operação:** comunicados (validação, prévia, público por plano, agendamento, urgente), equipe (convite com link, aceite com senha e 2FA, link de uso único), LGPD (pedido do titular, exportação sem chaves), visão de suporte (somente leitura, sem nome de aluno), inativar e reativar espaço, reiniciar o 2FA de um usuário de espaço, Fale com a gente do início ao fim (cliente escreve, equipe responde, cliente vê "1 nova").
- **Web, dono novo:** cadastro pelo link, senha, termos, configuração inicial em 3 passos, painel, aluno com validação, cobrança avulsa.
- **Asaas sandbox:** ativar a conta de recebimento (subconta), Pix com baixa (simulada e por aviso do parceiro), link de cartão (confirmado e depois recebido, saldo a liberar), cancelar cobrança com Pix aberto, aviso sem token, com token errado e com corpo inválido, aviso repetido, assinatura do Plano Profissional por Pix e liberação na hora, rotinas diárias com segredo.
- **2FA:** ligar pelo e-mail, 8 códigos de recuperação, entrar com um deles (uma vez só), reinício pelo painel.

## Achados corrigidos

| # | Onde | O que era | Correção |
| --- | --- | --- | --- |
| 1 | Assinatura do plano e ativação da conta de recebimento | CPF/CNPJ só conferia o número de dígitos: `111.111.111-11` passava e ia ao parceiro (que às vezes aceitava no sandbox) | `isValidCpfOrCnpj` em `@gestarahub/core/payer` (dígitos verificadores), usada nos dois formulários; testes no core |
| 2 | Fale com a gente | O CPF, e-mail, telefone e cartão digitados ficavam guardados na conversa (a doc dizia que apareciam mascarados) | A mensagem é mascarada antes de gravar; aviso no texto da caixa de conversa; teste de banco |
| 3 | Máscara do assistente | O telefone comia um pedaço do cartão (`41[telefone] 1111`): sobravam dígitos do cartão | O cartão (13 a 19 números) vai primeiro; testes |
| 4 | Login de espaço inativo | Voltava mudo à tela de entrada, sem dizer o porquê | Mensagem "Este espaço está inativo. Fale com o suporte do GestaraHub para reativar."; teste de banco |
| 5 | Painel, formulários | O erro de campo aparecia ao sair do campo (modo `onTouched`) e o botão andava para cima: o clique no "Revisar" se perdia e era preciso clicar duas vezes | `mode: "onSubmit"` como no web e o "Revisar" usa `handleSubmit` (o erro some ao corrigir) |
| 6 | Painel, layout | Dois `<main>` aninhados (landmark duplicado) | O interno virou `div` |
| 7 | Painel, comunicados | O plano "Profissional" aparecia como "Pro" na lista e nas caixas | Nome oficial |
| 8 | Painel, visão de suporte | Mostrava "approved" e misturava "cancelados" com "pagas" | Rótulos em português e separados (alunos x cobranças) |
| 9 | Painel, ids | O campo "Motivo" tinha id com espaços (HTML inválido) | Id sem espaços |
| 10 | Webhook do parceiro | Estorno e contestação eram ignorados em silêncio | Ficam no registro de erros (aparece em Saúde) com o texto "avisar o dono"; o que fazer com a cobrança é decisão de produto (pendência) |
| 11 | Resumo diário de erros | Com 30 ms de diferença entre o relógio do banco e o do servidor, um erro visto logo antes do resumo voltava como novo (o teste de banco falhava de vez em quando) | "Avisado" passa a ser o `last_seen` coberto pelo aviso, nunca a hora do servidor |
| 12 | e2e | 9 specs ainda esperavam "Professor"/"Profissional" depois da decisão "quem dá aula segue a área" (Instrutor ou Professor), e uma esperava link onde agora a linha da turma é clicável | Specs ajustadas ao vocabulário novo |

## Rodada automática (e2e)

Rodada completa do e2e em modo produção (`E2E_SERVER=prod`), uma por vez e sozinha na máquina (**rodar o e2e junto com outra coisa no mesmo banco derruba muitos testes por tempo**: a primeira tentativa, com dois servidores de desenvolvimento ligados, falhou 157 testes só por isso). Resultado: **401 passaram, 1 instável (passou na nova tentativa: `verificacao-email`), 2 ignorados e 9 falharam**; as 9 eram expectativas velhas (achado 12) e passaram depois do ajuste. Tempo: 37,7 minutos.

Depois: typecheck e lint limpos nos dois apps; Vitest do web 1114, do painel 33, core 293; testes de banco do web (36 arquivos) e do painel (11 arquivos, 79 testes) passando.

## Achados que ficam para decisão ou depois

- **Estorno e contestação do parceiro** (achado 10): hoje só avisa a equipe. Decidir o que acontece com a cobrança do aluno (reabrir? marcar "estornada"?). Em `docs/pendencias.md`.
- **Pix recém-aberto da assinatura não volta ao recarregar a página**: o QR some e a pessoa gera outro; o antigo fica no parceiro. Baixa.
- **Aviso de hidratação do React em dev na primeira carga** (landing e `/health` do painel), não reproduz em recargas. Só aparece na compilação do `next dev`.
- **Primeira geração de Pix logo depois de ativar a conta** pode dar "Pix ainda não liberado" por alguns segundos (a chave Pix leva um tempo no parceiro); a mensagem é clara e a segunda tentativa funciona. Já conhecido (achado 56 do teste anterior).
- **Painel, Equipe**: a linha de cada pessoa tem seletor e três botões vermelhos/cinza; funciona, mas pesa. Candidato a menu "⋮" (design).
- **Faixa de aviso no topo do web** (comunicados) ocupa uma largura um pouco maior que o conteúdo (alinhamento de 8 px). Baixa.
- **Conversa no Fale com a gente** repete duas frases parecidas depois de "Falar com o suporte" ("Enviamos sua conversa..." e "Sua conversa está com o suporte..."). Baixa.

## Dados de teste

Tudo o que o teste criou foi apagado no fim (espaço, usuários, administradores, comunicados, conversas, pedidos de LGPD e as linhas de auditoria deles). O banco ficou só com o administrador do dono. No Asaas sandbox ficaram a subconta e as cobranças de teste (ambiente de homologação, sem efeito).
