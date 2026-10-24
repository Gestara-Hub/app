import type { DateISO, DateTimeISO } from "./common";

/**
 * Assinatura do GestaraHub (o "plano" do produto contratado pelo tenant). Nao
 * confundir com `Plan` (plano de mensalidade do aluno). Na tela aparece como
 * "Plano GestaraHub". Ver docs/technical/05-modulo-financeiro (secao 3).
 */
export type SubscriptionTier = "free" | "pro" | "scale";
export type SubscriptionInterval = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

/** Recursos pagos, checados junto com a permissao do perfil. */
export type PaidFeature =
  | "online_payments" // cobranca online no app/web (Pix, link, Pix Automatico com baixa automatica)
  | "messaging" // Comunicacao automatizada (gateway WhatsApp, lembretes inteligentes)
  | "reports_advanced" // Relatorios gerenciais avancados (DRE, churn, projecao)
  | "certificates" // Certificado de conclusao do curso (doc 20, fase D)
  | "bi"; // Inteligencia e analytics preditivos (nivel Scale)

export interface Subscription {
  tier: SubscriptionTier;
  interval?: SubscriptionInterval;
  status?: SubscriptionStatus;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  nextDueDate?: string;
  priceCents?: number;
  paymentMethod?: "pix" | "credit_card";
  /** So demonstracao / historico: quando o tier foi trocado nas Configuracoes ou Checkout. */
  changedAt?: DateTimeISO;
  /**
   * Fim do periodo ja pago: o dia da renovacao (doc product/13 §6). Sem
   * pagamento ate la, conta a tolerancia de 5 dias.
   */
  renewsOn?: DateISO;
  /** Troca que reduz (plano menor, anual → mensal, Gratis): vale em `effectiveOn`. */
  scheduledChange?: ScheduledPlanChange;
  /** Upgrade esperando o pagamento da diferenca (Pix): liga ao confirmar. */
  pendingChange?: PendingPlanChange;
  /** Cobranca da renovacao em aberto no Asaas (para o aviso "pagar agora"). */
  pendingPayment?: { id: string; dueDate: DateISO; invoiceUrl?: string };
  /**
   * Voltou ao Gratis por falta de pagamento: o plano que tinha e a renovacao
   * nao paga (`on`). Pagar em ate 15 dias religa o plano.
   */
  revertedFrom?: { tier: SubscriptionTier; interval?: SubscriptionInterval; on: DateISO };
  /**
   * Assinatura encerrada no Asaas 15 dias depois de voltar ao Gratis: o plano
   * que tinha, a renovacao nao paga e o dia do encerramento (para o aviso).
   */
  closedFrom?: { tier: SubscriptionTier; renewsOn: DateISO; on: DateISO };
  /** Avisos ja enviados por e-mail ("<renovacao>:<tipo>"), para nao repetir. */
  noticesSent?: string[];
}

export interface ScheduledPlanChange {
  tier: SubscriptionTier;
  interval?: SubscriptionInterval;
  effectiveOn: DateISO;
}

export interface PendingPlanChange {
  tier: Exclude<SubscriptionTier, "free">;
  interval: SubscriptionInterval;
  /** Cobranca avulsa da diferenca no Asaas. */
  paymentId: string;
  amountCents: number;
  /** Mensal → anual: o ciclo anual comeca no dia do pagamento. */
  restartsCycle: boolean;
  createdAt: DateTimeISO;
}
