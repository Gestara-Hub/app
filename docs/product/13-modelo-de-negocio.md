# Modelo de negócio: Free vs Pro vs Scale

> **Status:** Atualizado em 03/10/2026. Reflete o modelo freemium com monetização em fintech, automação de WhatsApp e inteligência analítica.
> **13/10/2026:** WhatsApp sempre com o número do próprio espaço; envio assistido no grátis e API oficial no Pro (seção 5). Pagamentos (assinatura, custo das mensagens e mensalidade online com split): levantamento em [19-levantamento-pagamentos.md](19-levantamento-pagamentos.md); integração real do WhatsApp: [../technical/07-integracao-whatsapp.md](../technical/07-integracao-whatsapp.md).

## 1. Decisão Estratégica

O GestaraHub adota o modelo **Freemium agressivo com monetização em fluxo financeiro e automação**:
- **Plano Grátis:** O coração operacional e financeiro do dia a dia da academia é **100% gratuito**, sem limite artificial de alunos ou turmas. Isso elimina qualquer fricção de entrada e substitui de vez o caderno ou planilhas.
- **Apps do Aluno e do Professor:** Acesso gratuito para consulta de horários, faltas, presenças, avisos e trilha de graduação (faixas e graus).
- **A Monetização ocorre em 3 pilares:**
  1. **Automação e Comunicação (Pro):** Notificações e lembretes automáticos de cobrança via gateway de WhatsApp (redução da inadimplência sem esforço manual do dono).
  2. **Fintech e Pagamento Integrado (Taxa Transacional / Pro):** Cobrança online (Pix Copia e Cola, link, Pix Automático, cartão) com baixa automática no app e web.
  3. **Relatórios Gerenciais e BI (Pro / Scale):** DRE financeira, análises de retenção/churn e inteligência analítica preditiva.

---

## 2. Estrutura dos Níveis de Assinatura (`SubscriptionTier`)

```
┌────────────────────────────────┐   ┌────────────────────────────────┐   ┌────────────────────────────────┐
│         PLANO GRÁTIS           │   │           PLANO PRO            │   │      PLANO SCALE / REDE        │
│    (Coração Operacional)       │   │      (Piloto Automático)       │   │    (Inteligência e Gestão)     │
│           R$ 0 / mês           │   │      Mensalidade por SaaS      │   │    Multiunidade & Analytics    │
└────────────────────────────────┘   └────────────────────────────────┘   └────────────────────────────────┘
```

### 2.1 Plano Grátis (Free)
- **Operação Completa:** Cadastro de alunos, responsáveis, equipe, modalidades e planos.
- **Turmas e Tatame:** Criação de turmas, grade de horários, chamada/frequência, reposições e lista de espera.
- **Trilha de Graduação:** Gestão de faixas, graus e critérios de progressão por presença/tempo.
- **Mensalidades dos Alunos:** Geração de cobranças e controle manual de pagamentos (dinheiro, Pix manual conferido no extrato).
- **Módulo Financeiro Básico:** Entradas, saídas manuais, despesas recorrentes, categorias, fluxo de caixa e cálculo do repasse de professores (com fechamento e quitação manual).
- **Apps do Aluno e do Professor:** Acesso liberado (histórico de treinos, chamadas, graduações e avisos).
- **Relatórios Operacionais:** Lista simples de chamada em PDF e relação de alunos ativos/inadimplentes.
- **WhatsApp assistido:** cobrança, lembrete e parabéns com a mensagem pronta; o botão abre o WhatsApp do próprio espaço e a pessoa só toca em enviar (seção 5).

### 2.2 Plano Pro (O "Piloto Automático")
- **`online_payments`:** Pagamento de mensalidades online diretamente no App do Aluno e na Web (Pix instantâneo, link e Pix Automático recorrente), com baixa automática sem conferência manual.
- **`messaging`:** Envio automático pelo WhatsApp, pela API oficial da Meta e com o **número do próprio espaço**: lembretes de vencimento (antes, no dia e após), boas-vindas e recuperação de alunos ausentes (franquia mensal com custo de disparo Meta coberto pelo plano). Ver seção 5.
- **`reports_advanced`:** Relatórios avançados gerenciais (DRE completa do negócio, faturamento previsto vs. realizado, evolução da inadimplência e taxa de retenção por faixa).
- **Taxas transacionais reduzidas:** Vantagem comercial nas tarifas de processamento de pagamentos.

### 2.3 Plano Scale (Para Redes e Grandes Academias)
- **`bi`:** Módulo de BI & Analytics preditivo (análise de churn futuro, mapas de calor de ocupação de horários e tatames, desempenho financeiro por modalidade/professor).
- **Multiunidade / Franquias:** Gestão centralizada de múltiplas unidades ou filiais sob uma única conta com consolidação financeira.
- **Customização / White-label:** Identidade visual e marca personalizada no App do Aluno.

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

1. **Em Mensalidades (`/classes/billing`):**
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
- A franquia mensal do Pro (`monthlyQuota`) controla o custo por mensagem, que a Meta cobra por categoria. Lembrete de cobrança é "utilidade" (barata). Parabéns tende a ser classificado como "marketing" (cerca de 5x mais caro). Responder o aluno em até 24 horas depois que ele escreve é gratuito. **Valores a conferir na tabela oficial:** a Meta está passando a cobrar em reais em 2026, e as fontes de terceiros divergem.

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
