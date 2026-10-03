import type { DateTimeISO } from "./common";

/**
 * Assinatura do GestaraHub (o "plano" do produto contratado pelo tenant). Nao
 * confundir com `Plan` (plano de mensalidade do aluno). Na tela aparece como
 * "Plano GestaraHub". Ver docs/technical/05-modulo-financeiro (secao 3).
 */
export type SubscriptionTier = "free" | "pro" | "scale";

/** Recursos pagos, checados junto com a permissao do perfil. */
export type PaidFeature =
  | "online_payments" // cobranca online no app/web (Pix, link, Pix Automatico com baixa automatica)
  | "messaging" // Comunicacao automatizada (gateway WhatsApp, lembretes inteligentes)
  | "reports_advanced" // Relatorios gerenciais avancados (DRE, churn, projecao)
  | "bi"; // Inteligencia e analytics preditivos (nivel Scale)

export interface Subscription {
  tier: SubscriptionTier;
  /** So demonstracao: quando o tier foi trocado nas Configuracoes. */
  changedAt?: DateTimeISO;
}
