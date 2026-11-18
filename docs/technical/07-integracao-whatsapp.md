# 07 — Integração real do WhatsApp (API oficial da Meta)

Data: 2026-10-14.

> **Status (17/11/2026):** a API oficial da Meta está ligada no código (cliente, webhook, rotina de lembretes de cobrança, situação dos modelos e o cadastro guiado da Meta na tela). **Cada espaço conecta o próprio número** pelo cadastro guiado: o servidor troca o código pelo token do espaço e guarda as credenciais (seção 1.1, parte A feita). O envio por modelo aprovado e as rotinas enviando de verdade (seção 1.3, parte B) e os modelos e avisos por espaço (seção 1.4, parte C) também estão feitos. Falta o lado da Meta (dono, abaixo). O app da Meta está em modo de desenvolvimento; a revisão do app e a virada para produção ficam para o deploy (`docs/pendencias.md`).
> Decisão de produto (número do próprio espaço; assistido no grátis, oficial no Pro): [../product/13-modelo-de-negocio.md](../product/13-modelo-de-negocio.md), seção 5. Custos e repasse: [../product/19-levantamento-pagamentos.md](../product/19-levantamento-pagamentos.md), seção 3.

## 1. O que existe hoje

| Parte | Situação |
|---|---|
| Envio assistido (`api.whatsapp.com/send` com o texto pronto) | **Real.** Abre o WhatsApp do aparelho; registra "Aberto no WhatsApp". |
| Botão "Conectar WhatsApp oficial" | Abre o cadastro guiado da Meta (`use-meta-embedded-signup.ts`, SDK v21, `pt_BR`). Com o id do número devolvido, consulta o número e o nome verificados na Meta (`getWhatsAppPhoneNumberDetails`). Sem número confirmado (pela Meta ou no cadastro do espaço), não conecta: nunca grava o id da Meta nem um número inventado como telefone. Unidade sem telefone recebe o número confirmado pela Meta. |
| Envio pelo oficial, status "Entregue/Lida/Falhou" | Real pela Cloud API, **com o número da plataforma** (variáveis `WHATSAPP_*` do ambiente). Status pelo webhook da Meta (`/api/webhooks/whatsapp`). |
| Parabéns automático e lembretes de cobrança | Rotinas automáticas (só no Pro, só no oficial). O lembrete leva o link do pagamento online; sem ele, o da fatura pública (`/p/c/<cobrança>`, doc 25 §7). |
| Situação dos modelos na Meta (Comunicação → Mensagens) | Só aparece quando pede atenção (`metaStatusNotice`, `message-meta.ts`): "Em análise no WhatsApp", "Recusado pelo WhatsApp: ajuste o texto" e "Pausado pelo WhatsApp: revise o texto", como texto curto na linha do prazo; recusado e pausado abrem a edição. Aprovado (o normal) não mostra nada. Na tela é "WhatsApp", não "Meta" (30/10/2026). |
| Mensagem de teste ("Testar envio real") | Ferramenta de desenvolvimento: só fora de produção e para quem gerencia a comunicação (`whatsappTestActions.ts`). Usa o número da plataforma. |

**Boas-vindas automáticas (01/11/2026, decisão do dono).** Ao cadastrar um aluno com WhatsApp válido, no modo oficial e com o modelo "Boas-vindas" ligado, a mensagem sai sozinha, sem o diálogo de confirmação (`client-form.tsx`, `useWhatsAppSend` com `reviewed: true`; `enabled(trigger)` do hook respeita o modelo desligado). No assistido continua o botão "Enviar boas-vindas" do aviso de cadastro, porque quem envia é a própria pessoa. Falhou (janela de 24 h fechada, número fora da lista de testes): o registro fica "Falhou" no Histórico, com reenvio, e o lembrete "aluno novo sem boas-vindas" segue no Painel.

**Botão "Enviar mensagem de teste" (01/11/2026).** Fora de produção, na aba Conexão. A opção de modelo usa um modelo aprovado da própria conta: `welcome_student` em pt_BR com dois parâmetros, ou `hello_world` quando a conta é a de sandbox da Meta (`whatsappTestActions.ts`). Antes mandava sempre `hello_world`, que numa conta real não existe (erro 132001). A conta ligada hoje ao `.env.local` é um número próprio verificado, não o número de testes da Meta.

**Envio oficial em segundo plano (01/11/2026).** A chamada à Meta leva segundos e as chamadas de uma aba ao servidor rodam uma por vez (doc 19 §3): com as boas-vindas automáticas, a lista de alunos esperava a Meta responder. Agora `sendMessage` grava o registro como "Na fila" (status `queued`, já no contrato), conta na franquia e responde na hora; a Meta é chamada num efeito depois da gravação e da resposta (`afterWorldCommit` + `after()` do Next em `runWorld.ts`), por `messageDelivery.ts`, que atualiza a linha direto no banco: id vira o da Meta (os avisos de entregue e lida chegam por ele) e status "Enviada", ou "Falhou" com o motivo. O aviso da tela diz "Mensagem para {nome} na fila de envio"; o Histórico lê do banco e mostra o status final. Fora do servidor (demonstração, testes) o caminho antigo continua.

### 1.1 Número de cada espaço (parte A feita em 17/11/2026)
A doc 13 §5 decidiu que as mensagens saem do número do próprio espaço. O cadastro guiado da Meta devolve o código de uso único, o id do número, o id da conta (WABA), o id da empresa e o tipo de cadastro (`FINISH` = número novo na API; `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` = coexistência com o app WhatsApp Business).

**Como ficou (parte A).**
- Tabela `whatsapp_credentials` (migração 103), só do servidor: ids do número, da conta e da empresa, tipo de cadastro (`cloud` ou `coexistence`), datas do registro e da inscrição e a referência aos segredos. **Token e PIN ficam no Vault do Supabase**; o navegador não lê a tabela nem as funções (`whatsapp_credentials_save` e `whatsapp_credentials_get`, só `service_role`). Apagar a linha (desconectar ou excluir o espaço) apaga os segredos do Vault por gatilho. O mesmo número em dois espaços é recusado.
- `services/communication/whatsappCredentials.ts` (servidor, registrado por `runWorld` e pela ação de teste): troca o código pelo token (`GET /oauth/access_token` com `META_APP_ID` ou `NEXT_PUBLIC_META_APP_ID` e `META_APP_SECRET`), confirma o número com o token novo, grava, **registra o número só no cadastro `cloud`** (`POST /{id}/register` com PIN aleatório de 6 dígitos; na coexistência o número já está no app e não se registra) e inscreve o app nos avisos da conta (`POST /{waba}/subscribed_apps`). Falha no registro ou na inscrição apaga as credenciais e a conexão não fica "Conectado". Ids que não são números da Meta são recusados antes de chamar a Graph API.
- `connectOfficial` só marca "Conectado" depois das credenciais gravadas. `disconnectOfficial` cancela a inscrição (`DELETE /{waba}/subscribed_apps`) e apaga token e PIN. O número não é desregistrado (sem o token, o app não age mais na conta).
- Toda chamada à Meta leva a configuração do espaço (`whatsappClient.configFor(organizationId)`): as credenciais do Vault (cache de 1 minuto por processo); sem elas, **o número do ambiente (`WHATSAPP_*`) só fora de produção** e no servidor do e2e (`platformNumberFallbackAllowed`). Em produção, espaço sem credencial não envia.
- `officialSendingAvailable()`: fora de produção, ou em produção com o cadastro guiado configurado (`NEXT_PUBLIC_META_APP_ID` e `NEXT_PUBLIC_META_CONFIG_ID`). Em produção, conectar sem o cadastro guiado é recusado.
- Testes: `whatsapp-credentials.test.ts` (troca, Vault, registro, coexistência, número em outro espaço, falha na inscrição, desconectar) e `communication.test.ts` (produção com cadastro guiado).

**Falta antes de liberar em produção (só na Meta, com o dono).**
- Forma de pagamento da conta (erro 141006), revisão do app como provedor de tecnologia (`whatsapp_business_messaging` e `whatsapp_business_management`), `META_APP_SECRET`, `NEXT_PUBLIC_META_APP_ID` e `NEXT_PUBLIC_META_CONFIG_ID` no ambiente de produção, e o webhook do app apontando para `/api/webhooks/whatsapp` com os campos `messages` e `message_template_status_update`.
- Teste de ponta a ponta com `pnpm dev:https`: conectar um número, ver os modelos "Em análise" e depois aprovados, mandar um lembrete e ver "Entregue" e "Lida" no Histórico.

- **Reconectar (18/11/2026):** desconectar apaga o token e o PIN. Ao conectar de novo um número que já está ativo na API (`platform_type` CLOUD_API e `status` CONNECTED), o registro com PIN é pulado: um PIN novo seria recusado pela Meta (133005). Se o registro ainda assim voltar 133005, a conexão segue sem apagar as credenciais.

### 1.3 Envio por modelo aprovado (parte B feita em 17/11/2026)
Mensagem que o espaço inicia só sai fora da janela de 24 horas por **modelo aprovado** da Meta.
- Um modelo por gatilho, com o nome igual ao gatilho (`TRIGGER_TO_META_TEMPLATE`, `lib/whatsapp/types.ts`); antes os 4 lembretes de cobrança apontavam para o mesmo `billing_reminder`. A mensagem avulsa (`manual_broadcast`) não tem modelo.
- `officialTemplateFor` (`communicationRules.ts`): usa o modelo só quando o texto enviado é o do modelo do espaço com aqueles valores (texto editado no diálogo sai como texto livre) e toda variável tem valor; as variáveis vão na ordem em que aparecem no texto (`metaTemplateParams`, a mesma ordem de `convertGestaraVariablesToMetaPositional`), sem quebra de linha. A tela manda os valores junto (`SendMessagePayload.variables`); o servidor confere.
- O registro guarda o modelo usado (`MessageLog.metaTemplate`, coluna `message_logs.meta_template`, migração 104). A fila entrega o modelo (ou o texto) pelo número do espaço, e o "Reenviar" passa pela mesma fila repetindo o mesmo modelo.
- **Rotinas automáticas de verdade:** lembretes de cobrança e parabéns só gravavam "Entregue" sem chamar a Meta. Agora passam por `dispatchOfficial`, como o envio manual: no servidor nascem "Na fila" e a Meta é chamada depois da gravação; na demonstração seguem "Entregue". Sem modelo possível, saem como texto livre e o Histórico mostra a falha com o motivo.
- Falha da Meta vira motivo em português no Histórico (`metaErrorReason`): fora da janela de 24 horas (131047), modelo inexistente ou não aprovado (132001), pausado (132015), desativado (132016), variáveis que não batem (132000), número sem WhatsApp (131026), qualidade (131049), aluno que parou de receber (131050), conexão expirada (190).
- Testes: `communication.test.ts` (escolha do modelo, fila com modelo, reenvio, lembrete automático na fila) e `message-delivery.test.ts` (modelo e texto pelo número do espaço, motivo em português, espaço sem conexão).

### 1.4 Modelos e avisos por espaço (parte C feita em 17/11/2026)
- **Modelos na conta do espaço** (`metaTemplatesSync.ts`): um por gatilho, criados ao conectar o número, editados quando o texto muda (`updateTemplate`) e pelo "Sincronizar" (`syncMetaTemplates`). Lê a lista da conta uma vez; cria o que falta (`POST /{waba}/message_templates`), edita o que mudou (`POST /{id-do-modelo}`; aprovado aceita 1 edição por dia e 10 por mês) e só atualiza a situação do que já está igual. Falha num modelo grava o motivo nele (`metaRejectionReason`) e não para os outros nem a conexão. Um exemplo por variável vai para a análise da Meta.
- **Texto do modelo sem frase opcional** (`metaBodyFor`): na Meta toda variável é obrigatória, então a frase de uma variável que o espaço nunca preenche fica fora do modelo: `{link_app}` (ainda não existe; as boas-vindas padrão traziam) e `{link_pagamento}` sem pagamento online. A regra de corte é a de `fillMessage`, então o texto que a tela monta bate com o modelo.
- **O que a Meta tem fica guardado no modelo** (migração 105): `meta_template_name`, `meta_template_id`, `meta_body` (o texto enviado a ela), `meta_status` (aprovado, em análise, recusado, pausado, desativado) e `meta_rejection_reason`. O envio usa `meta_body`, então um texto editado e ainda em análise não quebra o envio do aprovado. Modelo recusado ou desativado não é usado (sai como texto livre).
- **Avisos por espaço** (`whatsappWebhook.ts`): status de entrega e respostas acham o espaço pelo `phone_number_id` (credenciais do número); "SAIR" revoga só nesse espaço. A situação do modelo (`message_template_status_update`) acha os espaços pelo `waba_id` e grava no banco; antes o laço pulava esse aviso e, mesmo quando chegava, só mudava a memória do servidor (que fora de um espaço carregado nem existe). O gatilho do banco sobe a versão do espaço, então a próxima leitura já vê.
- Aviso na tela para modelo desativado ("Desativado pelo WhatsApp: revise o texto"), além de em análise, recusado e pausado.
- **Pendente:** ligar ou desligar o pagamento online muda o texto dos lembretes na Meta (com ou sem a frase do link); até um "Sincronizar", os lembretes saem como texto livre. Sincronizar sozinho nessa troca fica para depois (`docs/pendencias.md`).
- Testes: `communication.test.ts` (texto sem frase opcional, criar, editar e só atualizar, falha num modelo, recusado fora do envio) e `whatsappWebhook.db.test.ts` (situação do modelo só na conta certa, entrega pelo número, "SAIR" só no espaço do número).

### 1.2 Sem franquia de mensagens (17/11/2026)
Até 17/11/2026 havia uma franquia por ciclo (Grátis 0, Pro 300, Expansão 1.000), renovada no pagamento do plano e, no anual, todo mês. Saiu: como Provedor de Tecnologia (Tech Provider), o GestaraHub não paga as mensagens (§1.5), então a franquia só limitava o espaço por um custo que é dele. Saíram o limite no envio e nas rotinas automáticas, a renovação no pagamento do plano e na rotina diária (`whatsappQuota.ts`, `annualQuotaCycleStart`), o aviso de franquia no sino e a barra "Franquia do ciclo". O cartão "Enviadas no mês" mostra só a contagem. A coluna `whatsapp_connections.monthly_quota` continua (obrigatória, sem uso; `monthlyQuota` marcado como `@deprecated` no contrato).

### 1.5 Quem paga as mensagens: o espaço, direto à Meta (17/11/2026)
- Cada espaço conecta o próprio número e fica com a **própria conta do WhatsApp (WABA) na Meta**. A Meta cobra cada mensagem iniciada pelo espaço (modelos de marketing, utilidade e autenticação) **da forma de pagamento dessa conta**. Provedor de Tecnologia não tem linha de crédito: não dá para o GestaraHub pagar pelo cliente.
- Sem forma de pagamento na conta, a Meta bloqueia as mensagens iniciadas pelo espaço (`health_status` com o erro 141006; no envio, código 131042). O envio aceita e a falha chega depois pelo webhook, com o motivo em português (`metaReasonForCode` em `whatsappClient.ts`, usado no envio e no webhook).
- As **1.000 mensagens grátis por número por mês** da Meta valem só para mensagens de serviço (respostas a quem escreveu nas últimas 24 horas), não para os avisos automáticos.
- Na tela: a aba Conexão, com o número conectado, mostra "Pagamento das mensagens na Meta" com o link para o faturamento da Meta (Billing Hub); a confirmação do envio em lote lembra que a Meta cobra cada mensagem.
- Teste de 17/11/2026: o cadastro guiado criou uma conta nova ("GestaraHub", 2228262711449794), sem pagamento, em vez de usar a que já tinha cartão; o envio ficou bloqueado até cadastrar o pagamento nela.
- **Para o espaço não precisar de cartão:** só com um parceiro oficial da Meta (Solution Partner) que compartilhe a linha de crédito (soluções com vários parceiros), ou virando parceiro. Aí o GestaraHub paga a Meta e embute no plano, e uma franquia volta a fazer sentido. Decisão de negócio em aberto (`pendencias.md`).

### 1.6 Situação na Meta dentro do GestaraHub (17/11/2026)
- O GestaraHub consulta, com o token do próprio espaço, `GET /{phone_number_id}?fields=status,name_status,quality_rating,messaging_limit_tier,health_status` e guarda o resultado em `whatsapp_connections.meta_health` (migração 107; `WhatsAppConnection.metaHealth`, tipo `WhatsAppMetaHealth`).
- Tradução em `lib/whatsapp/meta-health.ts` (`parseMetaHealth`, pura e testada): envio liberado, limitado ou bloqueado (`health_status.can_send_message`); bloqueio por pagamento (erros 141006 ou 131042, ou descrição com "payment"); nome exibido (aprovado, em análise, recusado); qualidade; limite diário (`TIER_250` = 250 conversas por dia, `TIER_UNLIMITED` = sem limite). Os erros de chamadas por SIP (138024, 138025) ficam de fora: não usamos chamadas.
- **Quando atualiza:** logo depois de conectar (efeito depois da gravação), de hora em hora pela rotina `cron/online-payments` (`refreshAllMetaHealth`, só os espaços conectados, grava direto na conexão) e no botão "Atualizar" da Conexão (`communicationService.refreshMetaHealth`, permissão de gerenciar a comunicação). Desconectar apaga a situação.
- **Na tela:** a aba Conexão mostra "Situação na Meta" (resumo, mensagens automáticas, pagamento, nome, qualidade, limite e a hora da consulta). A faixa do topo da Comunicação fica vermelha quando a Meta bloqueia. No sino, sem pagamento vira aviso urgente, fixo no topo até resolver, com modal uma vez (dono e gerente); bloqueio por outro motivo vira aviso de atenção (`metaHealthBellAlert`).
- **Limite:** a Meta não deixa um Provedor de Tecnologia ler a forma de pagamento da conta (`primary_funding_id` pede parceiro oficial). Dá para saber se está bloqueado por pagamento, não se há cartão cadastrado nem distinguir "sem cartão" de "cartão recusado".

### 1.7 Modelos mestres: biblioteca da Meta na cobrança, texto próprio no resto (18/11/2026)
- **Por quê:** cada espaço tinha até 4 textos por aviso (área de lutas ou não, com ou sem a frase do link) e cada conta da Meta analisava os seus. Em 17/11/2026 a Meta mudou "Vence hoje" e "Lembrete de cobrança" de utilidade para marketing por causa de "Obrigado!" e "Bons treinos! 🥋".
- **Como ficou:** um texto mestre por aviso, igual em todas as áreas e em todos os espaços (`lib/whatsapp/master-templates.ts`). O espaço não edita o texto do aviso (`updateTemplate` recusa texto diferente); `ensureTemplates` troca o texto salvo pelo mestre e limpa o modelo antigo da Meta, então não houve migração. A área não muda mais o texto (saiu a troca em `settingsService`).
- **Cobrança pela biblioteca da Meta** (utilidade, aprovada na hora, texto fixo da Meta em pt_BR): `payment_reminder_3` em "Mensalidade a vencer", "Vence hoje" e "Lembrete de cobrança" (Conta, Valor a pagar, Data de vencimento, "pendências"); `payment_overdue_2` em "Em atraso" e "Atraso de 10 dias" (aluno, Conta, Valor devido, Data prevista). A Meta confere o tipo de cada variável no envio (valor e data), então valor e data vão sozinhos; "Conta" leva "Mensalidade na {empresa}" ou "{referencia} na {empresa}". Criação: `POST /{waba}/message_templates` com `library_template_name` e `library_template_button_inputs` (botão de link com base `https://<site>/p/{{1}}`).
- **Botão "Pagar agora":** leva à página de pagamento do aluno (`/p/<código>` ou `/p/c/<cobrança>`); no envio vai o final do endereço (`buttonUrlSuffix` em `MetaTemplateSend`, componente `button` `url`). Sem recebimentos online, a página da cobrança avisa para combinar com o espaço. Endereço local (localhost) não vale para a Meta: a base fica a do site. No envio assistido não há botão: o texto ganha "Pague pelo link: {link_pagamento}" (sai sem link).
- **Texto próprio** nos outros 11: pagamento recebido, evento amanhã, aula cancelada, mudança de horário e feriado (utilidade, só informam); boas-vindas, aniversário, sentimos sua falta, pacote acabando, avanço e chamar de volta (marketing assumido). A biblioteca não tem modelos de relacionamento, e os de evento e aula cancelada pediam botão com página.
- **Nomes na Meta:** `<aviso>_v2`. A sincronização (`metaTemplatesSync.ts`) cria o que falta, traz a situação e apaga os nomes antigos sem versão. Roda ao conectar e no botão "Atualizar" da Situação na Meta (Conexão). A Meta bloqueia por 30 dias o nome de um modelo apagado; por isso mudar um texto mestre pede versão nova.
- Testes: `master-templates.test.ts` e `communication.test.ts` (envio com botão, biblioteca na sincronização, texto mestre em toda área).

Contrato pronto para a integração (`packages/contracts/src/communication.ts`): `WhatsAppConnection` (`officialStatus` com `pending`, número, nome exibido, `allowedSendHours`, `monthlyQuota`), `MessageTemplate`, `MessageLog` (status, `clientId`, `chargeId`, `errorReason`).

## 2. Decisão a tomar primeiro: como conectar com a Meta

| | Por um parceiro oficial da Meta (BSP) | Direto, como provedor de tecnologia |
|---|---|---|
| Exemplos | Twilio, 360dialog, Gupshup, Zenvia, Blip | — |
| Tempo até funcionar | Menor: o parceiro oferece a conexão guiada, a hospedagem e a cobrança da Meta | Maior: app próprio na Meta, revisão do app, verificação da empresa |
| Custo por mensagem | Preço da Meta + margem do parceiro | Só o preço da Meta |
| Dependência | Do parceiro (API e contrato dele) | Só da Meta |

**Recomendação (14/10/2026):** começar por um parceiro e migrar para direto quando o volume justificar. Antes de escolher, confirmar com o parceiro: suporte a **coexistência no Brasil** (o espaço continua usando o app do WhatsApp Business no mesmo número), conexão guiada (Embedded Signup) para vários clientes, cobrança em reais e preço por mensagem.

**Decisão (17/11/2026): direto, como provedor de tecnologia, com o cadastro incorporado como caminho único.** O espaço clica em "Conectar WhatsApp oficial", entra na janela da Meta com uma conta do Facebook (exigência da Meta: toda conta do WhatsApp Business pertence a uma empresa na Meta, administrada por alguém com Facebook) e o número fica ligado à conta do próprio espaço. Alternativas avaliadas e descartadas:
- **Conexão manual** (o espaço cria a conta no Gerenciador de Negócios e cola token e ids): mais passos, com o mesmo Facebook, e token passando pela mão de quem usa. Fica como plano B só se aparecerem espaços travados na janela da Meta.
- **Parceiro (BSP):** quase todos usam o mesmo cadastro incorporado por baixo; não tira o login e acrescenta custo por mensagem e dependência.
- **Números na conta do GestaraHub:** vai contra a doc 13 §5 (qualidade e bloqueio compartilhados entre espaços; o espaço perde o controle do número).
- **Sessão por QR code:** fora dos termos do WhatsApp (descartada em 13/10/2026).

Quem não quiser entrar com o Facebook continua no **envio assistido**, que não precisa conectar nada. A tela de conexão e a ajuda precisam avisar antes do clique que o login é pelo Facebook (`docs/pendencias.md`).

## 3. Checklist

### 3.1 Pré-requisitos do GestaraHub
- [ ] Conta empresarial do GestaraHub na Meta, com a empresa **verificada**.
- [ ] Parceiro escolhido (ou app próprio aprovado, se direto).
- [ ] Um número de teste para desenvolvimento.
- [ ] Forma de pagamento da Meta (ou do parceiro) e alerta de gasto.

### 3.2 Conexão de cada espaço
- [ ] Botão "Conectar WhatsApp oficial" abre a **conexão guiada da Meta**: a pessoa entra com a conta da Meta da academia e escolhe o número.
- [ ] O backend recebe e guarda, **criptografado**, os identificadores da conta e do número e o acesso (token). Nunca expor ao navegador.
- [ ] `officialStatus`: `pending` enquanto a Meta aprova o nome exibido; `connected` quando liberado.
- [ ] Confirmar a **coexistência** com o app do WhatsApp Business no Brasil (a confirmar na Meta; fontes de terceiros listam o Brasil).
- [ ] Desconectar: revogar o acesso e voltar ao envio assistido.

### 3.3 Modelos de mensagem (maior impacto no produto)
Mensagem que o espaço inicia (lembrete, parabéns, boas-vindas, falta) só sai com **texto aprovado pela Meta**.
- [ ] Para cada tipo (`billing_before_due`, `billing_due_date`, `billing_after_due`, `billing_critical`, `charge_reminder`, `welcome_student`, `minor_consent`, `absence_alert`, `package_ending`, `birthday_greeting`), criar o modelo na conta do espaço em **pt_BR**, convertendo as variáveis (`{aluno}` → `{{1}}`...).
- [ ] Modelo de autorização de menor / LGPD (`minor_consent`, categoria UTILITY): variáveis `{responsavel}`, `{aluno}`, `{link_termo}`. Permite o disparo 100% automático pela API oficial para o responsável legal no Plano Pro.
- [ ] Modelos da fase D do doc 20 (14/10/2026): `charge_reminder` ("Lembrete de cobrança": avulsa, parcela de curso e compra de pacote; variáveis `{aluno}`, `{referencia}`, `{valor}`, `{empresa}`, `{vencimento}`, `{link_pagamento}`; categoria provável "utilidade") e `package_ending` ("Pacote acabando": `{aluno}`, `{pacote}`, `{empresa}`, `{restante}`; tende a "marketing", porque convida a comprar de novo). `{referencia}` e `{restante}` são frases montadas pelo sistema ("parcela 2 de 4 do curso Confeitaria", "vence em 3 dias e resta 1 aula"); no oficial, conferir se a Meta aceita variável com frase ou se o modelo precisa de variáveis menores.
- [ ] Modelos só de envio manual (17/10/2026): `payment_received` (`{aluno}`, `{valor}`, `{referencia}`), `level_up` (`{aluno}`, `{empresa}`, `{nivel}`), `class_canceled`, `schedule_change` e `holiday_notice` (`{aluno}`, `{empresa}`). Não têm envio automático, mas no oficial a mensagem iniciada pelo espaço fora da janela de 24 horas também precisa de modelo aprovado. "Mudança de horário" termina em "Novo horário:" para a pessoa completar: no oficial, virar variável (`{horario}`).
- [x] **Modelos blindados sem edição livre (decisão de 05/11/2026):** o texto dos modelos oficiais é padronizado e mantido pela plataforma. O usuário não edita o corpo do texto na interface, evitando desclassificação de categoria na Meta (`UTILITY` virando `MARKETING`), quebra de variáveis essenciais (`{link_pagamento}`) e risco de suspensão do número por mensagens abusivas. O painel permite ligar/desligar a automação, ajustar horário e visualizar a prévia realista.
- [ ] Contrato: `MessageTemplate` ganha o estado na Meta e o motivo de recusa.
- [ ] A **categoria** é definida pela Meta e muda o preço: lembrete de cobrança tende a ser "utilidade" (barata); parabéns e "Sentimos sua falta" tendem a ser "marketing" (mais cara).
- [ ] Frase com variável sem valor: no assistido a frase sai (`fillMessage`); no oficial a variável é obrigatória, então o modelo aprovado não pode depender de dado que às vezes falta (ex.: link de pagamento).

### 3.4 Envio
- [ ] Envio pela API (parceiro ou Meta), guardando o identificador externo da mensagem no `MessageLog`.
- [ ] Respeitar `allowedSendHours` (a franquia mensal saiu em 17/11/2026, §1.2).
- [ ] Resposta livre ao aluno só dentro de **24 horas** depois da última mensagem dele; fora disso, só modelo aprovado.
- [ ] Tarefas agendadas (Supabase Cron, ver [08](08-backend-supabase.md)): lembretes de cobrança (antes, no dia, depois e crítico da mensalidade; o `charge_reminder` das outras cobranças, 3 dias antes por padrão), pacote acabando (última aula e 7 dias antes de vencer) e parabéns, sem duplicar.

### 3.5 Avisos da Meta (webhooks)
- **Assinatura (30/10/2026, auditoria):** o POST só vale com `X-Hub-Signature-256` certa (HMAC-SHA256 do corpo com `META_APP_SECRET`, comparação em tempo constante, `lib/security/webhook-signature.ts`). Sem o segredo, produção recusa (503) e o desenvolvimento aceita. Antes, qualquer um mudava a situação das mensagens de qualquer espaço.
- [x] **Rota no backend para receber:** `/api/webhooks/whatsapp` trata o desafio `GET` (`hub.challenge`) e o recebimento `POST` de status (**enviada, entregue, lida, falhou**) e mensagens recebidas.
- [x] **Conferir a assinatura do aviso:** validação criptográfica via `META_APP_SECRET` e comparação `timingSafeEqual`.
- [x] **Atualizar o status do `MessageLog`:** `processWhatsAppStatusUpdate` atualiza status, data de leitura (`read_at`) e motivo da falha (`error_reason`) no banco, só no espaço dono do número (seção 1.4).
- [ ] **Resposta do aluno:** registrar e avisar o espaço quando o aluno responder (hoje o webhook contabiliza `messagesReceived`; a conversa continua no app do WhatsApp).

### 3.5.1 Passo a passo no console da Meta para produção (atualizado em 17/11/2026)

Cada espaço conecta o **próprio número** pelo cadastro guiado (Embedded Signup); o GestaraHub é o **provedor de tecnologia** (Tech Provider) e não tem número próprio em produção (seção 1.1). Os nomes dos menus mudam com frequência no console: quando um caminho não bater, procure pelo nome do item. Faça na ordem: os passos 1 e 4 levam dias na Meta e não dependem de mais nada.

#### Passo 1. Verificar a empresa (Meta Business Suite, alguns dias)
1. Em [business.facebook.com](https://business.facebook.com), abra as **Configurações do negócio** da empresa dona do app (MHMJ).
2. Em **Central de segurança** (Security Center), clique em **Iniciar verificação** e envie os documentos da empresa (CNPJ, comprovante de endereço, domínio ou telefone da empresa).
3. Confira que o domínio de produção está em **Segurança da marca → Domínios** e verificado (registro DNS ou arquivo). Sem empresa verificada, a revisão do app não passa.

#### Passo 2. Conta de pagamento da Meta (resolve o erro 141006)
1. No **WhatsApp Manager** da conta de testes do GestaraHub, abra **Configurações de pagamento** e cadastre um cartão válido.
2. Confira a saúde da conta (Account health): sem bloqueio de pagamento.
3. **Importante para os espaços:** com o cadastro guiado de provedor de tecnologia, a conta do WhatsApp (WABA) é **do espaço**, e quem paga as mensagens à Meta é o espaço, com a forma de pagamento dele no WhatsApp Manager dele. Sem ela, a Meta aceita e não entrega (o mesmo 141006). Isso precisa ir para a ajuda de "Conectar WhatsApp oficial" e para a decisão de preço do Pro (doc 13 §5, `docs/pendencias.md`).

#### Passo 3. Configurações básicas do app (Meta for Developers)
Em [developers.facebook.com](https://developers.facebook.com) → **Meus apps** → app do GestaraHub → **Configurações do app → Básico**:
1. **Domínios do app:** o domínio de produção.
2. **URL da Política de Privacidade:** `https://<domínio>/privacy`.
3. **URL dos Termos de Serviço:** `https://<domínio>/terms`.
4. **Exclusão de dados do usuário:** URL de instruções de exclusão. Essa página ainda não existe (linha Jurídico de `docs/pendencias.md`); criar antes de pedir a revisão.
5. **Ícone** (1024×1024), **categoria** (Negócios) e **e-mail de contato**.
6. Anote o **ID do app** (vai em `NEXT_PUBLIC_META_APP_ID`) e, em **Chave secreta do app → Mostrar**, a chave (vai em `META_APP_SECRET`, nunca no código nem no navegador).

#### Passo 4. Tornar-se provedor de tecnologia e pedir a revisão do app (alguns dias)
1. No painel do app, em **WhatsApp → Início rápido** (ou **Configuração da API**), siga o fluxo **Tornar-se provedor de tecnologia** (Tech Provider). Ele pede a empresa verificada (passo 1) e a revisão do app.
2. Em **Revisão do app → Permissões e recursos**, peça **acesso avançado** para:
   - `whatsapp_business_messaging` (enviar e receber mensagens);
   - `whatsapp_business_management` (conta, números e modelos).
3. Em cada pedido, descreva o uso e grave um **vídeo** do fluxo: Comunicação → Conexão → "Conectar WhatsApp oficial" → janela da Meta → número conectado → modelos em análise → envio de um lembrete com o status no Histórico. Use `pnpm dev:https` ou o ambiente de staging com a conta de testes.
4. Responda o **Uso de dados** (Data Use Checkup) quando a Meta pedir.

#### Passo 5. Configurar o cadastro guiado (Embedded Signup)
1. No painel do app, adicione o produto **Login do Facebook para Empresas** (Facebook Login for Business), se ainda não estiver.
2. Em **Login do Facebook para Empresas → Configurações**:
   - **Login com o SDK do JavaScript:** Sim.
   - **Domínios permitidos para o SDK do JavaScript:** `https://<domínio>` (e o de staging, se houver).
   - **URIs de redirecionamento do OAuth válidos:** `https://<domínio>/` (o código usa o popup do SDK; a Meta pede o domínio cadastrado).
3. Em **Login do Facebook para Empresas → Configurações (Configurations) → Criar configuração**:
   - Variação de login: **Cadastro incorporado do WhatsApp** (WhatsApp Embedded Signup).
   - Tipo de token: **Token de acesso de usuário do sistema** (System-user access token), **sem expiração** (Never).
   - Ativos: **Contas do WhatsApp** (WhatsApp accounts).
   - Permissões: `whatsapp_business_management` e `whatsapp_business_messaging`.
4. Salve e anote o **ID da configuração** (vai em `NEXT_PUBLIC_META_CONFIG_ID`).
5. **Coexistência:** o código abre o cadastro com `featureType: "whatsapp_business_app_onboarding"` (o espaço continua no app WhatsApp Business no mesmo número). Confira no painel do WhatsApp do app que a coexistência está disponível para a conta; se não estiver, o cadastro cai no fluxo de número novo (`FINISH`), que o código também trata (registra o número com PIN).

#### Passo 6. Webhook do app
1. Antes, publique o app na Vercel com `WHATSAPP_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET` (passo 8): a Meta chama a URL na hora de salvar.
2. No painel do app, em **WhatsApp → Configuração → Webhook → Editar**:
   - **URL de retorno:** `https://<domínio>/api/webhooks/whatsapp`.
   - **Token de verificação:** o mesmo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (texto aleatório longo, criado por nós).
   - **Verificar e salvar** (o app responde ao `hub.challenge`).
3. Em **Campos do webhook → Gerenciar**, assine:
   - **`messages`**: entrega, leitura, falha e respostas ("SAIR").
   - **`message_template_status_update`**: modelo aprovado, recusado, pausado ou desativado.
4. Não precisa inscrever conta por conta: ao conectar, o código inscreve o app na conta de cada espaço (`POST /{waba}/subscribed_apps`), e os avisos chegam a esta URL.

#### Passo 7. Publicar o app (modo ativo)
Com a revisão aprovada (passo 4) e os passos 3, 5 e 6 feitos, troque o app de **Em desenvolvimento** para **Ativo** (Live) no topo do painel. Em desenvolvimento, só quem tem função no app consegue conectar.

#### Passo 8. Variáveis na Vercel (produção) e banco
| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_META_APP_ID` | Passo 3, ID do app |
| `NEXT_PUBLIC_META_CONFIG_ID` | Passo 5, ID da configuração |
| `META_APP_SECRET` | Passo 3, chave secreta do app |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Texto aleatório nosso (passo 6) |
| `WHATSAPP_API_URL` | `https://graph.facebook.com/v21.0` |

- **Não** configurar `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` nem `WHATSAPP_BUSINESS_ACCOUNT_ID` em produção: são do número de testes e em produção não são usadas.
- Com `NEXT_PUBLIC_META_APP_ID` e `NEXT_PUBLIC_META_CONFIG_ID`, o envio automático liga em produção (`officialSendingAvailable`). As duas `NEXT_PUBLIC_` entram no build: depois de cadastrar, publique de novo.
- Banco: `supabase db push --workdir apps` aplica as migrações 103 a 105 (credenciais no Vault e modelos da Meta).

#### Passo 9. Teste de ponta a ponta
1. Num espaço Pro seu, Comunicação → Conexão → **Conectar WhatsApp oficial**, com um número real.
2. Os modelos aparecem "Em análise no WhatsApp" e somem quando aprovados (minutos a horas).
3. Cadastre um aluno com WhatsApp e autorização: as boas-vindas vão "Na fila", depois "Enviada", "Entregue" e "Lida" no Histórico.
4. Responda **SAIR** do celular do aluno: a autorização dele vira "pediu para parar" e a Auditoria registra.
5. Desconecte e confira que a conexão some e os envios voltam ao assistido.

### 3.6 Consentimento e LGPD
- [ ] Campo de consentimento no cadastro do aluno ("Aceita receber mensagens pelo WhatsApp"), exigido pela Meta e pela LGPD. Sem consentimento, o envio automático não sai (o assistido continua, porque é a própria pessoa que envia).
- [ ] Pedido de saída ("parar de receber") marca o aluno sem consentimento.

### 3.7 Limites e qualidade
- [ ] Número novo tem **limite diário de conversas iniciadas** que sobe com o uso e a qualidade.
- [ ] Acompanhar a **qualidade do número** (denúncias e bloqueios); avisar o espaço quando cair.
- [ ] Mostrar falhas claras no Histórico ("Número inválido", "Aluno sem WhatsApp", "Limite do dia atingido").

## 4. Mudanças previstas no contrato e na tela

- `MessageTemplate`: estado na Meta (`draft | in_review | approved | rejected`), motivo da recusa, categoria definida pela Meta.
- `MessageLog`: identificador externo da mensagem; status passam a vir dos avisos da Meta.
- `Client`: consentimento de WhatsApp (data e origem).
- Tela Mensagens (no oficial): estado de aprovação em cada modelo; "Editar texto" envia para aprovação.

## 5. Fontes

- [Meta: preços da WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing)
- [Meta: cadastro guiado (Embedded Signup) e coexistência](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-3-public-preview/)
- [Chakra: coexistência explicada (2026)](https://chakrahq.com/article/whatsapp-business-app-api-coexistence-2026/)
- [Fórum Kirby: emoji quebrado com `wa.me`](https://forum.getkirby.com/t/whatsapp-link-in-kirby/20174) (motivo do uso de `api.whatsapp.com/send`)
