# Pendências registradas

Tudo o que ficou combinado "para depois", num lugar só. Cada linha aponta para a doc com o detalhe. Ao resolver um item, apague a linha daqui e atualize a doc dele.

Última revisão: 24/10/2026 (fim da execução noturna).

## Decidido, falta implementar

| Pendência | Onde está o detalhe | Situação |
| --- | --- | --- |
| Correções do teste geral: o que sobrou depende das decisões da seção "Esperando decisão sua" (57 de 81 achados corrigidos em 24/10) | `qa/2026-10-23-teste-geral.md`, seção Correções; `qa/2026-10-24-teste-final.md` | Esperando você |
| Cancelar aula e feriados | `product/25-lembretes-e-seguranca.md` §7 | Construir depois; há decisões abertas lá (avulsa, pacote, pagamento do professor, chamada, feriados) |
| Resumo diário de lembretes por e-mail | `product/25-lembretes-e-seguranca.md` §7 | Adiado |
| Primeiro desenho da tela no fuso do espaço (hoje sai em Brasília até o navegador ligar o fuso; afeta só outros fusos perto da meia-noite) | `qa/2026-10-23-teste-geral.md`, achado 81; `technical/22-fuso-do-espaco.md` | Registrado como `baixa` |
| Fuso por unidade (multiunidade em fusos diferentes) | `technical/22-fuso-do-espaco.md`, Limites | Só com a multiunidade (Expansão) |
| Botões com texto fora dos 36 px (doc `frontend/07` §1.5): cerca de 50 usos de `size="sm"`, `xs` ou `lg` (barra de paginação, painel de tema, evolução do aluno, Configurações, checkout do plano). O topo e a abertura de Recebimentos online já foram acertados | `qa/2026-10-23-teste-geral.md`, achado 9 | Varrer por tela, com captura, para não estragar telas densas; a do checkout fica junto com a revisão da tela de Planos |

## Testes deixados para o fim

Rodada final feita em 24/10/2026 (execução noturna): e2e completo (406 verdes, 5 ajustados por textos que mudaram de propósito), smoke (42), e2e novos do plano, da rotina diária, do aviso do Asaas, do fuso e do filtro da Auditoria, e a passada de tela de 104 telas (`qa/2026-10-24-teste-final.md`). Só o que depende de você ou do Asaas de verdade ficou:

| O que | Cobre | Como (tempo) |
| --- | --- | --- |
| À mão no Asaas sandbox: Pix logo depois de ativar uma subconta nova | #56: a mensagem "A conta ainda está liberando o Pix" e a cobrança cancelada no Asaas | Conta nova → Recebimentos online → Ativar → logo em seguida Cobranças → Cobrar online → Gerar Pix (5 min) |
| À mão no Asaas sandbox: avisos de verdade pelo túnel | Webhook da conta principal com renovação, diferença do upgrade e assinatura removida (a rotina diária e o aviso já estão no e2e `plano-rotina-e-webhook`, com dados do banco) | Doc `guides/16` (túnel) e doc 13 §6 |
| À mão no Asaas sandbox: data de vencimento da fatura do link de cartão (#59) | O app manda o vencimento igual ao fim da validade do link; a fatura do parceiro mostrou um dia a mais | Gerar o link numa cobrança que vence hoje e abrir |
| À mão, depois das 21h de Brasília: pagamento (#60) | A data do pagamento na ficha e no Asaas (já coberto por teste de banco e de unidade) | Registrar um pagamento depois das 21h e abrir a ficha |
| Conferir com o olho: janela com rolagem e botão "Certificado" do Grátis | #32 (seta de rolar cobrindo texto) e #49 (clicar em "Certificado" no Grátis) | Nova turma com horário fora do expediente; curso encerrado → ⋮ do aluno → Certificado numa conta Grátis |

## Esperando decisão sua

| Pendência | Onde está o detalhe |
| --- | --- |
| **#23: nome do papel de quem dá aula** (hoje: botão "Novo profissional", janela "Novo instrutor", aviso "Profissional criado", campo da turma "Professor" com erro "Selecione o instrutor."). Opções: (a) uma palavra só em todo o app ("Professor"); (b) a palavra da área, como já é com Faixa/Nível/Módulo (Lutas: "Instrutor"; Música, Idiomas e Reforço: "Professor"; Pilates e yoga: "Instrutor"), guardada no vocabulário da área. **Recomendação: (b).** Mexe em dezenas de textos; o glossário (`product/01`) já diz "Professor / Instrutor". A assinatura do certificado ("Instrutor") e o demonstrativo ("Professor") entram junto. | `qa/2026-10-23-teste-geral.md`, achados 23, 48 e 55 |
| **#10: etiquetas na lista de alunos** (até 4 por linha: Ativo, Aniversário, Termo pendente, Definir nível, além do plano). Opções: (a) só o que pede ação (atraso, termo pendente, pausa) na lista, e aniversário e "Definir nível" só na ficha; (b) manter. **Recomendação: (a).** Lista mais limpa, e o que importa não se perde no meio. | `qa/2026-10-23-teste-geral.md`, achado 10 |
| **#12: aceite dos termos duas vezes** (a tela de cadastro diz "Ao criar a conta, você aceita os Termos..." e o primeiro acesso abre o contrato pedindo "Li e aceito"). Opções: (a) manter o contrato e tirar a frase do cadastro; (b) manter a frase e tirar o contrato. **Recomendação: (a):** o contrato é o aceite que fica gravado (LGPD), a frase sozinha não prova nada. | `qa/2026-10-23-teste-geral.md`, achado 12 |
| **#48 (o que sobrou): certificado de aluno sem presença.** O curso encerrado marca "Concluído" e o certificado diz "com 7 aulas" (as do curso, não as do aluno), mesmo com zero presenças. Opções: (a) concluir por frequência mínima definida pelo espaço; (b) manter "Concluído" pelo calendário e trocar o texto para "curso de 7 aulas", mostrando a frequência real ao lado; (c) deixar. **Recomendação: (b) agora** (sem regra nova) e (a) depois, se algum espaço pedir. O cargo "Instrutor" na assinatura segue o nome do papel do achado 23 (um nome só, sem gênero fixo). | `qa/2026-10-23-teste-geral.md`, achados 48 e 23; `product/21-ideias-certificados-e-notas.md` |
| **#26 e #33: parcelas depois do fim** (pacote de 90 dias com parcelas até 9 meses depois; curso que termina em 20/11 com a última parcela em 23/12). As docs de cobrança (`product/15`, `product/20`) não dizem nada. Opções: (a) travar o número de parcelas pelo prazo; (b) só avisar na janela de venda/matrícula e deixar passar; (c) deixar como está. **Recomendação: (b)**, porque a dívida de uma venda já feita continua válida e parcelar além da validade é uma escolha comercial do dono; o aviso evita o erro sem prender. | `qa/2026-10-23-teste-geral.md`, achados 26 e 33 |
| **Termos na demonstração (#1, #72).** Hoje o visitante aceita um contrato em nome de "Ana Ribeiro" e, a cada troca de perfil, o aceite pode reaparecer. Opções: (a) `pnpm demo:local` já grava o aceite dos quatro perfis da demonstração e a troca de perfil nunca pergunta; (b) aviso curto próprio da demonstração. **Recomendação: (a)**: ninguém aceita contrato em nome de outra pessoa, e é só gravar o aceite no roteiro da demonstração. | `qa/2026-10-23-teste-geral.md`, achados 1 e 72 |
| **Tela de Planos e taxa do Pix (#17, #18, #19, #67).** A tela promete recursos que não existem (app do aluno, multiunidades ilimitadas, API, "BI preditivo") e mostra preços do Profissional (R$ 79,90) e do Expansão (R$ 199,00), ainda não definidos; a taxa do Pix aparece de dois jeitos. Opções: (a) só o que existe hoje (WhatsApp automático, relatórios avançados, certificado), sem preço, com "Fale com a gente"; (b) manter e só corrigir os textos. **Recomendação: (a)**, como a regra da landing. Taxa do Pix, uma frase única (constante nas duas telas): "Taxa do GestaraHub: R$ 1,99 por Pix pago no Grátis (R$ 1,29 nos pagos), mais a tarifa do parceiro". Os textos do checkout (maiúsculas, "Churn", "BI", "API", "gateway") se revisam junto. | `qa/2026-10-23-teste-geral.md`, achados 17, 18, 19; `product/13-modelo-de-negocio.md` |
| **Aluno pausado (#27, #53).** Pausar não mexe na mensalidade do mês em curso (só cancela as que começam depois de hoje), o lembrete de WhatsApp continua saindo e a ficha mostra "Ativo". Opções para a cobrança do mês: (a) perguntar ao pausar (cancelar a do mês se ainda não venceu e não foi paga, ou manter); (b) cancelar sempre; (c) manter sempre. **Recomendação: (a)** com a cobrança do mês em curso listada na confirmação, e o lembrete de WhatsApp pulando aluno pausado. Sem decisão, a ficha já pode mostrar "Pausado" (isso não depende da regra do dinheiro). | `qa/2026-10-23-teste-geral.md`, achados 27 e 53; `product/15-regras-de-cobranca.md` |
| **Menor de idade (#57).** A cobrança e os avisos de aluno menor vão para o telefone do próprio aluno ("Olá, Gabi!"); o responsável financeiro só entra para o CPF. Opções: (a) mandar ao responsável financeiro (nome e telefone dele), com o nome do aluno no texto, e cair no telefone do aluno só se o responsável não tiver; (b) manter. **Recomendação: (a)** (a cobrança é do responsável; a mesma regra do CPF). | `qa/2026-10-23-teste-geral.md`, achado 57; `technical/13-acesso-de-alunos-e-responsaveis.md` |
| **Professor (#70).** Hoje o professor não tem sino de lembretes nem abre a ficha do aluno. Opções: (a) lembretes só dos alunos dele (faltas seguidas e aniversários) e ficha sem a parte de dinheiro; (b) manter sem nada. **Recomendação: (a)**, porque quem dá a aula é quem primeiro percebe a falta; fica para depois do tratamento do nome do papel (#23). | `qa/2026-10-23-teste-geral.md`, achado 70; `product/06-perfis-permissoes.md` |
| **Mensagem para vários alunos e calendário (#65, #37).** "Nova mensagem" aceita um aluno só, e o calendário de turmas só tem Grade e Lista. Opções: (a) escolher vários alunos e enviar em sequência (o envio em sequência dos lembretes já existe); calendário só com Grade e Lista; (b) manter. **Recomendação: (a) para a mensagem; manter o calendário** (a Lista já cobre o dia e o mês). | `qa/2026-10-23-teste-geral.md`, achados 65 e 37; `product/25-lembretes-e-seguranca.md` |
| **Conta de recebimento como pessoa física (#58).** A fatura do cartão (parceiro) mostra ao aluno CPF, e-mail e telefone de quem abriu a conta como pessoa física. Opções: (a) avisar o dono na ativação, numa frase, e sugerir abrir como CNPJ/MEI quando tiver; (b) nada. **Recomendação: (a)**; o app não controla a fatura do parceiro. | `qa/2026-10-23-teste-geral.md`, achado 58 |
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
