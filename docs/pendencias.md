# Pendências registradas

Tudo o que ficou combinado "para depois", num lugar só. Cada linha aponta para a doc com o detalhe. Ao resolver um item, apague a linha daqui e atualize a doc dele.

Última revisão: 23/10/2026.

## Decidido, falta implementar

| Pendência | Onde está o detalhe | Situação |
| --- | --- | --- |
| Correções do teste geral: as `média` e as `baixa` (as 5 altas estão corrigidas) | `qa/2026-10-23-teste-geral.md`, seção Correções | Em andamento; antes, a doc 13 §6 com o achado 80 |
| Troca de plano, renovação e atraso da assinatura: upgrade proporcional na hora, downgrade no fim do período, mensal ↔ anual, 5 dias de tolerância com avisos, webhook da assinatura | `product/13-modelo-de-negocio.md` §6 | Decidido em 23/10; implementar depois das altas |
| Plano conferido nas actions do servidor (recursos pagos usáveis no Grátis por quem chama a action direto) | `qa/2026-10-23-teste-geral.md`, achado 80 | Registrado como `média` |
| Cancelar aula e feriados | `product/25-lembretes-e-seguranca.md` §7 | Construir depois; há decisões abertas lá (avulsa, pacote, pagamento do professor, chamada, feriados) |
| Resumo diário de lembretes por e-mail | `product/25-lembretes-e-seguranca.md` §7 | Adiado |
| Primeiro desenho da tela no fuso do espaço (hoje sai em Brasília até o navegador ligar o fuso; afeta só outros fusos perto da meia-noite) | `qa/2026-10-23-teste-geral.md`, achado 81; `technical/22-fuso-do-espaco.md` | Registrado como `baixa` |
| Fuso por unidade (multiunidade em fusos diferentes) | `technical/22-fuso-do-espaco.md`, Limites | Só com a multiunidade (Expansão) |

## Esperando decisão sua

| Pendência | Onde está o detalhe |
| --- | --- |
| 8 perguntas de produto do teste geral (termos na demonstração, tela de Planos e taxa do Pix, aluno pausado, aluno menor, professor, mensagem para vários, calendário, conta de recebimento como pessoa física) | `qa/2026-10-23-teste-geral.md`, Perguntas para o usuário |
| Verificação em duas etapas: desligar um método só, demonstração sem verificação, esquecer dispositivo sem encerrar a sessão | `technical/17-verificacao-em-duas-etapas.md`, Perguntas para o usuário |
| Preço do Profissional e do Expansão; quem paga o WhatsApp automático e o pagamento online. Até lá a landing fica sem planos | `product/13-modelo-de-negocio.md`, `frontend/08-decisoes-landing-page-e-onboarding.md` §3.5 |

## Antes de ir para produção

| Pendência | Onde está o detalhe |
| --- | --- |
| Escrever o roteiro de publicação: Supabase (`db push` antes do deploy do app), Vercel sem `DEMO_PASSWORD`, segredos no Vault, conferências depois do primeiro deploy | Ainda sem doc (combinado em 22/10, a escrever quando começar o deploy) |
| GitHub Actions com as conferências rápidas e o e2e completo, e `main` protegida | `technical/20-tempo-dos-testes.md`, Etapa 2 |
| `ASAAS_API_URL` da API real antes do build (desliga os botões de simular pagamento) | `technical/14-asaas-mcp.md` |
| `ASAAS_WEBHOOK_EMAIL` (contato@gestarahub.com.br) na Vercel; webhooks de subcontas já criadas só pegam ao registrar de novo | `technical/19-desempenho-e-escala.md` |
| Aprovar a conta do MailerSend ("Get approved"); hoje só entrega para 1 destinatário | Painel do MailerSend (ação sua, não é código) |

## Só se você pedir

| Pendência | Onde está o detalhe |
| --- | --- |
| Escopo por vínculo no acesso de alunos e responsáveis (ex.: só o financeiro) | `technical/13-acesso-de-alunos-e-responsaveis.md` |
| Rodada de testes pendentes (regras da mensalidade e horários na primeira vez, configuração inicial e landing atualizadas sem rodar, sessão, esqueletos, agenda) | Lista na memória do agente; vira doc quando a rodada começar |
| Ideias de certificado e notas | `product/21-ideias-certificados-e-notas.md` |
| Barbearia (modelo de agendamento) segue no modo demonstração | `product/16-backlog-barbearia.md` |
