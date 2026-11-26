import type { ExpiringPersonDocument, OnlinePayment, Organization, Subscription, WhatsAppConnectionView } from "@gestarahub/contracts";
import { isHealthDocumentKind } from "@gestarahub/core/person-documents";
import { formatCents, formatDate } from "@gestarahub/core/format";
import { documentExpiryText } from "@gestarahub/core/person-documents";
import { planNoticeFor } from "@gestarahub/core/subscription-plan";
import { PLAN_SETTINGS_HREF } from "@/components/shared/feature-locked";
import { subscriptionTierLabel } from "@/lib/labels";
import { isPinnedPlanNotice, planNoticeCopy } from "@/lib/plan-notice-copy";

/**
 * Avisos do espaco no sino, acima dos lembretes dos alunos (doc product/25, "Avisos do espaço no sino"):
 * o plano e o WhatsApp oficial. Somem quando resolvidos; nao
 * tem "adiar" nem "nao lembrar".
 */
export interface BellAlert {
  key: string;
  kind: "plan" | "messages" | "documents" | "payments";
  title: string;
  text: string;
  /** Nivel (doc product/25, "Níveis, urgência e novos lembretes"): info so conta; warning pulsa; danger pulsa e fica fixo no topo. */
  tone: "info" | "warning" | "danger";
  href: string;
  action: string;
  /** Urgente: tambem no aviso fixo do topo ate resolver. */
  pinned?: boolean;
  /** Afeta o funcionamento do espaco: modal uma vez por item (dono e gerente). */
  modal?: boolean;
}

/**
 * Plano: renova logo (Pix), pagamento pendente e assinatura encerrada. Os de
 * plano caindo ficam no aviso fixo do topo (`isPinnedPlanNotice`), nao aqui.
 */
export function planBellAlert(subscription: Subscription | undefined, today: string): BellAlert | null {
  const notice = planNoticeFor(subscription, today);
  if (!notice || !subscription || isPinnedPlanNotice(notice)) return null;
  const tier = subscription.closedFrom?.tier ?? subscription.tier;
  const copy = planNoticeCopy(notice, subscriptionTierLabel(tier));
  const closed = notice.kind === "closed";
  return {
    key: `plan:${notice.renewsOn}:${notice.kind}`,
    kind: "plan",
    title: copy.title,
    text: copy.text,
    tone: copy.tone,
    href: closed ? "/plans" : PLAN_SETTINGS_HREF,
    action: closed ? "Ver os planos" : "Ver o plano",
  };
}

/**
 * Alerta no sino para quem assinou o Pro ou superior mas ainda não conectou o
 * WhatsApp oficial da Meta ao número do seu espaço.
 */
export function whatsappPendingConnectionBellAlert(connection: WhatsAppConnectionView | undefined): BellAlert | null {
  if (!connection?.canUseOfficial || connection.officialStatus === "connected") return null;
  return {
    key: "messages:official:not_connected",
    kind: "messages",
    title: "Ative o WhatsApp oficial",
    text: "Conecte o número do seu espaço para liberar o envio 100% automático de mensagens.",
    tone: "info",
    href: "/communication?tab=connection",
    action: "Conectar",
  };
}

/**
 * Situacao na Meta (doc technical/07 §1.6): com o numero conectado e a Meta
 * bloqueando as mensagens iniciadas pelo espaco. Falta de pagamento e urgente
 * (fica no topo ate resolver): os lembretes automaticos param de sair.
 */
export function metaHealthBellAlert(connection: WhatsAppConnectionView | undefined): BellAlert | null {
  const health = connection?.metaHealth;
  if (!connection?.canUseOfficial || connection.officialStatus !== "connected" || !health) return null;
  const base = { kind: "messages" as const, href: "/communication?tab=connection", action: "Ver" };
  if (health.paymentBlocked) {
    return {
      ...base,
      key: "messages:meta:payment",
      title: "WhatsApp automático bloqueado pela Meta",
      text: "Cadastre um cartão na sua conta do WhatsApp na Meta.",
      tone: "danger",
      pinned: true,
      modal: true,
    };
  }
  if (health.sendState === "blocked") {
    return {
      ...base,
      key: "messages:meta:blocked",
      title: "WhatsApp automático bloqueado pela Meta",
      text: "As mensagens automáticas não estão saindo. Veja o motivo.",
      tone: "warning",
    };
  }
  return null;
}

/** Avisos de documento no sino: no maximo 5, o mais urgente primeiro. */
export const MAX_DOCUMENT_BELL_ALERTS = 5;

/**
 * Documento da ficha vencendo (30 dias) ou vencido (doc product/28): atestado,
 * registro profissional. Abre a ficha do aluno na secao Documentos, ou a
 * Equipe. Some quando o documento novo e anexado.
 */
export function documentBellAlerts(documents: ExpiringPersonDocument[] | undefined): BellAlert[] {
  return (documents ?? []).slice(0, MAX_DOCUMENT_BELL_ALERTS).map((doc) => {
    const when = documentExpiryText(doc.daysToExpire) ?? "";
    // Documento de saude vencido de aluno ativo: urgente (fica fixo no topo); os demais, atencao.
    const healthExpired = doc.expiry === "expired" && doc.ownerKind === "client" && isHealthDocumentKind(doc.kind);
    return {
      key: `document:${doc.id}:${doc.expiry}`,
      kind: "documents",
      title: `${doc.label} de ${doc.ownerName}`,
      text: `${when} (${formatDate(doc.expiresOn)}).`,
      tone: healthExpired ? "danger" : "warning",
      href: doc.ownerKind === "client" ? `/clients/${doc.ownerId}?tab=documents` : "/team",
      action: "Ver",
      ...(healthExpired ? { pinned: true } : {}),
    };
  });
}

export const DISPUTE_TITLE: Record<NonNullable<OnlinePayment["disputeStatus"]>, string> = {
  refund_in_progress: "Estorno em andamento",
  refunded: "Pagamento estornado",
  chargeback_requested: "Contestação de pagamento",
  chargeback_dispute: "Contestação em disputa",
  chargeback_reversal_pending: "Reversão de contestação pendente",
};

/** O que o aviso precisa da cobranca: o aluno e o mes (para abrir em Cobrancas). */
export interface DisputedChargeInfo {
  studentName?: string;
  competence?: string;
}

/**
 * Estorno ou contestacao avisados pelo parceiro (doc product/25, urgencia): a
 * cobranca continua paga no app; o dono decide. Urgente: sino, topo e modal.
 * Estorno (26/11/2026, doc product/15 "Estorno de pagamento"): "Resolver"
 * abre a cobranca em Cobrancas para reabrir ou encerrar; resolvido, some.
 */
export function disputeBellAlerts(
  payments: OnlinePayment[] | undefined,
  chargeOf: (chargeId: string) => DisputedChargeInfo | undefined,
): BellAlert[] {
  return (payments ?? [])
    // Estorno ja resolvido na cobranca (devolvido pelo app ou decidido no "Resolver agora"): some.
    .filter((p) => p.disputeStatus && !(p.refundHandledAt && isRefundDispute(p.disputeStatus)))
    .sort((a, b) => (b.disputedAt ?? "").localeCompare(a.disputedAt ?? ""))
    .map((p) => {
      const status = p.disputeStatus as NonNullable<OnlinePayment["disputeStatus"]>;
      const charge = chargeOf(p.chargeId);
      const who = charge?.studentName;
      const base = {
        key: `dispute:${p.id}:${status}`,
        kind: "payments" as const,
        title: `${DISPUTE_TITLE[status]}${who ? ` · ${who}` : ""}`,
        tone: "danger" as const,
        pinned: true,
        modal: true,
      };
      if (isRefundDispute(status)) {
        const query = new URLSearchParams({ status: "all", refund: p.chargeId });
        if (charge?.competence) query.set("month", charge.competence);
        return {
          ...base,
          text: `${formatCents(p.amountCents)} estornados ao aluno pelo parceiro. Reabra a cobrança ou encerre como estornada.`,
          href: `/classes/billing?${query.toString()}`,
          action: "Resolver",
        };
      }
      return {
        ...base,
        text: `${formatCents(p.amountCents)}. A cobrança continua paga no GestaraHub; veja com o parceiro e decida o que fazer.`,
        href: "/online-payments",
        action: "Ver recebimentos",
      };
    });
}

function isRefundDispute(status: NonNullable<OnlinePayment["disputeStatus"]>): boolean {
  return status === "refunded" || status === "refund_in_progress";
}

/**
 * Pagamento online recusado ou bloqueado pelo parceiro (doc product/25, urgencia):
 * os alunos deixam de conseguir pagar pelo Pix e pelo link.
 */
type OnlinePaymentsSettings = NonNullable<NonNullable<Organization["settings"]>["onlinePayments"]>;

export function gatewayRejectedBellAlert(settings: OnlinePaymentsSettings | undefined): BellAlert | null {
  if (!settings?.enabled || settings.gatewayStatus !== "rejected") return null;
  return {
    key: "payments:gateway:rejected",
    kind: "payments",
    title: "Pagamento online recusado pelo parceiro",
    text: "Os alunos não conseguem pagar pelo Pix ou pelo link até você regularizar a conta.",
    tone: "danger",
    href: "/online-payments",
    action: "Ver recebimentos",
    pinned: true,
    modal: true,
  };
}
