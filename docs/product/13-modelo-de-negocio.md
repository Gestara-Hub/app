# Modelo de negócio: Free vs Pro vs Scale

> **Status:** Atualizado em 19/10/2026. Preços do Pro (R$ 79,90/mês e R$ 799/ano) e Scale (R$ 199/mês e R$ 1.990/ano) aprovados. Pagamento online liberado para todos (inclusive no Grátis) com taxas transacionais via Asaas (split nativo). Sem travas artificiais de alunos ou professores no Grátis.
> **13/10/2026:** WhatsApp sempre com o número do próprio espaço; envio assistido no grátis e API oficial no Pro (seção 5). Pagamentos (assinatura, custo das mensagens e mensalidade online com split): levantamento em [19-levantamento-pagamentos.md](19-levantamento-pagamentos.md); integração real do WhatsApp: [../technical/07-integracao-whatsapp.md](../technical/07-integracao-whatsapp.md).
> **19/10/2026 (Decisão de Preço e Gateway):** O Asaas foi o gateway escolhido para a infraestrutura de pagamentos (assinaturas da plataforma + subcontas dos espaços com split automático). O Plano Grátis não possui travas de alunos ou equipe, monetizando no split transacional das mensalidades. O Plano Pro entrega automação pura (WhatsApp oficial, DRE Gerencial, certificados e taxas reduzidas no Pix).

## 1. Decisão Estratégica

O GestaraHub adota o modelo **Freemium agressivo com monetização em fluxo financeiro (fintech) e automação (SaaS)**:
- **Plano Grátis:** O coração operacional e financeiro do dia a dia da academia é **100% gratuito**, sem limite artificial de alunos, turmas ou usuários da equipe. Isso elimina qualquer fricção de entrada e substitui de vez o caderno ou planilhas.
- **Apps do Aluno e do Professor:** Acesso gratuito para consulta de horários, presenças, avisos, pagamentos e graduação.
- **A Monetização ocorre em 3 pilares:**
  1. **Fintech e Taxa Transacional (Em todos os planos, inclusive no Grátis):** Cobrança online (Pix Copia e Cola, link, Pix Automático, cartão) com baixa automática no app e web via Asaas. O GestaraHub retém sua margem no split na liquidação de cada mensalidade paga.
  2. **Assinatura do Plano Pro (R$ 79,90/mês ou R$ 799,00/ano):** Notificações e lembretes 100% automáticos de cobrança via API oficial da Meta (WhatsApp), DRE gerencial, certificados e **taxas reduzidas no Pix**.
  3. **Plano Scale (R$ 199,00/mês ou R$ 1.990,00/ano):** Gestão multiunidade, BI preditivo de evasão de alunos e franquias ampliadas de mensagens.

---

## 2. Estrutura dos Níveis de Assinatura (`SubscriptionTier`)

```
┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│              PLANO GRÁTIS               │   │                PLANO PRO                │   │               PLANO SCALE               │
│         "Coração Operacional"           │   │          "Piloto Automático"            │   │          "Redes e Franquias"            │
│               R$ 0 / mês                │   │             R$ 79,90 / mês              │   │             R$ 199,00 / mês             │
│                                         │   │        (ou R$ 799/ano à vista)          │   │       (ou R$ 1.990/ano à vista)         │
└─────────────────────────────────────────┘   └─────────────────────────────────────────┘   └─────────────────────────────────────────┘
```

### 2.1 Plano Grátis (Free)
- **Operação Completa e Ilimitada:** Alunos, responsáveis, turmas, chamadas com áudio, modalidades e planos ilimitados.
- **Equipe Ilimitada:** Dono, professores e recepcionistas com permissões granulares.
- **Trilha de Graduação:** Gestão de faixas, graus e critérios de progressão por presença/tempo.
- **Mensalidades dos Alunos:** Geração de cobranças e controle manual de pagamentos (dinheiro, Pix manual conferido no extrato).
- **Módulo Financeiro Básico:** Entradas, saídas manuais, despesas recorrentes, categorias, fluxo de caixa e cálculo do repasse de professores (com fechamento e quitação manual).
- **Apps do Aluno e do Professor:** Acesso liberado (histórico de treinos, chamadas, graduações e avisos).
- **WhatsApp assistido:** cobrança, lembrete e parabéns com a mensagem pronta; o botão abre o WhatsApp do próprio espaço e a pessoa só toca em enviar (seção 5).
- **Pagamento Online Integrado (Asaas):** Liberado no Grátis com baixa automática imediata. Taxa do GestaraHub de R$ 1,99 por cobrança online recebida, além da tarifa do Asaas da subconta do espaço (doc 19, seção 4).

### 2.2 Plano Pro (O "Piloto Automático" — R$ 79,90/mês ou R$ 799,00/ano)
- **`messaging`:** Envio 100% automático pelo WhatsApp, pela API oficial da Meta e com o **número do próprio espaço**: lembretes de vencimento (antes, no dia e após), boas-vindas e recuperação de alunos ausentes (franquia mensal de 300 mensagens/mês inclusa; excedente via pacotes pré-pagos ou retorno ao assistido).
- **Taxas transacionais reduzidas ⚡:** Taxa do GestaraHub de R$ 1,29 por cobrança online recebida (R$ 1,99 no Grátis); a tarifa do Asaas não muda. Para academias com mais de 70 alunos, a economia na taxa paga a própria assinatura do Pro.
- **`reports_advanced`:** Relatórios avançados gerenciais (DRE completa do negócio com lucro líquido real, faturamento previsto vs. realizado, evolução da inadimplência e taxa de retenção por faixa).
- **`certificates`:** Emissão de certificados de conclusão de curso e graduação prontos para imprimir ou exportar em PDF.

### 2.3 Plano Scale (Para Redes e Grandes Academias — R$ 199,00/mês ou R$ 1.990,00/ano)
- **Multiunidade / Franquias:** Gestão centralizada de múltiplas unidades ou filiais sob uma única conta com consolidação financeira.
- **`bi`:** Módulo de BI & Analytics preditivo (análise preditiva de churn/evasão de alunos, mapas de calor de ocupação de horários e tatames).
- **Taxas de pagamento personalizadas** para grandes volumes transacionados.

---

## 3. Matriz Técnica de Recursos (`PaidFeature`)

No código (`packages/contracts/src/subscription.ts` e `apps/web/src/lib/subscription.ts`):

```ts
export type SubscriptionTier = "free" | "pro" | "scale";

export type PaidFeature =
  | "online_payments"   // Pix, link, Pix Automático com baixa automática
  | "messaging"         // Notificações e lembretes automáticos via WhatsApp
  | "reports_advanced"  // DRE, projeção de caixa e retenção
  | "bi";               // Inteligência analítica preditiva
```

```ts
export const TIER_FEATURES: Record<SubscriptionTier, readonly PaidFeature[]> = {
  free: [],
  pro: ["online_payments", "messaging", "reports_advanced"],
  scale: ["online_payments", "messaging", "reports_advanced", "bi"],
};
```

---

## 4. Estratégia de Gatilhos de Upgrade (In-App Upsell)

Os gatilhos de upgrade são contextuais e aparecem no ponto exato do atrito manual:

1. **Em Cobranças (`/classes/billing`):**
   - No card de mensalidade vencida: botão rápido `[ Cobrar via WhatsApp ⚡ ]` (abre preview da mensagem automática com link de pagamento e convite para o Pro).
   - Na barra de ações em lote: botão `[ Disparar avisos de vencimento para todos ]` (badge Pro).
   - Ao registrar pagamento manual: dica contextual sobre baixa automática pelo app.
2. **No Fechamento de Professores (`/finance?tab=professores`):**
   - Ao fechar o pagamento: opção `[ Pagar via Pix Transferência / Split Automático ]` (badge Pro).
3. **Na Matrícula e Presença:**
   - Ao matricular: opção de `[ Enviar WhatsApp de boas-vindas com link do app ]`.
   - Ao registrar 3 faltas consecutivas: sugestão de `[ Enviar 'Sentimos sua falta' no WhatsApp ]`.
4. **No App do Aluno (Tração Bottom-Up):**
   - Na tela de pagamento de mensalidade do aluno: se a academia for Free, exibe o botão `[ Pagar com Pix pelo App ]` que abre uma mensagem pronta para o aluno enviar ao professor: *"Professor, ativa o pagamento pelo app no GestaraHub pra facilitar pra gente!"*.
5. **Nos Relatórios:**
   - Itens avançados como DRE Gerencial e Análise de Evasão aparecem com cadeado e preview explicativo dos benefícios do Pro.

---

## 5. Decisão: WhatsApp com o número do próprio espaço (13/10/2026)

### Decisao
- As mensagens saem **sempre do número de WhatsApp do próprio espaço**. Não existe número do GestaraHub para falar com alunos.
- **Fase 1, plano Grátis: envio assistido.** O sistema monta a mensagem (cobrança, lembrete, parabéns, boas-vindas) e o botão "Enviar no WhatsApp" abre o WhatsApp do aparelho (`wa.me` com o texto pronto). A pessoa só toca em enviar. Sem custo, sem conexão e sem servidor.
- **Fase 2, plano Pro (`messaging`): envio automático pela API oficial da Meta** (WhatsApp Business Platform), com o número do espaço conectado uma vez pelo cadastro guiado da Meta (Embedded Signup). O espaço continua usando o app do WhatsApp Business no mesmo número (coexistência). **A confirmar antes da fase 2:** elegibilidade da coexistência no Brasil e se a conexão será direta com a Meta ou por um parceiro (BSP).
- **Sem franquia de mensagens automáticas (17/11/2026):** a franquia (Grátis 0, Pro 300, Expansão 1.000 por ciclo) saiu. Como Provedor de Tecnologia, o GestaraHub não paga as mensagens: cada espaço paga a Meta direto, pela forma de pagamento da própria conta do WhatsApp (doc `technical/07` §1.5). O Pro continua com o envio automático; o custo de cada mensagem é do espaço, cobrado pela Meta por categoria (utilidade mais barata que marketing). Para o GestaraHub pagar e embutir no plano, só com um parceiro oficial da Meta; aí uma franquia volta a fazer sentido (em aberto em `pendencias.md`).

### Contexto
- Para o aluno, a mensagem precisa vir de quem ele conhece: cobrança vinda de um número desconhecido parece golpe, e as respostas ("vou faltar hoje") precisam chegar na academia.
- No WhatsApp oficial cada conta representa um negócio. Um número compartilhado por vários espaços divide o risco: denúncias contra um espaço derrubam a reputação, e no limite o número, de todos.
- Envio automático tem custo por mensagem; por isso ele é Pro, e o grátis fica com o envio assistido, de custo zero.
- Consequência técnica: nada na comunicação exige servidor sempre ligado (a API oficial funciona por avisos que a Meta envia ao sistema). Ver `docs/technical/00-decisoes-tecnicas.md`, seção Backend.

### Escopo
- Vale para todos os modelos e segmentos.
- **Implementado no mock (13/10/2026):** a sessão por QR code saiu.
  - Contrato `WhatsAppConnection` / `WhatsAppConnectionView` (`packages/contracts/src/communication.ts`): `mode` (`assisted` ou `official`; oficial = Pro e conectado), `officialStatus`, número, nome exibido, horário de envio e franquia. O mock simula o cadastro da Meta e conecta com o telefone da unidade.
  - Histórico (`MessageLog`): status `opened` ("Aberto no WhatsApp") no envio assistido, porque o sistema só sabe que o WhatsApp foi aberto, não se a mensagem saiu. A mensagem guarda `clientId` e `chargeId`.
  - Tela Comunicação liberada para todos: aviso do modo em uso, até 4 números do mês (no assistido, só "Abertas no WhatsApp" e "Recebido depois de lembrete"), abas Mensagens (textos editáveis por todos; envio automático e horário só no oficial), Histórico e Conexão (assistido explicado; no Pro, conectar ou desconectar o oficial).
  - Botões "WhatsApp": Mensalidades ("Lembrar no WhatsApp" no menu da mensalidade em aberto, com o lembrete certo pela situação), Dashboard (bloco "Para fazer hoje": alunos com 3 faltas seguidas e aniversariantes do dia, cada um com o botão de mensagem; e o card de aniversariantes do mês), aviso de aluno cadastrado ("Enviar boas-vindas"), "Nova mensagem" em Comunicação e "Enviar pelo WhatsApp" da cobrança online.
  - Frase do modelo com variável sem valor (ex.: link de pagamento sem cobrança online, link do app) sai inteira da mensagem (`fillMessage` em `apps/web/src/lib/whatsapp.ts`).
  - "Sentimos sua falta" passou de 14 dias sem frequência para **3 faltas seguidas**, contando as aulas de **todas as turmas em que o aluno está matriculado**, em ordem de data e horário: quem falta ao Jiu-Jitsu mas vai ao Muay Thai não sumiu do espaço. Presença ou falta justificada em qualquer dessas turmas encerram a sequência; só contam aulas com chamada feita, e cada aula conta uma falta (duas aulas no mesmo dia = duas faltas).

### Alternativas
- **Número único do GestaraHub:** rejeitado. O aluno não reconhece o remetente, as respostas caem no GestaraHub, o risco é dividido entre todos os espaços e conflita com a regra de um negócio por conta.
- **Conexão por QR code (WhatsApp Web, não oficial):** rejeitado. É contra os termos do WhatsApp, o número do cliente pode ser banido (para um espaço pequeno, perder o WhatsApp é crítico) e exige servidor sempre ligado com uma conexão aberta por espaço.

---

## 6. Decisão: troca de plano, renovação e atraso (23/10/2026)

**Implementado em 23/10/2026** (como ficou: ao fim desta seção). Os valores dos exemplos são os de hoje no código (`config/subscription.ts`), que seguem em aberto.

### Decisao
- **Upgrade (Grátis → Pro, Pro → Scale): na hora, com a diferença proporcional.** Os dias que sobram do plano atual viram crédito, e a **data de renovação não muda**. Exemplo: Pro mensal (R$ 79,90) → Scale mensal (R$ 199,00) no dia 10 de um ciclo de 30 dias, com 20 dias sobrando: hoje (199,00 − 79,90) × 20/30 = **R$ 79,40**; na renovação, R$ 199,00 por mês na mesma data. O plano novo liga quando a diferença é paga (cartão na hora, Pix ao confirmar).
- **Confirmação com os valores antes de cobrar:** "Hoje: R$ 79,40 (20 dias de diferença). A partir de 10/11: R$ 199,00/mês." Nada é cobrado sem esse passo.
- **Downgrade (Scale → Pro, pago → Grátis): no fim do período já pago.** Até lá nada muda, e a tela mostra a troca marcada ("Muda para o Grátis em 10/11"). O dono pode desmarcar antes da data.
- **Mensal ↔ anual: o que aumenta o compromisso é na hora, o que reduz é no fim do período.**
  - Mensal → anual: na hora. Os dias que sobram do mês abatem o anual, e o ciclo anual começa no dia da troca. Exemplo: Pro mensal, 20 dias sobrando: R$ 799,00 − R$ 53,27 = **R$ 745,73** hoje, renovação em um ano.
  - Anual → mensal: no fim do ano pago.
  - Combinações (Pro mensal → Scale anual) seguem a regra do upgrade.
- **Uma assinatura por espaço no Asaas.** Troca de plano atualiza a assinatura existente (valor e ciclo) e cobra a diferença numa cobrança avulsa; nunca cria uma segunda assinatura ativa.
- **Renovação não paga: 5 dias de tolerância**, com o plano funcionando nesse prazo. Avisos para **dono e gerente**, por **e-mail** e no sistema: no **sino** enquanto o plano funciona normalmente, e no **aviso fixo no topo** quando ele está para cair ou já caiu (30/10/2026: o usuário pediu os avisos no sino; o fixo ficou só para o plano caindo, para não repetir o mesmo aviso):

  | Quando | Aviso | Onde no sistema |
  | --- | --- | --- |
  | 3 dias antes (só Pix) | "Seu plano renova em 13/11" | sino |
  | No vencimento, sem pagamento | "Pagamento do plano pendente", com o Pix | sino |
  | 3 dias depois | "Faltam 2 dias para o plano voltar ao Grátis" | aviso fixo |
  | 5 dias depois | Volta ao Grátis e avisa | aviso fixo |

  Ao voltar ao Grátis os dados ficam guardados e só os recursos pagos ficam bloqueados. Pagar a cobrança atrasada depois religa o plano.
- **Depois de voltar ao Grátis: 15 dias para pagar e religar** (decisão do usuário, 23/10/2026). No 15º dia a assinatura é encerrada no Asaas, para de gerar cobranças, e o espaço assina de novo quando quiser, pelo checkout. Avisos ao dono e ao gerente, por e-mail e no aviso fixo do topo; o "assinatura encerrada" fica no sino por 7 dias:

  | Quando | Aviso |
  | --- | --- |
  | Ao voltar ao Grátis (5º dia de atraso) | "Seu plano voltou ao Grátis": pague até 03/12 para religar; depois, a assinatura é encerrada e dá para assinar de novo |
  | 7 dias depois | "A assinatura do plano será encerrada em 03/12" |
  | 2 dias antes | "Faltam 2 dias para encerrar a assinatura" |
  | No 15º dia | "A assinatura do plano foi encerrada": os dados continuam guardados, assine de novo quando quiser (o aviso fica 7 dias no app) |

  Por que 15: somado aos 5 dias de tolerância, o encerramento cai no 20º dia depois do vencimento, antes da renovação seguinte do mensal (30º dia). Assim nunca há duas cobranças atrasadas ao mesmo tempo. Ajustável em `PLAN_CLOSE_AFTER_REVERT_DAYS` (`@gestarahub/core/subscription-plan`).
- **O Asaas avisa o sistema (webhook) sobre a assinatura:** pagamento confirmado (primeiro e renovações, mesmo com a tela fechada), atraso e cancelamento feito direto no Asaas.

### Contexto
- Em 23/10/2026 o código só sabia assinar e cancelar. Pro → Scale criava uma segunda assinatura sem cancelar a primeira (cobrança dupla), o downgrade era imediato e perdia os dias pagos, mensal ↔ anual não era possível e o webhook não tratava pagamentos de assinatura: renovação não paga deixava o plano ligado para sempre, e Pix pago com a tela fechada não ligava o plano.
- Desde o commit `42ffdc3` o plano pago é gravado só no servidor, depois de conferir o pagamento no Asaas (a assinatura leva espaço, plano e período em `externalReference`). As regras acima partem dessa base. Ver `docs/technical/24-plano-gestarahub.md` §5.
- 5 dias e não 3: o Pix não é cobrado de novo sozinho (o dono precisa pagar), e 3 dias com fim de semana no meio ficam curtos.

### Escopo
- Vale para o Plano GestaraHub (assinatura do espaço), não para as mensalidades dos alunos (`docs/product/15-regras-de-cobranca.md`).
- Onde vai morar: `services/subscription/*` (actions e serviço), `services/server/subscription.ts` (gravação no servidor), webhook `app/api/webhooks/asaas/route.ts`, aviso fixo no layout, e-mails em `lib/email/ses.ts`, tarefa diária para a tolerância (como as outras em `app/api/cron`).

### Alternativas
- **Upgrade só no próximo ciclo:** rejeitado. Quem precisa do recurso quer usar na hora.
- **Upgrade começando um ciclo novo no dia da troca:** rejeitado para trocas no mesmo período (muda a data de cobrança sem necessidade). Fica só para mensal → anual.
- **Downgrade na hora:** rejeitado. O período já foi pago.
- **3 dias de tolerância:** considerado curto (ver Contexto). Pode ser revisto com dados de uso.

### Como ficou (23/10/2026)
- **Regras puras:** `@gestarahub/core/subscription-plan`.
  - `quotePlanChange` faz a conta da troca: hoje, renovação, ou marcada para o fim do período.
  - `planNoticeFor` decide os avisos; `planDailyStep` decide o que a rotina faz no dia.
  - O período usa o tamanho real do mês ou do ano até a renovação. Por isso o exemplo de 30 dias dá exatamente R$ 79,40 e R$ 745,73.
- **Servidor:** `services/server/subscriptionPlan.ts`, com as ações em `services/subscription/planChangeActions.ts`. Uma assinatura só por espaço no Asaas:
  - **Upgrade:** gera uma cobrança avulsa da diferença, na fatura do Asaas (Pix ou cartão, a pessoa escolhe). O plano liga quando ela é paga: pela tela, que confere a cada 5 s, ou pelo webhook.
  - **Ao ligar o upgrade:** a mesma assinatura recebe o valor e o ciclo novos, e a cobrança da renovação que o Asaas já gerou (ele cria a próxima 40 dias antes) também.
  - **Mensal → anual:** apaga a cobrança do mês, que não vai mais existir, e o ciclo anual começa no dia.
  - **Pro anual → Expansão mensal:** o Expansão liga na hora, com a diferença do anual, e a cobrança da renovação já vem com o valor mensal.
  - **Downgrade:** fica marcado, e a renovação já sai com o valor novo. "Desmarcar" volta o valor.
  - **Voltar ao Grátis:** encerra a assinatura no Asaas na hora, para não cobrar a próxima, mas o plano segue até o fim do período. "Desmarcar" cria a assinatura de novo, com a renovação na mesma data. Quem pagava no cartão passa a receber a fatura (Pix ou cartão), porque o cartão não fica guardado.
  - **Defesa no servidor:** a troca direta para o Grátis, numa conta real com dias pagos, também fica marcada.
  - **Checkout:** recusa quem já tem plano pago e encerra a assinatura antiga de quem voltou ao Grátis por atraso.
- **Renovação e tolerância:**
  - A assinatura guarda `renewsOn`, o fim do período pago.
  - O webhook (`app/api/webhooks/asaas/route.ts`) trata as cobranças do plano: a renovação paga empurra a data; a cobrança criada ou vencida fica guardada para o "Pagar agora"; a assinatura removida direto no Asaas volta o espaço ao Grátis.
  - A rotina diária (`app/api/cron/daily`) confere no Asaas se a renovação foi paga (mesmo sem webhook), aplica a troca marcada no dia, volta ao Grátis no 5º dia, encerra a assinatura no Asaas 15 dias depois (`closedFrom`) e manda os avisos por e-mail ao dono e ao gerente, uma vez cada.
- **Telas:**
  - Planos: quem já tem plano pago troca pela janela com a conta, e nada é cobrado sem confirmar.
  - Configurações → Plano: renovação, troca marcada com "Desmarcar" e "Voltar ao Grátis" no fim do período.
  - Avisos para dono e gerente com os mesmos textos do e-mail (`lib/plan-notice-copy.ts`): no sino (`planBellAlert`, `features/dashboard/bell-alerts.ts`) e, com o plano caindo, no aviso fixo do topo (`PlanNoticeBanner`). Quem vai para cada lugar: `isPinnedPlanNotice`.
  - **E-mails do GestaraHub no lugar dos do Asaas (19/11/2026):** o cliente da assinatura é criado no Asaas com `notificationDisabled: true`, e o Asaas não manda mais "Cobrança criada" nem "Pagamento confirmado" a quem assina. Pagar (renova logo, pendente, vencida) já vinha da rotina diária, com o botão "Pagar agora" na fatura do Asaas. O pagamento confirmado (plano ativo, renovado ou religado) sai na hora da conferência, para dono e gerente, com o botão para o plano (`services/server/planEmails.ts`). Clientes criados antes dessa data só mudam no próximo checkout; os já criados se ajustam à mão no painel do Asaas (cliente > Notificações).
  - **Pix Automático na assinatura (19/11/2026):** desde 29/10/2026 o Asaas oferece sozinho o Pix Automático em toda assinatura com Pix (Jornada 4): o QR Code da cobrança vigente é composto e, ao pagar, o banco oferece o débito automático. O GestaraHub guarda a situação em `subscription.pixAutomatic` (avisos `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*` no webhook e conferência diária por `subscriptionId`). Ativo, conta como o cartão: sem "pague até o dia", aviso só se o débito não passar. Configurações > Plano mostra se está ligado, e a troca de plano avisa que a autorização cai (mudar valor ou ciclo cancela, regra do Asaas). O webhook da conta principal precisa ter os eventos de autorização do Pix Automático marcados.
- **Testes:**
  - `packages/core/test/subscription-plan.test.ts` (regras e exemplos da doc);
  - `services/subscription/__tests__/planChange.db.test.ts` (servidor com o Asaas simulado);
  - `services/subscription/__tests__/plan-webhook.test.ts` (roteamento do webhook);
  - `services/subscription/__tests__/paidFeaturesOnServer.db.test.ts` (achado 80).

- **Histórico do plano (23/10/2026):** cada mudança vira uma linha em `subscription_events` e a mesma frase na Auditoria, com quem fez (pessoa, rotina ou parceiro de pagamentos). Aparece em Configurações → Plano. Ver doc `technical/23`.

### Pendente
- **Antes de produção:** cadastrar o webhook na conta principal do Asaas, com os eventos de cobrança e de assinatura e o mesmo token (`ASAAS_WEBHOOK_SECRET`). Hoje o webhook é cadastrado só nas subcontas. Sem ele, a rotina diária ainda confere a renovação, mas o upgrade pago com a tela fechada só liga na próxima conferência.

## 7. Addons, marketplace e integrações (decisão de 31/10/2026)

**Decisão:** nada de addon avulso, marketplace de addons nem integração com ERP agora. O sentido de cada plano fica simples: Grátis = operar o dia a dia; Pro = parecer profissional e automatizar; Scale = várias unidades. Recurso de acabamento (ex.: arte própria no certificado, doc 21 §1.1) é Pro, nunca Scale.

- **Addon:** só depois de o Pro ter preço e clientes pagando, e de um pedido claro que não cabe nele (ex.: SMS, nota fiscal). Cada addon multiplica as regras de troca de plano (§6) e a assinatura no Asaas; Pro fatiado passa a sensação de "tudo custa à parte".
- **Marketplace:** ideia de empresa com ecossistema (API pública, permissões por app, revisão de terceiros, divisão de receita). Antes precisa de volume de clientes. O alicerce que vale já pensar: **API pública com chave por espaço e webhooks** (aluno cadastrado, pagamento recebido, presença marcada), que serve para Zapier/Make e integrações.
- **ERP, SAP, TOTVS:** o público (academia, estúdio, escola de música e de idiomas) não usa. O que uma rede pede: **exportação contábil** (CSV e Excel por período e unidade), **NFS-e**, integração com contabilidade online (Omie, Conta Azul, Bling) e a API pública. Esse é o pacote de Scale que convence, junto com relatório consolidado e usuário em mais de uma unidade. Sem prazo; detalhar como itens de produto quando o Scale for vendido.

## Tela de Planos (decisão de 24/10/2026)

A tela mostra só o que existe: Grátis e Profissional (WhatsApp automático, relatórios de resultado e retenção, certificado, taxa menor). Sem preço nos cards (o valor aparece no checkout antes de cobrar) e sem Expansão à venda até existir multiunidade. A taxa do Pix tem uma frase única (`platformFeeSentence`). O botão "Fale com a gente" depende do canal de atendimento (ver `docs/pendencias.md`).
