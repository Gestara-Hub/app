# Pendências registradas

Tudo o que ficou combinado "para depois", num lugar só. Cada linha aponta para a doc com o detalhe. Ao resolver um item, apague a linha daqui e atualize a doc dele.

Última revisão: 31/10/2026 (revisão geral do web: o que ficou para depois entrou abaixo).

## Decidido, falta implementar

| Pendência | Onde está o detalhe | Situação |
| --- | --- | --- |
| Correções do teste geral: 73 de 81 achados corrigidos em 24/10 (noite + decisões do dia). Sobram o #81, o #32/#49 (conferir com o olho) e os botões `xs` | `qa/2026-10-23-teste-geral.md`, seção Correções | Em fechamento |
| **Painel admin do GestaraHub** (`apps/admin`): espaços, suporte por chatbot, planos e cortesias, saúde, comunicados e LGPD. Fase 1 é o "Fale com a gente" | `technical/26-painel-admin-gestarahub.md` | Fases 0 a 8 feitas em 24/10 (fases 1 a 8 sem commit); faltam os itens da seção 17 do doc, abaixo |
| **Canal de atendimento**: o "Fale com a gente" e o botão nos Planos estão feitos (fase 1). Falta o WhatsApp como canal (fase 1C, depende de conta Meta) e definir o preço do Profissional | `technical/26`, seção 17; `product/13-modelo-de-negocio.md` | Feito sem WhatsApp |
| Painel admin, itens que ficaram para depois: sugerir resposta por IA, imagens no chat, reenviar cobrança e cancelar assinatura no parceiro pelo painel, rodar rotina de novo, resumo diário de erros respeitar "erro conhecido", resposta por e-mail do cliente voltar para a conversa, configurações da plataforma, termos aceitos na aba de dados, e2e do painel | `technical/26`, seção 17 | Depois do teste manual |
| Suporte sem LLM no lançamento: o "?" com busca e dúvidas por tela e o guia "Me mostre na tela" estão feitos; falta Fale com a gente virar só formulário de chamado | `technical/26`, seções 18 e 18.5 | Parcial |
| Painel admin: conferir à mão o novo layout (gavetas, menu ⋮ de linha que abre gaveta ou confirmação, foco ao abrir pelo menu) e decidir se comunicados novo e editar viram gaveta (a action precisa devolver `ok` em vez de `redirect`) | `technical/26`, seção 19 | Conferir com o olho |
| Excluir espaço de vez (hoje só inativar): levantar a cascata das tabelas, os logins do espaço e a assinatura no parceiro de pagamentos; depois fazer em duas etapas com prazo | `technical/26`, seção 17 | Decidir depois do teste manual |
| Configurar no ambiente real: `ANTHROPIC_API_KEY` e o preço do modelo (custo estimado do assistente), `ADMIN_SERVICE_ROLE_KEY` e `ADMIN_PUBLIC_URL` (convite), `MAILERSEND_*`, `CRON_SECRET`, `ADMIN_NOTIFY_EMAIL` | `technical/26`, seção 12 | Antes de subir o painel |
| **Estorno e contestação do parceiro** (webhook `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_*`): hoje a cobrança continua "paga" e só cai no registro de erros (Saúde). Decidir o tratamento: reabrir a cobrança, marcar "estornada" ou só avisar o dono | `qa/2026-10-24-teste-geral-2.md`, achado 10 | Decisão de produto |
| Assinatura do plano: o Pix aberto não volta ao recarregar a página (o QR some e gera outro) | `qa/2026-10-24-teste-geral-2.md` | Baixa |
| Expansão fora da venda até existir multiunidade: o card e o botão voltam, e o teste e2e do upgrade para Expansão (`plano-gestarahub.spec.ts`, marcado `fixme`) | `technical/24-plano-gestarahub.md` | Voltar com a multiunidade |
| Categoria financeira "Professores" (dado semeado) continua com esse nome mesmo em áreas que dizem "instrutor" | `qa/2026-10-23-teste-geral.md`, achado 23 | Renomear exige migrar dado; deixado |
| Valores, sobras da revisão geral: o texto "R$ 1,99" das configurações quando falta a carteira principal; o fim de período na soma dos pontos não fica vermelho quando os pontos dados não somaram o total | `handoff/2026-10-31-revisao-geral.md`, O que ficou para depois | Baixa |
| Organização do código, sobras da revisão geral: datas `dd/MM` formatadas em 16 lugares, `clone` com 18 cópias, `forbiddenError` à mão, um `FormDrawer` comum, `queryKeys` à mão, páginas importando o interior das features, `client-form.tsx` com 2 mil linhas, placeholders "Ex.:" e um `line-clamp` | `handoff/2026-10-31-revisao-geral.md`, O que ficou para depois | Aos poucos, ao mexer em cada área |
| Recortes, sobras do smoke de 31/10/2026: a lista de alunos do professor (`clients.list`) sai do recorte e relê o espaço inteiro, porque o recorte não sabe quem chama (passar o perfil para o recorte); a ficha do aluno gera pelo espaço inteiro as mensalidades de todos e pelo recorte só as do aluno (sem efeito errado, mas o `WORLD_SLICE_CHECK=1` acusa) | `technical/19-desempenho-e-escala.md`; `handoff/2026-10-31-revisao-geral.md`, Testes | Baixa: só desempenho |
| Etiqueta "atraso" na lista de alunos (a decisão 10A cita atraso, termo pendente e pausa; atraso ainda não aparece) | `qa/2026-10-23-teste-geral.md`, achado 10 | Falta o dado de atraso na lista |
| Cancelar aula e feriados | `product/25-lembretes-e-seguranca.md` §7 | Construir depois; há decisões abertas lá (avulsa, pacote, pagamento do professor, chamada, feriados) |
| Resumo diário de lembretes por e-mail | `product/25-lembretes-e-seguranca.md` §7 | Adiado |
| Primeiro desenho da tela no fuso do espaço (hoje sai em Brasília até o navegador ligar o fuso; afeta só outros fusos perto da meia-noite) | `qa/2026-10-23-teste-geral.md`, achado 81; `technical/22-fuso-do-espaco.md` | Registrado como `baixa` |
| Fuso por unidade (multiunidade em fusos diferentes) | `technical/22-fuso-do-espaco.md`, Limites | Só com a multiunidade (Expansão) |
| "Nome da unidade" de volta em Configurações, aba Geral (saiu em 31/10/2026: o espaço tem uma unidade só) | `frontend/07-padroes-telas-e-ux.md`, Configurações | Só com a multiunidade (Expansão) |
| Ajuda do app: abrir o formulário já preenchido (ex.: Novo aluno com o nome); escrever mais artigos guiados pelo painel "Uso da ajuda" (buscas sem resultado); só depois, IA redigindo em cima da busca | `technical/26-painel-admin-gestarahub.md`, 18.2 e 18.3 | Decidido em 24/10: ajuda sem IA primeiro. Buscas sem resultado, "isso ajudou?" e tour já existem |
| Source maps de produção (tradução da pilha, `.map` no deploy) | `technical/21-registro-de-erros.md`, 5.1 | Decidido em 25/10: fora por ora; precisa de um preview na Vercel para conferir se os `.map` chegam
| Imagem anexada e captura de tela no relato de problema (avaliado e adiado em 24/10: complexidade e dado de aluno na imagem, LGPD); sugestões em lista/votação para priorizar | `technical/26-painel-admin-gestarahub.md`, fase 1 (problema e sugestão) | Hoje o problema leva texto, tela de origem, código do erro e contexto técnico |
| Botões `xs` com texto (ações de linha e chips: ficam, pela regra do doc `frontend/07` §1.5). Os `sm` e `lg` de texto foram tirados em 24/10, sem captura de tela | `qa/2026-10-23-teste-geral.md`, achado 9 | Conferir com o olho (linha abaixo) |
| **WhatsApp pelo número de cada espaço:** guardar as credenciais que o cadastro guiado da Meta devolve (token no Vault, id do número e da conta), registrar o número, inscrever os avisos e enviar com elas. Até lá, o envio automático fica bloqueado em produção (decisão de 30/10/2026) | `technical/07-integracao-whatsapp.md` §1.1, `product/13-modelo-de-negocio.md` §5 | Antes de produção |

## Testes deixados para o fim

Rodada final feita em 24/10/2026 (execução noturna): e2e completo (406 verdes, 5 ajustados por textos que mudaram de propósito), smoke (42), e2e novos do plano, da rotina diária, do aviso do Asaas, do fuso e do filtro da Auditoria, e a passada de tela de 104 telas (`qa/2026-10-24-teste-final.md`). Na noite de 30 para 31/10/2026, o e2e completo rodou duas vezes no build de produção (415 verdes; depois 414, com 1 corrida do teste da landing corrigida) e 21 telas foram revisadas no celular por captura (`handoff/2026-10-31-diario-noturno.md`). Na revisão geral de 31/10/2026, o e2e completo rodou de novo depois das correções (429 verdes) e as 10 telas novas de notas e testes e medidas foram capturadas no celular e no computador (`handoff/2026-10-31-revisao-geral.md`). Só o que depende de você ou do Asaas de verdade ficou:

| O que | Cobre | Como (tempo) |
| --- | --- | --- |
| À mão no Asaas sandbox: Pix logo depois de ativar uma subconta nova | #56: a mensagem "A conta ainda está liberando o Pix" e a cobrança cancelada no Asaas | Conta nova → Recebimentos online → Ativar → logo em seguida Cobranças → Cobrar online → Gerar Pix (5 min) |
| À mão no Asaas sandbox: avisos de verdade pelo túnel | Webhook da conta principal com renovação, diferença do upgrade e assinatura removida (a rotina diária e o aviso já estão no e2e `plano-rotina-e-webhook`, com dados do banco) | Doc `guides/16` (túnel) e doc 13 §6 |
| À mão no Asaas sandbox: data de vencimento da fatura do link de cartão (#59) | O app manda o vencimento igual ao fim da validade do link; a fatura do parceiro mostrou um dia a mais | Gerar o link numa cobrança que vence hoje e abrir |
| À mão, depois das 21h de Brasília: pagamento (#60) | A data do pagamento na ficha e no Asaas (já coberto por teste de banco e de unidade) | Registrar um pagamento depois das 21h e abrir a ficha |
| À mão: guias "Me mostre na tela" (Ajuda → card com o botão): percorrer os guias de cada tela e ver se o destaque cai no botão certo, se a janela aberta continua aberta ao clicar no balão e se o celular abre o menu lateral no passo "menu". Depois, um e2e leve por tela (clicar "Me mostre" e ver o primeiro destaque) | `technical/26`, seção 18.5; `ajuda/README.md` | Conferir com o olho amanhã |
| À mão: CSP com PostHog e Meta ligados (o e2e roda sem os dois). Smoke (42 fluxos) verde no build de produção com o CSP em 31/10/2026 | CSP de 31/10/2026 (`technical/00`): console sem "Refused to ..." ao aceitar a análise de uso e ao abrir o cadastro do WhatsApp oficial | `pnpm dev:https` com as chaves; aceitar cookies, navegar e abrir Comunicação → Conectar |
| Conferir com o olho: cadastro de aluno com início antigo (pergunta "Cobrar os meses desde o início?", padrão "A partir deste mês", contagem de mensalidades vencidas, 1ª cobrança do mês atual) e "Cobrar online" sem `ASAAS_MASTER_WALLET_ID` (taxa do GestaraHub zero na prévia) | Decisões 3 e 4 confirmadas em 31/10/2026 (`product/15`, `technical/25`) | Novo aluno com início de 6 meses atrás; tirar a variável do `.env.local` e abrir Cobrar online |
| Conferir com o olho: pausar aluno (duas confirmações), mensagem para vários alunos, tela de Planos sem Expansão, botões depois de tirar `size="sm"` e `lg` | Decisões 8A, 11A, 7A e achado 9 | Abrir cada tela |
| Conferir com o olho: janela com rolagem e botão "Certificado" do Grátis | #32 (seta de rolar cobrindo texto) e #49 (clicar em "Certificado" no Grátis) | Nova turma com horário fora do expediente; curso encerrado → ⋮ do aluno → Certificado numa conta Grátis |
| À mão: cadastro guiado da Meta de ponta a ponta (`pnpm dev:https`), conectar sem telefone no espaço, franquia esgotada voltando ao assistido; situação dos modelos em Comunicação (só em análise, recusado e pausado, sem selo no aprovado); cor e tiques da situação das mensagens no Histórico; topo sem o selo do plano (sino e avatar alinhados, no celular e no computador); avisos do plano e da franquia no sino e a aba de Comunicação pelo endereço (`?tab=connection`); menu do avatar enxuto (Preferências, Segurança, Ajuda e suporte com o número de respostas, sem linha dupla antes de Sair); "Remover" por método na janela Segurança (com app e e-mail ligados); trocar de página nas listas volta ao início da lista (Alunos, Cobranças, Financeiro, Histórico da Comunicação, Recebimentos; celular e computador); lista de Alunos sem o selo de plano e pacote (lista, cartões e celular); ficha do aluno com "Plano e pacotes" e o Cadastro sem cartões (com plano, bolsa, só pacote, sem nada, menor de idade); fatura pública `/p/c/<cobrança>` (CPF, menor, forma desligada, código antigo cancelado no Asaas); card da fatura do plano em Configurações → Plano | Mudanças de 29 e 30/10 (WhatsApp, fatura pública, fatura do plano) | `pnpm dev:https`, Asaas sandbox |

## Esperando decisão sua

| Pendência | Onde está o detalhe |
| --- | --- |
| DRE sem as taxas do pagamento online: a linha "Deduções" é sempre zero, mas cada Pix e link já guarda a tarifa e o líquido. Decidir como contar quando a taxa é repassada ao aluno (o aluno paga a mais e o espaço recebe o valor cheio) | `handoff/2026-10-31-diario-noturno.md`, O que ficou de fora |
| Landing sem planos até decidir mostrar os planos e quem paga o WhatsApp automático e o pagamento online (os preços já foram aprovados em 19/10: Profissional R$ 79,90 e Expansão R$ 199) | `product/13-modelo-de-negocio.md`, `frontend/08-decisoes-landing-page-e-onboarding.md` §3.5 |

## Antes de ir para produção

| Pendência | Onde está o detalhe |
| --- | --- |
| Escrever o roteiro de publicação: Supabase (`db push` antes do deploy do app), Vercel sem `DEMO_PASSWORD`, segredos no Vault, conferências depois do primeiro deploy | Ainda sem doc (combinado em 22/10, a escrever quando começar o deploy) |
| GitHub Actions com as conferências rápidas e o e2e completo, e `main` protegida | `technical/20-tempo-dos-testes.md`, Etapa 2 |
| Segredos novos da auditoria de 30/10/2026: `META_APP_SECRET` (assinatura do webhook do WhatsApp; sem ele, produção recusa o webhook) e, se quiser trocar o derivado da chave de serviço, `SESSION_SECRET` (cookie do app). Na publicação, as sessões abertas caem uma vez (cookie assinado). Se uma chave real de subconta do Asaas já esteve num banco com a coluna exposta, trocar no Asaas | `handoff/2026-10-31-diario-noturno.md`, Segurança |
| Mínimo de senha do Supabase Auth em 8 caracteres no projeto de produção (o local segue em 6 em `apps/supabase/config.toml`; o app já exige 8 em todas as telas e no servidor) | `qa/2026-10-23-teste-geral.md`, achado 14 |
| Webhook na conta principal do Asaas (eventos de cobrança e de assinatura, mesmo token): hoje só as subcontas têm | `product/13-modelo-de-negocio.md` §6, Pendente |
| `ASAAS_API_URL` da API real antes do build (desliga os botões de simular pagamento) | `technical/14-asaas-mcp.md` |
| `NEXT_PUBLIC_APP_URL` com o domínio do app na Vercel: sem ele, os links dos e-mails de senha, convite e consentimento usam o endereço da requisição (auditoria de 30/10/2026) | `handoff/2026-10-31-diario-noturno.md`, O que ficou de fora |
| `ASAAS_MASTER_WALLET_ID` da conta principal na Vercel: sem ele o Pix e o link saem sem a taxa do GestaraHub (desde 31/10/2026 o app zera a taxa nesse caso, então o aluno não paga a mais, mas o GestaraHub não recebe nada) | `handoff/2026-10-31-diario-noturno.md`, Decisões |
| Segurança, sobras da revisão geral de 31/10/2026: estreitar a leitura direta de presenças, matrículas, reservas, espera e equipe; registro de serviços negando por padrão (permissão obrigatória em todo método); reconferir no Asaas o pagamento do webhook antes da baixa; `organizations.settings` (chave Pix) legível por todos do espaço; `/p/<código>` gravando `opened_at` | `handoff/2026-10-31-revisao-geral.md`, O que ficou para depois |
| `ASAAS_WEBHOOK_EMAIL` (contato@gestarahub.com.br) na Vercel; webhooks de subcontas já criadas só pegam ao registrar de novo | `technical/19-desempenho-e-escala.md` |
| Aprovar a conta do MailerSend ("Get approved"); hoje só entrega para 1 destinatário | Painel do MailerSend (ação sua, não é código) |
| App da Meta: revisão das permissões `whatsapp_business_messaging` e `whatsapp_business_management` e virada para o modo de produção (precisa do domínio com `/privacy` e `/terms`) | `technical/07-integracao-whatsapp.md` |

## Só se você pedir

| Pendência | Onde está o detalhe |
| --- | --- |
| Escopo por vínculo no acesso de alunos e responsáveis (ex.: só o financeiro) | `technical/13-acesso-de-alunos-e-responsaveis.md` |
| Rodada de testes pendentes (regras da mensalidade e horários na primeira vez, configuração inicial e landing atualizadas sem rodar, sessão, esqueletos, agenda) | Lista na memória do agente; vira doc quando a rodada começar |
| Ideias de certificado e notas | `product/21-ideias-certificados-e-notas.md` |
| Barbearia (modelo de agendamento) segue no modo demonstração | `product/16-backlog-barbearia.md` |
- **Certificado de graduação em lote por exame** (31/10/2026): depois do individual (doc product/21 §1.6), um "Emitir certificados" por data de graduação na modalidade, um PDF com todos que graduaram no dia.
