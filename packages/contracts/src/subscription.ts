import type { DateTimeISO } from "./common";

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
}
