# 07 — Integração real do WhatsApp (API oficial da Meta)

> **Status:** 13/10/2026. Checklist para quando o backend começar. Hoje só o **envio assistido** funciona de verdade; a conexão oficial e os envios automáticos são simulados no mock.
> Decisão de produto (número do próprio espaço; assistido no grátis, oficial no Pro): [../product/13-modelo-de-negocio.md](../product/13-modelo-de-negocio.md), seção 5. Custos e repasse: [../product/19-levantamento-pagamentos.md](../product/19-levantamento-pagamentos.md), seção 3.

## 1. O que existe hoje

| Parte | Situação |
|---|---|
| Envio assistido (`api.whatsapp.com/send` com o texto pronto) | **Real.** Abre o WhatsApp do aparelho; registra "Aberto no WhatsApp". |
| Botão "Conectar WhatsApp oficial" | Simulado: usa o telefone da unidade e o nome do espaço, sem falar com a Meta. |
| Envio pelo oficial, status "Entregue/Lida/Falhou" | Simulado: nada sai do sistema. |
| Parabéns automático | Simulado na leitura da tela Comunicação. |
| Lembretes automáticos de cobrança | Não existem ainda. |

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
- [ ] Para cada tipo (`billing_before_due`, `billing_due_date`, `billing_after_due`, `billing_critical`, `charge_reminder`, `welcome_student`, `absence_alert`, `package_ending`, `birthday_greeting`), criar o modelo na conta do espaço em **pt_BR**, convertendo as variáveis (`{aluno}` → `{{1}}`...).
- [ ] Modelos da fase D do doc 20 (14/10/2026): `charge_reminder` ("Lembrete de cobrança": avulsa, parcela de curso e compra de pacote; variáveis `{aluno}`, `{referencia}`, `{valor}`, `{empresa}`, `{vencimento}`, `{link_pagamento}`; categoria provável "utilidade") e `package_ending` ("Pacote acabando": `{aluno}`, `{pacote}`, `{empresa}`, `{restante}`; tende a "marketing", porque convida a comprar de novo). `{referencia}` e `{restante}` são frases montadas pelo sistema ("parcela 2 de 4 do curso Confeitaria", "vence em 3 dias e resta 1 aula"); no oficial, conferir se a Meta aceita variável com frase ou se o modelo precisa de variáveis menores.
- [ ] **Editar o texto no oficial** passa a ser enviar para aprovação. A tela ganha o estado do modelo: "Em análise", "Aprovado", "Recusado" (com o motivo). Enquanto não aprovado, o envio automático daquele tipo não sai. No assistido, o texto continua livre.
- [ ] Contrato: `MessageTemplate` ganha o estado na Meta e o motivo de recusa.
- [ ] A **categoria** é definida pela Meta e muda o preço: lembrete de cobrança tende a ser "utilidade" (barata); parabéns e "Sentimos sua falta" tendem a ser "marketing" (mais cara).
- [ ] Frase com variável sem valor: no assistido a frase sai (`fillMessage`); no oficial a variável é obrigatória, então o modelo aprovado não pode depender de dado que às vezes falta (ex.: link de pagamento).

### 3.4 Envio
- [ ] Envio pela API (parceiro ou Meta), guardando o identificador externo da mensagem no `MessageLog`.
- [ ] Respeitar `allowedSendHours` e a franquia mensal (ver doc 19, seção 3).
- [ ] Resposta livre ao aluno só dentro de **24 horas** depois da última mensagem dele; fora disso, só modelo aprovado.
- [ ] Tarefas agendadas (Supabase Cron, ver [08](08-backend-supabase.md)): lembretes de cobrança (antes, no dia, depois e crítico da mensalidade; o `charge_reminder` das outras cobranças, 3 dias antes por padrão), pacote acabando (última aula e 7 dias antes de vencer) e parabéns, sem duplicar.

### 3.5 Avisos da Meta (webhooks)
- [ ] Rota no backend para receber: **enviada, entregue, lida, falhou** e **mensagens recebidas**.
- [ ] Conferir a assinatura do aviso; tratar avisos repetidos sem duplicar.
- [ ] Atualizar o status do `MessageLog` (hoje simulado) e o motivo da falha.
- [ ] Resposta do aluno: no começo, registrar e avisar o espaço (ex.: "Pedro respondeu no WhatsApp"); a conversa continua no app do WhatsApp.

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
