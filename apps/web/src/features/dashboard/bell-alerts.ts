import type { ExpiringPersonDocument, Subscription, WhatsAppConnectionView } from "@gestarahub/contracts";
import { formatDate, plural } from "@gestarahub/core/format";
import { documentExpiryText } from "@gestarahub/core/person-documents";
import { planNoticeFor } from "@gestarahub/core/subscription-plan";
import { PLAN_SETTINGS_HREF } from "@/components/shared/feature-locked";
import { subscriptionTierLabel } from "@/lib/labels";
import { isPinnedPlanNotice, planNoticeCopy } from "@/lib/plan-notice-copy";

/**
 * Avisos do espaco no sino, acima dos lembretes dos alunos (doc product/25, "Avisos do espaço no sino"):
 * o plano e a franquia de mensagens automaticas. Somem quando resolvidos; nao
 * tem "adiar" nem "nao lembrar".
 */
export interface BellAlert {
  key: string;
  kind: "plan" | "messages" | "documents";
  title: string;
  text: string;
  tone: "info" | "warning" | "danger";
  href: string;
  action: string;
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

/** Restando 20% ou menos da franquia do ciclo, o sino avisa. */
const QUOTA_LOW_SHARE = 0.2;

/**
 * Franquia de mensagens automaticas (doc technical/07 §1.2): acabando ou
 * acabou. So com o envio automatico ligado e saindo de verdade.
 */
export function quotaBellAlert(connection: WhatsAppConnectionView | undefined): BellAlert | null {
  if (!connection?.canUseOfficial || !connection.officialAvailable || connection.officialStatus !== "connected") return null;
  const { used, included, cycleStart } = connection.monthlyQuota;
  if (included <= 0) return null;
  const left = Math.max(0, included - used);
  const out = connection.isQuotaExhausted || left === 0;
  if (!out && left > included * QUOTA_LOW_SHARE) return null;
  const base = { kind: "messages" as const, href: "/communication?tab=connection", action: "Ver" };
  if (out) {
    return {
      ...base,
      key: `messages:${cycleStart ?? ""}:out`,
      title: "As mensagens automáticas do ciclo acabaram",
      text: "Até renovar, as mensagens saem com 1 toque.",
      tone: "warning",
    };
  }
  return {
    ...base,
    key: `messages:${cycleStart ?? ""}:low`,
    title: `${left === 1 ? "Resta" : "Restam"} ${plural(left, "mensagem automática", "mensagens automáticas")} no ciclo`,
    text: `${used} de ${included} usadas.`,
    tone: "info",
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
    return {
      key: `document:${doc.id}:${doc.expiry}`,
      kind: "documents",
      title: `${doc.label} de ${doc.ownerName}`,
      text: `${when} (${formatDate(doc.expiresOn)}).`,
      tone: doc.expiry === "expired" ? "danger" : "warning",
      href: doc.ownerKind === "client" ? `/clients/${doc.ownerId}?tab=documents` : "/team",
      action: "Ver",
    };
  });
}
