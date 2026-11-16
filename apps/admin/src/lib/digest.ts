import {
  EMAIL_ICON_VERSION,
  hostedEmailAssetUrl,
  renderOpsAlertEmail,
  type EmailIconState,
  type OpsAlertTone,
} from "@gestarahub/core/email-layouts";
import { slaFor, SLA_LABEL, type SlaState } from "./sla";

/**
 * Resumo diario do suporte para quem atende (em vez de um aviso por mensagem).
 * Puro: recebe as conversas que esperam resposta e devolve assunto, texto e HTML.
 */
export interface DigestThread {
  subject: string;
  organizationName: string;
  userName: string;
  urgent: boolean;
  since: Date;
}

const SLA_BADGE_TONE: Record<SlaState, OpsAlertTone> = {
  late: "danger",
  last_day: "warning",
  ok: "info",
};

export function buildDigest(input: {
  threads: DigestThread[];
  waitingCustomer: number;
  now: Date;
  panelUrl: string;
  icon?: EmailIconState;
}): { subject: string; text: string; html: string } | null {
  const { threads, waitingCustomer, now, panelUrl, icon } = input;
  if (threads.length === 0) return null;
  const rows = threads
    .map((thread) => ({ thread, sla: slaFor(thread.since, now) }))
    .sort((a, b) => Number(b.thread.urgent) - Number(a.thread.urgent) || a.thread.since.getTime() - b.thread.since.getTime());
  const late = rows.filter((row) => row.sla.state === "late").length;
  const urgent = rows.filter((row) => row.thread.urgent).length;
  const subject = `Suporte GestaraHub: ${threads.length} ${threads.length === 1 ? "conversa espera" : "conversas esperam"} resposta${late > 0 ? ` (${late} atrasada${late > 1 ? "s" : ""})` : ""}`;
  const lines = rows.slice(0, 15).map(({ thread, sla }) => {
    const due = sla.dueOn.split("-").reverse().join("/");
    return `- ${thread.urgent ? "[URGENTE] " : ""}${thread.subject} · ${thread.organizationName} (${thread.userName}) · ${SLA_LABEL[sla.state]}, prazo ${due}`;
  });
  const text = [
    `${threads.length} ${threads.length === 1 ? "conversa espera" : "conversas esperam"} resposta${urgent > 0 ? `, ${urgent} urgente${urgent > 1 ? "s" : ""}` : ""}.`,
    waitingCustomer > 0 ? `${waitingCustomer} aguardando o cliente.` : "",
    "",
    ...lines,
    rows.length > 15 ? `... e mais ${rows.length - 15}.` : "",
    "",
    `Abra o painel: ${panelUrl}/support`,
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");

  const summaryParts = [
    urgent > 0 ? `${urgent} urgente${urgent > 1 ? "s" : ""}` : "",
    late > 0 ? `${late} atrasada${late > 1 ? "s" : ""}` : "",
    waitingCustomer > 0 ? `${waitingCustomer} aguardando o cliente` : "",
  ].filter(Boolean);

  const html = renderOpsAlertEmail({
    tone: late > 0 || urgent > 0 ? "danger" : "info",
    sectionLabel: "Suporte",
    badge: "RESUMO DIÁRIO",
    title: `${threads.length} ${threads.length === 1 ? "conversa espera" : "conversas esperam"} resposta`,
    subtitle: summaryParts.join(" · ") || "Fila de atendimento do GestaraHub",
    items: rows.slice(0, 15).map(({ thread, sla }) => {
      const due = sla.dueOn.split("-").reverse().join("/");
      return {
        badge: thread.urgent
          ? { text: "Urgente", tone: "danger" }
          : { text: SLA_LABEL[sla.state], tone: SLA_BADGE_TONE[sla.state] },
        title: thread.subject,
        meta: `${thread.organizationName} (${thread.userName}) · ${SLA_LABEL[sla.state]}, prazo ${due}`,
      };
    }),
    overflowNote: rows.length > 15 ? `... e mais ${rows.length - 15} conversa(s).` : undefined,
    action: {
      label: "Abrir fila no painel",
      href: `${panelUrl.replace(/\/+$/, "")}/support`,
    },
    footer: "GestaraHub · Resumo diário de suporte",
    icon: icon ?? {
      hasInlineIcon: false,
      hostedIconUrl: hostedEmailAssetUrl(panelUrl, "email-icon.png", EMAIL_ICON_VERSION),
    },
  });

  return { subject, text, html };
}
