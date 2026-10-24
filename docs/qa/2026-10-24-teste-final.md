# Teste final do sistema (24/10/2026)

Data: 2026-10-24. Status: Feito (primeira volta). Código: `apps/web`. Testes: e2e completo (406 verdes, 5 ajustados), smoke (42) e a passada de tela abaixo.

Passada de tela do modelo de turmas, no navegador (Chrome do sistema, contra o `pnpm dev` na porta 3000, com as chaves do Asaas e do e-mail desligadas): 4 perfis da demonstração (dono, gerente, recepção, professor) em **desktop 1280 no tema claro** e **celular 390 no tema escuro**, 104 telas e janelas. Em cada uma foram medidos: erro no console, rolagem horizontal, texto cortado com reticências, campos com menos de 16 px no celular e redirecionamento. As capturas ficam em `docs/qa/capturas/2026-10-24/` (só na máquina local). Os achados seguem o formato de `2026-10-23-teste-geral.md`, a partir do número 82.

## Resumo

- **Console:** nenhum erro de console nem de página nas 104 telas (inclui o aviso de hidratação de Preferências, achado 75).
- **Rolagem horizontal e texto cortado:** nenhuma ocorrência.
- **Redirecionamentos esperados:** recepção e professor entram pelo Calendário (não têm Painel); o gerente não abre Configurações; `/setup` volta ao Painel com a configuração concluída.
- **Os números batem:** Painel e Cobranças mostram os mesmos 3 atrasos do mês, R$ 484,52 (achado 2 corrigido), e o Painel diz "R$ 1.381,55 até hoje, de 3 meses" nos Lembretes, como a lista de Cobranças.
- **Achados novos:** 4 (todos `baixa`): 3 corrigidos nesta volta e 1 mantido por desenho.

## Achados

| # | Tela | Fluxo/passo | Tamanho/tema | O que aconteceu | O que devia acontecer | Como repetir | Gravidade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 82 | Planos → checkout | campos de cartão e dados | celular 390, escuro | 4 campos com letra de 12 px (`text-xs`, altura fixa): o iPhone dá zoom ao tocar (doc 07, "16 px no celular"). | Letra de 16 px no celular (`text-base md:text-sm`), altura padrão. | `/plans/checkout?tier=pro&interval=monthly` no celular. | baixa (corrigido) |
| 83 | Configurações → Plano GestaraHub | texto dos recursos | desktop 1280, claro | "Relatórios avançados: DRE gerencial e retenção dos alunos" (jargão). O nome do relatório "DRE gerencial" também aparece em Relatórios. | Português simples: "Resultado do mês e retenção dos alunos". | `/settings?tab=plano`. | baixa (corrigido o texto do plano; o nome do relatório segue em `docs/pendencias.md`) |
| 84 | Cobranças | linha de um aluno com uma cobrança paga | desktop 1280, claro | O valor ("R$ 140,00") encosta nos ícones de recibo e de desfazer: a caixa das ações tem 32 px e comporta dois botões de 32 px. | Espaço entre o valor e os ícones. | `/classes/billing?status=all`, aluno pago no cartão. | baixa (corrigido) |
| 85 | Chamada | faixa "Chamada concluída. Registrar a aula" | celular 390, escuro | A faixa fixa de baixo cobre a última linha visível enquanto a lista rola. Ao chegar no fim, a faixa fica abaixo da lista (é uma faixa `sticky`, por desenho: a ação segue à mão). | Nada a mudar: no fim da lista nada fica coberto. | Abrir uma aula concluída no celular. | baixa (mantido) |

## Perguntas para o usuário

Nenhuma nova. As anteriores seguem em `docs/pendencias.md`.
