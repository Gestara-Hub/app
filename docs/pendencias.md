# Pendências registradas

Tudo o que ficou combinado "para depois", num lugar só. Cada linha aponta para a doc com o detalhe. Ao resolver um item, apague a linha daqui e atualize a doc dele.

Última revisão: 23/10/2026.

## Decidido, falta implementar

| Pendência | Onde está o detalhe | Situação |
| --- | --- | --- |
| Correções do teste geral: as `média` e as `baixa` (as 5 altas estão corrigidas) | `qa/2026-10-23-teste-geral.md`, seção Correções | Em andamento |
| Cancelar aula e feriados | `product/25-lembretes-e-seguranca.md` §7 | Construir depois; há decisões abertas lá (avulsa, pacote, pagamento do professor, chamada, feriados) |
| Resumo diário de lembretes por e-mail | `product/25-lembretes-e-seguranca.md` §7 | Adiado |
| Primeiro desenho da tela no fuso do espaço (hoje sai em Brasília até o navegador ligar o fuso; afeta só outros fusos perto da meia-noite) | `qa/2026-10-23-teste-geral.md`, achado 81; `technical/22-fuso-do-espaco.md` | Registrado como `baixa` |
| Fuso por unidade (multiunidade em fusos diferentes) | `technical/22-fuso-do-espaco.md`, Limites | Só com a multiunidade (Expansão) |

## Testes deixados para o fim

Decisão do usuário (23/10/2026): foco no desenvolvimento. O e2e e as conferências à mão ficam para uma rodada só, no fim, e o que aparecer é corrigido ali. **Cada etapa que pular um teste entra nesta tabela.** Na rodada: rodar tudo, registrar as falhas como achados no teste geral e corrigir.

| O que | Cobre | Como (tempo) |
| --- | --- | --- |
| e2e da área `acesso` | #13 (convidado entra com a senha), permissões, verificação em duas etapas | `pnpm --filter @gestarahub/web e2e:area acesso` (4 a 6 min) |
| e2e da área `configuracao` | #66 (plano em Configurações), #75 (Preferências), seletor de fuso | `pnpm --filter @gestarahub/web e2e:area configuracao` (5 a 7 min) |
| e2e da área `cobrancas` | #60 e #76 (datas de pagamento), #56 (cobrar online), cobranças | `pnpm --filter @gestarahub/web e2e:area cobrancas` (6 a 8 min) |
| e2e das áreas `auditoria` e `painel` | Filtro "Pessoas / Sistema / Só o que falhou" e detalhe com o código do erro; aviso fixo do plano no topo | `pnpm --filter @gestarahub/web e2e:area auditoria painel` |
| e2e novos a escrever | Troca de plano (Planos → janela com a conta → Pix da diferença simulado → plano ligado; troca marcada e "Desmarcar"), aviso fixo do plano, "Histórico do plano" em Configurações, seletor de fuso, filtro "Sistema" da Auditoria | Hoje nenhum spec cobre a tela de Planos |
| À mão no Asaas sandbox | #56: subconta nova e Pix gerado logo depois de ativar (mensagem e cobrança cancelada no Asaas); webhook da conta principal com os eventos do plano (renovação, diferença do upgrade, assinatura removida), com o túnel ligado | Doc `technical/16` (túnel) e doc 13 §6 |
| À mão: rotina diária do plano | Renovação vencida → avisos → Grátis no 5º dia → assinatura encerrada no 15º; e-mails ao dono e ao gerente | Chamar `/api/cron/daily` com o `CRON_SECRET`, ajustando a data de renovação no banco local |
| À mão no navegador | #60: pagamento depois das 21h e troca do fuso em Configurações; #75: console sem erro de hidratação em `/settings` → Preferências | `pnpm dev` |
| Smoke no fim de tudo | Os 42 fluxos críticos | `pnpm --filter @gestarahub/web e2e:smoke` (4 min) |

## Esperando decisão sua

| Pendência | Onde está o detalhe |
| --- | --- |
| **#10: etiquetas na lista de alunos** (até 4 por linha: Ativo, Aniversário, Termo pendente, Definir nível, além do plano). Opções: (a) só o que pede ação (atraso, termo pendente, pausa) na lista, e aniversário e "Definir nível" só na ficha; (b) manter. **Recomendação: (a).** Lista mais limpa, e o que importa não se perde no meio. | `qa/2026-10-23-teste-geral.md`, achado 10 |
| **#12: aceite dos termos duas vezes** (a tela de cadastro diz "Ao criar a conta, você aceita os Termos..." e o primeiro acesso abre o contrato pedindo "Li e aceito"). Opções: (a) manter o contrato e tirar a frase do cadastro; (b) manter a frase e tirar o contrato. **Recomendação: (a):** o contrato é o aceite que fica gravado (LGPD), a frase sozinha não prova nada. | `qa/2026-10-23-teste-geral.md`, achado 12 |
| **#48 (o que sobrou): certificado de aluno sem presença.** O curso encerrado marca "Concluído" e o certificado diz "com 7 aulas" (as do curso, não as do aluno), mesmo com zero presenças. Opções: (a) concluir por frequência mínima definida pelo espaço; (b) manter "Concluído" pelo calendário e trocar o texto para "curso de 7 aulas", mostrando a frequência real ao lado; (c) deixar. **Recomendação: (b) agora** (sem regra nova) e (a) depois, se algum espaço pedir. O cargo "Instrutor" na assinatura segue o nome do papel do achado 23 (um nome só, sem gênero fixo). | `qa/2026-10-23-teste-geral.md`, achados 48 e 23; `product/21-ideias-certificados-e-notas.md` |
| **#26 e #33: parcelas depois do fim** (pacote de 90 dias com parcelas até 9 meses depois; curso que termina em 20/11 com a última parcela em 23/12). As docs de cobrança (`product/15`, `product/20`) não dizem nada. Opções: (a) travar o número de parcelas pelo prazo; (b) só avisar na janela de venda/matrícula e deixar passar; (c) deixar como está. **Recomendação: (b)**, porque a dívida de uma venda já feita continua válida e parcelar além da validade é uma escolha comercial do dono; o aviso evita o erro sem prender. | `qa/2026-10-23-teste-geral.md`, achados 26 e 33 |
| 8 perguntas de produto do teste geral (termos na demonstração, tela de Planos e taxa do Pix, aluno pausado, aluno menor, professor, mensagem para vários, calendário, conta de recebimento como pessoa física) | `qa/2026-10-23-teste-geral.md`, Perguntas para o usuário |
| Verificação em duas etapas: desligar um método só, demonstração sem verificação, esquecer dispositivo sem encerrar a sessão | `technical/17-verificacao-em-duas-etapas.md`, Perguntas para o usuário |
| Preço do Profissional e do Expansão; quem paga o WhatsApp automático e o pagamento online. Até lá a landing fica sem planos | `product/13-modelo-de-negocio.md`, `frontend/08-decisoes-landing-page-e-onboarding.md` §3.5 |

## Antes de ir para produção

| Pendência | Onde está o detalhe |
| --- | --- |
| Escrever o roteiro de publicação: Supabase (`db push` antes do deploy do app), Vercel sem `DEMO_PASSWORD`, segredos no Vault, conferências depois do primeiro deploy | Ainda sem doc (combinado em 22/10, a escrever quando começar o deploy) |
| GitHub Actions com as conferências rápidas e o e2e completo, e `main` protegida | `technical/20-tempo-dos-testes.md`, Etapa 2 |
| Mínimo de senha do Supabase Auth em 8 caracteres no projeto de produção (o local segue em 6 em `apps/supabase/config.toml`; o app já exige 8 em todas as telas e no servidor) | `qa/2026-10-23-teste-geral.md`, achado 14 |
| Webhook na conta principal do Asaas (eventos de cobrança e de assinatura, mesmo token): hoje só as subcontas têm | `product/13-modelo-de-negocio.md` §6, Pendente |
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
