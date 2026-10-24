import { slaFor, SLA_LABEL } from "./sla";

/**
 * Resumo diario do suporte para quem atende (em vez de um aviso por mensagem).
 * Puro: recebe as conversas que esperam resposta e devolve o texto do e-mail.
 */
export interface DigestThread {
  subject: string;
  organizationName: string;
  userName: string;
  urgent: boolean;
  since: Date;
}

export function buildDigest(input: { threads: DigestThread[]; waitingCustomer: number; now: Date; panelUrl: string }): { subject: string; text: string } | null {
  const { threads, waitingCustomer, now, panelUrl } = input;
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
  return { subject, text };
}
