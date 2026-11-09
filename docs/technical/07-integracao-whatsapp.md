# 07 — Integração real do WhatsApp (API oficial da Meta)

Data: 2026-10-14.

> **Status (30/10/2026):** a API oficial da Meta já está ligada no código (cliente, webhook, rotina de lembretes de cobrança, situação dos modelos e o cadastro guiado da Meta na tela), mas **sempre com as credenciais do ambiente: o número único da plataforma**. As credenciais de cada espaço (token, id do número e da conta) ainda não são guardadas nem usadas (seção 1.1). O app da Meta está em modo de desenvolvimento; a revisão do app e a virada para produção ficam para o deploy (`docs/pendencias.md`).
> Decisão de produto (número do próprio espaço; assistido no grátis, oficial no Pro): [../product/13-modelo-de-negocio.md](../product/13-modelo-de-negocio.md), seção 5. Custos e repasse: [../product/19-levantamento-pagamentos.md](../product/19-levantamento-pagamentos.md), seção 3.

## 1. O que existe hoje

| Parte | Situação |
|---|---|
| Envio assistido (`api.whatsapp.com/send` com o texto pronto) | **Real.** Abre o WhatsApp do aparelho; registra "Aberto no WhatsApp". |
| Botão "Conectar WhatsApp oficial" | Abre o cadastro guiado da Meta (`use-meta-embedded-signup.ts`, SDK v21, `pt_BR`). Com o id do número devolvido, consulta o número e o nome verificados na Meta (`getWhatsAppPhoneNumberDetails`). Sem número confirmado (pela Meta ou no cadastro do espaço), não conecta: nunca grava o id da Meta nem um número inventado como telefone. Unidade sem telefone recebe o número confirmado pela Meta. |
| Envio pelo oficial, status "Entregue/Lida/Falhou" | Real pela Cloud API, **com o número da plataforma** (variáveis `WHATSAPP_*` do ambiente). Status pelo webhook da Meta (`/api/webhooks/whatsapp`). |
| Parabéns automático e lembretes de cobrança | Rotinas automáticas (só no Pro, só no oficial, até a franquia). O lembrete leva o link do pagamento online; sem ele, o da fatura pública (`/p/c/<cobrança>`, doc 25 §7). |
| Situação dos modelos na Meta (Comunicação → Mensagens) | Só aparece quando pede atenção (`metaStatusNotice`, `message-meta.ts`): "Em análise no WhatsApp", "Recusado pelo WhatsApp: ajuste o texto" e "Pausado pelo WhatsApp: revise o texto", como texto curto na linha do prazo; recusado e pausado abrem a edição. Aprovado (o normal) não mostra nada. Na tela é "WhatsApp", não "Meta" (30/10/2026). |
| Mensagem de teste ("Testar envio real") | Ferramenta de desenvolvimento: só fora de produção e para quem gerencia a comunicação (`whatsappTestActions.ts`). Usa o número da plataforma. |

**Boas-vindas automáticas (01/11/2026, decisão do dono).** Ao cadastrar um aluno com WhatsApp válido, no modo oficial e com o modelo "Boas-vindas" ligado, a mensagem sai sozinha, sem o diálogo de confirmação (`client-form.tsx`, `useWhatsAppSend` com `reviewed: true`; `enabled(trigger)` do hook respeita o modelo desligado). No assistido continua o botão "Enviar boas-vindas" do aviso de cadastro, porque quem envia é a própria pessoa. Falhou (janela de 24 h fechada, número fora da lista de testes): o registro fica "Falhou" no Histórico, com reenvio, e o lembrete "aluno novo sem boas-vindas" segue no Painel.

**Botão "Enviar mensagem de teste" (01/11/2026).** Fora de produção, na aba Conexão. A opção de modelo usa um modelo aprovado da própria conta: `welcome_student` em pt_BR com dois parâmetros, ou `hello_world` quando a conta é a de sandbox da Meta (`whatsappTestActions.ts`). Antes mandava sempre `hello_world`, que numa conta real não existe (erro 132001). A conta ligada hoje ao `.env.local` é um número próprio verificado, não o número de testes da Meta.

**Envio oficial em segundo plano (01/11/2026).** A chamada à Meta leva segundos e as chamadas de uma aba ao servidor rodam uma por vez (doc 19 §3): com as boas-vindas automáticas, a lista de alunos esperava a Meta responder. Agora `sendMessage` grava o registro como "Na fila" (status `queued`, já no contrato), conta na franquia e responde na hora; a Meta é chamada num efeito depois da gravação e da resposta (`afterWorldCommit` + `after()` do Next em `runWorld.ts`), por `messageDelivery.ts`, que atualiza a linha direto no banco: id vira o da Meta (os avisos de entregue e lida chegam por ele) e status "Enviada", ou "Falhou" com o motivo. O aviso da tela diz "Mensagem para {nome} na fila de envio"; o Histórico lê do banco e mostra o status final. Fora do servidor (demonstração, testes) o caminho antigo continua.

### 1.1 O que falta para cada espaço usar o próprio número (antes de produção)
A doc 13 §5 decidiu que as mensagens saem do número do próprio espaço. Hoje o código do cadastro guiado, o id do número e o id da conta que a Meta devolve não são guardados. Falta:
1. trocar, no servidor, o código do cadastro guiado pelo token do espaço (com o segredo do app da Meta);
2. guardar por espaço o id do número, o id da conta e o token, o token num lugar seguro (Vault do Supabase), nunca no `settings`;
3. registrar o número e inscrever o app nos avisos da conta do espaço;
4. enviar, ler modelos e tratar avisos com as credenciais do espaço, não as do ambiente.
**Decisão do usuário (30/10/2026): bloqueado em produção até isso existir.** `officialSendingAvailable()` (`communicationRules.ts`) é falso em produção: o oficial não conecta (aviso "Envio automático: em breve" na aba Conexão), um espaço já conectado volta ao assistido e as rotinas não enviam. Fora de produção (e no servidor do e2e) segue com o número de testes da Meta, que só alcança os números cadastrados como teste.

### 1.2 Franquia de mensagens automáticas
Grátis 0, Pro 300 e Expansão 1.000 por ciclo (`TIER_WHATSAPP_QUOTA`, doc 13 §5). Ao esgotar, o automático para e o botão volta ao envio assistido. A franquia zera quando o pagamento do plano é confirmado (`resetWhatsAppQuota`, `services/server/whatsappQuota.ts`): ativação, renovação, religar e troca aplicada. **Plano anual (decisão do usuário, 30/10/2026): renova todo mês, no dia do ciclo**, pela rotina diária (`renewAnnualQuotaIfDue`), contando mês a mês desde o início do ano pago (`annualQuotaCycleStart` em `@gestarahub/core/subscription-plan`, sem deriva de fim de mês). A franquia guarda o início do ciclo (`monthlyQuota.cycleStart`). Com a renovação anual vencida (tolerância), não renova. Com 20% ou menos da franquia, e quando ela acaba, dono e gerente veem o aviso no sino (doc 25, "Avisos do espaço no sino").

Contrato pronto para a integração (`packages/contracts/src/communication.ts`): `WhatsAppConnection` (`officialStatus` com `pending`, número, nome exibido, `allowedSendHours`, `monthlyQuota`), `MessageTemplate`, `MessageLog` (status, `clientId`, `chargeId`, `errorReason`).

## 2. Decisão a tomar primeiro: como conectar com a Meta

| | Por um parceiro oficial da Meta (BSP) | Direto, como provedor de tecnologia |
|---|---|---|
| Exemplos | Twilio, 360dialog, Gupshup, Zenvia, Blip | — |
| Tempo até funcionar | Menor: o parceiro oferece a conexão guiada, a hospedagem e a cobrança da Meta | Maior: app próprio na Meta, revisão do app, verificação da empresa |
| Custo por mensagem | Preço da Meta + margem do parceiro | Só o preço da Meta |
| Dependência | Do parceiro (API e contrato dele) | Só da Meta |

**Recomendação:** começar por um parceiro e migrar para direto quando o volume justificar. Antes de escolher, confirmar com o parceiro: suporte a **coexistência no Brasil** (o espaço continua usando o app do WhatsApp Business no mesmo número), conexão guiada (Embedded Signup) para vários clientes, cobrança em reais e preço por mensagem.

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
- [ ] Respeitar `allowedSendHours` e a franquia mensal (ver doc 19, seção 3).
- [ ] Resposta livre ao aluno só dentro de **24 horas** depois da última mensagem dele; fora disso, só modelo aprovado.
- [ ] Tarefas agendadas (Supabase Cron, ver [08](08-backend-supabase.md)): lembretes de cobrança (antes, no dia, depois e crítico da mensalidade; o `charge_reminder` das outras cobranças, 3 dias antes por padrão), pacote acabando (última aula e 7 dias antes de vencer) e parabéns, sem duplicar.

### 3.5 Avisos da Meta (webhooks)
- **Assinatura (30/10/2026, auditoria):** o POST só vale com `X-Hub-Signature-256` certa (HMAC-SHA256 do corpo com `META_APP_SECRET`, comparação em tempo constante, `lib/security/webhook-signature.ts`). Sem o segredo, produção recusa (503) e o desenvolvimento aceita. Antes, qualquer um mudava a situação das mensagens de qualquer espaço.
- [x] **Rota no backend para receber:** `/api/webhooks/whatsapp` trata o desafio `GET` (`hub.challenge`) e o recebimento `POST` de status (**enviada, entregue, lida, falhou**) e mensagens recebidas.
- [x] **Conferir a assinatura do aviso:** validação criptográfica via `META_APP_SECRET` e comparação `timingSafeEqual`.
- [x] **Atualizar o status do `MessageLog`:** `processWhatsAppStatusUpdate` atualiza status, data de leitura (`read_at`) e motivo da falha (`error_reason`) no banco Supabase e no store local.
- [ ] **Resposta do aluno:** registrar e avisar o espaço quando o aluno responder (hoje o webhook contabiliza `messagesReceived`; a conversa continua no app do WhatsApp).

### 3.5.1 Passo a passo de implantação e configuração na Meta (Produção e Staging)

Para que os recibos de entrega (`delivered`) e leitura (`read`) cheguem ao GestaraHub em produção:

#### 1. Variáveis de ambiente no provedor de hospedagem (Vercel / servidor)
Configurar as seguintes variáveis no ambiente de produção:
- `WHATSAPP_API_URL`: `https://graph.facebook.com/v21.0`
- `WHATSAPP_API_TOKEN`: Token permanente de Usuário do Sistema gerado no Meta Business Manager com permissões de mensageria.
- `WHATSAPP_PHONE_NUMBER_ID`: Identificador do número de WhatsApp na plataforma.
- `WHATSAPP_BUSINESS_ACCOUNT_ID`: Identificador da conta WABA da empresa.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Segredo alfanumérico longo aleatório criado pela equipe para autenticar o handshake inicial do webhook.
- `META_APP_SECRET`: Segredo do aplicativo Meta (App Secret obtido no painel de desenvolvedores), **obrigatório em produção** para validar a assinatura `X-Hub-Signature-256`.

#### 2. Configuração no painel Meta for Developers
1. Acesse [developers.facebook.com](https://developers.facebook.com) e selecione o aplicativo do GestaraHub.
2. No menu lateral, acesse **WhatsApp** → **Configuration** (Configuração).
3. No painel **Webhook**, clique no botão **Edit** (Editar):
   - **Callback URL (URL de retorno):** `https://<seu-dominio-producao>/api/webhooks/whatsapp`
   - **Verify Token (Token de verificação):** o mesmo valor definido em `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
   - Clique em **Verify and Save** (Verificar e salvar). O Next responderá ao desafio `hub.challenge` com HTTP 200.
4. No card **Webhook fields** (Campos do webhook), clique em **Manage** (Gerenciar):
   - Assine o campo **`messages`** (obrigatório: entrega, leitura, falha e mensagens de retorno).
   - Assine o campo **`message_template_status_update`** (atualizações automáticas de status dos modelos: aprovado, pausado, rejeitado).

#### 3. Requisitos para virada para Modo Live (Produção)
- Cadastrar a URL de Política de Privacidade (`https://<dominio>/privacy`) e Termos de Uso (`https://<dominio>/terms`) nas **Configurações Básicas** do App.
- Definir o ícone institucional e categoria de negócios.
- Solicitar aprovação avançada para as permissões:
  - `whatsapp_business_messaging` (envio e recebimento de mensagens comerciais).
  - `whatsapp_business_management` (gestão da conta WABA e modelos).
- Virar o alternador do App no topo de **Em desenvolvimento** para **Publicado/Live**.

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
