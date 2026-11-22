import type { DateISO, DateTimeISO } from "./common";

/**
 * Assinatura do GestaraHub (o "plano" do produto contratado pelo tenant). Nao
 * confundir com `Plan` (plano de mensalidade do aluno). Na tela aparece como
 * "Plano GestaraHub". Ver docs/technical/24-plano-gestarahub.
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
  | "event_signup" // Inscricao em evento por link e ingresso com QR code (doc product/29)
  | "bi"; // Inteligencia e analytics preditivos (nivel Scale)

/** Situacao da autorizacao de Pix Automatico no Asaas (oferta na assinatura com Pix). */
export type PixAutomaticStatus = "CREATED" | "ACTIVE" | "CANCELLED" | "EXPIRED" | "REFUSED";

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
  /**
   * Cortesia do GestaraHub (concedida pelo painel admin): o plano pago vale ate este
   * dia, sem cobranca. A troca para o Gratis ja vem marcada no dia seguinte.
   */
  courtesyUntil?: DateISO;
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
  /**
   * Pix Automatico da assinatura (19/11/2026): o Asaas oferece no Pix e, com a
   * autorizacao ativa (`ACTIVE`), as renovacoes sao debitadas no vencimento.
   */
  pixAutomatic?: { authorizationId: string; status: PixAutomaticStatus; updatedAt: DateTimeISO };
}

/** Tipo do evento no historico do plano (`subscription_events`, doc technical/23). */
export type SubscriptionEventKind =
  | "activated"
  | "upgraded"
  | "change_scheduled"
  | "change_canceled"
  | "change_applied"
  | "renewed"
  | "renewal_overdue"
  | "reverted_to_free"
  | "reactivated"
  | "closed"
  | "canceled"
  | "removed_at_partner"
  // Concedidos pelo painel admin do GestaraHub (doc technical/26, fase 3).
  | "courtesy_granted"
  | "courtesy_ended"
  | "courtesy_revoked"
  | "grace_extended"
  | "forced_free";

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
  /** Quem pediu a troca (o pagamento pode ser confirmado depois, pelo parceiro). */
  requestedBy?: { userId: string; name: string };
  createdAt: DateTimeISO;
}

/** Situacao da nota fiscal (NFS-e) do Plano GestaraHub (doc technical/24 §7.1). */
export type PlatformInvoiceStatus =
  | "requesting"
  | "scheduled"
  | "synchronized"
  | "authorized"
  | "processing_cancellation"
  | "canceled"
  | "cancellation_denied"
  | "error";

export type PlatformInvoiceKind = "subscription" | "plan_upgrade" | "platform_fees" | "addon";

/** Nota fiscal do plano, como o espaco e o painel veem. */
export interface PlatformInvoiceView {
  id: string;
  kind: PlatformInvoiceKind;
  status: PlatformInvoiceStatus;
  amountCents: number;
  serviceDescription: string;
  invoiceNumber?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  /** Motivo da recusa (prefeitura ou parceiro). */
  statusDescription?: string;
  effectiveDate?: string;
  issuedAt?: string;
  createdAt: string;
}
