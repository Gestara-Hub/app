import type { DateTimeISO } from "./common";

/**
 * Assinatura do GestaraHub (o "plano" do produto contratado pelo tenant). Nao
 * confundir com `Plan` (plano de mensalidade do aluno). Na tela aparece como
 * "Plano GestaraHub". Ver docs/technical/05-modulo-financeiro (secao 3).
 */
export type SubscriptionTier = "free" | "pro";

/** Recursos pagos, checados junto com a permissao do perfil. */
export type PaidFeature =
  | "finance" // Financeiro
  | "online_payments" // cobranca online (Pix, link, Pix Automatico)
  | "reports" // Relatorios (proximo modulo)
  | "messaging"; // Comunicacao automatizada (modulo futuro)

export interface Subscription {
  tier: SubscriptionTier;
  /** So demonstracao: quando o tier foi trocado nas Configuracoes. */
  changedAt?: DateTimeISO;
}
