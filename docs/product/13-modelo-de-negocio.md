# Modelo de negócio: Free vs Pro vs Scale

> **Status:** Atualizado em 03/10/2026. Reflete o modelo freemium com monetização em fintech, automação de WhatsApp e inteligência analítica.

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

### 2.2 Plano Pro (O "Piloto Automático")
- **`online_payments`:** Pagamento de mensalidades online diretamente no App do Aluno e na Web (Pix instantâneo, link e Pix Automático recorrente), com baixa automática sem conferência manual.
- **`messaging`:** Gateway integrado de WhatsApp com disparos automáticos de lembretes de vencimento (antes, no dia e após), boas-vindas e recuperação de alunos ausentes (franquia mensal com custo de disparo Meta coberto pelo plano).
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
